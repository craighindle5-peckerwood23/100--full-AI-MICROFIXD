export type PlannerWorkerPhase = 'not_started'|'idle'|'busy'|'stopped';

interface WorkerState {
  phase: PlannerWorkerPhase;
  startedAt: string | null;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  lastMissionCompletedAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  activeMissionId: string | null;
  ticks: number;
  missionsProcessed: number;
  consecutiveErrors: number;
}

const state: WorkerState = {
  phase:'not_started',startedAt:null,lastTickStartedAt:null,lastTickCompletedAt:null,
  lastMissionCompletedAt:null,lastErrorAt:null,lastErrorCode:null,activeMissionId:null,
  ticks:0,missionsProcessed:0,consecutiveErrors:0,
};

const now=()=>new Date().toISOString();
const errorCode=(error:unknown)=>String((error as any)?.code ?? (error instanceof Error?error.message:'WORKER_ERROR'))
  .replace(/[^A-Za-z0-9_:-]/g,'_').slice(0,120) || 'WORKER_ERROR';

export function plannerWorkerStarted(){state.phase='idle';state.startedAt??=now();}
export function plannerWorkerTickStarted(){state.phase='busy';state.lastTickStartedAt=now();state.ticks++;}
export function plannerWorkerMissionStarted(missionId:string){state.activeMissionId=missionId;}
export function plannerWorkerMissionCompleted(){
  state.missionsProcessed++;state.lastMissionCompletedAt=now();state.activeMissionId=null;state.consecutiveErrors=0;
}
export function plannerWorkerTickCompleted(){
  state.phase='idle';state.lastTickCompletedAt=now();state.activeMissionId=null;state.consecutiveErrors=0;
}
export function plannerWorkerError(error:unknown){
  state.lastErrorAt=now();state.lastErrorCode=errorCode(error);state.consecutiveErrors++;
}
export function plannerWorkerStopped(){state.phase='stopped';state.activeMissionId=null;}

export function getPlannerWorkerStatus(at=Date.now()){
  const tickStarted=state.lastTickStartedAt?Date.parse(state.lastTickStartedAt):0;
  const tickCompleted=state.lastTickCompletedAt?Date.parse(state.lastTickCompletedAt):0;
  const busySince=state.phase==='busy'&&tickStarted>tickCompleted?tickStarted:0;
  const busyForMs=busySince?Math.max(0,at-busySince):0;
  // A normal mission can legitimately run for tens of seconds. Five minutes indicates a stuck worker.
  const stale=state.phase==='busy'&&busyForMs>300_000;
  return {...state,busyForMs,stale,healthy:state.phase!=='stopped'&&!stale&&state.consecutiveErrors<5};
}
