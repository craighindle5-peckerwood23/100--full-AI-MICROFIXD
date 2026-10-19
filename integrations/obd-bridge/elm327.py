"""Prompt-framed ELM327 transport. No raw-command or vehicle-write API."""
import re
import socket
import time

READ_COMMANDS = frozenset(('0100','0120','0140','0160','0101','0104','0105','0106','0107','010B','010C','010D','010F','0110','0111','0142','03','07','0A','0902'))


def require_read(command):
    if command not in READ_COMMANDS:
        raise ValueError('Only fixed read-only OBD queries are permitted')


def decode_elm_reply(command, reply):
    """ELM CAF1/H0 output: separate single replies, numbered long replies.

    H0 intentionally loses ECU identity. Never invent an ECU identifier.
    Ambiguous/interleaved multi-ECU long replies are rejected.
    """
    require_read(command)
    if any(x in reply.upper() for x in ('NO DATA', 'UNABLE TO CONNECT', 'CAN ERROR', 'BUS ERROR', 'STOPPED', 'BUFFER FULL', '?')):
        return []
    rows, numbered, expected_index = [], [], 0
    for line in reply.upper().replace('>', '').replace('\n', '\r').split('\r'):
        line = line.strip().replace(' ', '')
        if not line or line == command or line.startswith(('SEARCHING', 'BUSINIT')):
            continue
        if re.fullmatch(r'[0-9A-F]{3}', line):  # Long response byte-count line.
            continue
        match = re.fullmatch(r'([0-9A-F]+):([0-9A-F]+)', line)
        if match:
            index = int(match.group(1), 16)
            if index != expected_index:
                raise ValueError('Ambiguous or incomplete ELM multi-frame reply')
            numbered.append(match.group(2))
            expected_index += 1
        elif re.fullmatch(r'(?:[0-9A-F]{2})+', line):
            rows.append(line)
    if numbered:
        if rows:
            raise ValueError('Mixed ELM response formats')
        rows = [''.join(numbered)]
    expected = int(command[:2], 16) + 0x40
    return [{'command': command, 'payload': row} for row in rows
            if bytes.fromhex(row)[0] == expected]


class ELM327:
    def __init__(self, stream):
        self.stream = stream
        self.version = ''
        self.protocol = 'unknown'
        self.carry = b''

    def _exchange(self, command, timeout=8):
        self.stream.write((command + '\r').encode('ascii'))
        deadline = time.monotonic() + timeout
        received = self.carry
        while b'>' not in received:
            if time.monotonic() > deadline:
                self.close()  # Never re-use a stream with late, uncorrelated responses.
                raise TimeoutError('ELM prompt timeout; adapter closed')
            part = self.stream.read(512)
            received += part
            if len(received) > 32768:
                self.close()
                raise ValueError('ELM response limit exceeded')
        response, self.carry = received.split(b'>', 1)
        return response.decode('ascii', errors='replace')

    def open(self):
        self.version = self._exchange('ATZ').strip()[:200]
        if not self.version or '?' in self.version:
            raise RuntimeError('ELM adapter identification failed')
        for command in ('ATE0','ATL0','ATS0','ATH0','ATSP0','ATCAF1'):
            result = self._exchange(command)
            if 'OK' not in result.upper():
                raise RuntimeError('ELM initialization failed: ' + command)
        probe = self.query('0100')
        if not any(r['payload'].startswith('4100') and len(r['payload']) >= 12 for r in probe):
            raise RuntimeError('Vehicle did not answer supported-PID query; check ignition')
        self.protocol = self._exchange('ATDPN').strip()[:100]
        return probe

    def query(self, command):
        require_read(command)
        return decode_elm_reply(command, self._exchange(command))

    def close(self):
        self.stream.close()


class TCPStream:
    def __init__(self, host, port):
        self.socket = socket.create_connection((host, port), timeout=5)
        self.socket.settimeout(.5)

    def read(self, size):
        try:
            data = self.socket.recv(size)
        except socket.timeout:
            return b''
        if not data:
            raise ConnectionError('OBD TCP peer disconnected')
        return data

    def write(self, data):
        self.socket.sendall(data)

    def close(self):
        self.socket.close()


def serial_stream(port, baud):
    try:
        import serial
    except ImportError as error:
        raise RuntimeError('Serial transport requires pyserial==3.5') from error
    # Classic Bluetooth SPP must already be paired and exposed as a COM/rfcomm port.
    return serial.Serial(port, baudrate=baud, timeout=.5, write_timeout=2)
