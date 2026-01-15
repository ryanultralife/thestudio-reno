# Railway Deployment Guide

Deploy The Studio Reno to production in ~15 minutes.

## 🚂 Prerequisites

1. **GitHub Account** - Code must be pushed to GitHub
2. **Railway Account** - Sign up at https://railway.app (free tier available)
3. **SendGrid Account** (optional but recommended) - For emails
4. **Stripe Account** (optional) - For payments

---

## 📋 Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
# Make sure all changes are committed
git add -A
git commit -m "Ready for deployment"

# Push to your repository
git push origin claude/start-website-i2qmc

# Or push to main branch
git checkout main
git merge claude/start-website-i2qmc
git push origin main
```

### Step 2: Create Railway Project

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `thestudio-reno` repository
5. Railway will auto-detect the configuration

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **"New"**
2. Select **"Database"**
3. Choose **"PostgreSQL"**
4. Railway will provision a database and set `DATABASE_URL` automatically

### Step 4: Set Environment Variables

Click on your service → **Variables** tab → Add these:

#### Required Variables

```bash
# Database (auto-set by Railway)
DATABASE_URL=postgresql://...  # Already set

# JWT Secret (IMPORTANT - Generate a random string)
JWT_SECRET=your-super-secret-random-string-at-least-32-characters-long

# Frontend URL (will be your Railway URL)
FRONTEND_URL=https://your-app-name.up.railway.app
CORS_ORIGIN=https://your-app-name.up.railway.app

# Node Environment
NODE_ENV=production
PORT=3000
```

#### Generate JWT Secret

```bash
# Run this to generate a secure random string:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Email Settings (SendGrid - Recommended)

```bash
SENDGRID_API_KEY=SG.xxxxx...
FROM_EMAIL=hello@thestudioreno.com
FROM_NAME=The Studio Reno
ADMIN_EMAIL=your-email@example.com
```

Get SendGrid API key:
1. Sign up at https://sendgrid.com
2. Go to Settings → API Keys
3. Create API Key
4. Copy and paste above

#### Optional: Payment Processing (Stripe)

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Optional: SMS (Twilio)

```bash
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_PHONE_NUMBER=+17755551234
```

### Step 5: Initialize Database

Railway will create an empty PostgreSQL database. You need to run migrations.

#### Option A: Using Railway CLI (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run psql $DATABASE_URL -f backend/database/schema.sql
railway run psql $DATABASE_URL -f backend/database/cms-schema.sql
railway run psql $DATABASE_URL -f backend/database/retail-schema.sql
railway run psql $DATABASE_URL -f backend/database/rentals-schema.sql
railway run psql $DATABASE_URL -f backend/database/seed.sql
```

#### Option B: Using Database GUI

1. Click on PostgreSQL service in Railway
2. Click **"Connect"** → Copy connection string
3. Use TablePlus, pgAdmin, or psql locally:
   ```bash
   psql "postgresql://..." -f backend/database/schema.sql
   psql "postgresql://..." -f backend/database/cms-schema.sql
   psql "postgresql://..." -f backend/database/retail-schema.sql
   psql "postgresql://..." -f backend/database/rentals-schema.sql
   psql "postgresql://..." -f backend/database/seed.sql
   ```

### Step 6: Deploy!

1. Railway auto-deploys on push
2. Watch the build logs
3. Wait for deployment to complete (~2-3 minutes)
4. Click **"View Logs"** to monitor

### Step 7: Get Your URL

1. Click on your service
2. Click **"Settings"** tab
3. Under **"Domains"**, you'll see your Railway URL:
   ```
   https://your-app-name.up.railway.app
   ```
4. **Update FRONTEND_URL and CORS_ORIGIN** with this URL!

### Step 8: Test Production Site

Visit your Railway URL and test:

- [ ] Homepage loads
- [ ] Can navigate to /for-teachers
- [ ] Can submit teacher inquiry (check for email)
- [ ] Can view /schedule
- [ ] Staff login works: /admin
- [ ] Can edit content in CMS

---

## 🔒 Post-Deployment Security

### Change Default Admin Password

```bash
# Connect to database
railway run psql $DATABASE_URL

# Update admin password
UPDATE users
SET password_hash = crypt('your-new-secure-password', gen_salt('bf'))
WHERE email = 'admin@thestudioreno.com';
```

### Create Your Own Admin Account

Use the signup flow or manually in database:

```sql
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
  'your-email@example.com',
  crypt('your-password', gen_salt('bf')),
  'Your',
  'Name',
  'owner'
);
```

---

## 🌐 Custom Domain (Optional)

Want your own domain like thestudioreno.com?

1. Buy domain (Namecheap, Google Domains, etc.)
2. In Railway → **Settings** → **Domains**
3. Click **"Add Custom Domain"**
4. Enter your domain: `thestudioreno.com`
5. Railway shows DNS records to add
6. Add those records in your domain registrar
7. Wait for DNS propagation (~10 minutes to 24 hours)
8. SSL certificate auto-generates

Update environment variables:
```bash
FRONTEND_URL=https://thestudioreno.com
CORS_ORIGIN=https://thestudioreno.com
```

---

## 💰 Costs

### Railway Pricing

- **Hobby Plan**: $5/month
  - Includes PostgreSQL
  - 512 MB RAM
  - 1 GB storage
  - Perfect for starting out

- **Pro Plan**: $20/month
  - More resources
  - Better for growth

### Total Monthly Costs

| Service | Cost |
|---------|------|
| Railway Hosting | $5-20 |
| SendGrid (Email) | $0 (free tier: 100 emails/day) |
| Stripe (Payments) | 2.9% + $0.30 per transaction |
| Cloudinary (Images) | $0 (free tier) |
| **Total Fixed** | **$5-20/month** |

Compare to Mindbody: $200-500/month 💸

---

## 📊 Monitoring

### Railway Dashboard

- View logs in real-time
- Monitor CPU/RAM usage
- Check deployment status
- View environment variables

### Health Checks

Railway automatically pings `/api/health` endpoint.

If service is unhealthy, Railway will:
1. Restart the service
2. Notify you (if configured)
3. Show status in dashboard

---

## 🔄 Updates and Redeployments

### Automatic Deployments

Every time you push to GitHub:
```bash
git add -A
git commit -m "Update content"
git push origin main
```

Railway automatically:
1. Detects the push
2. Builds new version
3. Deploys (zero-downtime)
4. Switches traffic to new version

### Manual Redeployment

In Railway dashboard:
1. Click on your service
2. Click three dots (•••)
3. Select **"Redeploy"**

### Rollback

Made a mistake?
1. Go to **Deployments** tab
2. Find previous working deployment
3. Click **"Redeploy"** on that version

---

## 🆘 Troubleshooting

### "Build Failed"

Check build logs:
- Missing dependencies? Run `npm install` locally first
- Syntax errors? Test build locally: `npm run build`

### "Service Unhealthy"

- Check application logs for errors
- Verify environment variables are set
- Check DATABASE_URL is correct
- Ensure PORT=3000 is set

### Database Connection Failed

- Verify DATABASE_URL is set by Railway
- Check if database service is running
- Try connecting with psql locally to test

### Emails Not Sending

- Verify SENDGRID_API_KEY is correct
- Check SendGrid dashboard for errors
- Verify sender email is authenticated in SendGrid
- Check application logs for email errors

### Can't Login

- Make sure you ran seed.sql (creates admin user)
- Try resetting password via database
- Check browser console for errors
- Verify JWT_SECRET is set

---

## ✅ Deployment Checklist

Before going live:

### Technical
- [ ] All environment variables set
- [ ] Database migrations run successfully
- [ ] HTTPS is working (auto via Railway)
- [ ] Health check endpoint returning 200
- [ ] Application starts without errors

### Content
- [ ] Locations updated with real info
- [ ] Teacher profiles completed
- [ ] Class schedule populated
- [ ] Contact info verified
- [ ] Pricing is accurate

### Functionality
- [ ] Can signup/login
- [ ] Can book a class
- [ ] Teacher inquiry form works
- [ ] Emails are being sent
- [ ] CMS editing works
- [ ] Mobile view looks good

### Security
- [ ] Changed default admin password
- [ ] JWT_SECRET is long and random
- [ ] Database credentials secured
- [ ] No secrets in code/commits

---

## 🎉 You're Live!

Congratulations! Your yoga studio management platform is now running in production.

**Share your website:**
- thestudioreno.com (or your Railway URL)
- Social media
- Email newsletter
- In-studio signage

**Next steps:**
- Monitor usage
- Gather feedback
- Iterate and improve
- Add more features as needed

**Support:**
- Check Railway docs: https://docs.railway.app
- Review application logs for errors
- Test regularly to ensure everything works

---

## 📞 Need Help?

If you run into issues:
1. Check Railway logs
2. Review environment variables
3. Test database connection
4. Check this guide again
5. Railway support: https://railway.app/help

Good luck with your launch! 🚀
