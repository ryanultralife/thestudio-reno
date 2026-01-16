# Railway Database Setup - Simple Instructions

## Quick Setup (2 steps)

### Step 1: Get DATABASE_URL from Railway

1. Go to Railway dashboard
2. Click your **PostgreSQL** service
3. Click **Variables** tab
4. Find **DATABASE_URL** and copy its value
5. In your terminal, run:
   ```bash
   export DATABASE_URL='paste-your-database-url-here'
   ```

### Step 2: Run Setup Script

```bash
cd backend/database
./railway-setup.sh
```

That's it! The script will:
- Reset the database (clean slate)
- Create all tables and functions
- Create the admin user

---

## After Setup

Visit: https://thestudio-reno-production.up.railway.app/staff

Login with:
- **Email:** `admin@thestudio.com`
- **Password:** `admin123`

**IMPORTANT:** Change the password immediately after first login!

---

## If You Get Errors

**Error: "DATABASE_URL not set"**
- Make sure you ran the `export DATABASE_URL='...'` command
- The export is temporary - it only lasts for your current terminal session

**Error: "connection refused"**
- Check that DATABASE_URL is correct
- Verify PostgreSQL service is running in Railway

**Error: "already exists"**
- Script handles these automatically - it should continue

**Error: "duplicate key"**
- Database may be partially initialized
- The script should handle this, but if not, the manual reset in RAILWAY-DB-MANUAL-SETUP.md can help

---

## Alternative: Run Commands Manually

If you prefer to run each step yourself:

```bash
# Set DATABASE_URL first (get from Railway Variables tab)
export DATABASE_URL='your-database-url'

# Step 1: Reset
psql "$DATABASE_URL" -f 00-reset-schema.sql

# Step 2: Migrate
psql "$DATABASE_URL" -f complete-migration.sql

# Step 3: Create admin
psql "$DATABASE_URL" -f 99-create-admin.sql
```

---

## Need Help?

If anything goes wrong, just let me know the error message!
