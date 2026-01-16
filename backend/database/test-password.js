const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:ucjBxgfmiOJlXSkjyCvLWILIuWVwVDBo@shinkansen.proxy.rlwy.net:14247/railway';

async function testPassword() {
  console.log('Testing password hash...\n');

  // The password we expect
  const testPassword = 'admin123';

  // The hash we stored in the database
  const storedHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u';

  console.log('Test password:', testPassword);
  console.log('Stored hash:', storedHash);
  console.log('');

  // Test if the password matches the hash
  const isValid = await bcrypt.compare(testPassword, storedHash);
  console.log('Does password match hash?', isValid ? '✅ YES' : '❌ NO');
  console.log('');

  // Now check what's actually in the database
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(
      "SELECT email, password_hash FROM users WHERE email = 'admin@thestudio.com'"
    );

    if (result.rows.length > 0) {
      const dbHash = result.rows[0].password_hash;
      console.log('Hash from database:', dbHash);
      console.log('');

      const dbValid = await bcrypt.compare(testPassword, dbHash);
      console.log('Does password match DB hash?', dbValid ? '✅ YES' : '❌ NO');
      console.log('');

      // Generate a fresh hash for comparison
      console.log('Generating fresh hash for "admin123"...');
      const freshHash = await bcrypt.hash(testPassword, 12);
      console.log('Fresh hash:', freshHash);
      console.log('');

      const freshValid = await bcrypt.compare(testPassword, freshHash);
      console.log('Does password match fresh hash?', freshValid ? '✅ YES' : '❌ NO');

      if (!dbValid) {
        console.log('\n⚠️  PASSWORD HASH IN DATABASE IS INCORRECT!');
        console.log('We need to update it. Run this SQL in Railway:');
        console.log('');
        console.log(`UPDATE users SET password_hash = '${freshHash}' WHERE email = 'admin@thestudio.com';`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

testPassword();
