const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  actorId: {
    type: String,
    required: true
  },
  actorName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  type: {
    type: String,
    required: true,
    enum: [
      'USER_LOGIN',
      'USER_LOGOUT',
      'USER_REGISTERED',
      'CONTENT_CREATED',
      'CONTENT_UPDATED',
      'CONTENT_DELETED',
      'COMMENT_ADDED',
      'LIKE_ADDED',
      'LIKE_REMOVED',
      'FILE_UPLOADED',
      'FILE_DELETED',
      'PAYMENT_MADE',
      'SUBSCRIPTION_STARTED',
      'SUBSCRIPTION_CANCELLED',
      'SETTINGS_CHANGED',
      'INVITE_SENT',
      'INVITE_ACCEPTED',
      'ROLE_CHANGED',
      'EXPORT_GENERATED',
      'API_KEY_CREATED'
    ]
  },
  entityId: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false,
  versionKey: false
});

// Required assessment index: tenantId + createdAt for tenant-scoped cursor reads.
activitySchema.index({ tenantId: 1, createdAt: -1 }, { name: 'tenant_createdAt_cursor' });

// Stable high-throughput cursor. _id breaks ties when many writes share createdAt.
activitySchema.index({ tenantId: 1, createdAt: -1, _id: -1 }, { name: 'tenant_feed_cursor_stable' });

// Extra covered paths for filtered feeds.
activitySchema.index({ tenantId: 1, type: 1, createdAt: -1, _id: -1 }, { name: 'tenant_type_feed' });
activitySchema.index({ tenantId: 1, actorId: 1, createdAt: -1, _id: -1 }, { name: 'tenant_actor_feed' });

// Projection: only return fields the feed needs. No joins and no extra payload.
activitySchema.statics.PROJECT_FIELDS = {
  _id: 1,
  tenantId: 1,
  actorId: 1,
  actorName: 1,
  type: 1,
  entityId: 1,
  metadata: 1,
  createdAt: 1
};

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
