import React, { useState, useCallback, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import LeftSidebar from './components/LeftSidebar';
import ActivityFeed from './components/ActivityFeed';
import RightPanel from './components/RightPanel';
import SystemDesignModal from './components/SystemDesignModal';
import activityApi from './api/activityApi';
import { WS_URL } from './config/urls';
import './App.css';

// ─── App ──────────────────────────────────────────────────────────────────────
// LinkedIn-style 3-column layout: Left sidebar | Feed | Right panel.
// wsStatus is tracked here so Navbar and RightPanel stay in sync.
// A lightweight WS connection in Navbar is for status display only;
// the feed's own useWebSocket in ActivityFeed does the actual data work.

export default function App() {
  const [tenantId, setTenantId] = useState('tenant-acme');
  const [filters, setFilters] = useState({});
  const [showSysDesign, setShowSysDesign] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);

  // Lightweight WS #1: status indicator only (Navbar / RightPanel dot).
  // WS #2 lives inside ActivityFeed → useWebSocket, which handles all feed data.
  // Two connections are intentional: status display is decoupled from data flow.
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let destroyed = false;
    let retries = 0;

    function connect() {
      if (destroyed) return;
      setWsStatus('connecting');
      const ws = new WebSocket(`${WS_URL}/ws?tenantId=${encodeURIComponent(tenantId)}`);
      wsRef.current = ws;
      ws.onopen = () => { if (!destroyed) { setWsStatus('connected'); retries = 0; } };
      ws.onclose = (e) => {
        setWsStatus('disconnected');
        if (!destroyed && e.code !== 1000 && e.code !== 4001 && retries < 5) {
          timerRef.current = setTimeout(connect, Math.min(1000 * 2 ** retries++, 20000));
        }
      };
      ws.onerror = () => { /* browser fires onclose automatically; reconnect handled there */ };
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(timerRef.current);
      // Guard: only close if CONNECTING(0) or OPEN(1) — avoids the
      // "WebSocket closed before connection established" browser warning.
      if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
        wsRef.current.close(1000);
      }
    };
  }, [tenantId]);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleChangeTenant = useCallback((id) => {
    setTenantId(id);
    setFilters({});
    setStats(null);
  }, []);

  const handleSeed = useCallback(async (count) => {
    try {
      await activityApi.seed(tenantId, count);
      showToast(`✅ Seeded ${count} activities`, 'success');
      // Re-trigger feed by toggling filters ref
      setFilters(f => ({ ...f, _t: Date.now() }));
    } catch (err) {
      showToast(`❌ Seed failed: ${err.message}`, 'error');
    }
  }, [tenantId, showToast]);

  const handleClear = useCallback(async () => {
    try {
      await activityApi.clearSeed(tenantId);
      showToast(`🗑 Cleared all data for ${tenantId}`, 'info');
      setFilters(f => ({ ...f, _t: Date.now() }));
      setStats(null);
    } catch (err) {
      showToast(`❌ Clear failed: ${err.message}`, 'error');
    }
  }, [tenantId, showToast]);

  // Stable filter without the internal _t trigger key
  const feedFilters = { type: filters.type, actorId: filters.actorId };

  return (
    <>
      <div className="app-shell">
        <Navbar wsStatus={wsStatus} tenantId={tenantId} />

        <div className="app-body">
          <LeftSidebar
            tenantId={tenantId}
            onChangeTenant={handleChangeTenant}
            filters={feedFilters}
            onFilterChange={setFilters}
            stats={stats}
          />

          <main className="feed-main" role="main">
            {/* key forces full remount on tenant change */}
            <ActivityFeed
              key={`${tenantId}-${filters._t || 0}`}
              tenantId={tenantId}
              filters={feedFilters}
              onStatsUpdate={setStats}
            />
          </main>

          <RightPanel
            tenantId={tenantId}
            wsStatus={wsStatus}
            stats={stats}
            onSeed={handleSeed}
            onClear={handleClear}
            onOpenSystemDesign={() => setShowSysDesign(true)}
          />
        </div>

        {/* <footer className="app-footer">
          <span>MongoDB cursor pagination</span><span className="dot">·</span>
          <span>WebSocket real-time</span><span className="dot">·</span>
          <span>Optimistic UI + rollback</span><span className="dot">·</span>
          <span>Async queue</span><span className="dot">·</span>
          <span>Tenant isolation</span>
        </footer> */}
      </div>

      {showSysDesign && <SystemDesignModal onClose={() => setShowSysDesign(false)} />}

      {toast && (
        <div className={`global-toast toast-${toast.type}`} role="alert">{toast.msg}</div>
      )}
    </>
  );
}
