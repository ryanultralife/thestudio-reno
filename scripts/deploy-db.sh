#!/bin/bash

# Get DATABASE_URL from Railway
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Please set DATABASE_URL environment variable"
  echo "   Get it from Railway PostgreSQL Variables tab"
  echo ""
  echo "Usage:"
  echo "  export DATABASE_URL='postgresql://...'"
  echo "  ./scripts/deploy-db.sh"
  exit 1
fi

echo "🗄️  Initializing database..."
echo ""

# Run migrations in order
psql "$DATABASE_URL" -f backend/database/schema.sql && \
psql "$DATABASE_URL" -f backend/database/seed.sql && \
psql "$DATABASE_URL" -f backend/database/retail-schema.sql && \
psql "$DATABASE_URL" -f backend/database/rentals-schema.sql && \
psql "$DATABASE_URL" -f backend/database/cms-schema.sql && \
psql "$DATABASE_URL" -f backend/database/campaigns-schema.sql && \
psql "$DATABASE_URL" -f backend/database/theme-customization-schema.sql && \
psql "$DATABASE_URL" -f backend/database/add-communication-preferences.sql && \
psql "$DATABASE_URL" -f backend/database/update-campaign-opt-in-logic.sql && \
psql "$DATABASE_URL" -f backend/database/mindbody-migration-schema.sql && \
psql "$DATABASE_URL" -f backend/database/fix-webhook-replay-vulnerability.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Database initialized successfully!"
  echo ""
  echo "Next: Create admin user"
else
  echo ""
  echo "❌ Migration failed. Check errors above."
  exit 1
fi
