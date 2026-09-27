import { WatchingAgent } from "./watching";
import { RepairAgent } from "./repair";
import { SecurityAgent } from "./security";
import { OptimizationAgent } from "./optimization";
import { SynchronizationAgent } from "./sync";

export const agentRegistry: Record<string, any> = {
  optimize: OptimizationAgent,
  build: RepairAgent,
  analyze: WatchingAgent,
  automate: SynchronizationAgent,
  deploy: SecurityAgent,
  research: WatchingAgent
};
