export interface AgentContext { mission:any; memory:any; telemetry:any; }
/** Legacy role descriptor; real work must use the durable planner. */
export const WatchingAgent = {
 name: 'WatchingAgent', role: 'System observation',
 execute: async (_context:any):Promise<never> => { throw new Error('LEGACY_AGENT_REQUIRES_DURABLE_MISSION'); }
};
