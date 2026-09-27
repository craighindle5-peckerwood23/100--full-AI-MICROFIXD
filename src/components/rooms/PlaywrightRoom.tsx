import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Globe, Play, MousePointer, Type, Code, RefreshCw, Camera } from "lucide-react";
import { useBrowser } from "../../hooks/useBrowser";
import { useServerEvents } from "../../hooks/useServerEvents";

export default function PlaywrightRoom() {
  const { state, navigate, click, fill, scrape, evaluate, refreshScreenshot } = useBrowser();
  const [urlInput,    setUrlInput]    = useState("https://example.com");
  const [selector,    setSelector]    = useState("");
  const [fillValue,   setFillValue]   = useState("");
  const [jsCode,      setJsCode]      = useState("document.title");
  const [streaming,   setStreaming]   = useState(false);
  const { send, connected } = useServerEvents();

  // Live screenshot streaming via WebSocket
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);

  useServerEvents((event) => {
    if (event.type === "playwright:screenshot") {
      const { screenshot } = event.payload as { screenshot: string };
      setLiveScreenshot(screenshot);
    }
  });

  const toggleStream = () => {
    if (streaming) {
      send("playwright:stream_stop");
      setStreaming(false);
    } else {
      send("playwright:stream_start");
      setStreaming(true);
    }
  };

  const displayShot = liveScreenshot ?? state.screenshot;

  return (
    <div className="flex h-full bg-[#0a0f1c]">
      {/* Left: Browser view */}
      <div className="flex-1 flex flex-col border-r border-[#21262d]">
        {/* URL bar */}
        <div className="flex items-center gap-2 p-2 border-b border-[#21262d] bg-[#0d1117]">
          <Globe size={13} className="text-cyan-400 flex-shrink-0" />
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && navigate(urlInput)}
            placeholder="https://..."
            className="flex-1 bg-transparent text-zinc-300 text-xs font-mono outline-none"
          />
          <button
            onClick={() => navigate(urlInput)}
            disabled={state.status === "loading"}
            className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-mono hover:bg-cyan-500/30 disabled:opacity-40"
          >
            Go
          </button>
          <button onClick={toggleStream}
            className={`px-2 py-0.5 border rounded text-[10px] font-mono transition-colors ${
              streaming
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            }`}>
            {streaming ? "Stop Stream" : "Live Stream"}
          </button>
          <button onClick={refreshScreenshot}
            className="p-1 text-zinc-500 hover:text-zinc-300">
            <Camera size={12} />
          </button>
        </div>

        {/* Page info bar */}
        {state.title && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[#0d1117] border-b border-[#21262d]">
            <span className="text-zinc-400 text-[10px] font-mono truncate">{state.title}</span>
            <span className="text-zinc-600 text-[10px] font-mono truncate ml-auto">{state.url}</span>
          </div>
        )}

        {/* Screenshot view */}
        <div className="flex-1 overflow-hidden bg-[#050810] flex items-center justify-center">
          {displayShot ? (
            <img
              src={displayShot}
              alt="Browser view"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center text-zinc-700 font-mono text-xs">
              <Globe size={32} className="mx-auto mb-2 opacity-30" />
              <p>Navigate to a URL to see the browser</p>
              {!connected && <p className="text-red-500 mt-1">⚠ Server not connected</p>}
            </div>
          )}
          {state.status === "loading" && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <RefreshCw size={20} className="text-cyan-400 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Right: Controls + log */}
      <div className="w-64 flex flex-col bg-[#0d1117]">
        {/* Actions */}
        <div className="p-3 space-y-3 border-b border-[#21262d]">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Actions</p>

          {/* Click */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-600 flex items-center gap-1">
              <MousePointer size={9} /> Click selector
            </label>
            <div className="flex gap-1">
              <input value={selector} onChange={e => setSelector(e.target.value)}
                placeholder="button, #id, .class"
                className="flex-1 bg-[#161b22] border border-[#21262d] rounded px-2 py-0.5 text-[10px] font-mono text-zinc-300 outline-none" />
              <button onClick={() => click(selector)}
                className="px-2 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-mono hover:bg-cyan-500/30">
                <Play size={9} />
              </button>
            </div>
          </div>

          {/* Fill */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-600 flex items-center gap-1">
              <Type size={9} /> Fill input
            </label>
            <input value={fillValue} onChange={e => setFillValue(e.target.value)}
              placeholder="value to type"
              className="w-full bg-[#161b22] border border-[#21262d] rounded px-2 py-0.5 text-[10px] font-mono text-zinc-300 outline-none mb-1" />
            <button onClick={() => fill(selector, fillValue)}
              disabled={!selector}
              className="w-full py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono hover:bg-emerald-500/30 disabled:opacity-40">
              Fill
            </button>
          </div>

          {/* Evaluate */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-600 flex items-center gap-1">
              <Code size={9} /> Evaluate JS
            </label>
            <div className="flex gap-1">
              <input value={jsCode} onChange={e => setJsCode(e.target.value)}
                className="flex-1 bg-[#161b22] border border-[#21262d] rounded px-2 py-0.5 text-[10px] font-mono text-zinc-300 outline-none" />
              <button onClick={() => evaluate(jsCode)}
                className="px-2 bg-violet-500/20 text-violet-400 rounded text-[10px] font-mono hover:bg-violet-500/30">
                Run
              </button>
            </div>
          </div>
        </div>

        {/* Action log */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Log</p>
          {state.log.length === 0
            ? <p className="text-zinc-700 text-[10px] font-mono">No actions yet</p>
            : state.log.slice().reverse().map((l, i) => (
              <div key={i} className="font-mono text-[9px] py-0.5 border-b border-[#21262d]">
                <span className="text-cyan-500">{l.action}</span>
                <span className="text-zinc-600 ml-1 truncate block">{l.result}</span>
                <span className="text-zinc-700">{l.ts.slice(11, 19)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
