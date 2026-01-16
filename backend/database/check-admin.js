const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:ucjBxgfmiOJlXSkjyCvLWILIuWVwVDBo@shinkansen.proxy.rlwy.net:14247/railway';

async function checkAdmin() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check if admin user exists
    const result = await client.query(
      "SELECT id, email, first_name, last_name, role, is_active, password_hash FROM users WHERE email = 'admin@thestudio.com'"
    );

    if (result.rows.length === 0) {
      console.log('❌ Admin user NOT found!');
      console.log('Creating admin user now...\n');

      const insertResult = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES (
          'admin@thestudio.com',
          '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u',
          'Admin',
          'User',
          'admin',
          true
        )
        RETURNING id, email, first_name, last_name, role, is_active
      `);

      console.log('✅ Admin user created:');
      console.log(insertResult.rows[0]);
    } else {
      console.log('✅ Admin user found:');
      console.log('ID:', result.rows[0].id);
      console.log('Email:', result.rows[0].email);
      console.log('Name:', result.rows[0].first_name, result.rows[0].last_name);
      console.log('Role:', result.rows[0].role);
      console.log('Active:', result.rows[0].is_active);
      console.log('Password hash:', result.rows[0].password_hash.substring(0, 30) + '...');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkAdmin();
