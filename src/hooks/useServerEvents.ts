/**
 * src/hooks/useServerEvents.ts
 * WebSocket hook — connects to backend ws://localhost:3001/ws
 * Delivers live events: playwright screenshots, sandbox results,
 * HITL triggers, metacognitive overwatch alerts.
 */
import { useEffect, useRef, useCallback, useState } from "react";

export interface ServerEvent {
  type:    string;
  payload: unknown;
  ts:      string;
}

type Handler = (event: ServerEvent) => void;

export function useServerEvents(onEvent?: Handler) {
  const wsRef      = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Handler[]>(onEvent ? [onEvent] : []);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ServerEvent | null>(null);

  useEffect(() => {
    if (onEvent) handlersRef.current = [onEvent];
  }, [onEvent]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket("ws://localhost:3001/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[ws] Connected to Microfixd backend");
    };

    ws.onmessage = (e) => {
      try {
        const event: ServerEvent = JSON.parse(e.data);
        setLastEvent(event);
        handlersRef.current.forEach(h => h(event));
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect]);

  const send = useCallback((type: string, payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const subscribe = useCallback((handler: Handler) => {
    handlersRef.current.push(handler);
    return () => {
      handlersRef.current = handlersRef.current.filter(h => h !== handler);
    };
  }, []);

  return { connected, lastEvent, send, subscribe };
}
