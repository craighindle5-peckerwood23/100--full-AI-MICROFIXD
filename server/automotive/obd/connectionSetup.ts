/** Public software contract; it never implies access to a user's local hardware. */
export function obdConnectionSetup(){
 return {
  version:2,
  localBridgeRequired:true,
  discoveryCommand:['python','bridge.py','--discover'],
  guidedCommand:['python','bridge.py','--setup'],
  automaticCommand:['python','bridge.py','--auto'],
  packageEndpoint:'/api/automotive/obd/bridge-package',
  readinessEndpoint:'/api/automotive/obd/readiness',
  transports:[
   {id:'j2534',priority:1,supported:true,requirements:'Windows, installed J2534-1 04.04 vendor driver, matching Python/DLL CPU architecture',coverage:'Generic ISO15765 emissions CAN; 11/29-bit, 500/250 kbit profiles'},
   {id:'elm327_serial',priority:2,supported:true,requirements:'ELM327-compatible USB/serial interface and pyserial 3.5',coverage:'Adapter protocol auto-selection; supported generic OBD queries'},
   {id:'elm327_bluetooth_serial',priority:2,supported:true,requirements:'OS-paired Bluetooth Classic SPP exposed as a serial port and pyserial 3.5',coverage:'Same ELM327 generic OBD queries'},
   {id:'elm327_tcp',priority:2,supported:true,requirements:'ELM327-compatible TCP adapter and its actual host:port',coverage:'Same ELM327 generic OBD queries'},
   {id:'ble_gatt',supported:false,requirements:'Vendor-specific BLE/GATT transport is not implemented'},
  ],
  capabilities:{dtcs:true,vinWhenReported:true,supportedLivePids:true,diagnosticCases:true,arbitraryHardwareCommands:false,ecuProgramming:false,allOemModules:false,hardwareCompatibilityVerified:false},
  workflow:['Download and extract the connector','Run --setup or START-WINDOWS.cmd on the computer connected to the adapter','Select a detected driver/port or enter your TCP endpoint','Enter the Microfixd server origin and operator/access token when prompted','Return to Vehicle connection; confirm a fresh responding session','Select the exact vehicle profile and create a diagnostic case'],
  agentTools:['obd_connection_setup','list_obd_sessions','read_obd_status'],
  unknownHardware:'Device inventory is not proof of connection. Only a validated vehicle response establishes a responding session.',
 };
}
