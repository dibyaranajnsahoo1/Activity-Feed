/**
 * BONUS: Event-Driven Architecture
 * 
 * In-memory queue implementation (production: replace with Bull + Redis)
 * Handles: idempotency, retry logic, failure handling, async processing
 * 
 * Production tools: Bull Queue + Redis + Dead Letter Queue
 * - Bull for job scheduling and retry
 * - Redis for queue storage (fast, persistent)
 * - Dead Letter Queue for failed jobs after max retries
 */

const logger = require('../utils/logger');
const Activity = require('../models/Activity');

class ActivityQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.processedIds = new Set(); // Idempotency store (Redis in production)
    this.failedJobs = [];
    this.maxRetries = 3;
    this.retryDelay = 1000; // base: 1s → 3s → 9s (tripling backoff in production)
    
    // Start processing loop
    this._startProcessing();
    
    logger.info('ActivityQueue initialized (in-memory mode)');
  }

  /**
   * Add job to queue
   * @param {Object} activityData - Activity payload
   * @param {string} idempotencyKey - Unique key to prevent duplicate processing
   */
  async enqueue(activityData, idempotencyKey) {
    // Idempotency check - prevent duplicate processing
    if (this.processedIds.has(idempotencyKey)) {
      logger.info(`Duplicate job skipped: ${idempotencyKey}`);
      return { duplicate: true, idempotencyKey };
    }

    const job = {
      id: idempotencyKey,
      data: activityData,
      attempts: 0,
      createdAt: new Date(),
      status: 'pending'
    };

    this.queue.push(job);
    logger.info(`Job enqueued: ${idempotencyKey}`);
    
    return { queued: true, jobId: job.id };
  }

  /**
   * Process jobs from queue
   */
  async _processJob(job) {
    job.attempts++;
    job.status = 'processing';

    try {
      const activity = new Activity(job.data);
      await activity.save();

      // Mark as processed for idempotency
      this.processedIds.add(job.id);
      
      // Emit to WebSocket subscribers (SSE/WS notifications)
      if (global.wsClients) {
        this._broadcastToTenant(job.data.tenantId, {
          type: 'NEW_ACTIVITY',
          activity: activity.toObject()
        });
      }

      job.status = 'completed';
      logger.info(`Job completed: ${job.id}`);
      return true;

    } catch (error) {
      logger.error(`Job failed: ${job.id}, attempt ${job.attempts}`, error);
      
      if (job.attempts < this.maxRetries) {
        // Tripling backoff: attempt 1 → 1s, 2 → 3s, 3 → 9s (matches README)
        const delay = this.retryDelay * Math.pow(3, job.attempts - 1);
        job.status = 'retry';
        setTimeout(() => {
          this.queue.unshift(job); // Re-add to front of queue
        }, delay);
        return false;
      } else {
        // Dead Letter Queue - store for manual inspection/replay
        job.status = 'failed';
        job.error = error.message;
        this.failedJobs.push(job);
        logger.error(`Job moved to DLQ: ${job.id}`);
        return false;
      }
    }
  }

  async _startProcessing() {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;
      
      this.processing = true;
      
      // Process up to 10 jobs concurrently (configurable)
      const batch = this.queue.splice(0, 10);
      
      await Promise.allSettled(
        batch.map(job => this._processJob(job))
      );
      
      this.processing = false;
    }, 100); // Poll every 100ms
  }

  /**
   * Broadcast real-time event to all WebSocket clients of a tenant
   */
  _broadcastToTenant(tenantId, message) {
    if (!global.wsClients) return;
    
    const payload = JSON.stringify(message);
    let sent = 0;
    
    global.wsClients.forEach((clientTenantId, ws) => {
      if (clientTenantId === tenantId && ws.readyState === 1) {
        ws.send(payload);
        sent++;
      }
    });

    if (sent > 0) {
      logger.info(`Broadcast to ${sent} clients in tenant ${tenantId}`);
    }
  }

  getStats() {
    return {
      pending: this.queue.length,
      failed: this.failedJobs.length,
      processedCount: this.processedIds.size,
      dlq: this.failedJobs.map(j => ({
        id: j.id,
        attempts: j.attempts,
        error: j.error,
        createdAt: j.createdAt
      }))
    };
  }

  // Replay a failed job from DLQ
  async replayJob(jobId) {
    const jobIndex = this.failedJobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) return null;

    const job = this.failedJobs.splice(jobIndex, 1)[0];
    job.attempts = 0;
    job.status = 'pending';
    this.processedIds.delete(jobId); // Remove from idempotency store to allow replay
    this.queue.push(job);
    
    return { replayed: true, jobId };
  }
}

// Singleton
const activityQueue = new ActivityQueue();

module.exports = activityQueue;
