# Railway Database Setup - Quick Guide

Your database is ready, now we just need to initialize it with tables.

## Step 1: Get to Railway's Query Interface

1. In Railway, click **PostgreSQL** service
2. Click **"Data"** tab
3. You'll see a SQL query editor

## Step 2: Run Migrations

You have the complete migration SQL in your repo at:
`backend/database/complete-migration.sql`

**Option A: Copy from Local File**
1. Open `backend/database/complete-migration.sql` in your code editor
2. Copy ALL the contents (it's 3,400 lines - that's OK!)
3. Paste into Railway's query editor
4. Click "Run" or "Execute"
5. Wait 10-30 seconds for it to complete

**Option B: Run Individual Files**

If the complete file is too large, run these files one by one in order:

1. `backend/database/schema.sql`
2. `backend/database/seed.sql`
3. `backend/database/retail-schema.sql`
4. `backend/database/rentals-schema.sql`
5. `backend/database/cms-schema.sql`
6. `backend/database/campaigns-schema.sql`
7. `backend/database/theme-customization-schema.sql`
8. `backend/database/add-communication-preferences.sql`
9. `backend/database/update-campaign-opt-in-logic.sql`
10. `backend/database/mindbody-migration-schema.sql`
11. `backend/database/fix-webhook-replay-vulnerability.sql`

For each file:
- Open it in your code editor
- Copy all contents
- Paste in Railway query editor
- Click "Run"
- Wait for success message
- Move to next file

## Step 3: Verify Tables Created

After running the migrations:

1. In Railway Data tab, look at the left sidebar
2. You should see LOTS of tables: `users`, `classes`, `bookings`, `memberships`, etc.
3. If you see ~30+ tables, you're done! ✅

## Step 4: Create Admin User

Once tables are created, run this SQL:

```sql
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'admin@thestudio.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u',
  'Admin',
  'User',
  'admin',
  true
);
```

**Default Login:**
- Email: `admin@thestudio.com`
- Password: `admin123`

**CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

## Step 5: Test Login

Visit: `https://thestudio-reno-production.up.railway.app/staff`

Login with the admin credentials above.

If login works, YOU'RE DEPLOYED! 🎉

---

**Having Issues?**

- Tables not appearing? Make sure SQL ran without errors
- Can't login? Check that admin user was created: `SELECT * FROM users;`
- App errors? Check Railway logs in Deployments tab
