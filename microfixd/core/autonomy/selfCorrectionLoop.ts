// @ts-nocheck
/**
 * microfixd/core/autonomy/selfCorrectionLoop.ts
 * SELF-CORRECTION LOOP
 * Evaluate → Reflect → Rewrite → Re-evaluate
 * Runs when eval_score < threshold. Max 2 correction cycles.
 */
import { GoogleGenerativeAI } from "../../lib/googleGenai";
import type { MicrofixdStateType } from "../../langgraph/state";

const genai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? "");
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

const CORRECTION_THRESHOLD = 0.65;
const MAX_CYCLES           = 2;

export interface CorrectionResult {
  cycles:        number;
  final_output:  string;
  final_score:   number;
  improved:      boolean;
  reflections:   string[];
}

export async function runSelfCorrectionLoop(
  state: MicrofixdStateType,
): Promise<CorrectionResult> {
  if (state.eval_score >= CORRECTION_THRESHOLD) {
    return {
      cycles:       0,
      final_output: state.final_output,
      final_score:  state.eval_score,
      improved:     false,
      reflections:  [],
    };
  }

  let currentOutput = state.final_output;
  let currentScore  = state.eval_score;
  let cycles        = 0;
  const reflections: string[] = [];

  while (currentScore < CORRECTION_THRESHOLD && cycles < MAX_CYCLES) {
    cycles++;
    console.log(`[self_correction] Cycle ${cycles} — score ${currentScore.toFixed(2)} < ${CORRECTION_THRESHOLD}`);

    // Reflect
    const reflectPrompt = `You are the Reflection agent for Microfixd.
This output scored ${currentScore.toFixed(2)}/1.0:
${currentOutput.slice(0, 600)}

Task was: ${state.task}
Issues: ${state.doctrine_warnings.join("; ") || "quality below threshold"}

Identify the 3 specific problems and how to fix each.`;
    const reflection = await model.generateContent(reflectPrompt).then(r => r.response.text()).catch(() => "");
    reflections.push(reflection);

    // Rewrite
    const rewritePrompt = `You are the Executor agent for Microfixd.
Rewrite this output addressing these specific issues:
${reflection.slice(0, 400)}

Original task: ${state.task}
Original output: ${currentOutput.slice(0, 400)}

Produce an improved version that scores higher.`;
    currentOutput = await model.generateContent(rewritePrompt).then(r => r.response.text()).catch(() => currentOutput);

    // Re-evaluate
    const evalPrompt = `Score this output 0.0–1.0 for task: "${state.task}"
Output: ${currentOutput.slice(0, 400)}
SCORE: `;
    const evalText = await model.generateContent(evalPrompt).then(r => r.response.text()).catch(() => "0.5");
    currentScore   = Math.min(1, Math.max(0, parseFloat(evalText.match(/[\d.]+/)?.[0] ?? "0.5")));
    console.log(`[self_correction] Cycle ${cycles} complete — new score: ${currentScore.toFixed(2)}`);
  }

  return {
    cycles,
    final_output: currentOutput,
    final_score:  currentScore,
    improved:     currentScore > state.eval_score,
    reflections,
  };
}
