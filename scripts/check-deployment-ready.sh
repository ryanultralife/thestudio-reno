#!/bin/bash

# ============================================
# DEPLOYMENT READINESS CHECKER
# ============================================
# Verifies that the application is ready for deployment
# Run this before deploying to production

set -e

echo "╔════════════════════════════════════════╗"
echo "║  DEPLOYMENT READINESS CHECKER          ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# ============================================
# CHECK 1: Required Files Exist
# ============================================
echo "📋 Checking required files..."

required_files=(
  "backend/src/index.js"
  "backend/database/schema.sql"
  "frontend/index.html"
  "package.json"
  ".env.example"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    echo -e "  ${RED}✗${NC} $file (missing)"
    ((ERRORS++))
  fi
done

echo ""

# ============================================
# CHECK 2: Environment Variables Template
# ============================================
echo "🔐 Checking environment variables template..."

required_env_vars=(
  "DATABASE_URL"
  "JWT_SECRET"
  "NODE_ENV"
)

if [ -f ".env.example" ]; then
  for var in "${required_env_vars[@]}"; do
    if grep -q "^${var}=" .env.example; then
      echo -e "  ${GREEN}✓${NC} $var documented in .env.example"
    else
      echo -e "  ${YELLOW}⚠${NC} $var not documented in .env.example"
      ((WARNINGS++))
    fi
  done
else
  echo -e "  ${RED}✗${NC} .env.example file not found"
  ((ERRORS++))
fi

echo ""

# ============================================
# CHECK 3: Dependencies Installed
# ============================================
echo "📦 Checking dependencies..."

# Check both root and backend node_modules
root_deps=false
backend_deps=false

if [ -d "node_modules" ]; then
  echo -e "  ${GREEN}✓${NC} Root node_modules exists"
  root_deps=true
fi

if [ -d "backend/node_modules" ]; then
  echo -e "  ${GREEN}✓${NC} Backend node_modules exists"
  backend_deps=true

  # Check critical backend packages
  critical_packages=("express" "pg" "jsonwebtoken")
  for pkg in "${critical_packages[@]}"; do
    if [ -d "backend/node_modules/$pkg" ]; then
      echo -e "  ${GREEN}✓${NC} $pkg installed"
    else
      echo -e "  ${RED}✗${NC} $pkg not installed in backend"
      ((ERRORS++))
    fi
  done

  # Check for bcrypt or bcryptjs
  if [ -d "backend/node_modules/bcrypt" ] || [ -d "backend/node_modules/bcryptjs" ]; then
    echo -e "  ${GREEN}✓${NC} bcrypt/bcryptjs installed"
  else
    echo -e "  ${RED}✗${NC} bcrypt or bcryptjs not installed"
    ((ERRORS++))
  fi
fi

if [ "$root_deps" = false ] && [ "$backend_deps" = false ]; then
  echo -e "  ${RED}✗${NC} No node_modules found - run 'npm install'"
  ((ERRORS++))
fi

echo ""

# ============================================
# CHECK 4: Database Migration Files
# ============================================
echo "🗄️  Checking database migration files..."

migration_files=(
  "backend/database/schema.sql"
  "backend/database/seed.sql"
  "backend/database/retail-schema.sql"
  "backend/database/rentals-schema.sql"
  "backend/database/cms-schema.sql"
  "backend/database/campaigns-schema.sql"
  "backend/database/theme-customization-schema.sql"
  "backend/database/add-communication-preferences.sql"
  "backend/database/update-campaign-opt-in-logic.sql"
  "backend/database/mindbody-migration-schema.sql"
)

for file in "${migration_files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $(basename $file)"
  else
    echo -e "  ${YELLOW}⚠${NC} $(basename $file) (missing)"
    ((WARNINGS++))
  fi
done

echo ""

# ============================================
# CHECK 5: Security Checks
# ============================================
echo "🔒 Running security checks..."

# Check for hardcoded secrets
if grep -r "sk_test_\|sk_live_\|SG\.\|AC[a-z0-9]\{32\}" backend/src/ --include="*.js" 2>/dev/null; then
  echo -e "  ${RED}✗${NC} Hardcoded API keys detected in source code!"
  ((ERRORS++))
else
  echo -e "  ${GREEN}✓${NC} No hardcoded API keys found"
fi

# Check for proper JWT_SECRET requirement
if grep -q "JWT_SECRET.*process.env.JWT_SECRET" backend/src/middleware/auth.js 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} JWT_SECRET properly required"
else
  echo -e "  ${YELLOW}⚠${NC} JWT_SECRET might have weak fallback"
  ((WARNINGS++))
fi

# Check password requirements
if grep -q "isLength({ min: 8 })" backend/src/routes/auth.js 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Password minimum 8 characters"
elif grep -q "isLength({ min: 6 })" backend/src/routes/auth.js 2>/dev/null; then
  echo -e "  ${YELLOW}⚠${NC} Password minimum only 6 characters (should be 8+)"
  ((WARNINGS++))
else
  echo -e "  ${RED}✗${NC} Password validation not found"
  ((ERRORS++))
fi

echo ""

# ============================================
# CHECK 6: Build Test
# ============================================
echo "🏗️  Testing build..."

if [ -f "package.json" ]; then
  if grep -q '"build":' package.json; then
    echo -e "  ${GREEN}✓${NC} Build script defined in package.json"
  else
    echo -e "  ${RED}✗${NC} Build script not found in package.json"
    ((ERRORS++))
  fi

  if grep -q '"start":' package.json; then
    echo -e "  ${GREEN}✓${NC} Start script defined in package.json"
  else
    echo -e "  ${RED}✗${NC} Start script not found in package.json"
    ((ERRORS++))
  fi
fi

echo ""

# ============================================
# CHECK 7: Documentation
# ============================================
echo "📚 Checking documentation..."

doc_files=(
  "README.md"
  "DEPLOYMENT-GUIDE.md"
  "RAILWAY-DEPLOYMENT.md"
  "SECURITY-REVIEW-FINDINGS.md"
)

for file in "${doc_files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    echo -e "  ${YELLOW}⚠${NC} $file (missing)"
    ((WARNINGS++))
  fi
done

echo ""

# ============================================
# SUMMARY
# ============================================
echo "════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Review RAILWAY-DEPLOYMENT.md"
  echo "  2. Set up Railway project"
  echo "  3. Configure environment variables"
  echo "  4. Deploy and test"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ $WARNINGS warning(s) found.${NC}"
  echo "You can proceed with deployment, but review warnings above."
  exit 0
else
  echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
  echo "Fix errors before deploying to production."
  exit 1
fi
