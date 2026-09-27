/**
 * Evolution Organ — generates and tracks evolution proposals
 * Actions: propose, list, apply_proposal, reject_proposal
 */
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

const proposals: { id: string; title: string; change: string; status: string; ts: string }[] = [];

export async function executeEvolutionOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "propose": {
      const completion = await groq.chat.completions.create({
        model:     "llama-3.1-70b-versatile",
        messages:  [{ role: "user", content: `Generate 1 specific improvement proposal for Microfixd based on: ${JSON.stringify(p)}. Output JSON: {"title":"...","change":"...","reason":"...","priority":"high|medium|low"}` }],
        max_tokens: 300,
      });
      const text     = completion.choices[0]?.message?.content ?? "{}";
      const proposal = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, string>;
      const entry    = { id: `evo_${Date.now().toString(36)}`, ...proposal, status: "pending", ts: new Date().toISOString() };
      proposals.push(entry as typeof proposals[0]);
      return { proposal: entry };
    }
    case "list":
      return { proposals: proposals.slice(-20) };
    case "apply_proposal": {
      const prop = proposals.find(p2 => p2.id === String(p.id));
      if (prop) prop.status = "applied";
      return { applied: !!prop, id: p.id };
    }
    case "reject_proposal": {
      const prop = proposals.find(p2 => p2.id === String(p.id));
      if (prop) prop.status = "rejected";
      return { rejected: !!prop, id: p.id };
    }
    default:
      throw new Error(`Evolution organ: unknown action '${action}'`);
  }
}
