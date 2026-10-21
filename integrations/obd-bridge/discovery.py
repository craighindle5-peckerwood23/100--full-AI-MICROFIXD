"""Local discovery and guided selection. Inventory never claims hardware connectivity."""
import ctypes
import os
import platform
import re
import struct
import sys
from pathlib import Path
from j2534 import installed_devices

MACHINES = {0x014C: 'x86', 0x8664: 'x64', 0xAA64: 'arm64'}


def pe_architecture(path):
    """Read the bounded PE header without loading or executing a vendor DLL."""
    try:
        with Path(path).open('rb') as stream:
            header = stream.read(64)
            if len(header) != 64 or header[:2] != b'MZ':
                return None
            offset = struct.unpack_from('<I', header, 60)[0]
            if not 64 <= offset <= 1_048_576:
                return None
            stream.seek(offset)
            signature = stream.read(6)
            if len(signature) != 6 or signature[:4] != b'PE\x00\x00':
                return None
            return MACHINES.get(struct.unpack_from('<H', signature, 4)[0])
    except (OSError, ValueError, TypeError):
        return None


def discover():
    bits = ctypes.sizeof(ctypes.c_void_p) * 8
    python_arch = pe_architecture(sys.executable) if os.name == 'nt' else platform.machine().lower()
    drivers, seen, warnings = [], set(), []
    for entry in installed_devices():
        path = os.path.expandvars(str(entry.get('dll', '')).strip().strip('"'))
        key = os.path.normcase(os.path.abspath(path))
        if key in seen:
            continue
        seen.add(key)
        exists = Path(path).is_file()
        arch = pe_architecture(path) if exists else None
        compatible = os.name == 'nt' and arch is not None and arch == python_arch
        reason = None if compatible else 'Driver DLL missing' if not exists else 'Unrecognized DLL architecture' if not arch else f'Requires {arch} Python; current process is {python_arch}'
        drivers.append({**entry, 'dll':path, 'architecture':arch, 'compatible':compatible, 'reason':reason})
    ports = []
    try:
        from serial.tools import list_ports
        for port in sorted(list_ports.comports(), key=lambda p: p.device):
            description = str(port.description or '')
            ports.append({'port':port.device, 'description':description,
                'obdCandidate':bool(re.search(r'\b(elm327|obd|obdlink|vlink|vgate)\b',description,re.I)),
                'hardwareValidated':False})
    except ImportError:
        warnings.append('Serial discovery needs: python -m pip install -r requirements.txt')
    except OSError:
        warnings.append('Serial inventory unavailable; check OS access and installed drivers')
    return {'platform':platform.system(),'pythonBits':bits,'pythonArchitecture':python_arch,
        'j2534':drivers,'serial':ports,'warnings':warnings,'hardwareValidated':False,
        'wifi':'Supply the adapter host:port; no network scanning is performed',
        'bluetooth':'Pair Classic SPP in the OS first; BLE/GATT is not supported'}


def automatic_selection(inventory):
    drivers = [d for d in inventory['j2534'] if d['compatible']]
    if len(drivers) == 1:
        return {'j2534_dll':drivers[0]['dll']}
    if len(drivers) > 1:
        raise ValueError('Multiple compatible J2534 drivers found. Run --setup to choose your adapter.')
    if inventory['j2534']:
        raise ValueError('J2534 drivers found but none match this Python process. Run --discover for architecture details.')
    ports = [p for p in inventory['serial'] if p['obdCandidate']]
    if len(ports) == 1:
        return {'serial':ports[0]['port']}
    raise ValueError('No unique OBD candidate found. Run --setup; inventory alone cannot identify every dongle.')


def guided_selection(inventory, ask=input, write=print):
    write(f"Local connector: {inventory['platform']}, {inventory['pythonBits']}-bit Python")
    choices = []
    for driver in inventory['j2534']:
        if driver['compatible']:
            choices.append(('J2534: '+driver['name'], {'j2534_dll':driver['dll']}))
        else:
            write(f"Unavailable J2534 driver: {driver['name']}: {driver['reason']}")
    for port in inventory['serial']:
        choices.append((f"Serial / paired Bluetooth: {port['port']} ({port['description']})", {'serial':port['port']}))
    for warning in inventory['warnings']:
        write(warning)
    choices.append(('Enter an ELM327 serial port manually', {'manual_serial':True}))
    choices.append(('ELM327 Wi-Fi / TCP adapter', {'manual_tcp':True}))
    for index,(label,_selection) in enumerate(choices,1):
        write(f'{index}. {label}')
    try:
        selected = int(ask('Select connection number: '))
    except ValueError:
        raise ValueError('Enter the numbered adapter selection') from None
    if not 1 <= selected <= len(choices):
        raise ValueError('Adapter selection is outside the displayed list')
    result = dict(choices[selected-1][1])
    if result.pop('manual_serial',False):
        result['serial'] = ask('OS serial port (COM or /dev path): ').strip()
        if not result['serial']:
            raise ValueError('A real OS serial port is required')
    if result.pop('manual_tcp',False):
        result['tcp'] = ask('Adapter host:port from its settings: ').strip()
        if not result['tcp']:
            raise ValueError('Adapter TCP address is required')
    if result.get('serial'):
        try:
            result['baud'] = int(ask('Serial baud rate [38400]: ').strip() or '38400')
        except ValueError:
            raise ValueError('Baud rate must be a number') from None
        result['bluetooth_spp'] = ask('Is this an OS-paired Bluetooth Classic SPP port? [y/N]: ').strip().lower() == 'y'
    return result
