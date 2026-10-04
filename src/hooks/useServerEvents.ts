/**
 * src/hooks/useServerEvents.ts
 * WebSocket hook — connects to the page host, using WSS on HTTPS
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

  const stopped = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (stopped.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({type:"authenticate",payload:{token:window.sessionStorage.getItem("microfixd_operator_token") || ""}}));
    };

    ws.onmessage = (e) => {
      try {
        const event: ServerEvent = JSON.parse(e.data);
        if(event.type === "authenticated") setConnected(true);
        setLastEvent(event);
        handlersRef.current.forEach(h => h(event));
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3s
      if (!stopped.current) reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    stopped.current = false;
    connect();
    const reauthenticate=()=>{
      if(reconnectTimer.current)clearTimeout(reconnectTimer.current);
      if(wsRef.current){wsRef.current.onclose=null;wsRef.current.close();wsRef.current=null;}
      setConnected(false);connect();
    };
    window.addEventListener('microfixd:auth-changed',reauthenticate);
    return () => {
      window.removeEventListener('microfixd:auth-changed',reauthenticate);
      stopped.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
      wsRef.current = null;
    };
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
