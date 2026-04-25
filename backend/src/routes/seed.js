const express = require('express');
const router  = express.Router();
const Activity = require('../models/Activity');
const tenantMiddleware = require('../middleware/tenant');

const ACTORS = [
  { actorId: 'user_001', actorName: 'Dibya Ranjan'  },
  { actorId: 'user_002', actorName: 'Priya Sharma'  },
  { actorId: 'user_003', actorName: 'Rahul Kumar'   },
  { actorId: 'user_004', actorName: 'Anita Singh'   },
  { actorId: 'user_005', actorName: 'Vikram Patel'  },
  { actorId: 'user_006', actorName: 'Sara Ali'      },
  { actorId: 'user_007', actorName: 'Rohan Mehta'   },
];

const TYPES = [
  'USER_LOGIN','USER_REGISTERED','CONTENT_CREATED','CONTENT_UPDATED',
  'COMMENT_ADDED','LIKE_ADDED','FILE_UPLOADED','PAYMENT_MADE',
  'INVITE_SENT','INVITE_ACCEPTED','ROLE_CHANGED','SETTINGS_CHANGED',
  'SUBSCRIPTION_STARTED','API_KEY_CREATED','EXPORT_GENERATED',
];

const ENTITIES = ['doc_101','post_202','file_303','proj_404','team_505','report_606','invoice_707'];

const META_POOL = [
  { source: 'web', browser: 'Chrome' },
  { source: 'mobile', platform: 'iOS' },
  { source: 'api', version: 'v2' },
  { source: 'slack_bot', trigger: 'auto' },
  { ip: '10.0.0.1', region: 'us-east-1' },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

router.post('/seed', tenantMiddleware, async (req, res) => {
  const { tenantId } = req;
  const count = Math.min(parseInt(req.query.count) || 50, 500);
  const now   = new Date();

  const docs = Array.from({ length: count }, (_, i) => {
    const actor    = pick(ACTORS);
    const type     = pick(TYPES);
    const entityId = pick(ENTITIES);
    const meta     = pick(META_POOL);
    // Spread over last 14 days with varied hours for realistic timeline
    const minsAgo  = Math.floor(Math.random() * 14 * 24 * 60);
    const createdAt = new Date(now - minsAgo * 60000);

    return { tenantId, actorId: actor.actorId, actorName: actor.actorName,
      type, entityId, metadata: { ...meta, seeded: true }, createdAt };
  });

  await Activity.insertMany(docs, { ordered: false });
  res.json({ success: true, message: `Seeded ${count} activities for tenant: ${tenantId}` });
});

router.delete('/seed', tenantMiddleware, async (req, res) => {
  const result = await Activity.deleteMany({ tenantId: req.tenantId });
  res.json({ success: true, message: `Deleted ${result.deletedCount} activities for tenant: ${req.tenantId}` });
});

module.exports = router;
