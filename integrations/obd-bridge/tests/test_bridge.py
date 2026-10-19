import ctypes as C
import json
import socket
import threading
import unittest
from unittest.mock import patch
from elm327 import ELM327, TCPStream, decode_elm_reply, require_read
from j2534 import J2534, Message
from bridge import supported_pids, Uplink, scan


class Stream:
    def __init__(self, replies):
        self.replies = iter(replies)
        self.sent, self.closed = [], False
    def write(self, data): self.sent.append(data)
    def read(self, _size): return next(self.replies, b'')
    def close(self): self.closed = True


class Function:
    def __init__(self, fn): self.fn=fn
    def __call__(self,*args): return self.fn(*args)


class DLL:
    def __init__(self):
        self.sent, self.filters, self.events = [], [], []
        self.PassThruOpen=Function(self.open)
        self.PassThruClose=Function(lambda *_: self.events.append('close') or 0)
        self.PassThruConnect=Function(self.connect)
        self.PassThruDisconnect=Function(lambda *_: self.events.append('disconnect') or 0)
        self.PassThruStartMsgFilter=Function(self.filter)
        self.PassThruIoctl=Function(lambda *_: 0)
        self.PassThruWriteMsgs=Function(self.write)
        self.PassThruReadMsgs=Function(self.read)
        self.pending=False
    def open(self,_name,id): id._obj.value=1;return 0
    def connect(self,_device,_protocol,_flags,_baud,id): id._obj.value=2;return 0
    def filter(self,_channel,_type,mask,pattern,flow,id):
        self.filters.append((bytes(mask._obj.Data[:4]),bytes(pattern._obj.Data[:4]),bytes(flow._obj.Data[:4])));return 0
    def write(self,_channel,msg,count,_timeout):
        self.sent.append(bytes(msg._obj.Data[:msg._obj.DataSize]));self.pending=True;count._obj.value=1;return 0
    def read(self,_channel,messages,count,_timeout):
        if self.pending:
            self.pending=False
            # One full RX message, after a TX indication that must be ignored.
            messages[0]=J2534.message(0x7E8,bytes.fromhex('4100BE3EA813'));messages[0].RxStatus=1
            messages[1]=J2534.message(0x7E8,bytes.fromhex('4100BE3EA813'))
            count._obj.value=2;return 0
        count._obj.value=0;return 0x10


class BridgeTests(unittest.TestCase):
    def test_fixed_read_allowlist(self):
        for command in ('04','2E','2701','3101','ATSH7E0','ATSP00','010C\r04'):
            with self.assertRaises(ValueError): require_read(command)

    def test_elm_prompt_split_and_initialization(self):
        stream=Stream([b'ELM327 v2.3\r>',*[b'OK\r>']*6,b'SEARCHING...\r4100BE3EA813\r>',b'A6\r>'])
        adapter=ELM327(stream);rows=adapter.open()
        self.assertEqual(adapter.protocol,'A6');self.assertEqual(rows[0]['payload'],'4100BE3EA813')
        self.assertEqual(stream.sent[-2],b'0100\r');self.assertNotIn(b'04\r',stream.sent)

    def test_long_vin_and_multiple_ecu_replies(self):
        self.assertEqual(len(decode_elm_reply('010C','410C1AF8\r410C0000\r>')),2)
        long='014\r0:49020157424157\r1:42373335313950\r2:303437323430\r>'
        result=decode_elm_reply('0902',long)
        self.assertEqual(bytes.fromhex(result[0]['payload'])[3:].decode(),'WBAWB73519P047240')
        self.assertEqual(decode_elm_reply('03','NO DATA\r>'),[])
        with self.assertRaises(ValueError): decode_elm_reply('0902','0:490201\r2:414141')

    def test_pid_bitmap(self):
        self.assertIn(12,supported_pids([{'command':'0100','payload':'410000100000'}]))
        self.assertEqual(supported_pids([{'command':'0100','payload':'4100'}]),set())

    def test_j2534_abi_filters_and_actual_read_request(self):
        self.assertEqual(C.sizeof(Message),4152)
        dll=DLL();adapter=J2534(library=dll);rows=adapter.open()
        self.assertEqual(adapter.protocol,'ISO15765-11bit-500000')
        self.assertEqual(rows,[{'command':'0100','ecu':'7E8','payload':'4100BE3EA813'}])
        self.assertEqual(dll.sent,[bytes.fromhex('000007DF0100')])
        self.assertEqual(dll.filters[0],(b'\xff'*4,bytes.fromhex('000007E8'),bytes.fromhex('000007E0')))
        with self.assertRaises(ValueError):adapter.query('04')
        adapter.close();self.assertEqual(dll.events,['disconnect','close'])

    def test_tcp_real_socket_exchange(self):
        listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen()
        def serve():
            conn,_=listener.accept()
            with conn:
                self.assertEqual(conn.recv(64),b'010C\r');conn.sendall(b'410C1AF8\r>')
        worker=threading.Thread(target=serve);worker.start()
        stream=TCPStream('127.0.0.1',listener.getsockname()[1]);rows=ELM327(stream).query('010C');stream.close();worker.join();listener.close()
        self.assertEqual(rows[0]['payload'],'410C1AF8')

    def test_uplink_refuses_insecure_remote_and_embedded_credentials(self):
        for url in ('http://example.com','https://user:pass@example.com','https://example.com/path'):
            with self.assertRaises(ValueError):Uplink(url,'not-a-real-credential')

    def test_scan_queries_only_supported_pids_and_publishes_real_empty_results(self):
        class Adapter:
            protocol='A6';version='fixture'
            def open(self):return [{'command':'0100','payload':'410000100000'}]
            def query(self,command):
                self.calls.append(command)
                return [{'command':'010C','payload':'410C1AF8'}] if command=='010C' else []
            calls=[]
        class Upload:
            def publish(self,_adapter,rows,**kwargs):self.rows.append(rows)
            rows=[]
        adapter,upload=Adapter(),Upload();scan(adapter,upload,once=True)
        self.assertEqual(adapter.calls,['0902','03','07','0A','010C'])
        self.assertEqual(upload.rows[-1][0]['payload'],'410C1AF8')


if __name__=='__main__':unittest.main()
