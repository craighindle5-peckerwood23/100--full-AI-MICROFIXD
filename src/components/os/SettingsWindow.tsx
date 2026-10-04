import React, { useEffect, useRef } from 'react';
import { Settings2, X } from 'lucide-react';
import type { Subsystem } from '../../types';
import SettingsRoom, { type SettingsSection } from '../rooms/SettingsRoom';
export default function SettingsWindow({onClose,onNavigate,onReboot,initialSection}: {onClose:()=>void;onNavigate:(id:Subsystem)=>void;onReboot?:()=>void;initialSection?:SettingsSection}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;const previous=document.activeElement as HTMLElement|null;element?.showModal();return()=>{element?.close();previous?.focus();};},[]);
  return <dialog ref={dialog} aria-labelledby="settings-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===dialog.current)onClose();}} className="fixed inset-0 m-auto w-[min(1100px,96vw)] h-[min(790px,94dvh)] max-w-none max-h-none overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#080f19] text-slate-100 p-0 shadow-[0_30px_100px_rgba(0,0,0,0.7)] backdrop:bg-black/70 backdrop:backdrop-blur-sm">
    <div className="flex h-full flex-col"><header className="flex items-center justify-between border-b border-white/10 px-5 py-4 shrink-0"><h1 id="settings-title" className="flex items-center gap-3 font-semibold"><Settings2 size={20} className="text-cyan-300"/>Settings<span className="hidden sm:inline text-xs font-normal text-slate-500">Configure your workspace</span></h1><button autoFocus onClick={onClose} aria-label="Close settings" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19}/></button></header><div className="flex-1 min-h-0"><SettingsRoom initialSection={initialSection} onNavigate={id=>{onNavigate(id);onClose();}} onReboot={onReboot?()=>{onClose();onReboot();}:undefined}/></div></div>
  </dialog>;
}
