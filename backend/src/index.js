// ============================================
// THE STUDIO RENO - API SERVER
// ============================================

console.log('🚀 Server starting...');
console.log('📍 Loading environment variables...');
require('dotenv').config();

// ============================================
// CRITICAL ENVIRONMENT VARIABLES CHECK
// ============================================
console.log('✅ Environment loaded');
console.log('🔍 Checking required environment variables...');

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

console.log('✅ Required environment variables present');

// Warn about payment keys (not critical for non-payment features)
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  WARNING: STRIPE_SECRET_KEY not set - payment features will not work');
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️  WARNING: STRIPE_WEBHOOK_SECRET not set - webhook verification will fail');
}

console.log('📦 Loading Express and middleware...');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

console.log('✅ Middleware loaded');
const app = express();

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

// Setup route (one-time database initialization)
app.use('/api/setup', require('./routes/setup'));

// API routes
console.log('📌 Loading API routes...');
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/classes', require('./routes/classes'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/memberships', require('./routes/memberships'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/teachers', require('./routes/teachers'));
  app.use('/api/reports', require('./routes/reports'));
  console.log('  ✓ Loaded core routes');

  app.use('/api/teacher-insights', require('./routes/teacher-insights'));
  console.log('  ✓ Loaded teacher-insights routes');

  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/setup-demo', require('./routes/admin-setup'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/social', require('./routes/social'));
  app.use('/api/webhooks', require('./routes/webhooks'));
  app.use('/api/retail', require('./routes/retail'));
  app.use('/api/cms', require('./routes/cms'));
  app.use('/api/rentals', require('./routes/rentals'));
  app.use('/api/campaigns', require('./routes/campaigns'));
  app.use('/api/migration', require('./routes/migration'));
  app.use('/api/theme', require('./routes/theme'));
  console.log('  ✓ Loaded extended routes');

  app.use('/api/series', require('./routes/series'));
  console.log('  ✓ Loaded series routes');

  console.log('✅ All API routes loaded successfully');
} catch (error) {
  console.error('❌ FATAL: Error loading routes:', error.message);
  console.error(error.stack);
  process.exit(1);
}

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

console.log('🚀 Starting HTTP server...');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`📡 Binding to ${HOST}:${PORT}`);

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════╗
║     THE STUDIO RENO - API SERVER       ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(31)}║
║  Host: ${HOST.padEnd(31)}║
║  Env:  ${(process.env.NODE_ENV || 'development').padEnd(31)}║
╚════════════════════════════════════════╝
  `);

  // Start scheduled jobs
  if (process.env.NODE_ENV !== 'test') {
    console.log('⏰ Starting scheduled jobs...');
    const { startScheduler } = require('./services/scheduler');
    startScheduler();
  }

  console.log('✅ Server is ready and accepting connections');
});

module.exports = app;
