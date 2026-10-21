import io
import json
import os
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from discovery import pe_architecture, automatic_selection, guided_selection
from bridge import main


def inventory(drivers=None, ports=None):
    return {'platform':'Windows','pythonBits':64,'pythonArchitecture':'x64',
        'j2534':drivers or [],'serial':ports or [],'warnings':[],'hardwareValidated':False}


class DiscoveryTests(unittest.TestCase):
    def test_driver_header_inspection_is_bounded_and_recognizes_architecture(self):
        with tempfile.TemporaryDirectory() as directory:
            dll=Path(directory)/'fixture.dll'
            for machine,expected in ((0x014c,'x86'),(0x8664,'x64'),(0xaa64,'arm64')):
                header=bytearray(128);header[:2]=b'MZ';struct.pack_into('<I',header,60,64)
                header[64:68]=b'PE\x00\x00';struct.pack_into('<H',header,68,machine)
                dll.write_bytes(header);self.assertEqual(pe_architecture(dll),expected)
            struct.pack_into('<I',header,60,0xffffffff);dll.write_bytes(header)
            self.assertIsNone(pe_architecture(dll))
            dll.write_bytes(b'not a DLL');self.assertIsNone(pe_architecture(dll))
            self.assertIsNone(pe_architecture(Path(directory)/'missing.dll'))

    def test_automatic_selection_prioritizes_one_compatible_j2534_and_refuses_ambiguity(self):
        driver={'compatible':True,'dll':'fixture.dll','name':'Fixture'}
        self.assertEqual(automatic_selection(inventory([driver])),{'j2534_dll':'fixture.dll'})
        with self.assertRaisesRegex(ValueError,'Multiple'):
            automatic_selection(inventory([driver,{**driver,'dll':'other.dll'}]))
        with self.assertRaisesRegex(ValueError,'none match'):
            automatic_selection(inventory([{**driver,'compatible':False}], [{'port':'COM1','obdCandidate':True}]))
        with self.assertRaisesRegex(ValueError,'No unique'):
            automatic_selection(inventory(ports=[{'port':'COM1','obdCandidate':False}]))
        self.assertEqual(automatic_selection(inventory(ports=[{'port':'COM1','obdCandidate':True}])),{'serial':'COM1'})

    def test_guided_setup_allows_unknown_serial_and_tcp_without_inventing_endpoint(self):
        answers=iter(['1','COM7','115200','y'])
        self.assertEqual(guided_selection(inventory(),lambda _:next(answers),lambda _:None),
            {'serial':'COM7','baud':115200,'bluetooth_spp':True})
        answers=iter(['2','192.168.7.1:35000'])
        self.assertEqual(guided_selection(inventory(),lambda _:next(answers),lambda _:None),{'tcp':'192.168.7.1:35000'})
        with self.assertRaises(ValueError):guided_selection(inventory(),lambda _:'99',lambda _:None)

    def test_discover_needs_neither_cloud_credential_nor_device_open(self):
        with patch('bridge.discover',return_value=inventory()), patch('bridge.getpass.getpass',side_effect=AssertionError('must not request credentials')), patch('sys.stdout',new_callable=io.StringIO) as output:
            self.assertEqual(main(['--discover']),0)
            self.assertFalse(json.loads(output.getvalue())['hardwareValidated'])

    def test_auto_runs_existing_adapter_and_scan_path(self):
        class Adapter:
            protocol='fixture';version='fixture'
            def close(self):pass
        with patch('bridge.discover',return_value=inventory([{'compatible':True,'dll':'fixture.dll'}])), patch('bridge.J2534',return_value=Adapter()) as driver, patch('bridge.Uplink') as uplink, patch('bridge.scan') as scan, patch.dict(os.environ,{'MICROFIXD_OBD_TOKEN':'SYNTHETIC-TEST-TOKEN'}), patch('sys.stdout',new_callable=io.StringIO):
            self.assertEqual(main(['--auto','--server','https://example.com','--once']),0)
            driver.assert_called_once_with('fixture.dll',(0x10,0x18))
            uplink.return_value.create.assert_called_once_with('j2534','Local vehicle adapter')
            scan.assert_called_once()


if __name__=='__main__':unittest.main()
