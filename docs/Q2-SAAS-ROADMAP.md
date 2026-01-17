# Q2 Multi-Tenant SaaS Expansion Roadmap

**The Studio Reno → Multi-Studio Platform**

> **Vision**: Transform from single-tenant yoga studio platform into a white-label SaaS for studios and gyms worldwide.

---

## Table of Contents

1. [Q1 vs Q2 Strategy](#q1-vs-q2-strategy)
2. [Current State Analysis](#current-state-analysis)
3. [Technical Migration Path](#technical-migration-path)
4. [Feature Roadmap](#feature-roadmap)
5. [Pricing & Subscription Tiers](#pricing--subscription-tiers)
6. [Go-to-Market Strategy](#go-to-market-strategy)
7. [Implementation Phases](#implementation-phases)

---

## Q1 vs Q2 Strategy

### Q1 (Current) - Single Tenant: The Studio Reno

**Focus**: Perfect product for single studio
**Timeline**: January - March 2026
**Goal**: Production-ready, revenue-generating, feature-complete

**Key Deliverables**:
- ✅ Core class management & booking
- ✅ Membership system with Stripe integration
- ✅ Retail & inventory management
- ✅ Email/SMS campaigns
- ✅ CMS for website customization
- ⏳ Space rental/co-op marketplace (in progress)
- ⏳ Teacher portal
- ⏳ Mobile-responsive design

**Current Status**:
- Deployed to Railway (production)
- Database fully initialized (50+ tables)
- Admin login functional
- Payment processing active
- **Revenue**: $0/mo (pre-launch)

---

### Q2 (Future) - Multi-Tenant SaaS Platform

**Focus**: Scale to 100+ studios
**Timeline**: April - June 2026
**Goal**: SaaS platform with recurring revenue

**Key Deliverables**:
- Multi-tenant data isolation
- Studio onboarding flow
- Subscription billing (Stripe Billing)
- White-label customization
- Subdomain/custom domain routing
- Admin dashboard for studio owners
- Marketplace features (optional add-ons)

**Target Metrics**:
- 10 paying studios by June 2026
- $5K-$10K MRR
- 95%+ uptime
- <2s average page load time

---

## Current State Analysis

### Infrastructure Already Built for Multi-Tenant

✅ **Database Schema Ready**:
```sql
CREATE TABLE studios (
  id UUID PRIMARY KEY,
  slug VARCHAR(50) UNIQUE,           -- subdomain
  name VARCHAR(100),
  owner_id UUID REFERENCES users,
  subscription_tier VARCHAR(20),     -- starter, pro, enterprise
  subscription_status VARCHAR(20),   -- trial, active, past_due, cancelled
  custom_domain VARCHAR(100) UNIQUE,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE theme_settings (
  studio_id UUID REFERENCES studios,
  -- Colors, fonts, layout, feature flags
  primary_color, secondary_color, accent_color,
  logo_url, favicon_url,
  font_heading, font_body,
  show_retail_shop BOOLEAN,
  show_teacher_rentals BOOLEAN,
  enable_dark_mode BOOLEAN
);
```

✅ **Feature Flags System**:
- `show_retail_shop` - Toggle retail functionality
- `show_teacher_rentals` - Toggle space rental
- `show_tea_lounge` - Toggle tea lounge (future)
- `enable_dark_mode` - Theme option

✅ **Theme Customization**:
- Full color palette control
- Font selection (Google Fonts)
- Logo/favicon upload
- Layout style presets
- Dynamic CSS generation

### What's Missing for Multi-Tenant

❌ **Data Isolation**:
- No `studio_id` foreign keys on tables yet
- All data currently shared (single tenant mode)
- Queries not filtered by studio

❌ **Tenant Detection**:
- No subdomain routing (e.g., `studio-name.thestudioplatform.com`)
- No custom domain support (e.g., `www.studiodomain.com`)
- No middleware to inject `req.studio_id`

❌ **Onboarding**:
- No studio signup flow
- No subscription payment collection
- No initial setup wizard

❌ **Billing**:
- No Stripe Billing integration
- No subscription management UI
- No usage tracking/metering

❌ **Admin Panel**:
- No super-admin dashboard (view all studios)
- No studio analytics/metrics
- No support ticketing

---

## Technical Migration Path

### Phase 1: Data Isolation (2 weeks)

**Goal**: Add `studio_id` to all tables and enforce data isolation

**Steps**:

1. **Add studio_id column to all tables**:
```sql
-- Migration: add-multi-tenant-support.sql
ALTER TABLE users ADD COLUMN studio_id UUID REFERENCES studios(id);
ALTER TABLE classes ADD COLUMN studio_id UUID REFERENCES studios(id);
ALTER TABLE products ADD COLUMN studio_id UUID REFERENCES studios(id);
ALTER TABLE bookings ADD COLUMN studio_id UUID REFERENCES studios(id);
ALTER TABLE transactions ADD COLUMN studio_id UUID REFERENCES studios(id);
-- ... repeat for all 50+ tables

-- Create indexes for performance
CREATE INDEX idx_users_studio ON users(studio_id);
CREATE INDEX idx_classes_studio ON classes(studio_id);
CREATE INDEX idx_products_studio ON products(studio_id);
-- ... repeat
```

2. **Backfill existing data** (Q1 studio becomes first tenant):
```sql
-- Create studio record for The Studio Reno
INSERT INTO studios (id, slug, name, owner_id, subscription_tier, subscription_status)
VALUES (
  gen_random_uuid(),
  'thestudioreno',
  'The Studio Reno',
  (SELECT id FROM users WHERE email = 'admin@thestudio.com'),
  'enterprise',
  'active'
);

-- Backfill all existing data
UPDATE users SET studio_id = (SELECT id FROM studios WHERE slug = 'thestudioreno');
UPDATE classes SET studio_id = (SELECT id FROM studios WHERE slug = 'thestudioreno');
-- ... repeat for all tables
```

3. **Add NOT NULL constraint** (after backfill):
```sql
ALTER TABLE users ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE classes ALTER COLUMN studio_id SET NOT NULL;
-- ... repeat
```

4. **Update all queries** to filter by studio:
```javascript
// BEFORE
const classes = await db.query('SELECT * FROM classes WHERE date = $1', [date]);

// AFTER
const classes = await db.query(
  'SELECT * FROM classes WHERE studio_id = $1 AND date = $2',
  [req.studio_id, date]
);
```

**Complexity**: 🟡 Medium - Requires updating every query in codebase
**Risk**: 🔴 High - Data leakage if queries missed
**Testing**: Create 2 test studios, verify data isolation

---

### Phase 2: Tenant Detection Middleware (1 week)

**Goal**: Detect which studio from subdomain/domain

**Steps**:

1. **Create tenant detection middleware**:
```javascript
// backend/src/middleware/tenant.js
async function detectStudio(req, res, next) {
  try {
    const hostname = req.hostname;  // e.g., 'thestudioreno.thestudioplatform.com'

    let studio;

    // Check if custom domain
    studio = await db.query(
      'SELECT * FROM studios WHERE custom_domain = $1 AND is_active = true',
      [hostname]
    );

    // If not custom domain, extract subdomain
    if (studio.rows.length === 0) {
      const subdomain = hostname.split('.')[0];  // 'thestudioreno'
      studio = await db.query(
        'SELECT * FROM studios WHERE slug = $1 AND is_active = true',
        [subdomain]
      );
    }

    if (studio.rows.length === 0) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    // Inject studio into request
    req.studio = studio.rows[0];
    req.studio_id = studio.rows[0].id;

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { detectStudio };
```

2. **Apply to all routes**:
```javascript
// backend/src/index.js
const { detectStudio } = require('./middleware/tenant');

// Apply globally (except health check, webhooks)
app.use('/api/classes', detectStudio, classesRoutes);
app.use('/api/bookings', detectStudio, bookingsRoutes);
// ... all routes
```

3. **Update frontend API calls** to use relative URLs:
```javascript
// BEFORE
const API_URL = 'https://thestudio-reno-production.up.railway.app/api';

// AFTER
const API_URL = '/api';  // Relative to current domain
```

**Complexity**: 🟢 Low - Single middleware file
**Risk**: 🟢 Low - Easy to test with localhost:3000
**Testing**: Use `/etc/hosts` to test multiple domains locally

---

### Phase 3: Studio Onboarding (2 weeks)

**Goal**: Self-service studio signup and setup

**Steps**:

1. **Create public marketing site** (separate from app):
```
https://thestudioplatform.com → Marketing site
https://app.thestudioplatform.com → Login portal
https://{studio-slug}.app.thestudioplatform.com → Studio sites
```

2. **Build signup flow**:
```
Step 1: Studio Info
  - Studio name
  - Email/password
  - Studio type (yoga, pilates, fitness, etc.)

Step 2: Subdomain Selection
  - Choose slug: [_______].app.thestudioplatform.com
  - Check availability

Step 3: Trial Start
  - Create studio record
  - Generate sample data (3 class types, 2 locations, 5 membership tiers)
  - Create owner user
  - Redirect to dashboard

Step 4: Setup Wizard (in-app)
  - Upload logo
  - Choose colors
  - Add first teacher
  - Create first class
  - Configure Stripe (for payments)
```

3. **Sample data generator**:
```javascript
async function generateSampleData(studio_id) {
  // Create class types
  await db.query(`
    INSERT INTO class_types (id, studio_id, name, duration_minutes, color)
    VALUES
      (gen_random_uuid(), $1, 'Vinyasa Flow', 60, '#f59e0b'),
      (gen_random_uuid(), $1, 'Hatha Yoga', 75, '#10b981'),
      (gen_random_uuid(), $1, 'Yin Yoga', 90, '#8b5cf6')
  `, [studio_id]);

  // Create membership types
  await db.query(`
    INSERT INTO membership_types (id, studio_id, name, price, duration_days, credits)
    VALUES
      (gen_random_uuid(), $1, 'Monthly Unlimited', 99, 30, NULL),
      (gen_random_uuid(), $1, '10-Class Pack', 180, 365, 10),
      (gen_random_uuid(), $1, 'Single Class', 22, 1, 1)
  `, [studio_id]);

  // Create default location
  await db.query(`
    INSERT INTO locations (id, studio_id, name)
    VALUES (gen_random_uuid(), $1, 'Main Studio')
  `, [studio_id]);
}
```

**Complexity**: 🟡 Medium - New pages and logic
**Risk**: 🟢 Low - Isolated from existing studios
**Testing**: Sign up test studios, verify isolation

---

### Phase 4: Subscription Billing (2 weeks)

**Goal**: Collect recurring revenue via Stripe

**Steps**:

1. **Define pricing tiers**:
```javascript
const PRICING_TIERS = {
  starter: {
    name: 'Starter',
    price: 49,  // $49/month
    limits: {
      max_active_members: 100,
      max_locations: 1,
      max_staff_users: 3,
      features: ['class_management', 'basic_reporting']
    }
  },
  professional: {
    name: 'Professional',
    price: 149,  // $149/month
    limits: {
      max_active_members: 500,
      max_locations: 3,
      max_staff_users: 10,
      features: ['class_management', 'advanced_reporting', 'campaigns', 'retail']
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,  // $299/month
    limits: {
      max_active_members: null,  // unlimited
      max_locations: null,
      max_staff_users: null,
      features: ['all_features', 'custom_domain', 'api_access', 'priority_support']
    }
  }
};
```

2. **Stripe Billing integration**:
```javascript
// backend/src/routes/subscriptions.js
router.post('/subscribe', authenticate, async (req, res) => {
  const { tier } = req.body;  // 'starter', 'professional', 'enterprise'

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: req.user.email,
    line_items: [{
      price: STRIPE_PRICE_IDS[tier],  // Pre-created in Stripe Dashboard
      quantity: 1
    }],
    metadata: {
      studio_id: req.studio_id,
      tier: tier
    },
    success_url: `https://${req.studio.slug}.app.thestudioplatform.com/settings/billing?success=true`,
    cancel_url: `https://${req.studio.slug}.app.thestudioplatform.com/settings/billing?cancelled=true`
  });

  res.json({ session_url: session.url });
});
```

3. **Webhook handler** for subscription events:
```javascript
// backend/src/routes/webhooks.js
router.post('/stripe-billing', async (req, res) => {
  const event = req.body;

  switch (event.type) {
    case 'customer.subscription.created':
      // Activate studio, start trial/billing
      await db.query(`
        UPDATE studios SET
          subscription_status = 'active',
          subscription_tier = $1,
          stripe_subscription_id = $2
        WHERE id = $3
      `, [event.data.object.metadata.tier, event.data.object.id, event.data.object.metadata.studio_id]);
      break;

    case 'customer.subscription.updated':
      // Handle tier changes, renewals
      break;

    case 'invoice.payment_failed':
      // Mark subscription as past_due
      await db.query(`
        UPDATE studios SET subscription_status = 'past_due'
        WHERE stripe_subscription_id = $1
      `, [event.data.object.subscription]);
      break;

    case 'customer.subscription.deleted':
      // Cancel subscription, disable studio
      await db.query(`
        UPDATE studios SET subscription_status = 'cancelled', is_active = false
        WHERE stripe_subscription_id = $1
      `, [event.data.object.id]);
      break;
  }

  res.json({ received: true });
});
```

4. **Enforce limits middleware**:
```javascript
// backend/src/middleware/limits.js
async function enforceLimits(req, res, next) {
  const studio = req.studio;
  const tier = PRICING_TIERS[studio.subscription_tier];

  // Check active members limit
  if (tier.limits.max_active_members) {
    const count = await db.query(`
      SELECT COUNT(*) FROM users
      WHERE studio_id = $1 AND role = 'student' AND is_active = true
    `, [studio.id]);

    if (count.rows[0].count >= tier.limits.max_active_members) {
      return res.status(403).json({
        error: 'Member limit reached',
        message: `Your ${tier.name} plan allows up to ${tier.limits.max_active_members} active members. Upgrade to add more.`,
        upgrade_url: `/settings/billing`
      });
    }
  }

  next();
}
```

**Complexity**: 🟡 Medium - Stripe integration
**Risk**: 🟡 Medium - Billing errors impact revenue
**Testing**: Use Stripe test mode extensively

---

### Phase 5: Custom Domains (1 week)

**Goal**: Allow studios to use their own domains

**Steps**:

1. **DNS verification**:
```javascript
// User adds CNAME record: www.studiodomain.com → thestudioreno.app.thestudioplatform.com
// Verify DNS propagation before enabling
async function verifyCustomDomain(domain) {
  const dns = require('dns').promises;
  try {
    const records = await dns.resolveCname(domain);
    return records.some(r => r.endsWith('.app.thestudioplatform.com'));
  } catch (error) {
    return false;
  }
}
```

2. **SSL certificate provisioning** (Railway/Cloudflare):
- Automatic SSL via Railway for `*.app.thestudioplatform.com`
- For custom domains, use Cloudflare proxy (free SSL)

3. **Update tenant detection** (already supports custom domains)

**Complexity**: 🟡 Medium - DNS and SSL complexity
**Risk**: 🟡 Medium - SSL issues can break sites
**Testing**: Test with free domain registrar

---

## Feature Roadmap

### Core Features (Q2 Launch Requirements)

- [x] Class management & booking
- [x] Membership system
- [x] Payment processing (Stripe)
- [x] Email/SMS campaigns
- [x] CMS for website
- [ ] Mobile-responsive design (50% complete)
- [ ] Studio onboarding flow
- [ ] Subscription billing
- [ ] Multi-tenant data isolation
- [ ] Subdomain routing

### Advanced Features (Post-Q2)

- [ ] **Teacher Portal** - Dedicated app for teachers
  - View schedule
  - Track earnings
  - Manage sub requests
  - Student attendance reports

- [ ] **Student Mobile App** - iOS/Android (React Native)
  - Browse schedule
  - Book classes
  - Manage membership
  - Check-in with QR code

- [ ] **Marketplace Add-ons** - Optional paid features
  - Advanced analytics ($20/mo)
  - SMS notifications (pay-per-use)
  - Custom integrations (MindBody, ClassPass)
  - Marketing automation ($30/mo)

- [ ] **API Access** (Enterprise tier)
  - REST API for integrations
  - Webhooks for events
  - Developer documentation

- [ ] **Franchise Management** - Multi-location studios
  - Centralized management
  - Location-specific settings
  - Cross-location memberships

---

## Pricing & Subscription Tiers

### Starter - $49/month

**Target**: New studios, <100 members

**Includes**:
- Up to 100 active members
- 1 location
- 3 staff users
- Unlimited classes
- Basic reporting
- Email support

**Limits**:
- No retail/inventory
- No campaigns
- No custom domain
- Basic theme customization

---

### Professional - $149/month

**Target**: Growing studios, 100-500 members

**Includes**:
- Up to 500 active members
- 3 locations
- 10 staff users
- Unlimited classes
- Advanced reporting & analytics
- Email/SMS campaigns
- Retail & inventory management
- Priority email support

**Limits**:
- No custom domain
- No API access

---

### Enterprise - $299/month

**Target**: Large studios, 500+ members

**Includes**:
- Unlimited members
- Unlimited locations
- Unlimited staff users
- All features
- Custom domain (e.g., www.studiodomain.com)
- White-label branding
- API access
- Priority phone/chat support
- Dedicated account manager

---

### Add-ons (All Tiers)

- **SMS Notifications**: $0.01/SMS (pay-as-you-go)
- **Advanced Analytics**: +$20/mo
- **ClassPass Integration**: +$50/mo
- **MindBody Migration**: $200 one-time

---

## Go-to-Market Strategy

### Phase 1: Friends & Family (April 2026)

**Goal**: 5 pilot studios, free for 6 months

**Acquisition**:
- Personal outreach to studio owners in network
- Offer free setup + migration
- Request detailed feedback

**Success Metrics**:
- 5 studios signed up
- 500+ total members across studios
- 90% feature satisfaction score

---

### Phase 2: Local Expansion (May 2026)

**Goal**: 20 paying studios in Reno/Tahoe region

**Acquisition**:
- Google Ads (local keywords: "yoga studio software Reno")
- Facebook Ads (target: studio owners, yoga teachers)
- In-person demos at local studios
- Referral program ($50 credit per referral)

**Pricing**:
- 30-day free trial
- 20% discount for annual payment
- Free migration from competitors

**Success Metrics**:
- 20 paying studios
- $2K MRR
- <5% churn rate

---

### Phase 3: National Launch (June 2026)

**Goal**: 100 studios nationwide

**Acquisition**:
- Content marketing (SEO blog posts)
- YouTube tutorials
- Partnerships with yoga teacher training programs
- Sponsor yoga conferences
- Affiliate program (20% recurring commission)

**Success Metrics**:
- 100 paying studios
- $10K MRR
- Featured in yoga/fitness publications

---

## Implementation Phases

### Phase 0: Q1 Foundation (January - March 2026) ✅

- [x] Core product for The Studio Reno
- [x] Database schema (multi-tenant ready)
- [x] Theme customization system
- [x] Payment processing
- [x] Production deployment

**Status**: Complete, in production

---

### Phase 1: Multi-Tenant Core (April 2026)

**Duration**: 3 weeks

**Tasks**:
- [ ] Add `studio_id` to all tables (1 week)
- [ ] Update all queries for data isolation (1 week)
- [ ] Tenant detection middleware (3 days)
- [ ] Testing with 2 test studios (2 days)

**Deliverable**: Single codebase serving multiple isolated studios

---

### Phase 2: Onboarding & Billing (May 2026)

**Duration**: 3 weeks

**Tasks**:
- [ ] Studio signup flow (1 week)
- [ ] Stripe Billing integration (1 week)
- [ ] Setup wizard (3 days)
- [ ] Billing dashboard (3 days)
- [ ] Limit enforcement (1 day)

**Deliverable**: Self-service signup with subscription payment

---

### Phase 3: Polish & Launch (June 2026)

**Duration**: 2 weeks

**Tasks**:
- [ ] Mobile-responsive design (1 week)
- [ ] Documentation for studio owners (2 days)
- [ ] Marketing site (3 days)
- [ ] Beta testing with 5 studios (ongoing)

**Deliverable**: Public launch-ready platform

---

## Success Metrics

### Technical Metrics

- **Uptime**: 99.5%+ (max 3.6 hours downtime/month)
- **Response Time**: <500ms average API response
- **Page Load**: <2s average page load time
- **Error Rate**: <0.1% of requests

### Business Metrics

- **Studios**: 100 by June 2026
- **MRR**: $10,000 by June 2026
- **Churn**: <5% monthly
- **NPS**: 50+ (promoter score)

### User Metrics

- **Active Members**: 10,000+ across all studios
- **Weekly Logins**: 60%+ of members
- **Bookings**: 500+ classes booked per day
- **Support Tickets**: <10 per week, <24hr response

---

## Risks & Mitigation

### Technical Risks

**Risk**: Data leakage between studios
**Impact**: 🔴 Critical - Legal liability, trust loss
**Mitigation**:
- Comprehensive testing with 2+ test studios
- Automated tests for every query
- Security audit before launch
- Row-level security policies (PostgreSQL)

**Risk**: Performance degradation at scale
**Impact**: 🟡 High - Poor UX, churn
**Mitigation**:
- Database indexing strategy
- Query optimization (EXPLAIN ANALYZE)
- Caching layer (Redis)
- CDN for static assets
- Load testing before launch

---

### Business Risks

**Risk**: Low adoption (no studios sign up)
**Impact**: 🔴 Critical - Business failure
**Mitigation**:
- Validate with 5 pilot studios first
- Solve real pain points (easier than competitors)
- Competitive pricing
- Superior onboarding experience

**Risk**: High churn (studios cancel)
**Impact**: 🟡 High - Revenue loss
**Mitigation**:
- In-app support chat
- Regular feature updates
- Customer success program
- Lock-in features (data export hard)

---

## Competitive Analysis

### Competitors

| Competitor | Pricing | Strengths | Weaknesses |
|------------|---------|-----------|------------|
| MindBody | $129-$399/mo | Established, feature-rich | Expensive, complex, slow |
| Zen Planner | $117-$297/mo | Good UX | Limited customization |
| Glofox | $99-$279/mo | Mobile app included | Costly add-ons |
| Pike13 | $129-$329/mo | Strong scheduling | Dated UI |

### Our Differentiators

1. **Modern Stack** - Fast, responsive, mobile-first
2. **AI-Optimized** - LLM-friendly codebase, rapid feature development
3. **Transparent Pricing** - No hidden fees, no per-member charges
4. **Easy Migration** - Free data migration from competitors
5. **Open API** - Integrate with anything (Enterprise tier)
6. **White-Label** - Fully customizable branding
7. **Co-op Marketplace** - Built-in teacher/space rental features (unique)

---

## Conclusion

**The path from Q1 to Q2 is clear**:
1. Perfect single-tenant experience (Q1)
2. Add multi-tenant isolation (Phase 1)
3. Build onboarding and billing (Phase 2)
4. Launch to public (Phase 3)

**The opportunity is massive**:
- 40,000+ yoga/pilates studios in US alone
- Average studio pays $150-300/mo for software
- Total addressable market: $72M-$144M annually (US only)

**We're positioned to win**:
- Modern tech stack (competitors use legacy)
- AI-assisted development (10x faster iteration)
- Better UX (designed for 2026, not 2016)
- Lower price point
- Unique features (co-op marketplace)

**Let's build the future of studio management software** 🚀

---

**Document Version**: 1.0
**Last Updated**: 2026-01-17
**Next Review**: Q1 retrospective (March 31, 2026)
