// ─── Activity API Client ───────────────────────────────────────────────────────
// Centralised HTTP layer. All requests go through here so base-URL and
// tenant-header injection happen in one place.

// Use https:// for production (HTTPS), http:// for local development
const BASE_URL = process.env.NODE_ENV === 'production'
  ? (process.env.REACT_APP_API_URL_PROD || 'https://activity-feed-dfpx.onrender.com')
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000');

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

const activityApi = {
  // ── Task 1: POST /activities ─────────────────────────────────────────────
  // X-Idempotency-Key ensures duplicate prevention (Task 4 + Bonus).
  async create(tenantId, payload, idempotencyKey) {
    return request('/api/activities', {
      method: 'POST',
      headers: {
        'X-Tenant-Id': tenantId,
        'Idempotency-Key': idempotencyKey || `idem-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });
  },

  // ── Task 1: GET /activities — cursor-based only, never skip ──────────────
  async getFeed(tenantId, { cursor, limit = 20, type, actorId, signal } = {}) {
    const params = new URLSearchParams({ limit });
    if (cursor)  params.set('cursor', cursor);
    if (type)    params.set('type', type);
    if (actorId) params.set('actorId', actorId);

    return request(`/api/activities?${params}`, {
      headers: { 'X-Tenant-Id': tenantId },
      signal,
    });
  },

  async getById(tenantId, id) {
    return request(`/api/activities/${id}`, {
      headers: { 'X-Tenant-Id': tenantId },
    });
  },

  async getStats(tenantId) {
    return request('/api/activities/stats', {
      headers: { 'X-Tenant-Id': tenantId },
    });
  },

  // ── Task 2: Performance debug — skip() vs cursor comparison ─────────────
  async getDebugPerf(tenantId, page = 1) {
    return request(`/api/activities/debug/perf?page=${page}`, {
      headers: { 'X-Tenant-Id': tenantId },
    });
  },

  // ── Queue stats (Bonus) ──────────────────────────────────────────────────
  async getQueueStats(tenantId) {
    return request('/api/activities/queue/stats', {
      headers: { 'X-Tenant-Id': tenantId },
    });
  },

  // ── Seed helper ──────────────────────────────────────────────────────────
  async seed(tenantId, count = 50) {
    return request(`/api/seed/seed?count=${count}`, {
      method: 'POST',
      headers: { 'X-Tenant-Id': tenantId },
    });
  },

  async clearSeed(tenantId) {
    return request('/api/seed/seed', {
      method: 'DELETE',
      headers: { 'X-Tenant-Id': tenantId },
    });
  },
};

export default activityApi;
