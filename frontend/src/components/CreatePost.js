import React, { useState, useCallback, memo } from 'react';
import { ACTIVITY_TYPES, getActivityConfig, getInitials, getAvatarColor } from '../utils/activityConfig';

// ─── CreatePost ───────────────────────────────────────────────────────────────
// Task 3 + Task 4: LinkedIn-style "What's new?" box that triggers optimistic
// activity creation. The form expands on click, collapses on success/cancel.

const DEFAULT_FORM = {
  actorId:      'user_001',
  actorName:    'Demo User',
  type:         'CONTENT_CREATED',
  entityId:     '',
  metadataText: '{ "source": "web" }',
};

function CreatePost({ onSubmit, currentUser }) {
  const [expanded,   setExpanded]   = useState(false);
  const [form,       setForm]       = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback,   setFeedback]   = useState(null);

  const avatarColor = getAvatarColor(currentUser || 'Demo User');
  const initials    = getInitials(currentUser || 'Demo User');

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleOpen = useCallback(() => {
    setExpanded(true);
    setFeedback(null);
    setForm(prev => ({
      ...prev,
      entityId: `doc_${Math.floor(Math.random() * 9000) + 1000}`,
    }));
  }, []);

  const handleCancel = useCallback(() => {
    setExpanded(false);
    setFeedback(null);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    let metadata = {};
    try {
      metadata = form.metadataText.trim() ? JSON.parse(form.metadataText) : {};
    } catch {
      setFeedback({ ok: false, msg: 'Metadata must be valid JSON.' });
      setSubmitting(false);
      return;
    }

    const result = await onSubmit({
      actorId:  form.actorId.trim(),
      actorName: form.actorName.trim(),
      type:     form.type,
      entityId: form.entityId.trim() || `entity_${Date.now()}`,
      metadata,
    });

    setSubmitting(false);

    if (result.success) {
      setFeedback({ ok: true, msg: '✅ Activity posted!' });
      setTimeout(() => { setExpanded(false); setFeedback(null); }, 1400);
    } else {
      // Optimistic row was rolled back — show error
      setFeedback({ ok: false, msg: `⚡ Rolled back: ${result.error}` });
    }
  }, [form, onSubmit]);

  const selectedConfig = getActivityConfig(form.type);

  return (
    <div className="create-post">
      {/* Collapsed trigger row */}
      <div className="create-post-trigger" onClick={!expanded ? handleOpen : undefined}>
        <div className="create-avatar" style={{ background: avatarColor }}>{initials}</div>
        {!expanded ? (
          <button type="button" className="create-prompt">
            Share an activity update…
          </button>
        ) : (
          <span className="create-post-title">New Activity</span>
        )}
        <span className="optimistic-tag">Optimistic UI</span>
      </div>

      {/* Expanded form */}
      {expanded && (
        <form className="create-form" onSubmit={handleSubmit} noValidate>
          {/* Row 1 */}
          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="cp-actorId">Actor ID</label>
              <input id="cp-actorId" name="actorId" value={form.actorId}
                onChange={handleChange} placeholder="user_001" required />
            </div>
            <div className="field">
              <label htmlFor="cp-actorName">Display Name</label>
              <input id="cp-actorName" name="actorName" value={form.actorName}
                onChange={handleChange} placeholder="Jane Doe" required />
            </div>
          </div>

          {/* Row 2 */}
          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="cp-type">Activity Type</label>
              <select id="cp-type" name="type" value={form.type} onChange={handleChange}>
                {ACTIVITY_TYPES.map(t => {
                  const c = getActivityConfig(t);
                  return <option key={t} value={t}>{c.emoji} {c.label}</option>;
                })}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cp-entityId">Entity ID</label>
              <input id="cp-entityId" name="entityId" value={form.entityId}
                onChange={handleChange} placeholder="doc_1234" />
            </div>
          </div>

          {/* Metadata */}
          <div className="field">
            <label htmlFor="cp-meta">
              Metadata <span className="field-hint">(valid JSON)</span>
            </label>
            <textarea id="cp-meta" name="metadataText" value={form.metadataText}
              onChange={handleChange} rows={3} spellCheck={false} />
          </div>

          {/* Type preview */}
          <div className="type-preview"
            style={{ background: selectedConfig.bg, borderColor: selectedConfig.color + '40' }}>
            <span style={{ fontSize: 22 }}>{selectedConfig.emoji}</span>
            <span style={{ color: selectedConfig.color, fontWeight: 700 }}>
              {selectedConfig.label}
            </span>
            <span className="type-preview-note">will be posted with optimistic UI</span>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div className={`form-feedback ${feedback.ok ? 'ok' : 'err'}`}>
              {feedback.msg}
            </div>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <><span className="btn-spinner" /> Posting…</>
              ) : (
                '🚀 Post Activity'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default memo(CreatePost);
