export type Profile = 'minimal' | 'full' | 'diagnostic';
export type AvatarMode = 'idle' | 'speaking' | 'thinking' | 'listening' | 'error';
export interface Cognition { confidence?: number; uncertainty?: number; policyMode?: 'normal'|'strict'|'safe'|'defer'; reflectionState?: 'idle'|'thinking'|'revising'|'deferring'; intent?: string; topic?: string }
export interface Emotion { valence?: number; arousal?: number; dominantTag?: 'neutral'|'engaged'|'skeptical'|'concerned'|'focused' }
export interface Telemetry { latencyNorm?:number; packetLoss?:number; loopStallRate?:number; cognitionStall?:boolean; audioDropout?:boolean; latencyMs?: number; systemLoad?: number; errorRate?: number; environment?: 'normal'|'degraded'|'offline-mode' }
export interface AudioFrame { utteranceId: string; speaking: boolean; playbackMs: number; visemes?: { atMs: number; durationMs: number; value: string }[] }
export interface HIOInput { cognition?: Cognition; emotion?: Emotion; telemetry?: Telemetry; audio?: AudioFrame; speaking?: boolean; listening?: boolean; error?: boolean; yaw?: number; pitch?: number; bootProgress?: number }
export interface AvatarState { mode: AvatarMode; expression: string; confidence: number|null; uncertainty: number|null; policyMode: string; blendshapes: Record<string,number>; headPose: {pitch:number;yaw:number;roll:number}; blink:number; flicker:number; noise:number; distortion:number; bootProgress:number; alpha:number;glow:number;sync:'viseme'|'speaking-state'|'idle' }
export interface HIOStatus { fps:number; frameMs:number; model:'loading'|'ready'|'failed'; running:boolean; profile:Profile|'degraded'|'error'; state:AvatarState; error?:string }
export const unit=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
