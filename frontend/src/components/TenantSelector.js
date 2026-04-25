import React, { useState } from 'react';

const DEMO_TENANTS = [
  { id: 'tenant-acme', label: 'Acme', color: '#4f46e5' },
  { id: 'tenant-globex', label: 'Globex', color: '#059669' },
  { id: 'tenant-initech', label: 'Initech', color: '#d97706' },
  { id: 'demo-tenant', label: 'Demo', color: '#db2777' }
];

function TenantSelector({ tenantId, onChangeTenant }) {
  const [custom, setCustom] = useState('');

  return (
    <div className="tenant-selector">
      <div className="tenant-presets" aria-label="Demo tenants">
        {DEMO_TENANTS.map(tenant => (
          <button
            key={tenant.id}
            type="button"
            className={`tenant-btn ${tenantId === tenant.id ? 'active' : ''}`}
            onClick={() => onChangeTenant(tenant.id)}
            style={tenantId === tenant.id ? { '--tenant-color': tenant.color } : undefined}
          >
            {tenant.label}
          </button>
        ))}
      </div>
      <div className="tenant-custom">
        <input
          value={custom}
          onChange={event => setCustom(event.target.value)}
          placeholder="tenant-id"
        />
        <button
          type="button"
          onClick={() => custom.trim() && onChangeTenant(custom.trim())}
          disabled={!custom.trim()}
        >
          Use
        </button>
      </div>
    </div>
  );
}

export default TenantSelector;
