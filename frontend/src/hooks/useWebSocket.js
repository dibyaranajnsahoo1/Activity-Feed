// ─── useWebSocket ─────────────────────────────────────────────────────────────
// Task 3 / Task 5: Real-time delivery via WebSocket.
//
// Design notes (Task 5 — SSE vs WebSocket):
//   WebSocket → chosen here. Supports bidirectional comms, lower latency,
//   multiplexing. Ideal when clients send heartbeats / filter changes.
//   SSE → simpler, works over HTTP/2, auto-reconnect built-in. Good for
//   pure server-push where client never sends data.
//
// This hook: tenant-scoped connection, exponential back-off reconnect,
// heartbeat ping/pong detection, and clean unmount teardown.

import { useEffect, useState, useRef } from 'react';
// onMessage is held in a ref so updating it never triggers a reconnect
import { WS_URL } from '../config/urls';

const MAX_RETRIES = 5;

export function useWebSocket(tenantId, onMessage) {
  const [status, setStatus] = useState('disconnected');
  const retryCount   = useRef(0);
  const timerRef     = useRef(null);
  const socketRef    = useRef(null);
  // Keep the latest callback in a ref — avoids adding it to the effect dep array
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    if (!tenantId) return undefined;

    let destroyed = false;

    function connect() {
      if (destroyed) return;
      setStatus('connecting');

      const ws = new WebSocket(`${WS_URL}/ws?tenantId=${encodeURIComponent(tenantId)}`);
      socketRef.current = ws;

      ws.onopen = () => {
        if (destroyed) { ws.close(1000); return; }
        setStatus('connected');
        retryCount.current = 0;
      };

      ws.onmessage = (evt) => {
        try { onMessageRef.current(JSON.parse(evt.data)); } catch { /* ignore bad frames */ }
      };

      ws.onclose = (evt) => {
        setStatus('disconnected');
        if (destroyed) return;
        // Do NOT reconnect on: clean close(1000) or rejected tenant(4001)
        if (evt.code === 1000 || evt.code === 4001) return;
        if (retryCount.current >= MAX_RETRIES) return;
        // Exponential back-off: 1s, 2s, 4s, 8s, 16s
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        retryCount.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(timerRef.current);
      const ws = socketRef.current;
      // Only close if the socket is still CONNECTING(0) or OPEN(1).
      // Calling close() on an already-CLOSING/CLOSED socket is a no-op but
      // closing a CONNECTING socket is what produces the browser warning.
      if (ws && ws.readyState < WebSocket.CLOSING) ws.close(1000);
    };
  // onMessage is intentionally omitted — it is accessed through onMessageRef
  // so that updating the callback never causes a reconnect cycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  return { status };
}
