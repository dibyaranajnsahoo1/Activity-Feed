const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const logger = require('../utils/logger');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function encodeCursor(activity) {
  if (!activity) return null;

  const payload = {
    createdAt: new Date(activity.createdAt).toISOString(),
    id: activity._id.toString()
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;

  // Backward compatible with the original ISO-date cursor used in the README.
  const legacyDate = new Date(cursor);
  if (!Number.isNaN(legacyDate.getTime())) {
    return { createdAt: legacyDate, id: null };
  }

  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(payload.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error('Invalid cursor date');
    }

    if (payload.id && !mongoose.Types.ObjectId.isValid(payload.id)) {
      throw new Error('Invalid cursor id');
    }

    return { createdAt, id: payload.id || null };
  } catch (error) {
    const invalidCursor = new Error('Invalid cursor token');
    invalidCursor.status = 400;
    throw invalidCursor;
  }
}

class ActivityService {
  async create(data) {
    return Activity.create(data);
  }

  async getFeed(tenantId, options = {}) {
    const { cursor, limit = DEFAULT_LIMIT, type, actorId } = options;
    const safeLimit = Math.min(Number.parseInt(limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const query = { tenantId };

    const decodedCursor = decodeCursor(cursor);
    if (decodedCursor) {
      const olderThanCursor = { createdAt: { $lt: decodedCursor.createdAt } };

      if (decodedCursor.id) {
        query.$or = [
          olderThanCursor,
          {
            createdAt: decodedCursor.createdAt,
            _id: { $lt: new mongoose.Types.ObjectId(decodedCursor.id) }
          }
        ];
      } else {
        query.createdAt = olderThanCursor.createdAt;
      }
    }

    if (type) query.type = type;
    if (actorId) query.actorId = actorId;

    const activities = await Activity.find(query)
      .select(Activity.PROJECT_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(safeLimit + 1)
      .lean();

    const hasMore = activities.length > safeLimit;
    const items = hasMore ? activities.slice(0, safeLimit) : activities;

    return {
      items,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
      hasMore,
      count: items.length
    };
  }

  async getById(tenantId, activityId) {
    return Activity.findOne({ _id: activityId, tenantId })
      .select(Activity.PROJECT_FIELDS)
      .lean();
  }

  async getStats(tenantId) {
    const [total, byType] = await Promise.all([
      Activity.countDocuments({ tenantId }),
      Activity.aggregate([
        { $match: { tenantId } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    return { total, byType };
  }

  async purgeOldActivities(tenantId, retentionDays = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await Activity.deleteMany({
      tenantId,
      createdAt: { $lt: cutoff }
    });

    logger.info(`Purged ${result.deletedCount} activities for tenant ${tenantId}`);
    return result.deletedCount;
  }
}

module.exports = new ActivityService();
