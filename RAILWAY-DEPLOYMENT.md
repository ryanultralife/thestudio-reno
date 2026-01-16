# Railway Deployment Guide

Complete guide to deploying The Studio Reno to Railway.

## Prerequisites

- [ ] GitHub account with access to this repository
- [ ] Railway account (sign up at https://railway.app)
- [ ] Stripe account for payments (optional but recommended)
- [ ] SendGrid account for emails (optional but recommended)
- [ ] Twilio account for SMS (optional)

## Step 1: Create Railway Project

1. Go to https://railway.app and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub account
5. Select the `thestudio-reno` repository
6. Railway will automatically detect it's a Node.js app

## Step 2: Add PostgreSQL Database

1. In your Railway project, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically:
   - Create a PostgreSQL instance
   - Set the `DATABASE_URL` environment variable
   - Link it to your app

## Step 3: Configure Environment Variables

In Railway, go to your app service → "Variables" tab and add:

### Required Variables

```bash
# JWT Secret (generate a strong one)
# Run: openssl rand -base64 32
JWT_SECRET=<paste-generated-secret-here>

# Node environment
NODE_ENV=production

# CORS origin (your domain)
CORS_ORIGIN=https://yourdomain.com

# Database SSL (Railway requires this)
DB_SSL_REJECT_UNAUTHORIZED=false
```

### Payment Variables (Stripe)

```bash
# Get from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_your_key_here

# Get from https://dashboard.stripe.com/webhooks
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Email Variables (SendGrid)

```bash
# Get from https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.your_api_key_here

# Your verified sender email
SENDGRID_FROM_EMAIL=noreply@yourstudio.com
```

### SMS Variables (Twilio) - Optional

```bash
# Get from https://console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

## Step 4: Initialize Database

Railway doesn't automatically run migrations. You need to run them manually:

### Option A: Using Railway CLI (Recommended)

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and link to your project:
   ```bash
   railway login
   railway link
   ```

3. Run database setup script:
   ```bash
   railway run bash backend/scripts/setup-db.sh
   ```

### Option B: Using psql Directly

1. Get your database connection URL from Railway (Variables tab)

2. Run each SQL file manually:
   ```bash
   psql "postgresql://..." -f backend/database/schema.sql
   psql "postgresql://..." -f backend/database/seed.sql
   # ... run all migration files
   ```

### SQL Files to Run (in order):

```bash
# Core schema
backend/database/schema.sql
backend/database/seed.sql

# Features
backend/database/retail-schema.sql
backend/database/rentals-schema.sql
backend/database/cms-schema.sql
backend/database/campaigns-schema.sql
backend/database/theme-customization-schema.sql

# Migrations
backend/database/add-communication-preferences.sql
backend/database/update-campaign-opt-in-logic.sql
backend/database/mindbody-migration-schema.sql
```

## Step 5: Configure Build Settings

Railway should auto-detect these, but verify:

1. **Root Directory**: Leave empty (project root)
2. **Build Command**: `npm run build` (Railway runs this automatically)
3. **Start Command**: `npm start` (should be in package.json)

## Step 6: Set Up Custom Domain (Optional)

1. In Railway project → Settings → Domains
2. Click "Generate Domain" for a free railway.app subdomain
3. Or add your custom domain:
   - Click "Add Domain"
   - Enter your domain (e.g., studio.yourdomain.com)
   - Add the CNAME record to your DNS provider:
     ```
     CNAME studio.yourdomain.com -> your-app.railway.app
     ```

## Step 7: Configure Stripe Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your Railway URL: `https://your-app.railway.app/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret
6. Add it to Railway environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 8: Create Admin User

Once deployed, create your first admin user:

```bash
# Using Railway CLI
railway run npm run create-admin

# Or using psql directly
psql "your-database-url" <<EOF
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'admin@yourstudio.com',
  -- Password hash for 'admin123' (CHANGE THIS IMMEDIATELY AFTER LOGIN)
  '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u',
  'Admin',
  'User',
  'admin',
  true
);
EOF
```

**IMPORTANT**: Login immediately and change the password!

## Step 9: Verify Deployment

Test these endpoints:

1. **Health Check**: `https://your-app.railway.app/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Public Website**: `https://your-app.railway.app/`
   - Should show your homepage

3. **Admin Login**: `https://your-app.railway.app/staff`
   - Login with admin credentials
   - Change password immediately

4. **Test Booking Flow**:
   - Create a test class
   - Book as a student
   - Check in
   - Verify emails are sent (if configured)

## Step 10: Monitor & Debug

### View Logs

In Railway → Deployments → Click on latest deployment → View logs

### Common Issues

**Database connection errors:**
```
Error: connect ECONNREFUSED
```
- Check `DATABASE_URL` is set correctly
- Verify database service is running
- Check `DB_SSL_REJECT_UNAUTHORIZED=false` is set

**JWT errors:**
```
JWT_SECRET environment variable must be set
```
- Generate a strong secret: `openssl rand -base64 32`
- Add to Railway environment variables

**Stripe webhook errors:**
```
Webhook signature verification failed
```
- Check `STRIPE_WEBHOOK_SECRET` matches the one in Stripe dashboard
- Verify webhook URL is correct
- Check that webhook is sending to HTTPS

**Email not sending:**
```
WARNING: SENDGRID_API_KEY not set
```
- Add SendGrid credentials to Railway
- Verify sender email is verified in SendGrid

## Step 11: Enable Automated Campaigns

Once deployed and tested:

1. Login to Staff Portal
2. Navigate to Website → Campaigns
3. Set engagement intensity slider
4. Enable auto-send for desired groups
5. Monitor campaign logs in Reports

## Production Checklist

Before going live:

- [ ] Strong `JWT_SECRET` set (not default)
- [ ] Production Stripe keys configured
- [ ] Custom domain configured with SSL
- [ ] Admin password changed from default
- [ ] Database backups enabled (Railway does this automatically)
- [ ] Webhook endpoints tested
- [ ] Email/SMS credentials configured and tested
- [ ] All migration SQL files run successfully
- [ ] Privacy policy and terms of service added to website
- [ ] GDPR/CCPA compliance reviewed
- [ ] Test transaction completed successfully
- [ ] Automated campaigns tested with small group first

## Maintenance

### View Database

Use Railway's built-in PostgreSQL client:
1. Click on PostgreSQL service
2. Click "Data" tab
3. Browse tables and run queries

### Rollback Deployment

If something goes wrong:
1. Go to Deployments
2. Find last working deployment
3. Click "..." → "Redeploy"

### Update Environment Variables

1. Variables tab → Edit
2. Click "Redeploy" to apply changes

### Database Backups

Railway automatically backs up PostgreSQL databases:
- Daily backups retained for 7 days
- For additional safety, set up manual backups:
  ```bash
  railway run pg_dump $DATABASE_URL > backup.sql
  ```

## Cost Estimate

Railway pricing (as of 2024):

- **Hobby Plan**: $5/month
  - Includes $5 of usage credits
  - Good for development/testing

- **Pro Plan**: $20/month
  - Includes $20 of usage credits
  - Recommended for production
  - Better performance and resources

Typical usage:
- Web service: ~$3-5/month
- PostgreSQL: ~$5-10/month
- **Total**: ~$8-15/month for small studio

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Stripe Support: https://support.stripe.com
- SendGrid Support: https://support.sendgrid.com

## Next Steps After Deployment

1. Import Mindbody data (see MINDBODY-MIGRATION-GUIDE.md)
2. Customize theme (see SAAS-WHITE-LABEL-GUIDE.md)
3. Add your class types and schedule
4. Invite teachers and staff
5. Test with small group before full launch
6. Train staff on using the system
7. Announce to members!
