import React, { useState, memo } from 'react';

// ─── SystemDesignModal ────────────────────────────────────────────────────────
// Covers: Task 2, Task 5, Task 6, and Bonus in one scrollable overlay.

const TABS = [
  { id: 'task2',  label: '⚡ Task 2 — Perf', title: 'Slow Query Fix (Skip → Cursor)' },
  { id: 'task5',  label: '🏗 Task 5 — Scale', title: 'Scaling to 50M Activities/Tenant' },
  { id: 'task6',  label: '🐛 Task 6 — Bug',   title: 'useEffect Infinite Loop Bug' },
  { id: 'bonus',  label: '🚀 Bonus — Queue',  title: 'Event-Driven Architecture' },
];

function SystemDesignModal({ onClose }) {
  const [tab, setTab] = useState('task2');

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">System Design & Debugging</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tab bar */}
        <div className="modal-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`modal-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab === 'task2' && <Task2Content />}
          {tab === 'task5' && <Task5Content />}
          {tab === 'task6' && <Task6Content />}
          {tab === 'bonus' && <BonusContent />}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Task2Content() {
  return (
    <div className="sd-content">
      <h3>Why <code>skip()</code> is slow</h3>
      <p>
        MongoDB's <code>skip(n)</code> must scan and discard <em>n</em> documents before
        returning results. At page 500 with 20 items/page = <strong>10,000 docs scanned</strong>
        on every request — even with an index. This causes:
      </p>
      <ul>
        <li>Query time grows linearly with page number → <strong>O(n)</strong></li>
        <li>Memory pressure from large cursor positions</li>
        <li>Race conditions: new inserts shift offsets, causing duplicates or gaps</li>
      </ul>

      <h3>The Fix — Cursor Pagination</h3>
      <div className="code-block">
        <div className="code-label">❌ BEFORE — skip() (slow)</div>
        <pre>{`// Scans 10,000 docs to return 20
db.activities
  .find({ tenantId })
  .sort({ createdAt: -1 })
  .skip(500 * 20)   // 10,000 docs thrown away
  .limit(20)`}</pre>
      </div>

      <div className="code-block good">
        <div className="code-label">✅ AFTER — Cursor pagination (O(log n))</div>
        <pre>{`// Cursor encodes { createdAt, _id } of last seen item
// MongoDB seeks directly to that position via index
db.activities.find({
  tenantId,
  $or: [
    { createdAt: { $lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }
  ]
})
.sort({ createdAt: -1, _id: -1 })
.limit(21)  // +1 to detect hasMore`}</pre>
      </div>

      <h3>Correct Index</h3>
      <div className="code-block good">
        <pre>{`// Compound index — required by assignment
db.activities.createIndex(
  { tenantId: 1, createdAt: -1, _id: -1 },
  { name: "tenant_feed_cursor_stable" }
)
// Separate index for filtered feeds (type or actorId)
db.activities.createIndex({ tenantId: 1, type: 1, createdAt: -1, _id: -1 })`}</pre>
      </div>

      <h3>Metrics to Monitor</h3>
      <div className="metrics-grid">
        {[
          { m: 'docsExamined / nReturned', d: 'Should be ≈1.0 after indexing' },
          { m: 'executionTimeMillis', d: 'Target < 10ms at p99' },
          { m: 'IXSCAN vs COLLSCAN', d: 'Always IXSCAN — never COLLSCAN' },
          { m: 'indexKeysExamined', d: 'Low = tight index selectivity' },
        ].map(({ m, d }) => (
          <div key={m} className="metric-card">
            <code>{m}</code>
            <span>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Task5Content() {
  return (
    <div className="sd-content">
      <h3>Scaling to 50M Activities per Tenant</h3>

      <div className="scale-section">
        <div className="scale-badge">Indexing</div>
        <p>
          Compound indexes <code>{'{tenantId, createdAt, _id}'}</code> are mandatory.
          Use partial indexes for active tenants only. Consider TTL indexes for
          automatic data retention (90-day default). Covered queries (projection
          matches index keys) eliminate document fetch entirely.
        </p>
      </div>

      <div className="scale-section">
        <div className="scale-badge">Sharding Strategy</div>
        <p>
          Shard key: <code>{'{ tenantId: "hashed" }'}</code> distributes tenants
          across shards. <strong>Do NOT</strong> use <code>{'{ tenantId: 1 }'}</code>
          as ranged shard key — all writes for one tenant go to one shard (hot spot).
          Hashed sharding distributes writes evenly while keeping compound cursor
          indexes efficient per shard.
        </p>
      </div>

      <div className="scale-section">
        <div className="scale-badge">Hot Tenant Isolation</div>
        <p>
          A tenant generating 1M writes/day is a "hot tenant". Solutions:
        </p>
        <ul>
          <li>Dedicated shard zone via MongoDB Zone Sharding</li>
          <li>Per-tenant rate limiting at API gateway level</li>
          <li>Async queue (Bull/SQS) absorbs write bursts, levels the load</li>
          <li>Read replica routing for large tenants</li>
        </ul>
      </div>

      <div className="scale-section">
        <div className="scale-badge">Data Retention</div>
        <p>
          MongoDB TTL index auto-deletes old documents. For compliance-heavy
          tenants: archive to S3 via MongoDB Atlas Data Lake before deletion.
          Partition by month using time-series collections (MongoDB 5+).
        </p>
        <div className="code-block good">
          <pre>{`// TTL: auto-delete after 90 days
db.activities.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 }
)`}</pre>
        </div>
      </div>

      <div className="scale-section">
        <div className="scale-badge">Real-time Delivery: WebSocket vs SSE</div>
        <div className="vs-table">
          <div className="vs-header">
            <span>WebSocket (this app)</span>
            <span>SSE</span>
          </div>
          {[
            ['Bidirectional', 'Server → Client only'],
            ['TCP multiplexed', 'HTTP/2 native'],
            ['Custom protocol', 'Standard EventSource API'],
            ['Needs load-balancer sticky sessions', 'Works with any HTTP proxy'],
            ['Best: chat, gaming, collab', 'Best: live dashboards, feeds'],
          ].map(([ws, sse], i) => (
            <div key={i} className="vs-row">
              <span className="vs-good">{ws}</span>
              <span>{sse}</span>
            </div>
          ))}
        </div>
        <p>
          <strong>Decision:</strong> For this assignment WebSocket is used because the
          tenant filter changes can be sent from client → server. For a pure
          read-only feed at 50M scale, <strong>SSE over HTTP/2</strong> scales better
          (no upgrade handshake, proxy-friendly, auto-reconnect built-in).
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Task6Content() {
  return (
    <div className="sd-content">
      <h3>The Bug</h3>
      <div className="code-block bad">
        <div className="code-label">❌ Buggy code from the question paper</div>
        <pre>{`useEffect(() => {
  fetchActivities().then(setActivities);
}, [activities]);  // ← BUG: activities as dependency`}</pre>
      </div>

      <h3>Why It's Wrong</h3>
      <ol className="sd-list">
        <li>
          Effect runs → <code>fetchActivities()</code> resolves → <code>setActivities(data)</code>
          is called → <strong>activities state changes</strong>
        </li>
        <li>
          React sees dependency <code>activities</code> changed → <strong>re-runs effect</strong>
        </li>
        <li>
          Loop repeats: <strong>infinite API calls</strong>, browser freezes, memory leak
        </li>
      </ol>

      <div className="impact-box">
        <div className="impact-title">🔴 Production Impact</div>
        <ul>
          <li>MongoDB hit with thousands of reads per second — kills the cluster</li>
          <li>API rate-limiter trips → users see 429 errors</li>
          <li>Browser tab memory grows unbounded → crash</li>
          <li>React DevTools shows thousands of re-renders per second</li>
        </ul>
      </div>

      <h3>The Fix</h3>
      <div className="code-block good">
        <div className="code-label">✅ Fixed — stable useCallback deps, functional setState</div>
        <pre>{`// fetchActivities is a useCallback with [tenantId, filters] deps
// It never reads 'activities' directly — uses functional setState
const fetchActivities = useCallback(async (cursor, replace, signal) => {
  const result = await api.getFeed(tenantId, { cursor });
  setActivities(prev => {                 // functional form
    const next = replace ? result.data : [...prev, ...result.data];
    return mergeUniqueById(next);         // dedup by _id
  });
}, [tenantId, filters.type, filters.actorId]);

// Effect deps are stable callbacks — NOT the data they produce
useEffect(() => {
  const ctrl = new AbortController();
  fetchActivities(null, true, ctrl.signal);
  return () => ctrl.abort();             // cleanup on unmount
}, [fetchActivities, fetchStats]);       // ← correct deps`}</pre>
      </div>

      <h3>Prevention Strategy</h3>
      <div className="prevention-grid">
        {[
          { icon: '🔍', t: 'ESLint Plugin', d: 'react-hooks/exhaustive-deps catches missing or wrong deps at build time' },
          { icon: '📏', t: 'Rule of Thumb', d: 'Effect deps = what the effect READS, not what it WRITES' },
          { icon: '🔄', t: 'Functional setState', d: 'Never put derived state (arrays, objects) as deps — use prev => next form' },
          { icon: '🧪', t: 'React StrictMode', d: 'Double-invokes effects in dev — immediately reveals infinite loops' },
        ].map(({ icon, t, d }) => (
          <div key={t} className="prevention-card">
            <span className="prev-icon">{icon}</span>
            <strong>{t}</strong>
            <span>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function BonusContent() {
  return (
    <div className="sd-content">
      <h3>Event-Driven Architecture — Async Queue</h3>
      <p>
        Instead of synchronous writes, the API can return immediately after
        enqueuing the activity. A background worker processes it asynchronously.
        This decouples write throughput from DB write latency.
      </p>

      <div className="arch-flow">
        {['Client POST', 'API (202)', 'In-Memory Queue', 'Worker', 'MongoDB', 'WebSocket Broadcast'].map((step, i, arr) => (
          <React.Fragment key={step}>
            <div className="arch-step">{step}</div>
            {i < arr.length - 1 && <div className="arch-arrow">→</div>}
          </React.Fragment>
        ))}
      </div>

      <div className="code-block good">
        <div className="code-label">Usage: X-Async header triggers queue mode</div>
        <pre>{`POST /api/activities
X-Tenant-Id: tenant-acme
X-Async: true
Idempotency-Key: idem-abc123

→ 202 Accepted { jobId: "job_xyz", idempotencyKey: "idem-abc123" }`}</pre>
      </div>

      <h3>Tools</h3>
      <div className="tools-grid">
        {[
          { t: 'In-Memory Queue', d: 'Built-in (this app). Good for local dev, zero deps.' },
          { t: 'Bull + Redis', d: 'Production-grade. Retry, DLQ, job priorities, dashboard.' },
          { t: 'AWS SQS', d: 'Managed, scales to millions. FIFO queues for ordering.' },
          { t: 'RabbitMQ', d: 'Pub/Sub + routing. Powerful exchange patterns.' },
        ].map(({ t, d }) => (
          <div key={t} className="tool-card">
            <strong>{t}</strong>
            <span>{d}</span>
          </div>
        ))}
      </div>

      <h3>Idempotency</h3>
      <p>
        Every POST carries an <code>Idempotency-Key</code> header. The server stores
        processed keys in Redis with a 24h TTL. If the same key arrives again
        (network retry), it returns the cached 200 response without re-processing.
        This prevents duplicate activities on client retry.
      </p>

      <h3>Failure Handling</h3>
      <ul className="sd-list-spaced">
        <li><strong>Retry with back-off:</strong> 3 attempts (1s, 3s, 9s) before DLQ</li>
        <li><strong>Dead Letter Queue (DLQ):</strong> Failed jobs stored for manual replay via <code>POST /queue/replay/:jobId</code></li>
        <li><strong>Circuit breaker:</strong> If MongoDB is down, queue drains to DLQ instead of crashing</li>
        <li><strong>Observability:</strong> Every job logged with jobId, tenant, attempt count, error reason</li>
      </ul>
    </div>
  );
}

export default memo(SystemDesignModal);
