# The Studio Reno

A complete yoga studio management platform replacing Mindbody + WordPress.

**Production Deployment**: https://thestudio-reno-production.up.railway.app

---

## 📚 Documentation

**Comprehensive documentation suite (145KB, AI-optimized)**:

- **[📖 Documentation Index](./docs/README.md)** - Start here
- **[🤖 AI Development Guide](./docs/AI-DEVELOPMENT-GUIDE.md)** - For AI assistants & developers
- **[🗄️ Database Schema](./docs/DATABASE-SCHEMA.md)** - All 50+ tables documented
- **[🔌 API Reference](./docs/API-REFERENCE.md)** - All 60+ endpoints documented
- **[🏗️ Architecture](./docs/ARCHITECTURE.md)** - System design & decisions
- **[🚀 Q2 SaaS Roadmap](./docs/Q2-SAAS-ROADMAP.md)** - Multi-tenant expansion plan

**Quick Links**:
- New to the project? → [Architecture Overview](./docs/ARCHITECTURE.md)
- Adding a feature? → [AI Development Guide](./docs/AI-DEVELOPMENT-GUIDE.md)
- Need an API endpoint? → [API Reference](./docs/API-REFERENCE.md)
- Writing queries? → [Database Schema](./docs/DATABASE-SCHEMA.md)

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- [Node.js 18+](https://nodejs.org/) 
- [PostgreSQL 14+](https://www.postgresql.org/download/)
- A code editor (VS Code recommended)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Set Up Database
```bash
# Create the database
createdb thestudio

# Or on Mac with Postgres.app:
psql -c "CREATE DATABASE thestudio;"
```

### 3. Configure Environment
```bash
# Copy the example env file
cp backend/.env.example backend/.env

# Edit with your values (see Configuration section below)
```

### 4. Initialize Database
```bash
npm run db:reset
```

### 5. Start Development
```bash
npm run dev
```

**That's it!**
- Public site: http://localhost:5173
- Staff portal: http://localhost:5173/staff

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@thestudioreno.com | admin123 |
| Teacher | sarah@thestudioreno.com | teacher123 |
| Front Desk | frontdesk@thestudioreno.com | teacher123 |

---

## ⚙️ Configuration

Edit `backend/.env` with your values:

### Required
```env
DATABASE_URL=postgresql://localhost:5432/thestudio
JWT_SECRET=generate-a-random-string-here-at-least-32-chars
FRONTEND_URL=http://localhost:5173
```

### For Payments (Stripe)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
Get these from [stripe.com/dashboard](https://dashboard.stripe.com/apikeys)

### For Emails (SendGrid)
```env
SENDGRID_API_KEY=SG...
FROM_EMAIL=hello@thestudioreno.com
```
Get this from [sendgrid.com](https://app.sendgrid.com/settings/api_keys)

### Optional
```env
# SMS via Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+17755551234

# Social Media Auto-posting
FACEBOOK_PAGE_ID=...
FACEBOOK_ACCESS_TOKEN=...
```

---

## 🌐 Deploy to Production

### Option A: Railway (Recommended - $5-20/mo)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Add PostgreSQL: Click "New" → "Database" → "PostgreSQL"
5. Set environment variables in Railway dashboard
6. Deploy!

Railway auto-detects the setup. Your site will be live in ~2 minutes.

### Option B: Render ($7-25/mo)

1. Push to GitHub
2. Go to [render.com](https://render.com)
3. Create "Web Service" from your repo
4. Create "PostgreSQL" database
5. Add environment variables
6. Deploy

### Option C: VPS (DigitalOcean/Linode - $6-12/mo)

```bash
# On your server
git clone your-repo
cd thestudio-reno
npm run install:all
npm run build

# Set up PM2 for process management
npm install -g pm2
pm2 start backend/src/index.js --name thestudio

# Set up Nginx as reverse proxy
# Set up SSL with Let's Encrypt
```

---

## 📱 Features

### Staff Portal (`/staff`)
- **Dashboard** - Today's stats, schedule, at-risk members
- **Check-In** - One-tap check-in with roster view
- **Schedule** - Week/day views, class management
- **Clients** - Search, profiles, membership info
- **Sell (POS)** - Memberships, drop-ins, retail
- **Sub Requests** - Teacher substitution workflow
- **Reports** - Attendance, revenue, popularity
- **Website (CMS)** - Content editor, theme customization
- **Settings** - Class types, memberships, teachers
- **My Account** - Profile management, password change

### Public Website (`/`)
- Schedule with real-time availability
- Online booking
- Pricing page with intro offers
- Teacher profiles
- User accounts

### Backend
- JWT authentication
- Role-based access (6 roles, 40+ permissions)
- Stripe payment processing
- Email notifications (SendGrid)
- SMS notifications (Twilio)
- Digital waiver signing
- Waitlist management
- Late cancellation handling

---

## 💰 Cost Comparison

| | Mindbody | The Studio |
|---|---|---|
| Platform | $200-500/mo | $0 |
| Hosting | Included | $5-20/mo |
| Payment fees | 2.75% | 2.9% (Stripe) |
| **Monthly Total** | **$200-500** | **$5-20** |
| **Annual Savings** | | **$2,160-5,760** |

---

## 🔧 Customization

### Change Colors
Edit `frontend/tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      brand: {
        500: '#d97706', // Your primary color
        600: '#b45309',
      }
    }
  }
}
```

### Change Studio Info
Edit `backend/.env`:
```env
STUDIO_NAME=Your Studio Name
STUDIO_ADDRESS=123 Main St, City, ST 12345
STUDIO_PHONE=(555) 123-4567
```

### Add Class Types
Use the Settings page in admin, or insert directly:
```sql
INSERT INTO class_types (name, description, duration, category, level)
VALUES ('Hot Power', 'Vigorous flow in heated room', 60, 'yoga', 'intermediate');
```

---

## 📊 Data Migration from Mindbody

If you have existing data in Mindbody:

1. Export your data from Mindbody (Clients, Sales History, etc.)
2. We can create migration scripts for your specific data

Contact us for help with data migration.

---

## 🆘 Troubleshooting

### "Database connection failed"
- Make sure PostgreSQL is running
- Check DATABASE_URL in .env matches your setup
- Try: `psql -d thestudio -c "SELECT 1"`

### "Cannot find module..."
- Run `npm run install:all` again
- Delete `node_modules` folders and reinstall

### "Port already in use"
- Another app is using port 3000 or 5173
- Kill it: `lsof -i :3000` then `kill -9 <PID>`
- Or change ports in backend/src/index.js and frontend/vite.config.js

### Emails not sending
- Check SENDGRID_API_KEY is set
- Verify sender email is authenticated in SendGrid
- Check SendGrid activity log for errors

---

## 📁 Project Structure

```
thestudio-reno/
├── docs/                    # 📚 Comprehensive documentation (145KB)
│   ├── README.md           # Documentation index
│   ├── AI-DEVELOPMENT-GUIDE.md  # Primary guide for AI-assisted coding
│   ├── DATABASE-SCHEMA.md  # All 50+ tables documented
│   ├── API-REFERENCE.md    # All 60+ endpoints documented
│   ├── ARCHITECTURE.md     # System design & decisions
│   └── Q2-SAAS-ROADMAP.md  # Multi-tenant expansion plan
│
├── backend/
│   ├── database/
│   │   ├── schema.sql      # Core database structure
│   │   ├── seed.sql        # Test data
│   │   └── *.sql           # 11 migration files
│   ├── src/
│   │   ├── routes/         # 19 API route modules
│   │   ├── services/       # Business logic, campaigns, notifications
│   │   ├── middleware/     # Auth, RBAC, permissions
│   │   └── database/       # Connection pooling
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Staff portal (985 lines)
│   │   ├── CMS.jsx         # Content management system
│   │   └── PublicWebsite.jsx  # Public-facing site
│   └── index.html
│
├── package.json            # Root scripts (dev, build, deploy)
└── README.md               # This file
```

---

## 🔒 Security Notes

- Never commit `.env` files (they're in .gitignore)
- Use strong JWT_SECRET (32+ random characters)
- Enable HTTPS in production
- Regularly update dependencies: `npm audit fix`

---

## 📞 Support

This is your custom platform. You own the code!

For help:
- Review this README
- Check the code comments
- Open a GitHub issue

---

Built with ❤️ for The Studio Reno
