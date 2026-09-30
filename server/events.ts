import type { WebSocket } from "ws";

type BroadcastFn = (type: string, payload: unknown) => void;

const clients = new Set<WebSocket>();
let _customBroadcaster: BroadcastFn | null = null;

export function registerWsClient(ws: WebSocket): void {
  clients.add(ws);
}

export function unregisterWsClient(ws: WebSocket): void {
  clients.delete(ws);
}

export function getWsClientCount(): number {
  return clients.size;
}

export function setCustomBroadcaster(fn: BroadcastFn): void {
  _customBroadcaster = fn;
}

export function broadcast(type: string, payload: unknown): void {
  if (_customBroadcaster) {
    try {
      _customBroadcaster(type, payload);
    } catch {
      // ignore
    }
  }

  const msg = JSON.stringify({ type, payload, ts: new Date().toISOString() });
  clients.forEach((ws) => {
    if (ws.readyState === 1 /* WebSocket.OPEN */) {
      try {
        ws.send(msg);
      } catch {
        // ignore send error
      }
    }
  });
}
