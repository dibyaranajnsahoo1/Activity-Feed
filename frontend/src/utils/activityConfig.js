// ─── Activity Config ─────────────────────────────────────────────────────────
// Central source of truth for activity type metadata used across the UI.
// Emoji icons render universally – no icon library needed.

export const ACTIVITY_CONFIG = {
  USER_LOGIN:             { emoji: '🔐', color: '#6366f1', label: 'Logged in',           bg: 'rgba(99,102,241,0.14)',   category: 'Auth' },
  USER_LOGOUT:            { emoji: '🚪', color: '#64748b', label: 'Logged out',          bg: 'rgba(100,116,139,0.12)',  category: 'Auth' },
  USER_REGISTERED:        { emoji: '🎉', color: '#10b981', label: 'Joined',              bg: 'rgba(16,185,129,0.14)',   category: 'Auth' },
  CONTENT_CREATED:        { emoji: '✍️',  color: '#f59e0b', label: 'Created content',    bg: 'rgba(245,158,11,0.14)',   category: 'Content' },
  CONTENT_UPDATED:        { emoji: '📝', color: '#3b82f6', label: 'Updated content',     bg: 'rgba(59,130,246,0.14)',   category: 'Content' },
  CONTENT_DELETED:        { emoji: '🗑️',  color: '#ef4444', label: 'Deleted content',    bg: 'rgba(239,68,68,0.14)',    category: 'Content' },
  COMMENT_ADDED:          { emoji: '💬', color: '#8b5cf6', label: 'Commented',           bg: 'rgba(139,92,246,0.14)',   category: 'Social' },
  LIKE_ADDED:             { emoji: '❤️',  color: '#ec4899', label: 'Liked',              bg: 'rgba(236,72,153,0.14)',   category: 'Social' },
  LIKE_REMOVED:           { emoji: '💔', color: '#64748b', label: 'Unliked',            bg: 'rgba(100,116,139,0.12)',  category: 'Social' },
  FILE_UPLOADED:          { emoji: '📎', color: '#06b6d4', label: 'Uploaded file',       bg: 'rgba(6,182,212,0.14)',    category: 'File' },
  FILE_DELETED:           { emoji: '🗂️',  color: '#ef4444', label: 'Deleted file',       bg: 'rgba(239,68,68,0.14)',    category: 'File' },
  PAYMENT_MADE:           { emoji: '💰', color: '#10b981', label: 'Payment made',        bg: 'rgba(16,185,129,0.14)',   category: 'Billing' },
  SUBSCRIPTION_STARTED:   { emoji: '⭐', color: '#f59e0b', label: 'Subscribed',          bg: 'rgba(245,158,11,0.14)',   category: 'Billing' },
  SUBSCRIPTION_CANCELLED: { emoji: '🚫', color: '#ef4444', label: 'Unsubscribed',        bg: 'rgba(239,68,68,0.14)',    category: 'Billing' },
  SETTINGS_CHANGED:       { emoji: '⚙️',  color: '#94a3b8', label: 'Changed settings',   bg: 'rgba(148,163,184,0.12)', category: 'Settings' },
  INVITE_SENT:            { emoji: '📧', color: '#6366f1', label: 'Sent invite',         bg: 'rgba(99,102,241,0.14)',   category: 'Team' },
  INVITE_ACCEPTED:        { emoji: '🤝', color: '#10b981', label: 'Accepted invite',     bg: 'rgba(16,185,129,0.14)',   category: 'Team' },
  ROLE_CHANGED:           { emoji: '🛡️',  color: '#f59e0b', label: 'Role changed',       bg: 'rgba(245,158,11,0.14)',   category: 'Team' },
  EXPORT_GENERATED:       { emoji: '📊', color: '#06b6d4', label: 'Generated export',    bg: 'rgba(6,182,212,0.14)',    category: 'Data' },
  API_KEY_CREATED:        { emoji: '🔑', color: '#8b5cf6', label: 'Created API key',     bg: 'rgba(139,92,246,0.14)',   category: 'Settings' },
};

export const ACTIVITY_TYPES = Object.keys(ACTIVITY_CONFIG);

export const ACTIVITY_CATEGORIES = [...new Set(Object.values(ACTIVITY_CONFIG).map(c => c.category))];

export function getActivityConfig(type) {
  return ACTIVITY_CONFIG[type] || { emoji: '⚡', color: '#6366f1', label: type, bg: 'rgba(99,102,241,0.12)', category: 'Other' };
}

export function titleFromType(type = '') {
  return type
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');
}

// Deterministic avatar color from actor name
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#10b981',
  '#f59e0b', '#3b82f6', '#06b6d4', '#ef4444',
];
export function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 5)  return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7)  return `${diffDay}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
