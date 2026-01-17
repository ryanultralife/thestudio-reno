#!/bin/bash
# Complete setup script - runs migrations and populates demo data

echo "=================================================="
echo "  THE STUDIO RENO - COMPLETE SETUP"
echo "=================================================="
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo ""
  echo "Usage:"
  echo "  DATABASE_URL=your_database_url ./complete-setup.sh"
  echo ""
  exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Step 1: Run co-op classes migration
echo "📝 Step 1: Running co-op classes migration..."
psql "$DATABASE_URL" -f database/add-coop-classes.sql
if [ $? -eq 0 ]; then
  echo "✅ Co-op classes migration complete"
else
  echo "⚠️  Co-op classes migration had warnings (may already be applied)"
fi
echo ""

# Step 2: Run class series migration
echo "📝 Step 2: Running class series migration..."
psql "$DATABASE_URL" -f database/add-class-series.sql
if [ $? -eq 0 ]; then
  echo "✅ Class series migration complete"
else
  echo "⚠️  Class series migration had warnings (may already be applied)"
fi
echo ""

# Step 3: Populate demo data
echo "📝 Step 3: Populating demo data..."
node database/populate-demo.js

echo ""
echo "=================================================="
echo "  ✅ SETUP COMPLETE!"
echo "=================================================="
echo ""
echo "You can now log in with:"
echo ""
echo "  Students:"
echo "    - emma.wilson@demo.com"
echo "    - michael.chen@demo.com"
echo "    - sofia.rodriguez@demo.com"
echo "    - (12 more available)"
echo ""
echo "  Teachers:"
echo "    - sarah.yoga@demo.com"
echo "    - raj.mindful@demo.com"
echo "    - lisa.power@demo.com"
echo ""
echo "  Password for all: demo123"
echo ""
echo "=================================================="
