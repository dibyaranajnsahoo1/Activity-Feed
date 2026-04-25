import React, { memo } from 'react';
import { getActivityConfig, formatTimeAgo, getInitials, getAvatarColor } from '../utils/activityConfig';

// ─── ActivityCard ─────────────────────────────────────────────────────────────
// Task 3: LinkedIn-style card with avatar, emoji icon, metadata chips.
// Task 4: Optimistic rows get a dashed animated border + "Saving…" pulse badge.

const ActivityCard = memo(({ activity, isNew = false }) => {
  const config      = getActivityConfig(activity.type);
  const isOptimistic = activity._optimistic;
  const initials    = getInitials(activity.actorName);
  const avatarColor = getAvatarColor(activity.actorName);

  const visibleMeta = Object.entries(activity.metadata || {})
    .filter(([k]) => k !== 'clientMutationId')
    .slice(0, 3);

  return (
    <article
      className={`activity-card${isOptimistic ? ' optimistic' : ''}${isNew ? ' is-new' : ''}`}
      style={{ '--card-accent': config.color }}
    >
      {/* Left accent bar */}
      <div className="card-accent-bar" />

      {/* Avatar */}
      <div
        className="card-avatar"
        style={{ background: avatarColor }}
        aria-label={activity.actorName}
      >
        {initials}
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="card-header">
          <div className="card-actor-info">
            <span className="actor-name">{activity.actorName}</span>
            <span className="actor-id">@{activity.actorId}</span>
          </div>

          <div className="card-badges">
            <span
              className="type-badge"
              style={{ background: config.bg, color: config.color }}
            >
              <span className="type-emoji">{config.emoji}</span>
              {config.label}
            </span>
            {isOptimistic && (
              <span className="saving-badge">
                <span className="saving-dot" />
                Saving…
              </span>
            )}
          </div>
        </div>

        {/* Activity sentence */}
        <p className="card-desc">
          <strong>{activity.actorName}</strong>
          <span> {config.label.toLowerCase()} </span>
          {activity.entityId && (
            <code className="entity-pill">{activity.entityId}</code>
          )}
        </p>

        {/* Metadata chips */}
        {visibleMeta.length > 0 && (
          <div className="meta-chips">
            {visibleMeta.map(([key, val]) => (
              <span key={key} className="meta-chip">
                <span className="meta-key">{key}</span>
                <span className="meta-val">{String(val).slice(0, 40)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Action row (decorative — LinkedIn style) */}
        <div className="card-actions">
          <button type="button" className="card-action-btn" aria-label="Like">
            <span>👍</span> Like
          </button>
          <button type="button" className="card-action-btn" aria-label="Comment">
            <span>💬</span> Comment
          </button>
          <button type="button" className="card-action-btn" aria-label="Share">
            <span>↗️</span> Share
          </button>
        </div>
      </div>

      {/* Timestamp */}
      <div className="card-time">
        <span className="time-text">{formatTimeAgo(activity.createdAt)}</span>
        <span className="entity-id-mini">{activity.entityId}</span>
      </div>
    </article>
  );
});

ActivityCard.displayName = 'ActivityCard';
export default ActivityCard;
