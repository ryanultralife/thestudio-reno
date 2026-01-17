# Database Schema Documentation

**The Studio Reno - Complete Database Reference**

> **For AI Assistants**: This document provides explicit table definitions, relationships, and common query patterns. Use this as your primary reference when modifying database-related code.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Tables](#core-tables)
3. [Class Management](#class-management)
4. [Membership & Billing](#membership--billing)
5. [Retail & Inventory](#retail--inventory)
6. [Content Management](#content-management)
7. [Campaigns & Notifications](#campaigns--notifications)
8. [Multi-Tenant (SaaS)](#multi-tenant-saas)
9. [Relationships Diagram](#relationships-diagram)
10. [Common Query Patterns](#common-query-patterns)

---

## Overview

**Database**: PostgreSQL 14+
**Total Tables**: 50+
**Total Schema Lines**: 6,855
**Migrations**: 11 files (ordered execution)

### Migration Order

```
1. schema.sql                          # Core tables (30+)
2. seed.sql                           # Sample data
3. retail-schema.sql                  # Products, inventory
4. rentals-schema.sql                 # Space rental system
5. cms-schema.sql                     # Website content
6. campaigns-schema.sql               # Email/SMS automation
7. theme-customization-schema.sql     # Multi-tenant theming
8. add-communication-preferences.sql  # User opt-in/out
9. update-campaign-opt-in-logic.sql   # Campaign rules
10. mindbody-migration-schema.sql     # Legacy import
11. fix-webhook-replay-vulnerability.sql  # Security patch
```

---

## Core Tables

### `users`

**Purpose**: User accounts (students, teachers, staff, admins)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'student',  -- student, teacher, front_desk, manager, owner, admin
  is_active BOOLEAN DEFAULT true,
  date_of_birth DATE,
  avatar_url TEXT,
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),

  -- Communication preferences
  email_opt_in BOOLEAN DEFAULT true,
  sms_opt_in BOOLEAN DEFAULT false,
  notifications_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**Roles**:
- `student` - Can book classes, view own data
- `teacher` - Can teach classes, view attendance
- `front_desk` - Check-in, sell memberships
- `manager` - View reports, manage schedule
- `owner` - Full business access
- `admin` - System administration

**Common Queries**:
```sql
-- Find user by email
SELECT * FROM users WHERE email = $1;

-- Active teachers
SELECT u.* FROM users u
WHERE u.role = 'teacher' AND u.is_active = true;

-- Users with expiring memberships (30 days)
SELECT u.*, um.end_date
FROM users u
JOIN user_memberships um ON u.id = um.user_id
WHERE um.status = 'active'
  AND um.end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days';
```

---

### `permissions`

**Purpose**: Granular permission definitions for RBAC

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'booking.create_self'
  description TEXT
);
```

**Permission Naming Convention**: `<resource>.<action>[_scope]`

**Examples**:
- `booking.create_self` - Book own classes
- `booking.create_others` - Book for other users
- `booking.view_all` - View all bookings
- `user.edit_all` - Edit any user profile
- `financial.view_revenue` - View financial reports

**All Permissions** (50+ total):
```
booking.create_self, booking.create_others, booking.view_own, booking.view_all
booking.cancel_self, booking.cancel_others, booking.checkin

class.create, class.edit, class.delete, class.view_all

user.create, user.edit_self, user.edit_all, user.view_all, user.delete

membership.purchase_self, membership.purchase_others, membership.view_own, membership.view_all

teacher.create, teacher.edit, teacher.view_all, teacher.view_pay

financial.view_revenue, financial.view_transactions, financial.process_refunds

admin.manage_settings, admin.manage_permissions, admin.view_logs
```

---

### `role_permissions`

**Purpose**: Maps roles to default permissions

```sql
CREATE TABLE role_permissions (
  role VARCHAR(20) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role, permission_id)
);
```

**Permission Inheritance**:
```
student < teacher < front_desk < manager < owner < admin
  (each level inherits all permissions from levels below)
```

---

### `user_permissions`

**Purpose**: User-level permission overrides (grant or deny)

```sql
CREATE TABLE user_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,  -- true = grant, false = deny
  PRIMARY KEY (user_id, permission_id)
);
```

**Use Cases**:
- Grant `teacher.view_pay` to a specific teacher (but not all teachers)
- Deny `user.delete` to a manager (override role default)

---

### `locations`

**Purpose**: Studio locations (physical addresses)

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  slug VARCHAR(100) UNIQUE,  -- For CMS (e.g., 'main-studio')
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seeded Locations**:
1. **Main Studio** - 105 Vassar St, Reno NV 89502
2. **Moran Location** - 2075 Moran St, Reno NV 89512

---

## Class Management

### `class_types`

**Purpose**: Yoga class style definitions

```sql
CREATE TABLE class_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  default_capacity INTEGER DEFAULT 20,
  color VARCHAR(20),  -- Hex code for calendar display
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seeded Class Types** (10 styles):
```
Vinyasa Flow, Hatha Yoga, Yin Yoga, Power Yoga,
Restorative Yoga, Yoga Sculpt, Prenatal Yoga,
Gentle Yoga, Hot Yoga, Meditation
```

---

### `teachers`

**Purpose**: Teacher profiles and certifications

```sql
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  certifications TEXT[],
  specialties TEXT[],
  photo_url TEXT,
  hourly_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teachers_user_id ON teachers(user_id);
```

**Note**: Teachers must also have `role = 'teacher'` in the `users` table.

---

### `teacher_pay_rates`

**Purpose**: Custom pay rates per location/class type

```sql
CREATE TABLE teacher_pay_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  class_type_id UUID REFERENCES class_types(id),
  rate_type VARCHAR(20) NOT NULL,  -- 'hourly', 'per_class', 'per_student'
  rate DECIMAL(10,2) NOT NULL,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rate Priority** (most specific wins):
1. Location + Class Type specific
2. Location specific
3. Class Type specific
4. Default (from `teachers.hourly_rate`)

---

### `class_schedule_templates`

**Purpose**: Recurring weekly schedule patterns

```sql
CREATE TABLE class_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id UUID NOT NULL REFERENCES class_types(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  day_of_week INTEGER NOT NULL,  -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  capacity INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_day ON class_schedule_templates(day_of_week);
```

**Use Case**: Auto-generate weekly classes based on templates.

---

### `classes`

**Purpose**: Individual class instances (scheduled classes)

```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id UUID NOT NULL REFERENCES class_types(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  substitute_teacher_id UUID REFERENCES teachers(id),
  template_id UUID REFERENCES class_schedule_templates(id),

  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER DEFAULT 20,

  status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, completed, cancelled
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classes_date ON classes(date);
CREATE INDEX idx_classes_location ON classes(location_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_date_location ON classes(date, location_id);
```

**Composite Query Optimization**: Index on `(date, location_id)` for common schedule view.

---

### `bookings`

**Purpose**: User enrollments in classes

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  membership_id UUID REFERENCES user_memberships(id),

  status VARCHAR(20) DEFAULT 'booked',  -- booked, checked_in, cancelled, no_show
  checked_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  booked_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, class_id)  -- One booking per user per class
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_class ON bookings(class_id);
CREATE INDEX idx_bookings_status ON bookings(status);
```

**Status Flow**:
```
booked → checked_in  (user attended)
booked → cancelled   (user cancelled)
booked → no_show     (didn't attend, didn't cancel)
```

---

## Membership & Billing

### `membership_types`

**Purpose**: Membership tier definitions

```sql
CREATE TABLE membership_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER,  -- NULL for unlimited recurring
  credits INTEGER,        -- NULL for unlimited classes
  auto_renew BOOLEAN DEFAULT false,
  is_intro_offer BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seeded Tiers** (7 options):

| Name | Price | Duration | Credits | Auto-Renew | Intro |
|------|-------|----------|---------|------------|-------|
| Intro Month | $40 | 30 days | Unlimited | No | Yes |
| Monthly Unlimited | $99 | 30 days | Unlimited | Yes | No |
| 10-Class Pack | $180 | 365 days | 10 | No | No |
| 20-Class Pack | $320 | 365 days | 20 | No | No |
| 5-Class Pack | $95 | 90 days | 5 | No | No |
| Single Class | $22 | 1 day | 1 | No | No |
| Student Monthly | $79 | 30 days | Unlimited | Yes | No |

---

### `user_memberships`

**Purpose**: Active user memberships

```sql
CREATE TABLE user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  membership_type_id UUID NOT NULL REFERENCES membership_types(id),

  status VARCHAR(20) DEFAULT 'active',  -- active, expired, cancelled, paused, pending

  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,  -- NULL for unlimited recurring

  credits_total INTEGER,      -- Total credits from membership
  credits_remaining INTEGER,  -- Current available credits

  stripe_subscription_id VARCHAR(100) UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memberships_user ON user_memberships(user_id);
CREATE INDEX idx_memberships_status ON user_memberships(status);
CREATE INDEX idx_memberships_end_date ON user_memberships(end_date);
```

**Credits Logic**:
- If `credits_total = NULL` → Unlimited classes (Monthly Unlimited, Student Monthly)
- Otherwise → Track `credits_remaining`, deduct 1 per booking

**Auto-Expiration**: CRON job can mark `status = 'expired'` when `end_date < NOW()`.

---

### `transactions`

**Purpose**: Financial transaction log

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- membership, retail, event, rental, refund
  description TEXT,
  payment_method VARCHAR(50),  -- stripe, cash, check, comp
  stripe_payment_intent_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'completed',  -- pending, completed, failed, refunded
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_type ON transactions(type);
```

**Audit Trail**: Every purchase creates a transaction record.

---

## Retail & Inventory

### `products`

**Purpose**: Product catalog (merchandise, equipment, services)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100) UNIQUE,

  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  wholesale_price DECIMAL(10,2),
  cost DECIMAL(10,2),

  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,

  -- Organization
  category_id UUID REFERENCES product_categories(id),
  supplier_id UUID REFERENCES suppliers(id),

  -- Type
  product_type VARCHAR(20) DEFAULT 'physical',  -- physical, digital, service, subscription

  -- Variants
  has_variants BOOLEAN DEFAULT false,

  -- Visibility
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Metadata
  tags TEXT[],
  image_urls TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_is_active ON products(is_active);
```

---

### `product_variants`

**Purpose**: Product variations (size, color, etc.)

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,  -- e.g., "Small - Blue"
  sku VARCHAR(100) UNIQUE,
  price DECIMAL(10,2),  -- Override product price if set
  quantity_on_hand INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
```

**Example**:
```
Product: Yoga Mat
├── Variant: Standard - Purple ($45)
├── Variant: Standard - Teal ($45)
├── Variant: Thick - Purple ($65)
└── Variant: Thick - Teal ($65)
```

---

### `inventory_transactions`

**Purpose**: Inventory movement audit trail

```sql
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),

  type VARCHAR(20) NOT NULL,  -- purchase, sale, adjustment, return, damage
  quantity INTEGER NOT NULL,  -- Negative for decreases

  reference_type VARCHAR(50),  -- e.g., 'retail_order', 'purchase_order'
  reference_id UUID,

  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_created_at ON inventory_transactions(created_at);
```

**Quantity Calculation**:
```sql
SELECT SUM(quantity) FROM inventory_transactions WHERE product_id = $1;
```

---

### `discounts`

**Purpose**: Promotional discount codes

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,

  type VARCHAR(20) NOT NULL,  -- percentage, fixed_amount, free_shipping
  value DECIMAL(10,2) NOT NULL,  -- 15 (for 15% or $15 off)

  scope VARCHAR(20) DEFAULT 'all',  -- all, products, memberships, categories
  scope_ids UUID[],  -- Specific product/category IDs if scoped

  min_purchase DECIMAL(10,2),
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,

  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discounts_code ON discounts(code);
CREATE INDEX idx_discounts_dates ON discounts(start_date, end_date);
```

**Validation Logic**:
```javascript
// Check valid, active, within date range, not maxed out
const valid = discount.is_active
  && discount.uses_count < discount.max_uses
  && now >= discount.start_date
  && now <= discount.end_date;
```

---

## Content Management

### `site_settings`

**Purpose**: Global website configuration (key-value store)

```sql
CREATE TABLE site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  type VARCHAR(20) DEFAULT 'string',  -- string, number, boolean, json
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Common Settings**:
```
studio_name, tagline, phone, email, address,
facebook_url, instagram_url, twitter_url,
booking_cancellation_hours, class_reminder_hours,
enable_retail, enable_rentals, enable_blog
```

---

### `content_blocks`

**Purpose**: Website page sections (editable content)

```sql
CREATE TABLE content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page VARCHAR(50) NOT NULL,  -- home, about, pricing, contact, etc.
  section VARCHAR(100) NOT NULL,  -- hero, features, testimonials, etc.
  content JSONB,  -- Flexible structure per section type
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_page ON content_blocks(page);
```

**Example Content Block**:
```json
{
  "page": "home",
  "section": "hero",
  "content": {
    "heading": "Find Your Balance",
    "subheading": "Reno's premier yoga studio",
    "cta_text": "Start Your Journey",
    "background_image": "https://..."
  }
}
```

---

### `blog_posts`

**Purpose**: Blog articles

```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  author_id UUID REFERENCES users(id),
  featured_image_url TEXT,
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'draft',  -- draft, published, archived
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_slug ON blog_posts(slug);
CREATE INDEX idx_posts_status ON blog_posts(status);
CREATE INDEX idx_posts_published ON blog_posts(published_at);
```

---

## Campaigns & Notifications

### `notification_campaigns`

**Purpose**: Automated email/SMS campaigns with triggers

```sql
CREATE TABLE notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Trigger configuration
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
    'membership_expiring', 'membership_expired', 'inactive_member',
    'declining_attendance', 'new_member_welcome', 'attendance_milestone',
    'no_upcoming_bookings', 'low_credits', 'birthday', 'anniversary',
    'class_reminder', 'review_request', 'waitlist_opening', 'custom'
  )),
  trigger_config JSONB,  -- Trigger-specific params (e.g., {"days_before": 7})

  -- Targeting
  target_query TEXT,  -- Custom SQL for 'custom' trigger type

  -- Message
  channel VARCHAR(10) DEFAULT 'email',  -- email, sms, both
  subject VARCHAR(255),  -- Email subject line
  message_template TEXT NOT NULL,  -- Template with {{placeholders}}

  -- Scheduling
  frequency VARCHAR(20) DEFAULT 'daily',  -- hourly, daily, weekly
  run_time TIME DEFAULT '09:00',
  max_sends_per_run INTEGER DEFAULT 100,

  -- Throttling
  cooldown_hours INTEGER DEFAULT 24,  -- Don't resend to same user within X hours

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_trigger ON notification_campaigns(trigger_type);
CREATE INDEX idx_campaigns_next_run ON notification_campaigns(next_run_at);
```

**Trigger Config Examples**:

```json
// membership_expiring
{"days_before": 7}

// inactive_member
{"days_inactive": 30}

// declining_attendance
{"comparison_days": 90, "decline_percentage": 25}

// attendance_milestone
{"class_count": 50}

// low_credits
{"credits_threshold": 3}
```

**Message Template Placeholders**:
```
{{first_name}}, {{last_name}}, {{email}},
{{membership_name}}, {{credits_remaining}}, {{end_date}},
{{class_count}}, {{days_inactive}}, etc.
```

---

### `notification_campaign_logs`

**Purpose**: Track campaign sends and engagement

```sql
CREATE TABLE notification_campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  channel VARCHAR(10) NOT NULL,  -- email, sms
  status VARCHAR(20) DEFAULT 'sent',  -- sent, delivered, opened, clicked, failed

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  error_message TEXT
);

CREATE INDEX idx_campaign_logs_campaign ON notification_campaign_logs(campaign_id);
CREATE INDEX idx_campaign_logs_user ON notification_campaign_logs(user_id);
CREATE INDEX idx_campaign_logs_sent_at ON notification_campaign_logs(sent_at);
```

**Engagement Metrics**:
```sql
SELECT
  COUNT(*) as total_sent,
  COUNT(delivered_at) as delivered,
  COUNT(opened_at) as opened,
  COUNT(clicked_at) as clicked,
  ROUND(COUNT(opened_at)::DECIMAL / COUNT(*) * 100, 2) as open_rate
FROM notification_campaign_logs
WHERE campaign_id = $1;
```

---

## Multi-Tenant (SaaS)

### `studios`

**Purpose**: Tenant isolation for multi-studio SaaS

```sql
CREATE TABLE studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,  -- subdomain: {slug}.app.com
  name VARCHAR(100) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),

  -- Subscription
  subscription_tier VARCHAR(20) DEFAULT 'starter',  -- starter, professional, enterprise
  subscription_status VARCHAR(20) DEFAULT 'trial',  -- trial, active, past_due, cancelled
  trial_ends_at TIMESTAMPTZ,

  -- Branding
  custom_domain VARCHAR(100) UNIQUE,
  logo_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studios_slug ON studios(slug);
CREATE INDEX idx_studios_custom_domain ON studios(custom_domain);
CREATE INDEX idx_studios_owner ON studios(owner_id);
```

**Multi-Tenant Migration Path**:
```sql
-- Step 1: Add studio_id to all main tables
ALTER TABLE users ADD COLUMN studio_id UUID REFERENCES studios(id);
ALTER TABLE classes ADD COLUMN studio_id UUID REFERENCES studios(id);
ALTER TABLE products ADD COLUMN studio_id UUID REFERENCES studios(id);
-- ... repeat for all tables

-- Step 2: Create indexes
CREATE INDEX idx_users_studio ON users(studio_id);
CREATE INDEX idx_classes_studio ON classes(studio_id);
-- ... repeat

-- Step 3: Middleware to extract studio from request
-- req.studio_id = getStudioFromSubdomain(req.hostname);

-- Step 4: Filter all queries
-- WHERE studio_id = req.studio_id
```

---

### `theme_settings`

**Purpose**: Per-studio white-label branding

```sql
CREATE TABLE theme_settings (
  studio_id UUID PRIMARY KEY REFERENCES studios(id) ON DELETE CASCADE,

  -- Branding
  studio_name VARCHAR(100),
  logo_url TEXT,
  favicon_url TEXT,

  -- Colors (CSS hex codes)
  primary_color VARCHAR(7) DEFAULT '#d97706',    -- Amber-600
  primary_hover VARCHAR(7) DEFAULT '#b45309',
  secondary_color VARCHAR(7) DEFAULT '#1f2937',  -- Gray-800
  accent_color VARCHAR(7) DEFAULT '#f59e0b',     -- Amber-500

  text_primary VARCHAR(7) DEFAULT '#111827',     -- Gray-900
  text_secondary VARCHAR(7) DEFAULT '#6b7280',   -- Gray-500

  bg_primary VARCHAR(7) DEFAULT '#ffffff',
  bg_secondary VARCHAR(7) DEFAULT '#f9fafb',     -- Gray-50
  bg_accent VARCHAR(7) DEFAULT '#fef3c7',        -- Amber-100

  -- Typography (Google Fonts)
  font_heading VARCHAR(100) DEFAULT 'Montserrat',
  font_body VARCHAR(100) DEFAULT 'Open Sans',

  -- Layout
  layout_style VARCHAR(20) DEFAULT 'modern',  -- modern, classic, minimal, bold
  border_radius VARCHAR(10) DEFAULT '0.5rem',

  -- Features (subscription-based toggles)
  show_retail_shop BOOLEAN DEFAULT true,
  show_teacher_rentals BOOLEAN DEFAULT true,
  show_tea_lounge BOOLEAN DEFAULT false,
  enable_dark_mode BOOLEAN DEFAULT false,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**CSS Generation Function**:
```sql
CREATE OR REPLACE FUNCTION generate_theme_css(studio_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  theme theme_settings%ROWTYPE;
  css TEXT;
BEGIN
  SELECT * INTO theme FROM theme_settings WHERE studio_id = studio_uuid;

  css := ':root {
    --color-primary: ' || theme.primary_color || ';
    --color-primary-hover: ' || theme.primary_hover || ';
    --font-heading: "' || theme.font_heading || '", sans-serif;
    ...
  }';

  RETURN css;
END;
$$ LANGUAGE plpgsql;
```

---

## Relationships Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      CORE USER SYSTEM                        │
└──────────────────────────────────────────────────────────────┘

users (id, email, role, ...)
  │
  ├──→ teachers (user_id, bio, certifications)
  │     └──→ teacher_pay_rates (teacher_id, rate_type, rate)
  │
  ├──→ user_memberships (user_id, membership_type_id, credits)
  │     └──→ membership_types (id, name, price, credits)
  │
  ├──→ bookings (user_id, class_id, status)
  │     └──→ classes (id, class_type_id, teacher_id, date)
  │           ├──→ class_types (id, name, duration)
  │           ├──→ locations (id, name, address)
  │           └──→ teachers (as teacher/substitute)
  │
  ├──→ transactions (user_id, amount, type)
  │
  ├──→ user_permissions (user_id, permission_id, granted)
  │     └──→ permissions (id, name)
  │
  └──→ role_permissions (role, permission_id)
        └──→ permissions (id, name)

┌──────────────────────────────────────────────────────────────┐
│                     RETAIL & INVENTORY                       │
└──────────────────────────────────────────────────────────────┘

products (id, name, price, category_id)
  ├──→ product_categories (id, name, parent_id)  [hierarchical]
  ├──→ product_variants (product_id, name, sku, price)
  ├──→ inventory_transactions (product_id, quantity, type)
  └──→ retail_order_items (product_id, variant_id, order_id)
        └──→ retail_orders (id, user_id, total, status)
              └──→ users (id)

┌──────────────────────────────────────────────────────────────┐
│                   CAMPAIGNS & NOTIFICATIONS                  │
└──────────────────────────────────────────────────────────────┘

notification_campaigns (id, trigger_type, message_template)
  └──→ notification_campaign_logs (campaign_id, user_id, status)
        └──→ users (id)

┌──────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT (Q2)                         │
└──────────────────────────────────────────────────────────────┘

studios (id, slug, owner_id, subscription_tier)
  ├──→ users (owner_id)  [studio owner]
  ├──→ theme_settings (studio_id, colors, fonts, features)
  │
  └──→ [FUTURE] All tables will have studio_id FK:
        ├──→ users (studio_id)
        ├──→ classes (studio_id)
        ├──→ products (studio_id)
        └──→ ... (all tenant-scoped data)
```

---

## Common Query Patterns

### 1. Get User with Active Membership

```sql
SELECT
  u.*,
  um.id as membership_id,
  mt.name as membership_name,
  um.credits_remaining,
  um.end_date
FROM users u
LEFT JOIN user_memberships um ON u.id = um.user_id AND um.status = 'active'
LEFT JOIN membership_types mt ON um.membership_type_id = mt.id
WHERE u.id = $1;
```

---

### 2. Get Schedule with Availability

```sql
SELECT
  c.id, c.date, c.start_time, c.end_time,
  ct.name as class_name, ct.color,
  l.name as location,
  CONCAT(t.first_name, ' ', t.last_name) as teacher,
  c.capacity,
  COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked_count,
  c.capacity - COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as spots_left
FROM classes c
JOIN class_types ct ON c.class_type_id = ct.id
JOIN locations l ON c.location_id = l.id
JOIN teachers t_record ON c.teacher_id = t_record.id
JOIN users t ON t_record.user_id = t.id
LEFT JOIN bookings b ON c.id = b.class_id
WHERE c.date BETWEEN $1 AND $2
  AND c.status = 'scheduled'
GROUP BY c.id, ct.id, l.id, t.id
ORDER BY c.date, c.start_time;
```

---

### 3. Check User Permissions

```sql
WITH user_perms AS (
  -- Direct user permissions (grant or deny)
  SELECT permission_id, granted
  FROM user_permissions
  WHERE user_id = $1
),
role_perms AS (
  -- Role-based permissions
  SELECT rp.permission_id, true as granted
  FROM users u
  JOIN role_permissions rp ON u.role = rp.role
  WHERE u.id = $1
)
SELECT p.name
FROM permissions p
WHERE p.id IN (
  -- User grants override role grants
  SELECT permission_id FROM user_perms WHERE granted = true
  UNION
  -- Role permissions (if no user-level deny)
  SELECT permission_id FROM role_perms
  WHERE permission_id NOT IN (SELECT permission_id FROM user_perms WHERE granted = false)
);
```

---

### 4. Get Campaign Targets (Membership Expiring)

```sql
SELECT DISTINCT
  u.id, u.email, u.first_name, u.last_name,
  um.id as membership_id,
  mt.name as membership_name,
  um.end_date
FROM users u
JOIN user_memberships um ON u.id = um.user_id
JOIN membership_types mt ON um.membership_type_id = mt.id
WHERE um.status = 'active'
  AND um.end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
  AND u.email_opt_in = true
  AND u.notifications_enabled = true
  -- Cooldown check
  AND NOT EXISTS (
    SELECT 1 FROM notification_campaign_logs ncl
    WHERE ncl.user_id = u.id
      AND ncl.campaign_id = $1
      AND ncl.sent_at > NOW() - INTERVAL '24 hours'
  );
```

---

### 5. Revenue Report by Period

```sql
SELECT
  DATE_TRUNC('day', created_at) as date,
  type,
  COUNT(*) as transaction_count,
  SUM(amount) as total_revenue
FROM transactions
WHERE status = 'completed'
  AND created_at BETWEEN $1 AND $2
GROUP BY DATE_TRUNC('day', created_at), type
ORDER BY date DESC, type;
```

---

### 6. Member Lifecycle Stats

```sql
WITH cohort AS (
  SELECT DATE_TRUNC('month', created_at) as month
  FROM users
  WHERE role = 'student'
)
SELECT
  month,
  COUNT(DISTINCT u.id) as new_members,
  COUNT(DISTINCT um.user_id) FILTER (WHERE um.status = 'active') as active_members,
  COUNT(DISTINCT b.user_id) as members_with_bookings
FROM cohort c
LEFT JOIN users u ON DATE_TRUNC('month', u.created_at) = c.month
LEFT JOIN user_memberships um ON u.id = um.user_id
LEFT JOIN bookings b ON u.id = b.user_id AND b.booked_at >= c.month
GROUP BY month
ORDER BY month DESC;
```

---

### 7. Inventory Status

```sql
SELECT
  p.id, p.name, p.sku,
  p.quantity_on_hand,
  p.quantity_reserved,
  p.quantity_on_hand - p.quantity_reserved as available,
  p.low_stock_threshold,
  CASE
    WHEN p.quantity_on_hand - p.quantity_reserved <= 0 THEN 'Out of Stock'
    WHEN p.quantity_on_hand - p.quantity_reserved <= p.low_stock_threshold THEN 'Low Stock'
    ELSE 'In Stock'
  END as stock_status
FROM products p
WHERE p.track_inventory = true
ORDER BY stock_status, p.name;
```

---

## AI Development Notes

**When Modifying Tables**:
1. Always use migrations (ALTER TABLE) instead of DROP/CREATE
2. Add indexes for frequently queried foreign keys
3. Use CHECK constraints for enum-like fields
4. Default values prevent NULL issues

**Query Optimization Tips**:
- Use FILTER clauses in COUNT() for conditional aggregation
- Use LEFT JOIN for optional relationships, INNER JOIN for required
- Index composite columns used together in WHERE clauses
- Use EXPLAIN ANALYZE to check query plans

**Transaction Guidelines**:
- Use transactions for multi-step operations (booking with credit deduction)
- Use row-level locking (FOR UPDATE) to prevent race conditions
- Keep transactions short (hold locks briefly)
- Always release connections (finally block)

**Naming Conventions**:
- Tables: plural nouns (users, classes, bookings)
- Columns: snake_case (first_name, created_at)
- Indexes: idx_{table}_{column(s)} (idx_users_email)
- Foreign keys: {referenced_table}_id (user_id, class_id)
- Timestamps: created_at, updated_at (TIMESTAMPTZ)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-17
**Schema Lines**: 6,855
**Tables**: 50+
