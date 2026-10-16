import {unit,type Telemetry} from '../types';
export function mapTelemetry(t:Telemetry={}){
 const latency=unit(t.latencyNorm,unit((t.latencyMs??0)/1000)),load=unit(t.systemLoad),error=unit(t.errorRate),loss=unit(t.packetLoss),stall=unit(t.loopStallRate);
 const critical=load>.85||error>.6||loss>.2||stall>.5;
 return {critical,latency,alpha:t.environment==='offline-mode'?.5:t.environment==='degraded'?.7:.85,glow:t.environment==='offline-mode'?.3:t.environment==='degraded'?.4:.6,
 flicker:Math.min(.4,(load<.3?0:load<.5?.05:load<.7?.1:load<.85?.2:.35)+(loss>.05?.1:0)),
 noise:Math.min(.3,(error<.2?0:error<.4?.05:error<.6?.1:.2)+(loss>.05?.1:0)+(t.audioDropout?.1:0)),
 distortion:Math.min(.7,(critical?.5:load>.7?.3:load>.5?.2:0)+(loss>.1?.3:0)+(stall>.3?.2:0)),
 pitch:latency>.2?.02:0,roll:latency>.8?.05:loss>.1?.03:0,cognitionStall:t.cognitionStall===true,audioDropout:t.audioDropout===true};
}
