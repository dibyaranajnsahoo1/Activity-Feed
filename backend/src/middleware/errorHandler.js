const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenantId: req.tenantId
  });

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: messages
    });
  }

  // Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }

  // Duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate resource'
    });
  }

  // Default server error
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`
  });
};

module.exports = { errorHandler, notFound };
