// ============================================
// DATABASE CONNECTION
// ============================================

const { Pool } = require('pg');

// SSL Configuration
// Railway/Heroku require rejectUnauthorized: false for their SSL certificates
// For self-hosted DB with proper certs, set DB_SSL_REJECT_UNAUTHORIZED=true
const sslConfig = process.env.NODE_ENV === 'production' ? {
  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
} : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
