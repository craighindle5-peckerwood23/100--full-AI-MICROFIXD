/**
 * server/crossai/crossAIRouter.ts
 * REST endpoints for Cross-AI communications.
 * Mounted at: /api/crossai
 *
 * POST /api/crossai/call          { to, messages, routing? }
 * POST /api/crossai/parallel      { targets[], messages }
 * POST /api/crossai/consensus     { targets[], messages, method? }
 * POST /api/crossai/fastest       { messages }
 * POST /api/crossai/fallback      { chain[], messages }
 * GET  /api/crossai/providers     — List configured providers
 * GET  /api/crossai/audit         — Audit log
 */
import { Router } from "express";
import Groq       from "groq-sdk";
import Anthropic  from "@anthropic-ai/sdk";
import OpenAI     from "openai";
import { GoogleGenAI } from "@google/genai";

export const crossAIRouter = Router();

const auditLog: unknown[] = [];

async function callProvider(to: string, messages: {role: string; content: string}[], opts: {max_tokens?: number; temperature?: number} = {}) {
  const t0 = Date.now();
  try {
    let content = "";
    let model   = "";
    switch (to) {
      case "groq": {
        if (!process.env.GROQ_API_KEY && !process.env.VITE_GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY });
        const r = await groq.chat.completions.create({
          model: "qwen/qwen3.8-27b",
          messages: messages as Parameters<typeof groq.chat.completions.create>[0]["messages"],
          max_tokens: Math.min(Number(opts.max_tokens ?? 500), 750)
        });
        const msg = r.choices[0]?.message;
        content = msg?.content || msg?.reasoning || "";
        model   = r.model;
        break;
      }
      case "gemini": {
        if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is not configured on the server");
        const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY.trim()});
        model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
        const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
        const r = await ai.models.generateContent({model,contents:prompt,
          config:{maxOutputTokens:Math.max(1,Math.min(Number(opts.max_tokens) || 512,16384)),temperature:opts.temperature}});
        if (r.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new Error("Gemini response reached its token limit");
        content = r.text || "";
        if (!content.trim()) throw new Error("Gemini returned no answer");
        break;
      }
      case "claude": {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const userMsgs = messages.filter(m => m.role !== "system");
        const sys      = messages.find(m => m.role === "system")?.content ?? "You are a helpful assistant.";
        const r = await anthropic.messages.create({ model: "claude-3-5-sonnet-20241022", max_tokens: opts.max_tokens ?? 1024, system: sys, messages: userMsgs as Parameters<typeof anthropic.messages.create>[0]["messages"] });
        content = r.content[0]?.type === "text" ? r.content[0].text : "";
        model   = r.model;
        break;
      }
      case "openai": {
        if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const r = await openai.chat.completions.create({ model: "gpt-4o", messages: messages as Parameters<typeof openai.chat.completions.create>[0]["messages"], max_tokens: opts.max_tokens ?? 1024 });
        content = r.choices[0]?.message?.content ?? "";
        model   = r.model;
        break;
      }
      default:
        return { success: false, error: `Provider '${to}' not configured on server`, latency_ms: Date.now() - t0 };
    }
    return { success: true, content, model, latency_ms: Date.now() - t0 };
  } catch (err) {
    return { success: false, error: String(err), latency_ms: Date.now() - t0 };
  }
}

crossAIRouter.get("/providers", (req, res) => {
  res.json({
    providers: [
      { id: "groq",      available: !!(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY),       model: "qwen/qwen3.8-27b" },
      { id: "claude",    available: !!process.env.ANTHROPIC_API_KEY,  model: "claude-3-5-sonnet-20241022" },
      { id: "openai",    available: !!process.env.OPENAI_API_KEY,     model: "gpt-4o" },
      { id: "copilot",   available: !!process.env.AZURE_OPENAI_API_KEY, model: "azure/gpt-4o" },
      { id: "devin",     available: !!process.env.DEVIN_API_KEY,      model: "devin-v1", skeleton: !process.env.DEVIN_API_KEY },
      { id: "gemini",    available: !!process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-2.5-flash" },
    ],
  });
});

crossAIRouter.post("/call", async (req, res) => {
  const { to = "groq", messages, max_tokens, temperature } = req.body;
  const result = await callProvider(to, messages, { max_tokens, temperature });
  auditLog.push({ type: "call", to, ts: new Date().toISOString(), ...result });
  res.json(result);
});

crossAIRouter.post("/fallback", async (req, res) => {
  const { messages, max_tokens, temperature, chain = ["groq", "gemini", "openai", "claude"] } = req.body;
  for (const provider of chain as string[]) {
    const result = await callProvider(provider, messages, { max_tokens, temperature });
    if (result.success) return res.json({ ...result, provider });
  }
  res.status(502).json({ success: false, error: "All configured LLM providers failed" });
});

crossAIRouter.post("/parallel", async (req, res) => {
  const { targets, messages, max_tokens } = req.body;
  const results = await Promise.allSettled(
    (targets as string[]).map(t => callProvider(t, messages, { max_tokens }))
  );
  const responses = results.map((r, i) => ({
    provider: targets[i],
    ...(r.status === "fulfilled" ? r.value : { success: false, error: String((r as PromiseRejectedResult).reason) }),
  }));
  res.json({ responses });
});

crossAIRouter.post("/fastest", async (req, res) => {
  const { messages, max_tokens } = req.body;
  const ORDER = ["groq", "gemini", "openai", "claude"];
  for (const t of ORDER) {
    const r = await callProvider(t, messages, { max_tokens });
    if (r.success) return res.json({ ...r, provider: t });
  }
  res.status(500).json({ success: false, error: "All providers failed" });
});

crossAIRouter.get("/audit", (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  res.json({ log: auditLog.slice(-limit) });
});
