import React, { useState, useCallback, memo } from 'react';
import activityApi from '../api/activityApi';

// ─── RightPanel ───────────────────────────────────────────────────────────────
// Shows: live WS status, activity stats, queue info, seed controls,
// and a button to open the System Design modal.

function RightPanel({ tenantId, wsStatus, stats, onSeed, onClear, onOpenSystemDesign }) {
  const [seeding,  setSeeding]  = useState(false);
  const [clearing, setClearing] = useState(false);
  const [queueStats, setQueueStats] = useState(null);
  const [loadingQ,   setLoadingQ]   = useState(false);

  const handleSeed = useCallback(async (count) => {
    setSeeding(true);
    try { await onSeed(count); } finally { setSeeding(false); }
  }, [onSeed]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    try { await onClear(); } finally { setClearing(false); }
  }, [onClear]);

  const loadQueueStats = useCallback(async () => {
    setLoadingQ(true);
    try {
      const res = await activityApi.getQueueStats(tenantId);
      setQueueStats(res.data);
    } catch { setQueueStats(null); }
    finally { setLoadingQ(false); }
  }, [tenantId]);

  const statusColor = wsStatus === 'connected'   ? '#10b981'
                    : wsStatus === 'connecting'   ? '#f59e0b'
                    : '#ef4444';

  return (
    <aside className="right-panel">
      {/* Live Status */}
      <div className="rp-card">
        <h3 className="rp-title">Connection</h3>
        <div className="ws-indicator">
          <span className="ws-pulse" style={{ '--pulse-color': statusColor }} />
          <span className="ws-label" style={{ color: statusColor }}>
            {wsStatus === 'connected'  ? 'Live — Real-time'   :
             wsStatus === 'connecting' ? 'Connecting…'        :
                                        'Offline (reconnecting)'}
          </span>
        </div>
        <p className="rp-hint">WebSocket broadcasts new activities instantly to all connected clients in the same tenant.</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="rp-card">
          <h3 className="rp-title">Feed Stats</h3>
          <div className="rp-stat-row">
            <span className="rp-stat-num">{stats.total?.toLocaleString() ?? '—'}</span>
            <span className="rp-stat-label">Total activities</span>
          </div>
          <div className="rp-types">
            {stats.byType?.slice(0, 6).map(item => (
              <div key={item._id} className="rp-type-row">
                <span className="rp-type-name">{item._id.replace(/_/g, ' ')}</span>
                <span className="rp-type-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seed Controls */}
      <div className="rp-card">
        <h3 className="rp-title">Seed Data</h3>
        <p className="rp-hint">Insert demo activities into the current tenant workspace.</p>
        <div className="seed-buttons">
          <button className="btn-seed" onClick={() => handleSeed(25)} disabled={seeding}>
            {seeding ? 'Seeding…' : '+ 25 activities'}
          </button>
          <button className="btn-seed" onClick={() => handleSeed(100)} disabled={seeding}>
            {seeding ? 'Seeding…' : '+ 100 activities'}
          </button>
        </div>
        <button className="btn-clear" onClick={handleClear} disabled={clearing}>
          {clearing ? 'Clearing…' : '🗑 Clear tenant data'}
        </button>
      </div>

      {/* Queue */}
      <div className="rp-card">
        <h3 className="rp-title">Async Queue <span className="bonus-tag">BONUS</span></h3>
        <p className="rp-hint">
          Use <code>X-Async: true</code> header for background processing.
          Queue returns 202 immediately.
        </p>
        <button className="btn-outline" onClick={loadQueueStats} disabled={loadingQ}>
          {loadingQ ? 'Loading…' : '📊 Load Queue Stats'}
        </button>
        {queueStats && (
          <div className="queue-stats">
            {Object.entries(queueStats).map(([k, v]) => (
              <div key={k} className="queue-stat-row">
                <span>{k}</span>
                <span className="queue-stat-val">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Design */}
      <div className="rp-card rp-design">
        <h3 className="rp-title">System Design</h3>
        <p className="rp-hint">Covers all assignment tasks: performance debugging, 50M scale, WebSocket vs SSE, event-driven architecture.</p>
        <button className="btn-design" onClick={onOpenSystemDesign}>
          📐 Open System Design →
        </button>
      </div>
    </aside>
  );
}

export default memo(RightPanel);
