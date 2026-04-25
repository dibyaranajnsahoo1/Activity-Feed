import React, { useState, memo } from 'react';
import { ACTIVITY_TYPES, ACTIVITY_CATEGORIES, getActivityConfig, ACTIVITY_CONFIG } from '../utils/activityConfig';

// ─── LeftSidebar ───────────────────────────────────────────────────────────────
// Navigation sidebar with tenant switcher, category filters, and quick stats.

const TENANTS = [
  { id: 'tenant-acme',    label: 'Acme Corp',   color: '#6366f1' },
  { id: 'tenant-globex',  label: 'Globex Inc',  color: '#10b981' },
  { id: 'tenant-initech', label: 'Initech Ltd', color: '#f59e0b' },
  { id: 'tenant-demo',    label: 'Demo Org',    color: '#ec4899' },
];

function LeftSidebar({ tenantId, onChangeTenant, filters, onFilterChange, stats }) {
  const [customTenant, setCustomTenant] = useState('');
  const [showCustom,   setShowCustom]   = useState(false);

  const currentTenant = TENANTS.find(t => t.id === tenantId);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customTenant.trim()) {
      onChangeTenant(customTenant.trim());
      setShowCustom(false);
      setCustomTenant('');
    }
  };

  const typesByCategory = ACTIVITY_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = Object.entries(ACTIVITY_CONFIG)
      .filter(([, v]) => v.category === cat)
      .map(([k]) => k);
    return acc;
  }, {});

  return (
    <aside className="left-sidebar">
      {/* ── Tenant Section ── */}
      <div className="sidebar-section">
        <h3 className="sidebar-label">Workspace</h3>
        <div className="tenant-list">
          {TENANTS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`tenant-item${tenantId === t.id ? ' active' : ''}`}
              style={{ '--t-color': t.color }}
              onClick={() => onChangeTenant(t.id)}
            >
              <span className="tenant-dot" style={{ background: t.color }} />
              <span className="tenant-name">{t.label}</span>
              {tenantId === t.id && <span className="tenant-check">✓</span>}
            </button>
          ))}

          <button
            type="button"
            className="tenant-item custom-tenant-toggle"
            onClick={() => setShowCustom(v => !v)}
          >
            <span className="tenant-dot" style={{ background: '#64748b' }} />
            <span className="tenant-name">Custom…</span>
          </button>
        </div>

        {showCustom && (
          <form onSubmit={handleCustomSubmit} className="custom-tenant-form">
            <input
              value={customTenant}
              onChange={e => setCustomTenant(e.target.value)}
              placeholder="my-tenant-id"
              autoFocus
            />
            <button type="submit" className="btn-xs-primary">Go</button>
          </form>
        )}

        {!TENANTS.find(t => t.id === tenantId) && (
          <div className="active-tenant-pill">
            <span className="tenant-dot" style={{ background: '#64748b' }} />
            {tenantId}
          </div>
        )}
      </div>

      {/* ── Filter by type ── */}
      <div className="sidebar-section">
        <h3 className="sidebar-label">Filter Feed</h3>
        <button
          type="button"
          className={`filter-item${!filters.type ? ' active' : ''}`}
          onClick={() => onFilterChange({})}
        >
          <span className="fi-emoji">🌐</span>
          <span>All Activities</span>
        </button>

        {Object.entries(typesByCategory).map(([cat, types]) => (
          <div key={cat} className="filter-category">
            <span className="filter-cat-label">{cat}</span>
            {types.map(type => {
              const cfg = getActivityConfig(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`filter-item${filters.type === type ? ' active' : ''}`}
                  style={filters.type === type ? { '--fi-color': cfg.color } : {}}
                  onClick={() => onFilterChange({ type: filters.type === type ? undefined : type })}
                >
                  <span className="fi-emoji">{cfg.emoji}</span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Mini Stats ── */}
      {stats && (
        <div className="sidebar-section sidebar-stats">
          <h3 className="sidebar-label">Quick Stats</h3>
          <div className="mini-stat">
            <span className="mini-stat-num">{stats.total?.toLocaleString()}</span>
            <span className="mini-stat-label">Total activities</span>
          </div>
          {stats.byType?.slice(0, 4).map(item => {
            const cfg = getActivityConfig(item._id);
            return (
              <div key={item._id} className="mini-stat-row">
                <span>{cfg.emoji} {cfg.label}</span>
                <span className="mini-stat-count">{item.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export default memo(LeftSidebar);
