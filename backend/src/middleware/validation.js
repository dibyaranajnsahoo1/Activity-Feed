const Joi = require('joi');

const activityTypes = [
  'USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTERED',
  'CONTENT_CREATED', 'CONTENT_UPDATED', 'CONTENT_DELETED',
  'COMMENT_ADDED', 'LIKE_ADDED', 'LIKE_REMOVED',
  'FILE_UPLOADED', 'FILE_DELETED', 'PAYMENT_MADE',
  'SUBSCRIPTION_STARTED', 'SUBSCRIPTION_CANCELLED',
  'SETTINGS_CHANGED', 'INVITE_SENT', 'INVITE_ACCEPTED',
  'ROLE_CHANGED', 'EXPORT_GENERATED', 'API_KEY_CREATED'
];

const createActivitySchema = Joi.object({
  actorId: Joi.string().required().max(100),
  actorName: Joi.string().required().max(255),
  type: Joi.string().valid(...activityTypes).required(),
  entityId: Joi.string().required().max(100),
  metadata: Joi.object().optional().default({})
});

const feedQuerySchema = Joi.object({
  cursor: Joi.string().max(500).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  type: Joi.string().valid(...activityTypes).optional(),
  actorId: Joi.string().optional()
});

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  req.body = value;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  req.query = value;
  next();
};

module.exports = {
  validateCreateActivity: validateBody(createActivitySchema),
  validateFeedQuery: validateQuery(feedQuerySchema)
};
