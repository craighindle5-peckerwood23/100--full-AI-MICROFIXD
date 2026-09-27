// @ts-nocheck
/**
 * microfixd/langgraph/parallelMesh.ts
 * L9 PARALLEL REASONING MESH
 * Runs multiple reasoning paths simultaneously via Promise.all.
 * Merges results by confidence score — best path wins.
 * Used for high-complexity tasks where a single path may miss nuance.
 */
import { GoogleGenerativeAI } from "../lib/googleGenai";
import type { MicrofixdStateType } from "./state";

const genai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? "");
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

type ReasoningMode = "analytical" | "creative" | "critical" | "systematic";

interface MeshResult {
  mode:       ReasoningMode;
  output:     string;
  confidence: number;
  elapsed_ms: number;
}

interface MergedResult {
  final_output:   string;
  winning_mode:   ReasoningMode;
  all_results:    MeshResult[];
  mesh_score:     number;
  consensus:      boolean;
}

const MODE_PROMPTS: Record<ReasoningMode, string> = {
  analytical:  "Approach analytically. Break into components, evaluate each systematically, synthesize.",
  creative:    "Approach creatively. Find non-obvious solutions, lateral thinking, novel connections.",
  critical:    "Approach critically. Challenge assumptions, identify weaknesses, stress-test the approach.",
  systematic:  "Approach systematically. Follow a structured step-by-step process, verify each step.",
};

async function runMeshPath(
  task:    string,
  context: string,
  mode:    ReasoningMode,
): Promise<MeshResult> {
  const t0 = Date.now();
  const prompt = `You are a specialized Microfixd reasoning agent using ${mode} mode.
${MODE_PROMPTS[mode]}

Task: ${task}
Context: ${context.slice(0, 300)}

Produce your best output. End with: CONFIDENCE: <0.0-1.0>`;

  try {
    const result = await model.generateContent(prompt);
    const text   = result.response.text();
    const conf   = parseFloat(text.match(/CONFIDENCE:\s*([\d.]+)/i)?.[1] ?? "0.6");
    const output = text.replace(/CONFIDENCE:.*$/im, "").trim();
    return { mode, output, confidence: Math.min(1, Math.max(0, conf)), elapsed_ms: Date.now() - t0 };
  } catch {
    return { mode, output: "", confidence: 0, elapsed_ms: Date.now() - t0 };
  }
}

export async function runParallelMesh(
  state: MicrofixdStateType,
): Promise<MergedResult> {
  // Only run for high-complexity tasks
  if (state.complexity !== "high") {
    return {
      final_output:  state.final_output,
      winning_mode:  "systematic",
      all_results:   [],
      mesh_score:    state.eval_score,
      consensus:     true,
    };
  }

  const context = [
    ...state.memory_hits.slice(0, 2),
    state.steps?.planner?.output ?? "",
  ].join("\n");

  console.log("[parallel_mesh] Running 4-path reasoning mesh...");

  // Run all 4 paths simultaneously
  const [analytical, creative, critical, systematic] = await Promise.all([
    runMeshPath(state.task, context, "analytical"),
    runMeshPath(state.task, context, "creative"),
    runMeshPath(state.task, context, "critical"),
    runMeshPath(state.task, context, "systematic"),
  ]);

  const results = [analytical, creative, critical, systematic].filter(r => r.output.length > 0);
  results.sort((a, b) => b.confidence - a.confidence);

  const winner    = results[0];
  const avgConf   = results.reduce((s, r) => s + r.confidence, 0) / results.length;
  const consensus = results.every(r => Math.abs(r.confidence - avgConf) < 0.2);

  console.log(`[parallel_mesh] Winner: ${winner.mode} (${winner.confidence.toFixed(2)}) | Consensus: ${consensus}`);

  return {
    final_output:  winner.output,
    winning_mode:  winner.mode,
    all_results:   results,
    mesh_score:    winner.confidence,
    consensus,
  };
}
