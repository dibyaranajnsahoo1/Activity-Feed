import React, { useState, useCallback, useEffect, memo } from 'react';
import { useActivityFeed }   from '../hooks/useActivityFeed';
import { useWebSocket }      from '../hooks/useWebSocket';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import ActivityCard          from './ActivityCard';
import CreatePost            from './CreatePost';

// ─── ActivityFeed ─────────────────────────────────────────────────────────────
// Task 3: Infinite scroll, real-time WS, filters, optimistic UI,
// loading skeletons, empty + error states.

function ActivityFeed({ tenantId, filters = {}, onStatsUpdate }) {
  const [toast,  setToast]  = useState(null);
  const [newIds, setNewIds] = useState(new Set());

  const {
    activities, loading, error, hasMore,
    stats, newCount, loadMore, createActivity,
    injectActivity, refresh, resetNewCount,
  } = useActivityFeed(tenantId, filters);

  // Lift stats up so Sidebar + RightPanel can display them
  useEffect(() => {
    if (stats && onStatsUpdate) onStatsUpdate(stats);
  }, [stats, onStatsUpdate]);

  // ── WebSocket real-time injection ─────────────────────────────────────────
  const handleWsMsg = useCallback((msg) => {
    if (msg.type === 'NEW_ACTIVITY' && msg.activity) {
      injectActivity(msg.activity);
      setNewIds(prev => new Set([...prev, msg.activity._id]));
    }
  }, [injectActivity]);

  useWebSocket(tenantId, handleWsMsg);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const sentinelRef = useInfiniteScroll(loadMore, hasMore, loading);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Create + optimistic ───────────────────────────────────────────────────
  const handleCreate = useCallback(async (data) => {
    const result = await createActivity(data);
    showToast(
      result.success ? '✅ Activity posted!' : `⚡ Rolled back: ${result.error}`,
      result.success ? 'success' : 'error',
    );
    return result;
  }, [createActivity, showToast]);

  const handleShowNew = useCallback(() => {
    resetNewCount();
    setNewIds(new Set());
    refresh();
  }, [resetNewCount, refresh]);

  return (
    <div className="feed-col">
      {/* New-items banner */}
      {newCount > 0 && (
        <button className="new-items-banner" onClick={handleShowNew}>
          🔔 {newCount} new {newCount === 1 ? 'activity' : 'activities'} — click to refresh
        </button>
      )}

      {/* Create post box */}
      <CreatePost onSubmit={handleCreate} currentUser="Demo User" />

      {/* Error */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={refresh}>Retry</button>
        </div>
      )}

      {/* Feed list */}
      <div className="feed-list" aria-label="Activity feed">
        {activities.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No activities yet</h3>
            <p>Use the Seed Data panel on the right to populate this tenant's feed, or post a new activity above.</p>
          </div>
        )}

        {activities.map(activity => (
          <ActivityCard
            key={activity._id}
            activity={activity}
            isNew={newIds.has(activity._id)}
          />
        ))}

        <div ref={sentinelRef} className="scroll-sentinel" />

        {loading && (
          <div className="skeletons">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card">
                <div className="sk sk-avatar" />
                <div className="sk-body">
                  <div className="sk sk-title" />
                  <div className="sk sk-line" />
                  <div className="sk sk-line short" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasMore && activities.length > 0 && !loading && (
          <div className="feed-end">✓ All {activities.length} activities loaded</div>
        )}
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert">{toast.msg}</div>
      )}
    </div>
  );
}

export default memo(ActivityFeed);
