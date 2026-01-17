// Safe Start Script - Minimal server to diagnose deployment issues
// This will start even if some routes fail to load

console.log('='.repeat(50));
console.log('SAFE START MODE - Diagnosing Issues');
console.log('='.repeat(50));
console.log('');

try {
  console.log('Step 1: Loading dotenv...');
  require('dotenv').config();
  console.log('✓ dotenv loaded');

  console.log('Step 2: Checking environment variables...');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.substring(0, 20) + '...)' : 'NOT SET');
  console.log('  JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
  console.log('  PORT:', process.env.PORT || 3000);
  console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');

  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    console.error('');
    console.error('❌ CRITICAL: Missing required environment variables!');
    console.error('   Please set DATABASE_URL and JWT_SECRET in Railway');
    process.exit(1);
  }
  console.log('✓ Environment variables OK');

  console.log('Step 3: Loading Express...');
  const express = require('express');
  console.log('✓ Express loaded');

  console.log('Step 4: Creating app...');
  const app = express();
  console.log('✓ App created');

  console.log('Step 5: Adding basic middleware...');
  app.use(express.json());
  console.log('✓ Middleware added');

  console.log('Step 6: Adding health endpoint...');
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Safe start mode - server is running',
      timestamp: new Date().toISOString()
    });
  });
  console.log('✓ Health endpoint added');

  console.log('Step 7: Adding catch-all...');
  app.use('*', (req, res) => {
    res.json({
      message: 'Server is running in safe mode',
      path: req.originalUrl,
      hint: 'Check Railway logs for startup errors'
    });
  });
  console.log('✓ Catch-all added');

  console.log('Step 8: Starting server...');
  const PORT = process.env.PORT || 3000;
  const HOST = '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('✅ SERVER STARTED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log(`Listening on ${HOST}:${PORT}`);
    console.log('Health check: http://localhost:${PORT}/api/health');
    console.log('');
    console.log('If you see this, the issue is with route loading,');
    console.log('not with basic Node.js/Express setup.');
    console.log('='.repeat(50));
  });

  app.on('error', (err) => {
    console.error('');
    console.error('❌ SERVER ERROR:');
    console.error(err);
    process.exit(1);
  });

} catch (error) {
  console.error('');
  console.error('❌ FATAL ERROR DURING STARTUP:');
  console.error('Error:', error.message);
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  console.error('');
  process.exit(1);
}
