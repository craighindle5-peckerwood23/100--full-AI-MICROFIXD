import {hostSignals} from '../hio/sync/HostSignals';
import{createStore}from'zustand/vanilla';
import type{ShellViewModel,TelemetryEvent}from'../integration/ShellAPI';
import type{HIOInput}from'../hio/types';
import{telemetryToEmotion}from'./mapping/telemetryToEmotion';
import{telemetryToPose}from'./mapping/telemetryToPose';
import{telemetryToIndicators}from'./mapping/telemetryToIndicators';
export type ShellState={vm:ShellViewModel;lastEvent?:TelemetryEvent;ingest:(e:TelemetryEvent)=>void};
export const createShellStore=()=>createStore<ShellState>((set)=>({
 vm:{emotion:'calm',pose:{yaw:0,pitch:0,attention:1},mouth:'idle',indicators:{status:'CONNECTING',agents:0,signal:0,severity:'info'}},
 ingest:e=>set(current=>{
  const voice=/^voice\./.test(e.type),d=e.data||{},hio:HIOInput=hostSignals(e,current.vm.hio);
  if(voice)hio.listening=e.state==='listening';
  const pose=telemetryToPose(e),indicators=telemetryToIndicators(e);
  return {lastEvent:e,vm:{...current.vm,hio,emotion:voice?current.vm.emotion:telemetryToEmotion(e),pose:voice?current.vm.pose:pose,mouth:voice?(e.state==='idle'||e.state==='error'||e.state==='listening'?'idle':'speaking'):current.vm.mouth,indicators:voice?{...current.vm.indicators,...(e.signal!==undefined?{signal:indicators.signal}:{})}:{...indicators,agents:e.agents===undefined?current.vm.indicators.agents:indicators.agents,signal:e.signal===undefined?current.vm.indicators.signal:indicators.signal}}};
 })
}));
