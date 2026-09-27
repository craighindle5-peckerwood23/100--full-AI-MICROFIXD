import React, { useState } from "react";
import { Save, Eye, EyeOff } from "lucide-react";

interface Setting { key: string; label: string; placeholder: string; secret?: boolean }
const SETTINGS: Setting[] = [
  { key: "VITE_GEMINI_API_KEY",  label: "Gemini API Key",      placeholder: "AIza...",      secret: true },
  { key: "VITE_GITHUB_TOKEN",    label: "GitHub Token",         placeholder: "ghp_...",      secret: true },
  { key: "VITE_SUPABASE_URL",    label: "Supabase URL",         placeholder: "https://xxx.supabase.co" },
  { key: "VITE_SUPABASE_ANON",   label: "Supabase Anon Key",    placeholder: "eyJ...",       secret: true },
];

export default function SettingsRoom() {
  const [values,  setValues]  = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saved,   setSaved]   = useState(false);

  const handleSave = () => {
    // Settings go in .env — this is display-only, shows user what to set
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-lg bg-[#0a0f1c] h-full overflow-y-auto">
      <h2 className="text-cyan-400 font-mono text-sm font-semibold tracking-wider mb-1">⚙ SETTINGS</h2>
      <p className="text-zinc-600 font-mono text-[10px] mb-6">
        These values must be set in your .env file. This panel shows what's needed.
      </p>
      <div className="space-y-4">
        {SETTINGS.map(s => (
          <div key={s.key}>
            <label className="block text-[10px] text-zinc-500 font-mono mb-1">{s.label}</label>
            <p className="text-[9px] text-zinc-700 font-mono mb-1">{s.key}=...</p>
            <div className="flex items-center gap-1">
              <input
                type={s.secret && !visible[s.key] ? "password" : "text"}
                value={values[s.key] ?? ""}
                onChange={e => setValues(v => ({ ...v, [s.key]: e.target.value }))}
                placeholder={s.placeholder}
                className="flex-1 bg-[#0d1117] border border-[#21262d] rounded px-2 py-1.5 text-xs font-mono text-zinc-300 placeholder-zinc-700 outline-none"
              />
              {s.secret && (
                <button onClick={() => setVisible(v => ({ ...v, [s.key]: !v[s.key] }))}
                  className="p-1.5 text-zinc-600 hover:text-zinc-400">
                  {visible[s.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleSave}
        className="mt-6 flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg font-mono text-xs hover:bg-cyan-500/30 transition-colors">
        <Save size={12} />
        {saved ? "Noted! Update your .env file" : "Save Reference"}
      </button>
    </div>
  );
}
