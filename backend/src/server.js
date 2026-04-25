require('dotenv').config();
require('express-async-errors');

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const activitiesRouter = require('./routes/activities');
const seedRouter = require('./routes/seed');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// ============================================================
// WEBSOCKET SERVER - TASK 5: Real-time delivery
// SSE vs WebSocket: WebSocket chosen for bidirectional comms
// SSE is simpler for unidirectional server-to-client streaming
// WebSocket supports lower latency, multiplexing
// ============================================================
const wss = new WebSocket.Server({ server, path: '/ws' });

// Map: ws -> tenantId (for targeted broadcasting)
global.wsClients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    ws.close(4001, 'Missing tenantId');
    return;
  }

  global.wsClients.set(ws, tenantId);
  logger.info(`WS client connected: tenant=${tenantId}, total=${wss.clients.size}`);

  ws.send(JSON.stringify({ type: 'CONNECTED', tenantId }));

  ws.on('close', () => {
    global.wsClients.delete(ws);
    logger.info(`WS client disconnected: tenant=${tenantId}`);
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error:', err);
    global.wsClients.delete(ws);
  });

  // Heartbeat
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Heartbeat interval - detect dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      global.wsClients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

// ============================================================
// MIDDLEWARE STACK
// ============================================================

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization',
    'X-Tenant-Id', 'Idempotency-Key', 'X-Async'
  ],
  exposedHeaders: ['X-Request-Id']
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Request ID
app.use((req, res, next) => {
  req.requestId = require('crypto').randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ============================================================
// ROUTES
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    wsConnections: wss.clients.size,
    env: process.env.NODE_ENV
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Activity Feed API',
    version: '1.0.0',
    docs: '/health',
    endpoints: {
      activities: 'GET/POST /api/activities',
      stats: 'GET /api/activities/stats',
      seed: 'POST /api/seed/seed',
      queue: 'GET /api/activities/queue/stats',
      websocket: 'ws://host/ws?tenantId=YOUR_TENANT'
    }
  });
});

app.use('/api/activities', activitiesRouter);
app.use('/api/seed', seedRouter);

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

// ============================================================
// STARTUP
// ============================================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`WebSocket server ready at ws://localhost:${PORT}/ws`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
  });
};

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  wss.clients.forEach(ws => ws.close());
  
  server.close(async () => {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    logger.info('Server shut down complete');
    process.exit(0);
  });

  // Force shutdown after 30s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

module.exports = { app, server };
