/**
 * src/agents/agentMesh.ts
 * Cross-Agent Mesh — manages the full agent society.
 * Creates + wires: Planner, Executor, Critic, Evaluator, Reflector,
 *                  RAG, Uncertainty, Paragon agents.
 * All communicate via AgentBus (<1ms latency).
 * Each runs isolated tasks, can delegate cross-agent.
 */
import { IsolatedAgent } from "./isolatedAgent";
import { watchdog }      from "./watchdog";
import { agentRegistry } from "./agentRegistry";

export interface AgentSociety {
  planner:     IsolatedAgent;
  executor:    IsolatedAgent;
  critic:      IsolatedAgent;
  evaluator:   IsolatedAgent;
  reflector:   IsolatedAgent;
  rag:         IsolatedAgent;
  uncertainty: IsolatedAgent;
  paragon:     IsolatedAgent;
  overwatch:   IsolatedAgent;
}

let _society: AgentSociety | null = null;
let _initialized = false;

export async function initAgentMesh(): Promise<AgentSociety> {
  if (_initialized && _society) return _society;

  const planner     = new IsolatedAgent("planner",     "planning");
  const executor    = new IsolatedAgent("executor",    "execution");
  const critic      = new IsolatedAgent("critic",      "evaluation");
  const evaluator   = new IsolatedAgent("evaluator",   "evaluation");
  const reflector   = new IsolatedAgent("reflector",   "reflection");
  const rag         = new IsolatedAgent("rag",         "retrieval");
  const uncertainty = new IsolatedAgent("uncertainty", "risk_assessment");
  const paragon     = new IsolatedAgent("paragon",     "pattern_extraction");
  const overwatch   = new IsolatedAgent("overwatch",   "metacognition");

  // Initialize all in parallel
  await Promise.all([
    planner.init(),     executor.init(),
    critic.init(),      evaluator.init(),
    reflector.init(),   rag.init(),
    uncertainty.init(), paragon.init(),
    overwatch.init(),
  ]);

  _society     = { planner, executor, critic, evaluator, reflector, rag, uncertainty, paragon, overwatch };
  _initialized = true;

  // Watchdog monitors all
  watchdog.start();

  console.log(`[agent_mesh] Society initialized — ${agentRegistry.all().length} agents live`);
  return _society;
}

export function getAgentMesh(): AgentSociety | null { return _society; }

export async function runSocietyTask(task: string): Promise<void> {
  const society = _society ?? await initAgentMesh();

  // 1. RAG recalls context
  society.rag.enqueue({ taskId: crypto.randomUUID(), task: `Retrieve context for: ${task}`, priority: 0 });

  // 2. Uncertainty assesses risk
  society.uncertainty.enqueue({ taskId: crypto.randomUUID(), task: `Assess risks for: ${task}`, priority: 0 });

  // 3. Planner creates plan
  society.planner.enqueue({ taskId: crypto.randomUUID(), task: `Plan: ${task}`, priority: 1 });

  // 4. Executor runs plan
  society.executor.enqueue({ taskId: crypto.randomUUID(), task: `Execute: ${task}`, priority: 2 });

  // 5. Critic reviews
  society.critic.enqueue({ taskId: crypto.randomUUID(), task: `Critique execution of: ${task}`, priority: 3 });

  // 6. Evaluator scores
  society.evaluator.enqueue({ taskId: crypto.randomUUID(), task: `Evaluate: ${task}`, priority: 4 });

  // 7. Reflector learns
  society.reflector.enqueue({ taskId: crypto.randomUUID(), task: `Reflect on: ${task}`, priority: 5 });

  // Overwatch monitors the entire run
  society.overwatch.enqueue({ taskId: crypto.randomUUID(), task: `Monitor cognitive integrity of: ${task}`, priority: 0 });
}
