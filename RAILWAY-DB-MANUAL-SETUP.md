# Railway Database Manual Setup

## Quick 3-Step Process

### Step 1: Find the Query Interface in Railway

**In Railway Dashboard:**
1. Click on your **PostgreSQL** service
2. Look for these tabs at the top:
   - Deployments
   - Variables
   - Metrics
   - **Query** ← **CLICK THIS**
   - Data
   - Settings

3. If you see a **Query tab** → Click it and you'll see a SQL editor

### Step 2: Reset the Database

**Copy the contents of:** `backend/database/00-reset-schema.sql`

**Paste into Railway Query tab and run it.**

This will:
- Drop all existing tables (clean slate)
- Recreate the schema
- Add required PostgreSQL extensions

### Step 3: Run Complete Migration

**Copy the contents of:** `backend/database/complete-migration.sql`

**Paste into Railway Query tab and run it.**

This is a large file (3,400 lines) that creates all tables, functions, and permissions.

### Step 4: Create Admin User

**Copy the contents of:** `backend/database/99-create-admin.sql`

**Paste into Railway Query tab and run it.**

This creates the admin user: `admin@thestudio.com` / `admin123`

---

## Alternative: If No Query Tab Exists

If Railway doesn't show a Query tab, you can:

1. **Look for "Connect" tab** in PostgreSQL service
2. Copy the connection string
3. Use a local PostgreSQL client (like pgAdmin, DBeaver, or psql) to connect
4. Run the SQL files in order

---

## After Setup

Test the login at:
```
https://thestudio-reno-production.up.railway.app/staff
```

Login with:
- Email: `admin@thestudio.com`
- Password: `admin123`

**CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN**

---

## Files to Run (In Order)

1. ✅ `backend/database/00-reset-schema.sql` (Reset)
2. ✅ `backend/database/complete-migration.sql` (All tables)
3. ✅ `backend/database/99-create-admin.sql` (Admin user)

---

## If Something Goes Wrong

If you get errors, let me know the exact error message and I can help troubleshoot.
