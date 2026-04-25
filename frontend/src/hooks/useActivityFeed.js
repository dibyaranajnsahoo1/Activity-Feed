// ─── useActivityFeed ──────────────────────────────────────────────────────────
// Task 3: Core data hook for the activity feed.
// Task 4: Implements optimistic UI + rollback.
//
// Task 6 — The Bug:
//   BAD:  useEffect(() => { fetchActivities().then(setActivities); }, [activities]);
//         ↑ 'activities' as dependency creates an infinite loop:
//           fetch → setActivities → activities changes → re-runs effect → repeat.
//         Production impact: API hammered, browser freezes, memory leak.
//
// FIX (below): Dependencies are [fetchActivities, fetchStats] — stable
//   useCallback refs that only change when tenantId or filters change.
//   fetchActivities does NOT use 'activities' internally; it receives cursor
//   as an argument and uses the functional setState form to merge safely.
//
// Prevention: ESLint react-hooks/exhaustive-deps catches this. Always list
//   exactly what the effect reads. Avoid derived state as deps.

import { useState, useEffect, useCallback } from 'react';
import activityApi from '../api/activityApi';

function mergeUniqueById(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item?._id || seen.has(item._id)) return false;
    seen.add(item._id);
    return true;
  });
}

function matchesFilters(activity, filters) {
  if (filters.type    && activity.type    !== filters.type)    return false;
  if (filters.actorId && activity.actorId !== filters.actorId) return false;
  return true;
}

export function useActivityFeed(tenantId, filters = {}) {
  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [cursor,     setCursor]     = useState(null);
  const [hasMore,    setHasMore]    = useState(true);
  const [stats,      setStats]      = useState(null);
  const [newCount,   setNewCount]   = useState(0); // badge for real-time arrivals

  // ── Stats ─────────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!tenantId) return;
    try {
      const result = await activityApi.getStats(tenantId);
      setStats(result.data);
    } catch { /* non-critical */ }
  }, [tenantId]);

  // ── Fetch page ────────────────────────────────────────────────────────────
  // NOTE: 'activities' is intentionally NOT a dependency (see Task 6 above).
  const fetchActivities = useCallback(async (cursorValue = null, replace = false, signal) => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);

    try {
      const result = await activityApi.getFeed(tenantId, {
        cursor:  cursorValue,
        limit:   20,
        type:    filters.type,
        actorId: filters.actorId,
        signal,
      });

      // Functional setState — never reads stale 'activities' closure
      setActivities(prev => {
        const next = replace ? result.data : [...prev, ...result.data];
        return mergeUniqueById(next);
      });
      setCursor(result.pagination.nextCursor);
      setHasMore(result.pagination.hasMore);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to load activities');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [tenantId, filters.type, filters.actorId]);

  // ── Bootstrap / filter change ─────────────────────────────────────────────
  // FIXED: deps are stable callbacks, NOT the activities array.
  useEffect(() => {
    const controller = new AbortController();
    setCursor(null);
    setActivities([]);
    setHasMore(true);
    setNewCount(0);
    fetchActivities(null, true, controller.signal);
    fetchStats();
    return () => controller.abort();
  }, [fetchActivities, fetchStats]);

  // ── Load next page ────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!loading && hasMore && cursor) {
      fetchActivities(cursor, false);
    }
  }, [loading, hasMore, cursor, fetchActivities]);

  // ── Task 4: Optimistic create + rollback ──────────────────────────────────
  const createActivity = useCallback(async (data) => {
    // 1. Generate a mutation ID for idempotency and temp-item tracking
    const clientMutationId = `mut_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tempId = `temp_${clientMutationId}`;

    const payload = {
      ...data,
      metadata: { ...(data.metadata || {}), clientMutationId },
    };

    // 2. Inject optimistic row immediately (before API call)
    const optimisticActivity = {
      _id:        tempId,
      tenantId,
      actorId:    payload.actorId,
      actorName:  payload.actorName,
      type:       payload.type,
      entityId:   payload.entityId,
      metadata:   payload.metadata,
      createdAt:  new Date().toISOString(),
      _optimistic: true,
    };

    if (matchesFilters(optimisticActivity, filters)) {
      setActivities(prev => mergeUniqueById([optimisticActivity, ...prev]));
    }

    try {
      // 3. Real API call
      const result = await activityApi.create(tenantId, payload, clientMutationId);
      const real   = { ...result.data, _optimistic: false };

      // 4. Swap temp row with real server response
      setActivities(prev => {
        const without = prev.filter(a => a._id !== tempId);
        if (!matchesFilters(real, filters)) return without;
        return mergeUniqueById([real, ...without]);
      });
      fetchStats();
      return { success: true, activity: real };

    } catch (err) {
      // 5. ROLLBACK: remove optimistic row on failure
      setActivities(prev => prev.filter(a => a._id !== tempId));
      return { success: false, error: err.message };
    }
  }, [tenantId, filters, fetchStats]);

  // ── Inject real-time WS activity ──────────────────────────────────────────
  const injectActivity = useCallback((activity) => {
    if (!matchesFilters(activity, filters)) {
      setNewCount(n => n + 1); // count arrivals that don't match current filter
      return;
    }
    setActivities(prev => {
      // If we already have a temp row with same clientMutationId, swap it
      const cid    = activity.metadata?.clientMutationId;
      const tempId = cid ? `temp_${cid}` : null;
      const base   = tempId ? prev.filter(a => a._id !== tempId) : prev;
      return mergeUniqueById([{ ...activity, _optimistic: false }, ...base]);
    });
    fetchStats();
  }, [filters, fetchStats]);

  const refresh = useCallback(() => {
    setCursor(null);
    setActivities([]);
    setHasMore(true);
    setNewCount(0);
    fetchActivities(null, true);
    fetchStats();
  }, [fetchActivities, fetchStats]);

  return {
    activities,
    loading,
    error,
    hasMore,
    stats,
    newCount,
    loadMore,
    createActivity,
    injectActivity,
    refresh,
    resetNewCount: () => setNewCount(0),
  };
}
