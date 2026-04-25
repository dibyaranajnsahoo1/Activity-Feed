/**
 * Tenant Isolation Middleware
 * In production: validate JWT and extract tenantId from claims
 * Here: read from X-Tenant-Id header (demo purposes)
 */
const tenantMiddleware = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId || tenantId.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Missing required header: X-Tenant-Id'
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid tenant ID format'
    });
  }

  // Attach to request for all downstream handlers
  req.tenantId = tenantId.trim();
  next();
};

module.exports = tenantMiddleware;
