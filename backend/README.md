# The Studio Reno - Complete Platform

A full-featured yoga studio management system to replace Mindbody and WordPress.

## Quick Start

### Backend
```bash
cd thestudio-backend
npm install
createdb thestudio
cp .env.example .env  # Edit with your values
npm run db:reset
npm run dev
```

### Frontend
```bash
cd thestudio-app
npm install
npm run dev
```

- **Public Site**: http://localhost:5173
- **Staff Portal**: http://localhost:5173/admin

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@thestudioreno.com | admin123 |
| Teacher | sarah@thestudioreno.com | teacher123 |
| Front Desk | frontdesk@thestudioreno.com | teacher123 |

## Features

### Staff Portal
- Dashboard with stats
- One-tap check-in
- Schedule management
- Client profiles
- POS for selling memberships
- Sub request workflow
- Reports & analytics
- System settings

### Public Website
- Class schedule with booking
- Teacher profiles
- Pricing page
- User accounts
- Login/signup

### Backend
- RBAC with 40+ permissions
- Digital waivers
- Waitlist management
- Stripe payments
- Email/SMS notifications
- Social media auto-posting
- Schedule templates

## Environment Variables

See `.env.example` for all required variables.

## Deployment

Push to GitHub and deploy on Railway, Render, or similar platform.
