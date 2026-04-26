import React, { memo } from 'react';

// ─── Navbar ───────────────────────────────────────────────────────────────────
// Top navigation bar — logo, app name, assignment badge, live indicator

function Navbar({ wsStatus, tenantId }) {
  const isLive = wsStatus === 'connected';

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <div className="nav-brand">
        <div className="nav-logo" aria-hidden="true">
          <span>AF</span>
        </div>
        <div className="nav-titles">
          <span className="nav-name">ActivityFeed</span>
          <span className="nav-sub">Tenant-Isolated Real-time Feed</span>
        </div>
      </div>

      {/* Center — current tenant */}
      <div className="nav-center">
        <span className="nav-tenant-label">Workspace:</span>
        <code className="nav-tenant">{tenantId}</code>
      </div>

      {/* Right — live status */}
      <div className="nav-right">
        <div className={`live-indicator ${isLive ? 'live' : 'offline'}`}>
          <span className={`live-dot ${isLive ? 'pulsing' : ''}`} />
          <span>{isLive ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}</span>
        </div>
        <div className="nav-avatar" aria-label="Demo User">DU</div>
      </div>
    </nav>
  );
}

export default memo(Navbar);
