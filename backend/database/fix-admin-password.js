const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:ucjBxgfmiOJlXSkjyCvLWILIuWVwVDBo@shinkansen.proxy.rlwy.net:14247/railway';

async function fixAdminPassword() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Generate correct hash for "admin123"
    console.log('Generating correct password hash for "admin123"...');
    const correctHash = await bcrypt.hash('admin123', 12);
    console.log('New hash:', correctHash);
    console.log('');

    // Verify it works
    const testValid = await bcrypt.compare('admin123', correctHash);
    console.log('Hash verification:', testValid ? '✅ Valid' : '❌ Invalid');
    console.log('');

    // Update the database
    console.log('Updating admin user password...');
    await client.query(
      "UPDATE users SET password_hash = $1 WHERE email = 'admin@thestudio.com'",
      [correctHash]
    );
    console.log('✅ Password updated successfully!\n');

    // Verify the update
    const result = await client.query(
      "SELECT email, password_hash FROM users WHERE email = 'admin@thestudio.com'"
    );

    const dbHash = result.rows[0].password_hash;
    const finalCheck = await bcrypt.compare('admin123', dbHash);

    console.log('Final verification:');
    console.log('Database hash:', dbHash);
    console.log('Password "admin123" works?', finalCheck ? '✅ YES' : '❌ NO');
    console.log('');

    if (finalCheck) {
      console.log('🎉 SUCCESS! You can now login with:');
      console.log('   Email: admin@thestudio.com');
      console.log('   Password: admin123');
      console.log('');
      console.log('🌐 Login at: https://thestudio-reno-production.up.railway.app/staff');
    } else {
      console.log('❌ Something went wrong. Password still doesn\'t work.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixAdminPassword();
