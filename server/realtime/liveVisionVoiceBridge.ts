import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  Behavior,
  type FunctionDeclaration,
  FunctionResponseScheduling,
  GoogleGenAI,
  InteractionStatus,
  type LiveServerMessage,
  Modality,
  ThinkingLevel,
  Type,
} from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import { getPending } from '../hitl/hitlManager';
import { roleForToken, type Role } from '../security/rbac';
import { verifySupabaseSession } from '../security/supabaseAuth';

export const LIVE_MODELS = {
  fast: 'gemini-3.8-live',
  extended: 'gemini-3.8-live-extended-thinking',
} as const;

export const LIVE_VOICE_PRESETS = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const;
export type LiveVoicePreset = (typeof LIVE_VOICE_PRESETS)[number];
export type LiveModelId = (typeof LIVE_MODELS)[keyof typeof LIVE_MODELS];

export const MAX_WS_PAYLOAD_BYTES = 512 * 1024;
export const MAX_AUDIO_CHUNK_BYTES = 160 * 1024;
export const MAX_VIDEO_FRAME_BYTES = 450 * 1024;
export const MIN_VIDEO_INTERVAL_MS = 900;

export interface LiveSessionHandle {
  sendRealtimeInput: (input: {
    audio?: { data: string; mimeType: string };
    video?: { data: string; mimeType: string };
    text?: string;
  }) => void;
  sendToolResponse?: (payload: {
    functionResponses: Array<{
      id?: string;
      name?: string;
      response: Record<string, unknown>;
      scheduling?: FunctionResponseScheduling;
    }>;
  }) => void;
  close: () => void;
}

export type LiveConnectFn = (params: {
  model: string;
  config: Record<string, unknown>;
  callbacks: {
    onopen?: () => void;
    onmessage?: (message: LiveServerMessage) => void;
    onerror?: (err: unknown) => void;
    onclose?: (ev?: unknown) => void;
  };
}) => Promise<LiveSessionHandle>;

interface BridgeAuth {
  role: Role;
  tenantId: string;
  userId?: string;
}

export interface UpgradeServerLike {
  on(event: 'upgrade', listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): unknown;
  once(event: 'close', listener: () => void): unknown;
}

const activeSessions = new Set<WebSocket>();
let registeredUpgradeServers = new WeakSet<UpgradeServerLike>();
let sharedLiveWss: WebSocketServer | null = null;

export function getLiveBridgeStatus() {
  return {
    configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    models: {
      fast: LIVE_MODELS.fast,
      extended: LIVE_MODELS.extended,
    },
    voices: [...LIVE_VOICE_PRESETS],
    activeSessions: activeSessions.size,
    wsPath: '/ws/live',
    audioInputFormat: 'audio/pcm;rate=16000',
    audioOutputFormat: 'audio/pcm;rate=24000',
    maxVideoFps: 1,
  };
}

function allowedForLive(role: Role): boolean {
  return role === 'admin' || role === 'operator' || role === 'system';
}

async function resolveLiveAuth(token: string): Promise<BridgeAuth | null> {
  if (!token) return null;
  const sharedRole = roleForToken(token);
  if (sharedRole !== 'anonymous') {
    return allowedForLive(sharedRole) ? { role: sharedRole, tenantId: 'default' } : null;
  }
  const supa = await verifySupabaseSession(token);
  if (!supa || !allowedForLive(supa.role)) return null;
  return { role: supa.role, tenantId: supa.tenantId, userId: supa.userId };
}

function buildNonBlockingDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: 'get_live_capabilities',
      description: 'Inspect live runtime capability probing posture, degraded subsystems, and active organs.',
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          includeRecords: { type: Type.BOOLEAN },
        },
      },
    },
    {
      name: 'get_system_status',
      description: 'Read current live organ registry health, active operations metrics, and pending approval count.',
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    {
      name: 'list_pending_hitl',
      description: 'List pending human-in-the-loop approval items awaiting operator decision.',
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    {
      name: 'run_world_thinking_check',
      description: 'Run a bounded world-thinking risk and outcome projection for an operator decision.',
      behavior: Behavior.NON_BLOCKING,
      parameters: {
        type: Type.OBJECT,
        properties: {
          objective: { type: Type.STRING },
        },
        required: ['objective'],
      },
    },
  ];
}

async function executeReadOnlyLiveTool(
  name: string,
  args: Record<string, unknown>,
  auth: BridgeAuth,
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'get_live_capabilities': {
      const { liveCapabilityLedger } = await import('../runtime/liveCapabilities');
      const snap = liveCapabilityLedger.getSnapshot();
      const includeRecords = Boolean(args.includeRecords);
      return {
        stale: snap.stale,
        generatedAt: snap.generatedAt,
        counts: snap.counts,
        summary: snap.agentSummaryPrompt,
        degraded: snap.records
          .filter((r) => r.status === 'degraded' || r.status === 'unavailable')
          .slice(0, 8)
          .map((r) => ({ id: r.id, name: r.name, status: r.status, summary: r.summary })),
        ...(includeRecords ? { subsystems: snap.subsystems.slice(0, 12) } : {}),
      };
    }
    case 'get_system_status': {
      const { getSystemSnapshot } = await import('../organs/organMetrics');
      const snap = getSystemSnapshot() as unknown as Record<string, unknown>;
      return {
        snapshot: snap,
        pendingApprovals: getPending().filter(item => item.session_id.startsWith(`${auth.tenantId}:`)).length,
        tenantId: auth.tenantId,
      };
    }
    case 'list_pending_hitl': {
      const pending = getPending().filter(item => item.session_id.startsWith(`${auth.tenantId}:`)).slice(0, 8).map((item) => ({
        hitl_id: item.hitl_id,
        trigger: item.trigger,
        artifactName: item.artifact?.name ?? 'Unnamed action',
        ts: item.ts,
      }));
      return { count: pending.length, pending };
    }
    case 'run_world_thinking_check': {
      const { worldThinkingEngine } = await import('../orchestration/worldThinkingEngine');
      const objective = typeof args.objective === 'string' && args.objective.trim()
        ? args.objective.trim().slice(0, 500)
        : 'Evaluate live operational safety posture';
      const report = await worldThinkingEngine.simulateWorldThinking(objective, [], {
        tenantId: auth.tenantId,
        useLlm: false,
        includeLiveCapabilities: true,
      });
      return {
        epistemicUncertainty: report.epistemicUncertainty,
        recommendedDecision: report.optimalBranch.decision,
        reasoning: report.optimalBranch.reasoning,
        safetyScore: report.activeWorldState.safetyScore,
        riskProbability: report.activeWorldState.riskProbability,
      };
    }
    default:
      return { error: `Tool '${name}' is not authorized in live voice mode.` };
  }
}

function buildSystemInstruction(contextNote?: string): string {
  return [
    'You are Microfyxd OS live multimodal voice and vision assistant.',
    'Communication policy: deliver intelligent, concise spoken summaries first (1-3 crisp sentences) focusing on the actionable conclusion, measured status, or visual observation.',
    'When a finding has deeper logs, metrics, or multi-domain reasoning, briefly offer to expand details if asked rather than reading long lists aloud.',
    'Only report verified observations from live camera/screen frames or read-only tool outputs. Never fabricate sensor readings, capabilities, or execution completions.',
    contextNote ? `Active operator workspace context: ${contextNote.slice(0, 300)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function createLiveVisionVoiceWss(options?: { liveConnect?: LiveConnectFn }): WebSocketServer {
  const liveWss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES });

  liveWss.on('connection', (ws) => {
    let auth: BridgeAuth | null = null;
    let liveSession: LiveSessionHandle | null = null;
    let currentModel: LiveModelId = LIVE_MODELS.fast;
    let currentVoice: LiveVoicePreset = 'Zephyr';
    let lastVideoFrameAt = 0;
    let closed = false;

    const authTimer = setTimeout(() => {
      if (!auth && ws.readyState === WebSocket.OPEN) {
        ws.close(1008, 'Authentication required');
      }
    }, 5000);

    const closeUpstreamSession = () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore close errors
        }
        liveSession = null;
      }
      activeSessions.delete(ws);
    };

    ws.once('close', () => {
      closed = true;
      clearTimeout(authTimer);
      closeUpstreamSession();
    });

    ws.on('error', () => {
      closed = true;
      clearTimeout(authTimer);
      closeUpstreamSession();
    });

    ws.on('message', (raw) => {
      void (async () => {
        const rawBytes = Buffer.isBuffer(raw) ? raw.byteLength : Buffer.byteLength(String(raw));
        if (rawBytes > MAX_WS_PAYLOAD_BYTES) {
          sendJson(ws, {
            type: 'error',
            code: 'PAYLOAD_TOO_LARGE',
            message: 'WebSocket frame exceeded the 512 KB live media cap.',
          });
          return;
        }

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        } catch {
          sendJson(ws, { type: 'error', code: 'INVALID_JSON', message: 'Malformed JSON control message.' });
          return;
        }

        const msgType = typeof msg.type === 'string' ? msg.type : '';

        if (!auth) {
          const payload = (msg.payload && typeof msg.payload === 'object'
            ? (msg.payload as Record<string, unknown>)
            : {}) as Record<string, unknown>;
          const token = typeof payload.token === 'string' ? payload.token.trim() : '';
          const resolved = msgType === 'authenticate' ? await resolveLiveAuth(token) : null;
          if (!resolved) {
            ws.close(1008, 'Invalid or unauthorized credentials');
            return;
          }
          auth = resolved;
          clearTimeout(authTimer);
          sendJson(ws, {
            type: 'authenticated',
            role: auth.role,
            tenantId: auth.tenantId,
            status: getLiveBridgeStatus(),
            ts: new Date().toISOString(),
          });
          return;
        }

        switch (msgType) {
          case 'ping': {
            sendJson(ws, { type: 'pong', ts: new Date().toISOString() });
            return;
          }

          case 'session.start': {
            closeUpstreamSession();
            const requestedModel = msg.model === LIVE_MODELS.extended ? LIVE_MODELS.extended : LIVE_MODELS.fast;
            const requestedVoice = LIVE_VOICE_PRESETS.includes(msg.voiceName as LiveVoicePreset)
              ? (msg.voiceName as LiveVoicePreset)
              : 'Zephyr';
            const thinkingLevel = msg.thinkingLevel === 'HIGH' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM;
            const contextNote = typeof msg.contextNote === 'string' ? msg.contextNote : undefined;

            const geminiKey = process.env.GEMINI_API_KEY?.trim();
            if (!geminiKey && !options?.liveConnect) {
              sendJson(ws, {
                type: 'error',
                code: 'GEMINI_API_KEY_NOT_CONFIGURED',
                message: 'GEMINI_API_KEY is not configured on the server. Live Gemini voice and vision cannot start without a server key.',
              });
              return;
            }

            currentModel = requestedModel;
            currentVoice = requestedVoice;

            const connectFn: LiveConnectFn =
              options?.liveConnect ??
              (async (params) => {
                const ai = new GoogleGenAI({
                  apiKey: geminiKey!,
                  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
                });
                return (await ai.live.connect(params as any)) as unknown as LiveSessionHandle;
              });

            const config: Record<string, unknown> = {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: currentVoice },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: buildSystemInstruction(contextNote),
              tools: [{ functionDeclarations: buildNonBlockingDeclarations() }],
            };

            if (currentModel === LIVE_MODELS.extended) {
              config.thinkingConfig = { thinkingLevel };
            }

            try {
              const session = await connectFn({
                model: currentModel,
                config,
                callbacks: {
                  onmessage: (serverMessage: LiveServerMessage) => {
                    if (closed || ws.readyState !== WebSocket.OPEN) return;

                    const content = serverMessage.serverContent as (Record<string, any> | undefined);
                    if (content?.inputTranscription?.text) {
                      sendJson(ws, {
                        type: 'transcript.input',
                        text: String(content.inputTranscription.text),
                      });
                    }
                    if (content?.outputTranscription?.text) {
                      sendJson(ws, {
                        type: 'transcript.output',
                        text: String(content.outputTranscription.text),
                      });
                    }
                    if (content?.modelTurn?.parts && Array.isArray(content.modelTurn.parts)) {
                      for (const part of content.modelTurn.parts) {
                        if (part?.inlineData?.data) {
                          sendJson(ws, {
                            type: 'audio.chunk',
                            data: String(part.inlineData.data),
                            mimeType: String(part.inlineData.mimeType || 'audio/pcm;rate=24000'),
                          });
                        }
                      }
                    }
                    if (content?.interrupted) {
                      sendJson(ws, { type: 'interrupted' });
                    }
                    if (content?.turnComplete) {
                      sendJson(ws, { type: 'turn.complete' });
                    }
                    if (content?.interactionStatus) {
                      const status =
                        content.interactionStatus === InteractionStatus.IN_PROGRESS ? 'IN_PROGRESS' : 'IDLE';
                      sendJson(ws, { type: 'interaction.status', status });
                    }

                    const toolCalls = serverMessage.toolCall?.functionCalls ?? [];
                    for (const call of toolCalls) {
                      const toolName = String(call.name || '');
                      const toolArgs =
                        call.args && typeof call.args === 'object'
                          ? (call.args as Record<string, unknown>)
                          : {};
                      sendJson(ws, { type: 'tool.call', name: toolName, args: toolArgs });
                      void executeReadOnlyLiveTool(toolName, toolArgs, auth!)
                        .then((result) => {
                          if (closed || !liveSession?.sendToolResponse) return;
                          liveSession.sendToolResponse({
                            functionResponses: [
                              {
                                id: call.id,
                                name: toolName,
                                response: result,
                                scheduling: FunctionResponseScheduling.WHEN_IDLE,
                              },
                            ],
                          });
                          sendJson(ws, { type: 'tool.result', name: toolName, ok: true });
                        })
                        .catch((err) => {
                          if (closed || !liveSession?.sendToolResponse) return;
                          liveSession.sendToolResponse({
                            functionResponses: [
                              {
                                id: call.id,
                                name: toolName,
                                response: { error: err instanceof Error ? err.message : String(err) },
                                scheduling: FunctionResponseScheduling.WHEN_IDLE,
                              },
                            ],
                          });
                          sendJson(ws, { type: 'tool.result', name: toolName, ok: false });
                        });
                    }
                  },
                  onerror: (err: unknown) => {
                    sendJson(ws, {
                      type: 'error',
                      code: 'LIVE_SESSION_ERROR',
                      message: err instanceof Error ? err.message : String(err || 'Gemini Live stream error'),
                    });
                  },
                  onclose: () => {
                    if (!closed && ws.readyState === WebSocket.OPEN) {
                      activeSessions.delete(ws);
                      liveSession = null;
                      sendJson(ws, { type: 'live.stopped', reason: 'upstream_closed' });
                    }
                  },
                },
              });

              if (closed) {
                session.close();
                return;
              }

              liveSession = session;
              activeSessions.add(ws);
              sendJson(ws, {
                type: 'live.ready',
                model: currentModel,
                voiceName: currentVoice,
                interactionStatus: 'IDLE',
                ts: new Date().toISOString(),
              });
            } catch (err) {
              sendJson(ws, {
                type: 'error',
                code: 'LIVE_CONNECT_FAILED',
                message: err instanceof Error ? err.message : String(err),
              });
            }
            return;
          }

          case 'audio.chunk': {
            if (!liveSession) return;
            const data = typeof msg.data === 'string' ? msg.data : '';
            if (!data || Buffer.byteLength(data) > MAX_AUDIO_CHUNK_BYTES) {
              sendJson(ws, { type: 'error', code: 'INVALID_AUDIO_CHUNK', message: 'Invalid or oversized PCM audio chunk.' });
              return;
            }
            liveSession.sendRealtimeInput({
              audio: { data, mimeType: 'audio/pcm;rate=16000' },
            });
            return;
          }

          case 'video.frame': {
            if (!liveSession) return;
            const data = typeof msg.data === 'string' ? msg.data : '';
            if (!data || Buffer.byteLength(data) > MAX_VIDEO_FRAME_BYTES) {
              sendJson(ws, { type: 'error', code: 'INVALID_VIDEO_FRAME', message: 'Invalid or oversized JPEG video frame.' });
              return;
            }
            const now = Date.now();
            if (now - lastVideoFrameAt < MIN_VIDEO_INTERVAL_MS) {
              return;
            }
            lastVideoFrameAt = now;
            liveSession.sendRealtimeInput({
              video: { data, mimeType: 'image/jpeg' },
            });
            return;
          }

          case 'text.turn': {
            if (!liveSession) {
              sendJson(ws, { type: 'error', code: 'NO_ACTIVE_SESSION', message: 'Start a live session before sending text.' });
              return;
            }
            const text = typeof msg.text === 'string' ? msg.text.trim() : '';
            if (!text || text.length > 4000) {
              sendJson(ws, { type: 'error', code: 'INVALID_TEXT_TURN', message: 'Text turn must be 1-4000 characters.' });
              return;
            }
            liveSession.sendRealtimeInput({ text });
            return;
          }

          case 'session.interrupt': {
            sendJson(ws, { type: 'interrupted', source: 'client' });
            return;
          }

          case 'session.stop': {
            closeUpstreamSession();
            sendJson(ws, { type: 'live.stopped', reason: 'client_stopped' });
            return;
          }

          default: {
            sendJson(ws, { type: 'error', code: 'UNKNOWN_MESSAGE_TYPE', message: `Unsupported live message '${msgType}'.` });
          }
        }
      })().catch((err) => {
        sendJson(ws, {
          type: 'error',
          code: 'BRIDGE_INTERNAL_ERROR',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    });
  });

  return liveWss;
}

export function attachLiveVisionVoiceBridge(
  httpServer: UpgradeServerLike,
  options?: { liveConnect?: LiveConnectFn },
): WebSocketServer {
  if (!sharedLiveWss || options?.liveConnect) {
    sharedLiveWss = createLiveVisionVoiceWss(options);
  }
  const liveWss = sharedLiveWss;

  if (!registeredUpgradeServers.has(httpServer)) {
    registeredUpgradeServers.add(httpServer);
    httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const reqUrl = req.url || '';
      if (reqUrl === '/ws/live' || reqUrl.startsWith('/ws/live?')) {
        liveWss.handleUpgrade(req, socket, head, (ws) => {
          liveWss.emit('connection', ws, req);
        });
      }
    });
    httpServer.once('close', () => {
      liveWss.clients.forEach((client) => client.terminate());
      liveWss.close();
    });
  }

  return liveWss;
}
