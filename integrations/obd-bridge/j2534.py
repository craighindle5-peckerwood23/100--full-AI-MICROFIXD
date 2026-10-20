"""Windows J2534-1 04.04 ISO15765 generic OBD transport.

Uses the installed vendor DLL; Python process bitness must match the driver.
No programming voltage, security access, raw writes or flash API is exposed.
"""
import ctypes as C
import os
import time
from pathlib import Path
from elm327 import require_read

U32 = C.c_uint32
ISO15765 = 6
CAN_29BIT_ID = 0x100
FRAME_PAD = 0x40
FLOW_CONTROL_FILTER = 3
ERR_TIMEOUT, ERR_BUFFER_EMPTY = 0x09, 0x10


class Message(C.Structure):
    _fields_ = [(name, U32) for name in ('ProtocolID','RxStatus','TxFlags','Timestamp','DataSize','ExtraDataIndex')] + [('Data', C.c_ubyte * 4128)]


def installed_devices():
    if os.name != 'nt':
        return []
    import winreg
    result = []
    for view in (winreg.KEY_WOW64_32KEY, winreg.KEY_WOW64_64KEY):
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\PassThruSupport.04.04', 0, winreg.KEY_READ | view) as root:
                for i in range(winreg.QueryInfoKey(root)[0]):
                    with winreg.OpenKey(root, winreg.EnumKey(root, i)) as entry:
                        result.append({'name':winreg.QueryValueEx(entry,'Name')[0], 'dll':winreg.QueryValueEx(entry,'FunctionLibrary')[0], 'registryView':32 if view==winreg.KEY_WOW64_32KEY else 64})
        except OSError:
            pass
    return result


class J2534:
    def __init__(self, dll_path=None, ecu_addresses=(0x10, 0x18), library=None):
        if library is None:
            if os.name != 'nt':
                raise RuntimeError('J2534 bridge needs Windows and the vendor 04.04 driver')
            path = Path(dll_path or '').resolve(strict=True)
            if path.suffix.lower() != '.dll':
                raise ValueError('Select an installed vendor DLL')
            library = C.WinDLL(str(path))
        self.dll = library
        self.device, self.channel = U32(), U32()
        self.opened, self.connected = False, False
        self.flags, self.protocol, self.version = 0, 'unknown', 'J2534-1 04.04'
        self.ecu_addresses = tuple(ecu_addresses)
        if not self.ecu_addresses or len(self.ecu_addresses)>8 or any(not 0<=n<=255 for n in self.ecu_addresses):
            raise ValueError('Provide 1 to 8 29-bit ECU source addresses')
        ptr = C.POINTER
        signatures = {
            'PassThruOpen':[C.c_void_p,ptr(U32)],
            'PassThruClose':[U32],
            'PassThruConnect':[U32,U32,U32,U32,ptr(U32)],
            'PassThruDisconnect':[U32],
            'PassThruReadMsgs':[U32,ptr(Message),ptr(U32),U32],
            'PassThruWriteMsgs':[U32,ptr(Message),ptr(U32),U32],
            'PassThruStartMsgFilter':[U32,U32,ptr(Message),ptr(Message),ptr(Message),ptr(U32)],
            'PassThruIoctl':[U32,U32,C.c_void_p,C.c_void_p],
        }
        for name,args in signatures.items():
            function = getattr(self.dll,name)
            function.argtypes, function.restype = args, C.c_int32

    @staticmethod
    def message(header, payload=b'', flags=0):
        msg = Message()
        data = header.to_bytes(4,'big') + payload
        msg.ProtocolID, msg.TxFlags, msg.DataSize = ISO15765, flags, len(data)
        msg.Data[:len(data)] = data
        return msg

    @staticmethod
    def check(status, operation):
        if status != 0:
            raise RuntimeError(f'{operation} failed with J2534 status 0x{status:02X}')

    def open(self):
        try:
            self.check(self.dll.PassThruOpen(None,C.byref(self.device)), 'PassThruOpen')
            self.opened = True
            # Probe standard generic emissions CAN configurations. No baud/pin assumptions
            # are promoted to a connection until an actual 41 00 response arrives.
            for flags,baud in ((0,500000),(0,250000),(CAN_29BIT_ID,500000),(CAN_29BIT_ID,250000)):
                self.flags = flags
                status = self.dll.PassThruConnect(self.device,ISO15765,flags,baud,C.byref(self.channel))
                if status:
                    continue
                self.connected = True
                try:
                    pairs = [(0x7E8+i,0x7E0+i) for i in range(8)] if not flags else [(0x18DAF100|address,0x18DA0000|(address<<8)|0xF1) for address in self.ecu_addresses]
                    for receive,transmit in pairs:
                        mask = self.message(0xFFFFFFFF,flags=flags)
                        pattern = self.message(receive,flags=flags)
                        flow = self.message(transmit,flags=flags)
                        filter_id = U32()
                        self.check(self.dll.PassThruStartMsgFilter(self.channel,FLOW_CONTROL_FILTER,C.byref(mask),C.byref(pattern),C.byref(flow),C.byref(filter_id)), 'PassThruStartMsgFilter')
                    probe = self.query('0100')
                    if any(r['payload'].startswith('4100') and len(r['payload'])>=12 for r in probe):
                        self.protocol = f'ISO15765-{29 if flags else 11}bit-{baud}'
                        return probe
                except RuntimeError:
                    pass
                self.check(self.dll.PassThruDisconnect(self.channel),'PassThruDisconnect')
                self.connected = False
            raise RuntimeError('No generic ISO15765 OBD response; legacy K-line/J1850 and other ECU addresses need a separate validated profile')
        except BaseException:
            self.close()
            raise

    def query(self, command):
        require_read(command)
        if not self.connected:
            raise RuntimeError('J2534 channel is closed')
        self.check(self.dll.PassThruIoctl(self.channel,8,None,None),'CLEAR_RX_BUFFER')
        header = 0x18DB33F1 if self.flags else 0x7DF
        msg = self.message(header,bytes.fromhex(command),self.flags|FRAME_PAD)
        count = U32(1)
        self.check(self.dll.PassThruWriteMsgs(self.channel,C.byref(msg),C.byref(count),1000),'PassThruWriteMsgs')
        if count.value != 1:
            raise RuntimeError('J2534 request was not transmitted')
        deadline,rows = time.monotonic()+2,[]
        while time.monotonic()<deadline and len(rows)<32:
            messages = (Message*16)()
            count = U32(16)
            status = self.dll.PassThruReadMsgs(self.channel,messages,C.byref(count),200)
            if status not in (0,ERR_TIMEOUT,ERR_BUFFER_EMPTY):
                self.check(status,'PassThruReadMsgs')
            if count.value>16:
                raise RuntimeError('J2534 returned invalid message count')
            for message in list(messages)[:count.value]:
                # Ignore TX confirmations, start-of-message and padding-error indications.
                if message.ProtocolID!=ISO15765 or message.RxStatus & 0x1B or not 5<=message.DataSize<=4128:
                    continue
                end = message.ExtraDataIndex or message.DataSize
                if not 5<=end<=message.DataSize:
                    continue
                data = bytes(message.Data[:end])
                if data[4] != int(command[:2],16)+0x40:
                    continue
                if command.startswith(('01','09')) and (len(data)<6 or data[5]!=int(command[2:4],16)):
                    continue
                rows.append({'command':command,'ecu':f'{int.from_bytes(data[:4],"big"):X}','payload':data[4:].hex().upper()})
            if rows and status in (ERR_TIMEOUT,ERR_BUFFER_EMPTY):
                break
        return rows

    def close(self):
        try:
            if self.connected:
                self.dll.PassThruDisconnect(self.channel)
        finally:
            self.connected = False
            if self.opened:
                self.dll.PassThruClose(self.device)
            self.opened = False
