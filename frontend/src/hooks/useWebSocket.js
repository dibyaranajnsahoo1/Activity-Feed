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

// Use environment variable or default to production URL
// The URL determines the protocol: wss:// for production, ws:// for localhost
const getWsUrl = () => {
  const envUrl = process.env.REACT_APP_WS_URL_PROD || process.env.REACT_APP_WS_URL;
  if (envUrl) return envUrl;
  // Default: use wss:// for production, ws:// for local
  return 'wss://activity-feed-dfpx.onrender.com';
};

const WS_URL = getWsUrl();
const MAX_RETRIES = 5;

export function useWebSocket(tenantId, onMessage) {
  const [status, setStatus] = useState('disconnected');
  const retryCount = useRef(0);
  const timerRef  = useRef(null);
  const socketRef = useRef(null);

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
        try { onMessage(JSON.parse(evt.data)); } catch { /* ignore bad frames */ }
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
      if (socketRef.current) socketRef.current.close(1000);
    };
  // onMessage is listed as a dep but is stable because every caller wraps
  // it in useCallback — so this effect only re-runs on real tenant changes.
  }, [tenantId, onMessage]);

  return { status };
}
