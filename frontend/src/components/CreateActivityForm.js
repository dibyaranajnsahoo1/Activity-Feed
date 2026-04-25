// ─── CreateActivityForm ───────────────────────────────────────────────────────
// Full-field advanced activity form (all schema fields exposed: actorId,
// actorName, type, entityId, metadata JSON).
//
// Relationship to CreatePost.js:
//   CreatePost   — compact LinkedIn-style composer embedded at the top of the
//                  feed (ActivityFeed.js). Users see it inline while scrolling.
//   CreateActivityForm — standalone form with every field visible; intended for
//                  embedded panels, admin tools, or storybook/testing contexts
//                  where a complete payload must be constructed manually.
//
// Both delegate to the same onSubmit → useActivityFeed.createActivity flow,
// which handles optimistic UI and rollback (Task 4).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import { ACTIVITY_TYPES, titleFromType } from '../utils/activityConfig';

function CreateActivityForm({ onSubmit }) {
  const [form, setForm] = useState({
    actorId: 'user_001',
    actorName: 'Demo User',
    type: 'CONTENT_CREATED',
    entityId: `doc_${Math.floor(Math.random() * 1000)}`,
    metadataText: '{ "source": "web" }'
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    let metadata = {};

    try {
      metadata = form.metadataText.trim() ? JSON.parse(form.metadataText) : {};
    } catch (error) {
      setSubmitting(false);
      setResult({ success: false, error: 'Metadata must be valid JSON.' });
      return;
    }

    const response = await onSubmit({
      actorId: form.actorId.trim(),
      actorName: form.actorName.trim(),
      type: form.type,
      entityId: form.entityId.trim() || `entity_${Date.now()}`,
      metadata
    });

    setSubmitting(false);

    if (response.success) {
      setResult({ success: true });
      setForm(prev => ({
        ...prev,
        entityId: `doc_${Math.floor(Math.random() * 1000)}`
      }));
      setTimeout(() => {
        setResult(null);
        setOpen(false);
      }, 1200);
    } else {
      setResult({
        success: false,
        error: response.error || 'Create failed. The optimistic row was rolled back.'
      });
    }
  }, [form, onSubmit]);

  return (
    <div className="create-form-wrapper">
      <button
        type="button"
        className="create-btn"
        onClick={() => setOpen(value => !value)}
      >
        {open ? 'Close' : 'New Activity'}
      </button>

      {open && (
        <div className="create-form-panel">
          <div className="form-heading">
            <h3 className="form-title">Create activity</h3>
            <span className="form-badge">Optimistic</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="actorId">Actor ID</label>
                <input
                  id="actorId"
                  name="actorId"
                  value={form.actorId}
                  onChange={handleChange}
                  placeholder="user_001"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="actorName">Actor Name</label>
                <input
                  id="actorName"
                  name="actorName"
                  value={form.actorName}
                  onChange={handleChange}
                  placeholder="Jane Doe"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="type">Activity Type</label>
                <select id="type" name="type" value={form.type} onChange={handleChange}>
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type} value={type}>{titleFromType(type)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="entityId">Entity ID</label>
                <input
                  id="entityId"
                  name="entityId"
                  value={form.entityId}
                  onChange={handleChange}
                  placeholder="doc_123"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="metadataText">Metadata JSON</label>
              <textarea
                id="metadataText"
                name="metadataText"
                value={form.metadataText}
                onChange={handleChange}
                rows="3"
                spellCheck="false"
              />
            </div>

            {result && (
              <div className={`result-banner ${result.success ? 'success' : 'error'}`}>
                {result.success ? 'Activity created.' : result.error}
              </div>
            )}

            <button
              type="submit"
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Activity'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default CreateActivityForm;
