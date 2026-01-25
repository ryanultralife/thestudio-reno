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

// One-time seed endpoint (remove after use)
app.get('/api/seed-users/:secret', async (req, res) => {
  if (req.params.secret !== 'studio2025seed') {
    return res.status(404).json({ error: 'Not found' });
  }

  const bcrypt = require('bcryptjs');
  const db = require('./database/connection');

  try {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const teacherHash = bcrypt.hashSync('teacher123', 10);

    // Create admin user
    await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
      VALUES ($1, $2, 'Admin', 'User', 'admin', true, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'admin'
    `, ['admin@thestudioreno.com', adminHash]);

    // Create owner user
    await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
      VALUES ($1, $2, 'Rachelle', 'Lanning', 'owner', true, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'owner'
    `, ['rachelle@thestudioreno.com', adminHash]);

    // Create teacher user
    await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
      VALUES ($1, $2, 'Sarah', 'Teacher', 'teacher', true, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'teacher'
    `, ['sarah@thestudioreno.com', teacherHash]);

    // Create teacher record
    const teacherUser = await db.query('SELECT id FROM users WHERE email = $1', ['sarah@thestudioreno.com']);
    if (teacherUser.rows[0]) {
      await db.query(`
        INSERT INTO teachers (user_id, hourly_rate, is_active)
        VALUES ($1, 50.00, true)
        ON CONFLICT (user_id) DO NOTHING
      `, [teacherUser.rows[0].id]);
    }

    res.json({
      success: true,
      message: 'Test users created!',
      users: [
        { email: 'admin@thestudioreno.com', password: 'admin123', role: 'admin' },
        { email: 'rachelle@thestudioreno.com', password: 'admin123', role: 'owner' },
        { email: 'sarah@thestudioreno.com', password: 'teacher123', role: 'teacher' },
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API routes
app.use('/api/auth', require('./routes/auth'));
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
