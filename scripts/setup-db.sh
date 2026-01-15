#!/bin/bash
# ============================================
# THE STUDIO RENO - DATABASE SETUP
# Complete database initialization script
# ============================================

set -e # Exit on error

echo "🗄️  Setting up The Studio Reno database..."

# Database connection from env or default
DB_NAME=${DATABASE_NAME:-thestudio}
DB_USER=${DATABASE_USER:-postgres}
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}

# Check if database exists, create if not
echo "📋 Checking database..."
if ! psql -U $DB_USER -h $DB_HOST -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "Creating database $DB_NAME..."
    createdb -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME
else
    echo "Database $DB_NAME exists"
fi

echo ""
echo "🔧 Running migrations..."

# Run schemas in order
echo "  → Main schema (users, classes, bookings, memberships)"
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f backend/database/schema.sql

echo "  → CMS schema (locations, content, media)"
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f backend/database/cms-schema.sql

echo "  → Retail schema (products, inventory)"
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f backend/database/retail-schema.sql

echo "  → Rentals schema (space inquiries)"
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f backend/database/rentals-schema.sql

echo ""
echo "🌱 Seeding initial data..."
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f backend/database/seed.sql

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Start the server: npm run dev"
echo "  2. Login at http://localhost:5173/admin"
echo "     Email: admin@thestudioreno.com"
echo "     Password: admin123"
echo "  3. Go to Website section in sidebar"
echo "  4. Update locations and teacher profiles"
echo ""
