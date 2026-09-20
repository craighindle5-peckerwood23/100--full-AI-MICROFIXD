import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Zap, 
  Play, 
  ToggleLeft, 
  ToggleRight, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Activity 
} from 'lucide-react';
import { AutomationRule } from '../../types';
import { INITIAL_AUTOMATIONS } from '../../data/osData';
import { sound } from '../../utils/audio';

export default function AutomationRoom() {
  const [rules, setRules] = useState<AutomationRule[]>(INITIAL_AUTOMATIONS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [condition, setCondition] = useState('');
  const [action, setAction] = useState('');

  const handleToggle = (id: string) => {
    sound.playTick();
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleFireRule = (id: string) => {
    sound.playWarp();
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        executionCount: r.executionCount + 1,
        lastExecuted: new Date().toLocaleTimeString()
      };
    }));
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !trigger.trim()) return;

    sound.playWarp();
    const newRule: AutomationRule = {
      id: `aut-${Date.now().toString().slice(-3)}`,
      name,
      trigger,
      condition: condition || 'True',
      action: action || 'Notify Sentinel Kernel',
      enabled: true,
      lastExecuted: 'Just now',
      executionCount: 1
    };

    setRules(prev => [newRule, ...prev]);
    setName('');
    setTrigger('');
    setCondition('');
    setAction('');
    setShowAddModal(false);
  };

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Zap className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">WORKFLOW AUTOMATION // CHAPTER 12</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            AUTONOMOUS REACTIVE ENGINES
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            <Plus size={13} /> Create Pipeline Rule
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
        {rules.map(rule => (
          <div
            key={rule.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
              rule.enabled 
                ? 'bg-black/60 border-cyan-500/30 hover:border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.1)]' 
                : 'bg-black/30 border-cyan-500/10 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-bold text-white tracking-wide">{rule.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(rule.id)}
                    className="text-cyan-400 hover:text-white"
                  >
                    {rule.enabled ? <ToggleRight size={22} className="text-cyan-400" /> : <ToggleLeft size={22} className="text-zinc-500" />}
                  </button>
                </div>
              </div>

              {/* Trigger -> Condition -> Action flow card */}
              <div className="space-y-2 text-xs mb-4">
                <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/15">
                  <span className="text-[10px] text-cyan-500/60 block uppercase">Trigger</span>
                  <span className="text-cyan-200">{rule.trigger}</span>
                </div>

                <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/15">
                  <span className="text-[10px] text-cyan-500/60 block uppercase">Condition Gate</span>
                  <span className="text-cyan-200">{rule.condition}</span>
                </div>

                <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/15">
                  <span className="text-[10px] text-cyan-500/60 block uppercase">Autonomous Action</span>
                  <span className="text-white font-medium">{rule.action}</span>
                </div>
              </div>
            </div>

            {/* Bottom Meta & Test Fire Button */}
            <div className="flex items-center justify-between border-t border-cyan-500/10 pt-3 text-[10px] text-cyan-500/70">
              <div className="flex items-center gap-3">
                <span>Runs: <strong className="text-white">{rule.executionCount}</strong></span>
                <span>Last: <strong className="text-cyan-300">{rule.lastExecuted}</strong></span>
              </div>
              <button
                onClick={() => handleFireRule(rule.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 transition-all"
              >
                <Play size={11} /> Test Trigger
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Pipeline Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-black border border-cyan-500/40 rounded-2xl p-5 shadow-[0_0_50px_rgba(6,182,212,0.3)]"
          >
            <h3 className="text-base font-bold text-white mb-1">CREATE WORKFLOW AUTOMATION</h3>
            <p className="text-xs text-cyan-400/60 mb-4">Define trigger condition and automated multi-agent response.</p>
            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="text-xs text-cyan-300 block mb-1">Rule Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Memory Garbage Collection Loop"
                  className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-cyan-300 block mb-1">Trigger (Event or Cron)</label>
                <input
                  type="text"
                  value={trigger}
                  onChange={e => setTrigger(e.target.value)}
                  placeholder="e.g. System CPU > 90% or Cron: */15 * * * *"
                  className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-xs text-cyan-300 block mb-1">Condition</label>
                <input
                  type="text"
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  placeholder="e.g. Status is Active"
                  className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-xs text-cyan-300 block mb-1">Autonomous Action</label>
                <input
                  type="text"
                  value={action}
                  onChange={e => setAction(e.target.value)}
                  placeholder="e.g. Trigger Carter to rebalance compute nodes"
                  className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-cyan-500/20 text-xs text-cyan-400 hover:bg-cyan-500/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                >
                  Activate Rule
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
