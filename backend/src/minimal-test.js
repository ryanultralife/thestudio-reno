// Ultra-minimal test - just start Express and respond to health check
// This has ZERO dependencies on routes, database, or anything else

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

console.log('='.repeat(60));
console.log('MINIMAL TEST SERVER');
console.log('='.repeat(60));
console.log('PORT:', PORT);
console.log('HOST:', HOST);
console.log('Starting server...');

app.get('/api/health', (req, res) => {
  console.log('Health check hit!');
  res.json({ status: 'ok', message: 'Minimal test server is running' });
});

app.get('*', (req, res) => {
  console.log('Request to:', req.path);
  res.json({ message: 'Minimal test server', path: req.path });
});

app.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log('✅ SERVER STARTED SUCCESSFULLY');
  console.log('Listening on', HOST + ':' + PORT);
  console.log('='.repeat(60));
});

app.on('error', (err) => {
  console.error('❌ SERVER ERROR:', err);
  process.exit(1);
});
