// @ts-nocheck
/**
 * microfixd/langgraph/predictiveHorizon.ts
 * L8 PREDICTIVE HORIZON
 * Before executing, predicts outcome probability based on episode history.
 * If predicted score < threshold, adjusts the plan proactively.
 */
import { listEpisodes } from "../core/episodes/episodeStore";
import { GoogleGenerativeAI } from "../lib/googleGenai";
import type { MicrofixdStateType } from "./state";

const genai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? "");
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

export interface HorizonPrediction {
  predicted_score:   number; // 0–1
  predicted_success: boolean;
  confidence:        number; // 0–1
  risk_factors:      string[];
  suggested_adjustments: string[];
  similar_episodes:  number;
}

export async function predictHorizon(
  state: MicrofixdStateType,
): Promise<HorizonPrediction> {
  // Get similar episodes from history
  const episodes = await listEpisodes(50);
  const similar  = episodes.filter(ep =>
    ep.cognitive_intent === state.cognitive_intent ||
    ep.complexity       === state.complexity ||
    ep.task.toLowerCase().split(" ").some(w => w.length > 4 && state.task.toLowerCase().includes(w))
  ).slice(0, 10);

  if (similar.length === 0) {
    return {
      predicted_score:   0.7,
      predicted_success: true,
      confidence:        0.3,
      risk_factors:      ["No similar episodes — low prediction confidence"],
      suggested_adjustments: [],
      similar_episodes:  0,
    };
  }

  const avgScore   = similar.reduce((s, e) => s + (e.critic_score ?? 5), 0) / similar.length / 10;
  const successRate = similar.filter(e => e.success).length / similar.length;

  // Gemini-powered horizon analysis
  const prompt = `You are the Predictive Horizon agent for Microfixd (L8).
Analyze this incoming task and predict outcomes.

Task: ${state.task}
Intent: ${state.cognitive_intent} | Complexity: ${state.complexity}
Risk flags: ${state.risk_flags.join(", ") || "none"}

Similar episodes (${similar.length}):
${similar.slice(0, 5).map(e => `  - ${e.task.slice(0, 60)} | success=${e.success} score=${e.critic_score ?? "?"}`).join("\n")}

Historical avg score: ${avgScore.toFixed(2)}
Historical success rate: ${(successRate * 100).toFixed(0)}%

Respond in JSON:
{
  "risk_factors": ["..."],
  "suggested_adjustments": ["..."]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text   = result.response.text();
    const json   = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      risk_factors?: string[];
      suggested_adjustments?: string[];
    };

    return {
      predicted_score:       Math.round(avgScore * 100) / 100,
      predicted_success:     successRate >= 0.6,
      confidence:            Math.min(0.95, similar.length / 10),
      risk_factors:          json.risk_factors ?? [],
      suggested_adjustments: json.suggested_adjustments ?? [],
      similar_episodes:      similar.length,
    };
  } catch {
    return {
      predicted_score:   avgScore,
      predicted_success: successRate >= 0.6,
      confidence:        similar.length / 20,
      risk_factors:      [],
      suggested_adjustments: [],
      similar_episodes:  similar.length,
    };
  }
}
