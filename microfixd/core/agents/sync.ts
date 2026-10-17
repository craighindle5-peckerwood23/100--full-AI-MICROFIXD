/** Legacy role descriptor; real work must use the durable planner. */
export const SynchronizationAgent = {
 name: 'SynchronizationAgent', role: 'Cross-agent synchronization',
 execute: async (_context:any):Promise<never> => { throw new Error('LEGACY_AGENT_REQUIRES_DURABLE_MISSION'); }
};
