import type {OBDSample,OBDSession} from './schema';
const dtc=(a:number,b:number)=>'PBCU'[a>>6]+((a>>4)&3).toString()+(a&15).toString(16).toUpperCase()+b.toString(16).padStart(2,'0').toUpperCase();
const metrics:Record<string,{name:string;unit:string;size:number;value:(b:number[])=>number}>={
 '04':{name:'load',unit:'%',size:1,value:b=>b[0]*100/255},'05':{name:'coolant',unit:'°C',size:1,value:b=>b[0]-40},
 '06':{name:'shortTermFuelTrimBank1',unit:'%',size:1,value:b=>(b[0]-128)*100/128},'07':{name:'longTermFuelTrimBank1',unit:'%',size:1,value:b=>(b[0]-128)*100/128},
 '0B':{name:'manifoldPressure',unit:'kPa',size:1,value:b=>b[0]},'0C':{name:'rpm',unit:'rpm',size:2,value:b=>(b[0]*256+b[1])/4},
 '0D':{name:'speed',unit:'km/h',size:1,value:b=>b[0]},'0F':{name:'intakeTemperature',unit:'°C',size:1,value:b=>b[0]-40},
 '10':{name:'airflow',unit:'g/s',size:2,value:b=>(b[0]*256+b[1])/100},'11':{name:'throttle',unit:'%',size:1,value:b=>b[0]*100/255},
 '42':{name:'controlModuleVoltage',unit:'V',size:2,value:b=>(b[0]*256+b[1])/1000},
};
export function interpretSample(sample:OBDSample){
 const readings:{ecu:string;name:string;value:number;unit:string}[]=[],codes:{ecu:string;kind:string;code:string}[]=[],vins=new Set<string>(),ecus=new Set<string>(),invalid:string[]=[];
 let validResponses=0;const monitors:{ecu:string;mil:boolean;reportedDTCCount:number}[]=[];
 for(const r of sample.responses){
  const b=r.payload.match(/../g)?.map(x=>parseInt(x,16))??[],ecu=r.ecu??'unattributed';
  if(!b.length||b[0]!==parseInt(r.command.slice(0,2),16)+0x40){invalid.push(`${r.command}:${ecu}:unexpected_response`);continue;}
  if(r.command.startsWith('01')){
   const pid=r.command.slice(2),descriptor=metrics[pid];
   if(b[1]!==parseInt(pid,16)||(descriptor&&b.length<2+descriptor.size)||(['00','20','40','60','01'].includes(pid)&&b.length<6)){invalid.push(`${r.command}:${ecu}:truncated_or_wrong_pid`);continue;}
   if(descriptor)readings.push({ecu,name:descriptor.name,value:Math.round(descriptor.value(b.slice(2))*100)/100,unit:descriptor.unit});
   if(pid==='01')monitors.push({ecu,mil:Boolean(b[2]&128),reportedDTCCount:b[2]&127});
  }else if(['03','07','0A'].includes(r.command)){
   const bytes=b.slice(1);
   // CAN has an explicit count. Legacy ELM protocols carry pairs without it.
   const can=sample.protocol.startsWith('ISO15765')||/^A?[6-9]$/i.test(sample.protocol);
   const legacy=/^A?[1-5]$/i.test(sample.protocol);
   if(!can&&!legacy){invalid.push(`${r.command}:${ecu}:unknown_dtc_framing`);continue;}
   let payload=bytes;
   if(can){const n=bytes[0];if(n===undefined||n*2>bytes.length-1){invalid.push(`${r.command}:${ecu}:truncated_dtcs`);continue;}payload=bytes.slice(1,1+n*2);}
   else if(bytes.length%2){invalid.push(`${r.command}:${ecu}:truncated_dtcs`);continue;}
   for(let i=0;i+1<payload.length;i+=2)if(payload[i]||payload[i+1])codes.push({ecu,kind:r.command==='03'?'stored':r.command==='07'?'pending':'permanent',code:dtc(payload[i],payload[i+1])});
  }else if(r.command==='0902'){
   if(b[1]!==2||b[2]!==1||b.length<20){invalid.push(`${r.command}:${ecu}:incomplete_vin`);continue;}
   const vin=String.fromCharCode(...b.slice(3,20));if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)){invalid.push(`${r.command}:${ecu}:invalid_vin`);continue;}vins.add(vin);
  }
  validResponses++;ecus.add(ecu);
 }
 const warnings=[...sample.errors,...invalid];if(vins.size>1)warnings.push('VIN_CONFLICT: responding modules disagree');
 if(monitors.some(m=>m.mil))warnings.push('MIL_ON: inspect the recorded fault codes; a DTC is not a confirmed root cause');
 return {validResponses,ecus:[...ecus],vin:vins.size===1?[...vins][0]:null,vinConflict:vins.size>1,readings,dtcs:codes,monitors,warnings};
}
export function sessionView(session:OBDSession,now=Date.now()){
 const age=session.receivedAt?now-Date.parse(session.receivedAt):Infinity;
 const current=session.latest?interpretSample(session.latest):null;
 const freshQueries=(session.queries??[]).filter(q=>now-Date.parse(q.receivedAt)<(q.command.startsWith('01')?30000:180000));
 const interpreted=session.latest?interpretSample({...session.latest,responses:session.queries?freshQueries.flatMap(q=>q.responses):session.latest.responses}):null;
 const state=!session.latest?'waiting_for_bridge':age>20000?'stale':session.latest.status==='connected'&&!current?.validResponses?'vehicle_not_responding':session.latest.status;
 return {...session,state,queryFreshness:freshQueries.map(q=>({command:q.command,receivedAt:q.receivedAt})),ageSeconds:Number.isFinite(age)?Math.max(0,Math.floor(age/1000)):null,interpreted,
  understanding:{adapterConnected:['connected','vehicle_not_responding'].includes(state)?true:state==='disconnected'?false:null,vehicleResponding:state==='connected'&&Boolean(current?.validResponses),engineRunning:state==='connected'&&interpreted?.readings.some(r=>r.name==='rpm')?interpreted.readings.some(r=>r.name==='rpm'&&r.value>0):null,
   basis:'Read-only bridge-reported OBD responses, validated and decoded by Microfixd; no independent hardware attestation',
   nextAction:state==='waiting_for_bridge'?'Start the local bridge on the computer connected to the adapter':state==='stale'?'Bridge heartbeat expired; reconnect before using these readings':state!=='connected'?'Check ignition, adapter power, cable, driver and protocol':interpreted?.vinConflict?'Resolve conflicting module VINs before attaching a diagnostic case':interpreted?.dtcs.length?'Review DTCs and applicable source tests; do not replace parts based on codes alone':'Review supported live data and enter the actual complaint; absence of codes does not prove vehicle health'}};
}
