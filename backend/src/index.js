// ============================================
// THE STUDIO RENO - API SERVER
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ============================================
// RATE LIMITING (In-memory, simple implementation)
// ============================================

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP
const AUTH_RATE_LIMIT_MAX = 10; // 10 auth attempts per minute per IP

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

function rateLimit(maxRequests = RATE_LIMIT_MAX_REQUESTS) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}:${req.path.startsWith('/api/auth') ? 'auth' : 'general'}`;
    const now = Date.now();

    let data = rateLimitStore.get(key);
    if (!data || now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      data = { windowStart: now, count: 0 };
    }

    data.count++;
    rateLimitStore.set(key, data);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - data.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((data.windowStart + RATE_LIMIT_WINDOW_MS) / 1000));

    if (data.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil((data.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
      });
    }

    next();
  };
}

// Apply general rate limiting to all requests
app.use(rateLimit(RATE_LIMIT_MAX_REQUESTS));

// Stricter rate limiting for auth endpoints (applied after routes are defined)

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing (except for Stripe webhook which needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// ============================================
// ROUTES
// ============================================

// Health check (both paths for compatibility)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
// Apply stricter rate limiting to auth endpoints to prevent brute force attacks
app.use('/api/auth', rateLimit(AUTH_RATE_LIMIT_MAX), require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/memberships', require('./routes/memberships'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/social', require('./routes/social'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/retail', require('./routes/retail'));
app.use('/api/cms', require('./routes/cms'));
app.use('/api/coop', require('./routes/coop'));

// ============================================
// SERVE FRONTEND IN PRODUCTION
// ============================================

const path = require('path');

// Serve static files from frontend build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  // Handle client-side routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Postgres errors
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Invalid reference' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Default
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     THE STUDIO RENO - API SERVER       ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(31)}║
║  Env:  ${(process.env.NODE_ENV || 'development').padEnd(31)}║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
