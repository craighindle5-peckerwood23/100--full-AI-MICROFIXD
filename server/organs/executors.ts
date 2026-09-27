import { executeBrainOrgan } from "./organs/brainOrgan";
import { executeMemoryOrgan } from "./organs/memoryOrgan";
import { executePlaywrightOrgan } from "./organs/playwrightOrgan";
import { executeGithubOrgan } from "./organs/githubOrgan";
import { executeVoiceOrgan } from "./organs/voiceOrgan";
import { executeSecurityOrgan } from "./organs/securityOrgan";
import { executeEvolutionOrgan } from "./organs/evolutionOrgan";
import { executeReflexOrgan } from "./organs/reflexOrgan";
import { executeSchedulerOrgan } from "./organs/schedulerOrgan";

export type ExecutorFn = (action: string, payload: unknown) => Promise<unknown>;

export const EXECUTORS: Record<string, ExecutorFn> = {
  brain: executeBrainOrgan,
  memory: executeMemoryOrgan,
  playwright: executePlaywrightOrgan,
  github_connector: executeGithubOrgan,
  voice: executeVoiceOrgan,
  security_spine: executeSecurityOrgan,
  evolution_engine: executeEvolutionOrgan,
  reflex: executeReflexOrgan,
  scheduler: executeSchedulerOrgan,
};
