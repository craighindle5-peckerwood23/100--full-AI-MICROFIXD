#!/usr/bin/env python3
"""Outbound-only local adapter bridge for Microfixd. Python 3.10+."""
import argparse
import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from elm327 import ELM327, TCPStream, serial_stream
from j2534 import J2534, installed_devices
from discovery import discover, automatic_selection, guided_selection


def utcnow():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Server redirect refused; use the canonical HTTPS server URL')


class Uplink:
    def __init__(self, server, token):
        url = urllib.parse.urlsplit(server)
        if url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
            raise ValueError('Server must be a plain origin, without credentials or paths')
        if url.scheme != 'https' and not (url.scheme=='http' and url.hostname in ('127.0.0.1','localhost')):
            raise ValueError('Use HTTPS (HTTP is allowed only for local testing)')
        if not url.hostname or not token:
            raise ValueError('Server and authenticated operator credential required')
        self.server, self.token = server.rstrip('/'), token
        self.opener = urllib.request.build_opener(NoRedirect())
        self.session_id, self.sequence = None, 0

    def post(self, path, body):
        request = urllib.request.Request(self.server+'/api/automotive/obd'+path, data=json.dumps(body).encode(),
            headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'},method='POST')
        for attempt in range(3):
            try:
                with self.opener.open(request, timeout=15) as response:
                    return json.loads(response.read(2_000_000))
            except urllib.error.HTTPError as error:
                # Never print request headers, tokens or potentially sensitive server bodies.
                raise RuntimeError(f'Cloud rejected OBD upload: HTTP {error.code}') from None
            except (urllib.error.URLError, TimeoutError):
                if attempt==2:
                    raise RuntimeError('Cloud upload failed; no durable success confirmed') from None
                time.sleep(1)

    def create(self, adapter, label):
        session = self.post('/sessions', {'adapter':adapter,'label':label})
        self.session_id = session['id']
        return self.session_id

    def publish(self, adapter, responses, status='connected', errors=None):
        sample = {'sequence':self.sequence+1,'observedAt':utcnow(),'status':status,
            'protocol':adapter.protocol,'adapterVersion':adapter.version,
            'responses':responses,'errors':(errors or [])[:30]}
        result = self.post('/sessions/'+self.session_id+'/samples', sample)
        self.sequence = sample['sequence']
        print(json.dumps({'session':self.session_id,'sequence':self.sequence,'state':result['state'],
            'ecus':result.get('interpreted',{}).get('ecus',[])}), flush=True)
        return result


def supported_pids(responses):
    supported = set()
    for row in responses:
        command = row['command']
        if command not in ('0100','0120','0140','0160'):
            continue
        data = bytes.fromhex(row['payload'])
        if len(data)<6 or data[:2]!=bytes.fromhex('41'+command[2:]):
            continue
        base, mask = int(command[2:],16), int.from_bytes(data[2:6], 'big')
        for offset in range(1,33):
            if mask & (1 << (32-offset)):
                supported.add(base+offset)
    return supported


def collect_batch(adapter, commands):
    rows, errors = [], []
    for command in commands:
        try:
            response = adapter.query(command)
            rows.extend(response)
            if not response:
                errors.append(command+': no response (unsupported or unavailable)')
        except ValueError:
            errors.append(command+': malformed or ambiguous response')
    return rows, errors


def scan(adapter, uplink, once=False):
    probe = adapter.open()
    uplink.publish(adapter, probe)
    supported = supported_pids(probe)
    for command in ('0120','0140','0160'):
        if int(command[2:],16) in supported:
            rows, errors = collect_batch(adapter,[command])
            supported |= supported_pids(rows)
            uplink.publish(adapter, rows, errors=errors)
    # Keep every upload fresh: small batches bound the query-to-heartbeat delay.
    initial, errors = collect_batch(adapter,['0902','03','07','0A'])
    uplink.publish(adapter, initial, errors=errors)
    live = [command for command in ('0101','010C','0105','010D','0104','0106','0107','010B','010F','0110','0111','0142') if int(command[2:],16) in supported]
    if not live:
        live = ['0100']  # Heartbeat rechecks a real ECU, never fabricates zeros.
    misses, cycles = 0, 0
    while True:
        for index in range(0,len(live),3):
            rows, errors = collect_batch(adapter,live[index:index+3])
            misses = 0 if rows else misses+1
            uplink.publish(adapter,rows,status='connected' if rows else 'vehicle_not_responding',errors=errors)
            if misses>=3:
                raise RuntimeError('Vehicle stopped responding; ignition or connection may be lost')
        if once:
            return
        cycles += 1
        if cycles%3==0:
            rows, errors = collect_batch(adapter,['0902','03','07','0A'])
            uplink.publish(adapter,rows,status='connected' if rows else 'vehicle_not_responding',errors=errors)
        time.sleep(2)


def main(argv=None):
    parser = argparse.ArgumentParser(description='Microfixd read-only J2534/OBD hardware bridge')
    parser.add_argument('--discover',action='store_true',help='List local drivers, architecture compatibility and serial ports without connecting')
    parser.add_argument('--list-j2534',action='store_true',help='Enumerate installed Windows J2534-1 04.04 drivers')
    source = parser.add_mutually_exclusive_group()
    source.add_argument('--setup',action='store_true',help='Guided connection setup; no adapter model required')
    source.add_argument('--auto',action='store_true',help='Use one compatible registered J2534 driver, otherwise one identified OBD serial candidate')
    source.add_argument('--j2534-dll',help='Primary: absolute path to the installed vendor 04.04 DLL')
    source.add_argument('--serial',help='ELM327 USB serial or paired Bluetooth SPP COM/rfcomm port')
    source.add_argument('--tcp',help='ELM327 Wi-Fi adapter host:port')
    parser.add_argument('--bluetooth-spp',action='store_true',help='Label --serial as an OS-paired Bluetooth SPP adapter (not BLE)')
    parser.add_argument('--baud',type=int,default=38400)
    parser.add_argument('--ecu-addresses',default='10,18',help='29-bit CAN ECU source addresses in hex; max 8')
    parser.add_argument('--server',help='Microfixd canonical HTTPS origin')
    parser.add_argument('--label',default='Local vehicle adapter')
    parser.add_argument('--once',action='store_true',help='Perform discovery and one live-data sweep, then close')
    args = parser.parse_args(argv)
    if args.discover:
        print(json.dumps(discover(),indent=2))
        return 0
    if args.setup or args.auto:
        try:
            selection = guided_selection(discover()) if args.setup else automatic_selection(discover())
            for key,value in selection.items():
                setattr(args,key,value)
            if args.setup and not args.server:
                args.server = input('Microfixd server HTTPS origin: ').strip()
        except (ValueError,EOFError,KeyboardInterrupt) as error:
            print('Setup stopped: '+str(error),file=sys.stderr)
            return 2
    if args.list_j2534:
        print(json.dumps({'pythonBits':8*__import__('ctypes').sizeof(__import__('ctypes').c_void_p),'devices':installed_devices()},indent=2))
        return 0
    if not args.server or not any((args.j2534_dll,args.serial,args.tcp)):
        parser.error('--server and one adapter transport are required')
    if args.bluetooth_spp and not args.serial:
        parser.error('--bluetooth-spp requires --serial (an already paired SPP port)')
    if not 1<=args.baud<=2_000_000:
        parser.error('invalid serial baud rate')
    adapter, uplink = None, None
    try:
        token = os.environ.get('MICROFIXD_OBD_TOKEN') or getpass.getpass('Microfixd operator/access token: ')
        uplink = Uplink(args.server,token)
        if args.j2534_dll:
            adapter = J2534(args.j2534_dll, tuple(int(n,16) for n in args.ecu_addresses.split(',')))
            kind = 'j2534'
        elif args.serial:
            adapter = ELM327(serial_stream(args.serial,args.baud))
            kind = 'elm327_bluetooth_serial' if args.bluetooth_spp else 'elm327_serial'
        else:
            host,port = args.tcp.rsplit(':',1)
            port = int(port)
            if not 1<=port<=65535:
                raise ValueError('Invalid adapter TCP port')
            adapter = ELM327(TCPStream(host,port))
            kind = 'elm327_tcp'
        print('Session: '+uplink.create(kind,args.label), flush=True)
        scan(adapter,uplink,args.once)
        uplink.publish(adapter,[],status='disconnected')
        return 0
    except KeyboardInterrupt:
        if uplink and uplink.session_id and adapter:
            try:
                uplink.publish(adapter,[],status='disconnected')
            except Exception:
                pass
        return 130
    except Exception as error:
        # Known transport errors are useful; OS/vendor exceptions are sanitized.
        message = str(error) if isinstance(error,(RuntimeError,ValueError,TimeoutError)) else type(error).__name__
        print('Bridge stopped: '+message,file=sys.stderr)
        if uplink and uplink.session_id and adapter:
            try:
                uplink.publish(adapter,[],status='error',errors=['LOCAL_ADAPTER_OR_UPLOAD_FAILURE'])
            except Exception:
                pass
        return 1
    finally:
        if adapter:
            adapter.close()


if __name__=='__main__':
    sys.exit(main())
