const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

const activityService  = require('../services/activityService');
const activityQueue    = require('../queues/activityQueue');
const tenantMiddleware = require('../middleware/tenant');
const { validateCreateActivity, validateFeedQuery } = require('../middleware/validation');
const logger           = require('../utils/logger');
const Activity         = require('../models/Activity');

router.use(tenantMiddleware);

// ── POST /activities — Task 1: High write-throughput create ──────────────────
router.post('/', validateCreateActivity, async (req, res) => {
  const { actorId, actorName, type, entityId, metadata } = req.body;
  const { tenantId } = req;
  const idempotencyKey = req.headers['idempotency-key'] || uuidv4();

  const activityData = { tenantId, actorId, actorName, type, entityId,
    metadata: metadata || {}, createdAt: new Date() };

  // Async path (Bonus) — enqueue instead of direct write
  if (req.headers['x-async'] === 'true') {
    const result = await activityQueue.enqueue(activityData, idempotencyKey);
    if (result.duplicate) {
      return res.status(200).json({ success: true, message: 'Duplicate – already processed', idempotencyKey });
    }
    return res.status(202).json({ success: true, message: 'Queued', jobId: result.jobId, idempotencyKey });
  }

  // Sync path
  const activity = await activityService.create(activityData);
  const payload  = activity.toObject ? activity.toObject() : activity;

  // Broadcast to same-tenant WS clients
  if (global.wsClients) {
    const frame = JSON.stringify({ type: 'NEW_ACTIVITY', activity: payload });
    global.wsClients.forEach((clientTenant, ws) => {
      if (clientTenant === tenantId && ws.readyState === 1) ws.send(frame);
    });
  }

  logger.info(`Activity created: ${activity._id} tenant=${tenantId}`);
  res.status(201).json({ success: true, data: payload, idempotencyKey });
});

// ── GET /activities — Task 1: Cursor-based pagination, NO skip ───────────────
router.get('/', validateFeedQuery, async (req, res) => {
  const { cursor, limit, type, actorId } = req.query;
  const result = await activityService.getFeed(req.tenantId, { cursor, limit, type, actorId });

  res.json({
    success: true,
    data: result.items,
    pagination: {
      nextCursor: result.nextCursor,
      hasMore:    result.hasMore,
      count:      result.count,
      limit:      Math.min(parseInt(limit, 10) || 20, 100),
    },
  });
});

// ── GET /activities/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const stats = await activityService.getStats(req.tenantId);
  res.json({ success: true, data: stats });
});

// ── GET /activities/queue/stats — Bonus ──────────────────────────────────────
router.get('/queue/stats', async (req, res) => {
  res.json({ success: true, data: activityQueue.getStats() });
});

// ── POST /activities/queue/replay/:jobId — Bonus DLQ replay ──────────────────
router.post('/queue/replay/:jobId', async (req, res) => {
  const result = await activityQueue.replayJob(req.params.jobId);
  if (!result) return res.status(404).json({ success: false, error: 'Job not found in DLQ' });
  res.json({ success: true, data: result });
});

// ── GET /activities/debug/perf — Task 2: Skip vs Cursor comparison ────────────
// Shows EXPLAIN output for both approaches so the client can render the diff.
router.get('/debug/perf', async (req, res) => {
  const { tenantId } = req;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = 20;
  const skip  = (page - 1) * limit;

  // ── SLOW: skip() — scans 'skip' docs before returning anything ────────────
  const slowExplain = await Activity
    .find({ tenantId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .explain('executionStats')
    .catch(() => null);

  // ── FAST: cursor — uses index seek, O(log n) regardless of page ───────────
  // Simulate a cursor at the correct position
  const anchorDoc = skip > 0
    ? await Activity.findOne({ tenantId })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip - 1)
        .select({ createdAt: 1, _id: 1 })
        .lean()
    : null;

  let fastExplain = null;
  if (anchorDoc) {
    fastExplain = await Activity
      .find({
        tenantId,
        $or: [
          { createdAt: { $lt: anchorDoc.createdAt } },
          { createdAt: anchorDoc.createdAt, _id: { $lt: anchorDoc._id } },
        ],
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .explain('executionStats')
      .catch(() => null);
  }

  const extract = (exp) => exp ? {
    stage:            exp.executionStats?.executionStages?.stage || 'unknown',
    docsExamined:     exp.executionStats?.totalDocsExamined,
    keysExamined:     exp.executionStats?.totalKeysExamined,
    nReturned:        exp.executionStats?.nReturned,
    executionTimeMs:  exp.executionStats?.executionTimeMillis,
    indexUsed:        exp.queryPlanner?.winningPlan?.inputStage?.indexName || 'none',
  } : { note: 'Not available on page 1 (no cursor needed)' };

  res.json({
    success: true,
    explanation: {
      page, skip, limit,
      verdict: 'cursor pagination is O(log n); skip() is O(n) — avoid skip() at scale',
      skipBased:   extract(slowExplain),
      cursorBased: extract(fastExplain),
    },
  });
});

// ── GET /activities/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const activity = await activityService.getById(req.tenantId, req.params.id);
  if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });
  res.json({ success: true, data: activity });
});

module.exports = router;
