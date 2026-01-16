#!/bin/bash
# ============================================
# Railway Database Setup Script
# Run all migrations in correct order
# ============================================

set -e  # Exit on any error

echo "🗄️  Railway Database Setup Starting..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo ""
  echo "Get your DATABASE_URL from Railway:"
  echo "1. Go to PostgreSQL service → Variables tab"
  echo "2. Copy the DATABASE_URL value"
  echo "3. Run: export DATABASE_URL='your-database-url-here'"
  echo ""
  exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Step 1: Reset Schema
echo "📝 Step 1: Resetting database schema..."
psql "$DATABASE_URL" -f 00-reset-schema.sql
echo "✅ Schema reset complete"
echo ""

# Step 2: Run Complete Migration
echo "📝 Step 2: Running complete migration (this may take a minute)..."
psql "$DATABASE_URL" -f complete-migration.sql
echo "✅ Migration complete"
echo ""

# Step 3: Create Admin User
echo "📝 Step 3: Creating admin user..."
psql "$DATABASE_URL" -f 99-create-admin.sql
echo "✅ Admin user created"
echo ""

echo "🎉 Database setup complete!"
echo ""
echo "You can now login at:"
echo "https://thestudio-reno-production.up.railway.app/staff"
echo ""
echo "Login credentials:"
echo "  Email: admin@thestudio.com"
echo "  Password: admin123"
echo ""
echo "⚠️  CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN"
