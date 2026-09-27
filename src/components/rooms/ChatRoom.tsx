// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Brain, Loader, ChevronDown } from "lucide-react";
import { runCortex } from "../../../microfixd/langgraph/graph";

interface Message {
  id:     string;
  role:   "user" | "system";
  text:   string;
  steps?: Record<string, { output: string; success: boolean }>;
  score?: number;
  ts:     string;
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:   "boot",
      role: "system",
      text: "◈ MICROFIXD L7 online. Identity locked. Constitution active. All organs nominal. How can I help?",
      ts:   new Date().toISOString(),
    },
  ]);
  const [input,    setInput]    = useState("");
  const [thinking, setThinking] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", text, ts: new Date().toISOString(),
    };
    setMessages(m => [...m, userMsg]);
    setThinking(true);

    try {
      const result = await runCortex(text, crypto.randomUUID());
      const sysMsg: Message = {
        id:    crypto.randomUUID(),
        role:  "system",
        text:  result.final_output || "Task complete.",
        steps: result.steps as Message["steps"],
        score: result.eval_score,
        ts:    new Date().toISOString(),
      };
      setMessages(m => [...m, sysMsg]);
    } catch (err) {
      setMessages(m => [...m, {
        id:   crypto.randomUUID(),
        role: "system",
        text: `⚠ Error: ${String(err)}`,
        ts:   new Date().toISOString(),
      }]);
    } finally { setThinking(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1c]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-100"
                  : "bg-[#0d1117] border border-[#21262d] text-zinc-300"
              }`}>
                {msg.role === "system" && (
                  <div className="flex items-center gap-1 mb-1">
                    <Brain size={10} className="text-cyan-400" />
                    <span className="text-[9px] text-cyan-400 font-mono">MICROFIXD</span>
                    {msg.score != null && (
                      <span className="text-[9px] text-zinc-500 ml-1">score {msg.score.toFixed(2)}</span>
                    )}
                  </div>
                )}
                <p className="text-sm font-mono leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Agent steps collapsible */}
                {msg.steps && Object.keys(msg.steps).length > 0 && (
                  <button
                    onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                    className="flex items-center gap-1 mt-1.5 text-[9px] text-zinc-500 hover:text-zinc-300"
                  >
                    <ChevronDown size={9} className={`transition-transform ${expanded === msg.id ? "rotate-180" : ""}`} />
                    {Object.keys(msg.steps).length} agent steps
                  </button>
                )}
                <AnimatePresence>
                  {expanded === msg.id && msg.steps && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-1"
                    >
                      {Object.entries(msg.steps).map(([node, step]) => (
                        <div key={node} className="font-mono text-[9px] text-zinc-600 py-0.5">
                          <span className={step.success ? "text-emerald-500" : "text-red-500"}>
                            {step.success ? "✓" : "✗"} {node}
                          </span>
                          <span className="ml-1 text-zinc-700">{step.output?.slice(0, 80)}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="text-[9px] text-zinc-600 mt-1 text-right">
                  {new Date(msg.ts).toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-[#0d1117] border border-[#21262d] rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader size={11} className="text-cyan-400 animate-spin" />
              <span className="text-zinc-500 text-xs font-mono">Cortex processing...</span>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#21262d] bg-[#0d1117]">
        <div className="flex items-center gap-2 bg-[#161b22] border border-[#21262d] rounded-xl px-3 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask Microfixd anything..."
            className="flex-1 bg-transparent text-zinc-200 text-sm font-mono outline-none placeholder-zinc-600"
          />
          <button
            onClick={send}
            disabled={thinking || !input.trim()}
            className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 disabled:opacity-40 transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
