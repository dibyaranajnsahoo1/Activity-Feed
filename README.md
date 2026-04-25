# ActivityFeed — MERN Real-time Feed

> **DMAQ SDE I Assignment** — MongoDB · Express · React · Node.js  
> A production-quality, tenant-isolated activity feed with cursor pagination, WebSocket delivery, optimistic UI, and an async event queue.

---

## What Is This?

This is a full-stack web app that works like LinkedIn's activity feed, but built to demonstrate every technical concept from the MERN SDE I assignment paper. You can switch between tenants (like workspaces), post activities, watch them appear in real time across tabs, scroll infinitely through historical data, and explore system design decisions — all inside the browser.

Everything in the assignment paper is implemented and explained here.

---

## Quick Start

You need **Node.js 18+** and a **MongoDB** connection string.

### 1. Clone and install

```bash
# Backend
cd activityfeed/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure the backend

Edit `backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017/activityfeed
PORT=5000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
```

### 3. Run both servers

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm start
```

Open **http://localhost:3000** and you'll see the LinkedIn-style feed.

---

## Project Structure

```
activityfeed/
├── backend/
│   └── src/
│       ├── config/database.js        # MongoDB connection with retry
│       ├── middleware/
│       │   ├── errorHandler.js       # Global error handler
│       │   ├── tenant.js             # X-Tenant-Id extraction
│       │   └── validation.js         # Joi request validation
│       ├── models/Activity.js        # Schema + compound indexes
│       ├── queues/activityQueue.js   # In-memory queue with DLQ (Bonus)
│       ├── routes/
│       │   ├── activities.js         # Main API + /debug/perf endpoint
│       │   └── seed.js               # Demo data seeding
│       ├── services/activityService.js  # Cursor pagination logic
│       ├── utils/logger.js           # Winston logger
│       └── server.js                 # Express + WebSocket setup
└── frontend/
    └── src/
        ├── api/activityApi.js        # HTTP client
        ├── components/
        │   ├── ActivityCard.js       # LinkedIn-style card with avatar
        │   ├── ActivityFeed.js       # Infinite scroll + WS feed
        │   ├── CreatePost.js         # Optimistic activity creation
        │   ├── LeftSidebar.js        # Tenant switcher + type filters
        │   ├── Navbar.js             # Top nav with live indicator
        │   ├── RightPanel.js         # Stats, seed controls, queue info
        │   └── SystemDesignModal.js  # Task 2, 5, 6, Bonus explanations
        ├── hooks/
        │   ├── useActivityFeed.js    # Data hook (optimistic, cursor)
        │   ├── useWebSocket.js       # WS with exponential back-off
        │   └── useInfiniteScroll.js  # IntersectionObserver-based
        └── utils/activityConfig.js   # Emoji icons, colors, formatters
```

---

## How to Use the App

1. **Switch tenant** — click any workspace in the left sidebar. Each tenant has completely isolated data.
2. **Seed data** — click "+ 25 activities" or "+ 100 activities" in the right panel to populate the feed.
3. **Post an activity** — click "Share an activity update…" at the top of the feed. The row appears instantly (optimistic UI) before the API responds.
4. **Watch real time** — open a second browser tab on the same tenant and post from one — it appears in the other within milliseconds.
5. **Filter** — click any activity type in the left sidebar to filter the feed.
6. **System Design** — click "📐 Open System Design →" in the right panel to read the full technical explanation with code examples.

---

## Part 1 — Backend

### Task 1: Activity Feed API

The schema matches the assignment exactly:

```js
Activity {
  _id, tenantId, actorId, actorName,
  type, entityId, metadata, createdAt
}
```

**POST /api/activities** — Creates an activity. Supports both sync (201) and async queue (202) modes.  
**GET /api/activities** — Returns a cursor-paginated feed. Never uses `skip()`. Always returns `{ data, pagination: { nextCursor, hasMore } }`.

Tenant isolation is enforced by the `X-Tenant-Id` header middleware. Every query is scoped to the tenant — no cross-tenant data leakage is possible.

**Compound indexes** (exactly as required):

```js
// Assignment-required index
{ tenantId: 1, createdAt: -1 }

// Stable cursor (tie-breaking on _id)
{ tenantId: 1, createdAt: -1, _id: -1 }

// Filtered feeds
{ tenantId: 1, type: 1, createdAt: -1, _id: -1 }
{ tenantId: 1, actorId: 1, createdAt: -1, _id: -1 }
```

All queries use `projection` (`.select(Activity.PROJECT_FIELDS)`) — no extra fields fetched.

---

### Task 2: Performance Debugging — Skip vs Cursor

**Why `skip()` is slow:**

When you write `db.activities.find({tenantId}).sort({createdAt:-1}).skip(10000).limit(20)`, MongoDB has to scan and discard 10,000 documents before returning anything. Even with an index it still walks through 10,000 index keys. At page 500 with 20 items per page, that's 10,000 key reads every request. The cost grows linearly — O(n) — as you go deeper into the feed.

**The rewrite:**

```js
// Cursor encodes the last seen { createdAt, _id }
// MongoDB seeks directly to that position using the index
db.activities.find({
  tenantId,
  $or: [
    { createdAt: { $lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
  ]
})
.sort({ createdAt: -1, _id: -1 })
.limit(21)  // fetch one extra to detect hasMore
```

This is O(log n) regardless of how deep you are in the feed. MongoDB uses the index to jump straight to the cursor position.

**See it live:** Hit `GET /api/activities/debug/perf?page=5` with `X-Tenant-Id: tenant-acme` and you'll get the actual MongoDB `executionStats` for both approaches side by side.

**Metrics to monitor in production:**

| Metric | Target |
|---|---|
| `docsExamined / nReturned` | ≈ 1.0 (tight index) |
| `executionTimeMillis` | < 10ms at p99 |
| `IXSCAN vs COLLSCAN` | Always IXSCAN |
| `indexKeysExamined` | Low = good selectivity |

---

## Part 2 — Frontend

### Task 3: ActivityFeed Component

The `ActivityFeed` component (`src/components/ActivityFeed.js`) uses only hooks — no Redux, no class components.

- **Infinite scroll** — `useInfiniteScroll` uses `IntersectionObserver` on a 1px sentinel div at the bottom. When it enters the viewport, `loadMore()` is called automatically.
- **Real-time updates** — `useWebSocket` maintains a tenant-scoped WebSocket connection. New activities are injected into the top of the feed via `injectActivity()`.
- **Filtering** — Type filter state lives in `App.js` and flows down as props. Changing a filter resets the cursor and refetches from the beginning.
- **Loading state** — Three animated skeleton cards appear during every fetch.
- **Empty state** — A friendly empty state prompts you to seed data or post an activity.
- **New-items banner** — When real-time activities arrive but the user is scrolled down, a blue banner appears at the top: "🔔 3 new activities — click to refresh".

Re-render prevention: `ActivityCard` is wrapped in `React.memo`. `useCallback` is used on all event handlers. The feed list only re-renders when `activities`, `loading`, or `error` changes.

---

### Task 4: Optimistic UI Update

When you click "🚀 Post Activity", this happens in order:

1. A temporary activity row (with `_optimistic: true`) is prepended to the feed immediately — before any API call. You see the card appear instantly with a dashed border and "Saving…" badge.
2. The real API call happens in the background.
3. **If it succeeds**: The temp row is swapped for the real server response (same position, dashed border removed).
4. **If it fails**: The temp row is removed — rolled back completely. A red toast shows the error message.

The idempotency key (`clientMutationId`) ensures that if the WebSocket broadcast arrives before the API response, the duplicate is detected and the temp row is swapped rather than duplicated.

**Rollback logic in code:**

```js
// 1. Insert optimistic row
setActivities(prev => [optimisticActivity, ...prev]);

try {
  // 2. Real API call
  const result = await activityApi.create(tenantId, payload, clientMutationId);
  // 3. Swap temp for real
  setActivities(prev => {
    const without = prev.filter(a => a._id !== tempId);
    return mergeUniqueById([result.data, ...without]);
  });
} catch (err) {
  // 4. ROLLBACK: remove the optimistic row
  setActivities(prev => prev.filter(a => a._id !== tempId));
}
```

---

## Part 3 — System Design

### Task 5: Scaling to 50M Activities per Tenant

**Indexing at scale:**  
The compound index `{ tenantId: 1, createdAt: -1, _id: -1 }` is the backbone. At 50M documents per tenant, this index supports O(log n) seeks. Use covered queries so MongoDB never fetches the document from the collection — just reads from the index itself.

**Sharding strategy:**  
Shard key: `{ tenantId: "hashed" }`. Hashed sharding distributes tenants evenly across shards. Do not use a ranged shard key on tenantId — it creates a hotspot where all writes from one tenant hammer a single shard.

**Hot tenant isolation:**  
A tenant generating 1M writes/day gets a dedicated shard zone via MongoDB Zone Sharding. The API gateway applies per-tenant rate limits. Write bursts are absorbed by the async queue (Bull + Redis) and smoothed out before hitting MongoDB.

**Data retention:**  
A TTL index (`{ expireAfterSeconds: 7776000 }`) auto-deletes documents older than 90 days. For compliance-sensitive tenants, documents are archived to S3 via MongoDB Atlas Data Lake before deletion.

**WebSocket vs SSE:**  
WebSocket is used here because the client sends data (heartbeats, filter updates). For a pure read-only feed at 50M scale, SSE over HTTP/2 would be better — no upgrade handshake, proxy-friendly, native auto-reconnect, and each connection is just an HTTP response stream.

---

## Part 4 — Debugging & Refactoring

### Task 6: The useEffect Bug

**The buggy code from the question paper:**

```js
useEffect(() => {
  fetchActivities().then(setActivities);
}, [activities]);  // ← BUG
```

**What goes wrong:**

1. Effect runs → `fetchActivities()` resolves → `setActivities(data)` is called
2. `activities` state changes → React re-runs the effect (it's in the deps array)
3. Repeat forever → infinite API calls → browser freezes → memory leak

In production this hammers MongoDB thousands of times per second, trips rate limiters, and causes the browser tab to crash.

**The fix:**

```js
// fetchActivities is a stable useCallback — deps are tenantId and filters
const fetchActivities = useCallback(async (cursor, replace, signal) => {
  const result = await api.getFeed(tenantId, { cursor });
  // Functional setState never reads the 'activities' closure
  setActivities(prev => {
    const next = replace ? result.data : [...prev, ...result.data];
    return mergeUniqueById(next);
  });
}, [tenantId, filters.type, filters.actorId]);

// Effect deps = stable callbacks, NOT the data they produce
useEffect(() => {
  const ctrl = new AbortController();
  fetchActivities(null, true, ctrl.signal);
  return () => ctrl.abort();  // cleanup cancels the in-flight request
}, [fetchActivities, fetchStats]);
```

**Prevention:**
- Install `eslint-plugin-react-hooks` — the `exhaustive-deps` rule catches this at build time
- Never put derived state (arrays, objects produced by the effect) as a dependency
- Always use functional setState (`prev => ...`) inside effects that fetch data
- Run with `React.StrictMode` — it double-invokes effects in development and reveals infinite loops immediately

---

## Bonus: Event-Driven Architecture

The backend includes an in-memory async queue (`src/queues/activityQueue.js`) for high-throughput write scenarios.

**How it works:**

```
Client POST → API (202 Accepted) → Queue → Worker → MongoDB → WS Broadcast
```

Send `X-Async: true` header to use the queue. The API returns `202 Accepted` with a `jobId` immediately — the client doesn't wait for the MongoDB write.

**Idempotency:**  
Every request carries an `Idempotency-Key` header. If the same key is seen twice (network retry), the server returns the cached 200 without re-processing. This prevents duplicate activities.

**Failure handling:**
- 3 retry attempts with exponential back-off (1s, 3s, 9s)
- Jobs that fail all 3 retries go to the Dead Letter Queue (DLQ)
- Replay a DLQ job: `POST /api/activities/queue/replay/:jobId`
- View queue stats: `GET /api/activities/queue/stats`

**Production tools:**  
For real scale, replace the in-memory queue with Bull + Redis (dashboard included), AWS SQS (managed, FIFO), or RabbitMQ (pub/sub routing). The interface (`enqueue`, `replayJob`, `getStats`) is the same — just swap the implementation.

---

## API Reference

| Method | Path | Header | Description |
|---|---|---|---|
| POST | `/api/activities` | `X-Tenant-Id` | Create activity (sync or async) |
| GET  | `/api/activities` | `X-Tenant-Id` | Cursor-paginated feed |
| GET  | `/api/activities/stats` | `X-Tenant-Id` | Count by type |
| GET  | `/api/activities/debug/perf` | `X-Tenant-Id` | Skip vs cursor explain stats |
| GET  | `/api/activities/queue/stats` | `X-Tenant-Id` | Queue metrics |
| POST | `/api/activities/queue/replay/:id` | `X-Tenant-Id` | Replay DLQ job |
| POST | `/api/seed/seed?count=50` | `X-Tenant-Id` | Insert demo data |
| DELETE | `/api/seed/seed` | `X-Tenant-Id` | Clear tenant data |
| GET  | `/health` | — | Server + WS status |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Database | MongoDB | Document model fits activity events naturally |
| ODM | Mongoose | Schema validation + index management |
| Server | Express.js | Minimal, fast, widely understood |
| Real-time | WebSocket (ws) | Bidirectional, low latency |
| UI | React 18 | Hooks-only, concurrent features |
| Styling | Vanilla CSS | Full control, no build-time overhead |
| Validation | Joi | Declarative, composable schemas |
| Logging | Winston | Structured JSON logs in production |
| Queue | In-memory (Bull-compatible interface) | Zero deps for local dev |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | — | MongoDB connection string (required) |
| `PORT` | `5000` | Express server port |
| `NODE_ENV` | `development` | Enables dev logging |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (1 min) |
| `RATE_LIMIT_MAX` | `200` | Max requests per window |
| `REACT_APP_API_URL` | `""` | Backend URL (uses CRA proxy in dev) |
| `REACT_APP_WS_URL` | `ws://localhost:5000` | WebSocket server URL |

---

*Built with care for the DMAQ MERN SDE I assignment. Every task in the question paper maps directly to working code in this repository.*
