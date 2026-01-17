# System Architecture Documentation

**The Studio Reno - Complete Technical Architecture**

> **For AI Assistants**: This document provides the complete system architecture, technology decisions, and design patterns. Use this to understand the "why" behind architectural choices.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Architecture](#database-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Security Architecture](#security-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Scaling Strategy](#scaling-strategy)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Web Browser (Desktop/Mobile)                                    │
│  ├─ Staff Portal    (React SPA - /staff)                        │
│  ├─ Public Website  (React SPA - /)                             │
│  └─ CMS Editor      (React Component - /staff/website)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                         EDGE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Railway Load Balancer                                           │
│  ├─ SSL Termination                                              │
│  ├─ DDoS Protection                                              │
│  └─ Health Checks                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  Express.js Server (Node.js 18+)                                 │
│  ├─ Middleware Stack                                             │
│  │   ├─ Helmet (Security headers)                                │
│  │   ├─ Morgan (Request logging)                                 │
│  │   ├─ CORS (Cross-origin policy)                               │
│  │   ├─ Body Parser (JSON parsing)                               │
│  │   └─ Error Handler (Global errors)                            │
│  │                                                                │
│  ├─ Authentication Layer                                          │
│  │   ├─ JWT Verification                                          │
│  │   ├─ Permission Checking (RBAC)                                │
│  │   └─ Session Management                                        │
│  │                                                                │
│  ├─ API Routes (19 modules)                                       │
│  │   ├─ /api/auth          - Authentication                       │
│  │   ├─ /api/classes       - Schedule management                  │
│  │   ├─ /api/bookings      - Class enrollment                     │
│  │   ├─ /api/memberships   - Membership purchases                 │
│  │   ├─ /api/retail        - Product catalog                      │
│  │   ├─ /api/cms           - Content management                   │
│  │   ├─ /api/campaigns     - Email/SMS automation                 │
│  │   ├─ /api/reports       - Analytics                            │
│  │   └─ ... (11 more)                                             │
│  │                                                                │
│  └─ Background Services                                            │
│      ├─ Campaign Scheduler (CRON - hourly)                         │
│      ├─ Email Service (SendGrid)                                   │
│      └─ SMS Service (Twilio)                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL 14 (Railway Managed)                                 │
│  ├─ Connection Pool (max 20 connections)                         │
│  ├─ SSL Enabled                                                   │
│  ├─ 50+ Tables                                                    │
│  └─ Automated Backups                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│  ├─ Stripe (Payment Processing)                                  │
│  ├─ SendGrid (Email Delivery)                                    │
│  ├─ Twilio (SMS Delivery)                                        │
│  └─ Cloudinary (Image Hosting)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend

**Runtime**:
- **Node.js 18+** - JavaScript runtime
  - Why: Async I/O for high concurrency, large ecosystem
  - Version: Latest LTS for security and performance

**Framework**:
- **Express.js 4.18** - Web framework
  - Why: Minimal, flexible, industry standard
  - Alternatives considered: Fastify (too new), Koa (less ecosystem)

**Database**:
- **PostgreSQL 14+** - Relational database
  - Why: ACID compliance, complex queries, JSON support, free
  - Alternatives considered: MySQL (less features), MongoDB (not relational)

**ORM**:
- **None** - Direct SQL with `pg` library
  - Why: Full control, better performance, easier debugging
  - Trade-off: More boilerplate, no auto-migrations

**Authentication**:
- **JWT (jsonwebtoken)** - Stateless authentication
  - Why: Scalable, no session storage, works with mobile apps
  - Expiration: 7 days
  - Secret: 64+ character random string (env var)

**Password Hashing**:
- **bcryptjs** - Password hashing
  - Why: Industry standard, slow by design (resistant to brute force)
  - Rounds: 12 (balances security and performance)

**Validation**:
- **express-validator** - Input validation
  - Why: Declarative, integrates with Express, comprehensive

**Scheduling**:
- **node-cron** - Background jobs
  - Why: Simple, no external dependencies
  - Usage: Campaign execution (hourly)

### Frontend

**Framework**:
- **React 18.2** - UI library
  - Why: Component-based, large ecosystem, fast
  - Hooks for state management (no Redux needed yet)

**Build Tool**:
- **Vite 5.1** - Build tooling
  - Why: 10-100x faster than Webpack, modern, great DX
  - Hot Module Replacement (HMR) for instant updates

**Styling**:
- **TailwindCSS 3.4** - Utility-first CSS
  - Why: Fast prototyping, consistent design, small bundle size
  - No custom CSS files needed

**HTTP Client**:
- **fetch API** - Native browser API
  - Why: Built-in, no dependencies
  - Wrapper function for auth headers and error handling

**Icons**:
- **Lucide React** - Icon library
  - Why: Modern, tree-shakeable, consistent design

**State Management**:
- **React Hooks (useState, useEffect, useContext)** - Built-in
  - Why: Sufficient for current complexity, no extra library needed
  - Future: Consider Zustand if state complexity grows

**Routing**:
- **Client-side routing** - Manual state management
  - Why: Simple SPA with few routes, no need for React Router yet
  - Implementation: `currentPage` state + switch statement

### External Services

**Payment Processing**:
- **Stripe** - Payment gateway
  - Why: Best developer experience, transparent pricing, PCI compliant
  - Alternatives: PayPal (poor DX), Square (US-only)

**Email**:
- **SendGrid** - Transactional email
  - Why: Reliable, good deliverability, free tier (100 emails/day)
  - Alternatives: Mailgun, Amazon SES

**SMS**:
- **Twilio** - SMS delivery
  - Why: Industry standard, global coverage, reliable
  - Alternatives: Nexmo, Amazon SNS

**Image Hosting**:
- **Cloudinary** - Image CDN
  - Why: Automatic optimization, transformations, CDN
  - Alternatives: Amazon S3 + CloudFront (more setup)

---

## Database Architecture

### Schema Design Philosophy

**Principles**:
1. **Normalization**: 3NF (Third Normal Form) for data integrity
2. **Explicit over Implicit**: Clear column names, no abbreviations
3. **Timestamps**: Every table has `created_at`, many have `updated_at`
4. **UUIDs**: Primary keys are UUIDs (not auto-increment integers)
   - Why: Distributed systems friendly, no sequential exposure
5. **Soft Deletes**: Some tables use `is_active` instead of DELETE
6. **Audit Trail**: Critical tables log who/when (created_by, updated_by)

### Key Design Patterns

#### 1. Polymorphic Relationships (Avoided)

```sql
-- BAD (polymorphic - hard to enforce integrity)
CREATE TABLE notes (
  id UUID,
  notable_type VARCHAR(50),  -- 'user', 'class', 'product'
  notable_id UUID,           -- Foreign key to ANY table
  content TEXT
);

-- GOOD (explicit foreign keys)
CREATE TABLE user_notes (
  id UUID,
  user_id UUID REFERENCES users(id),  -- Enforced by database
  content TEXT
);
```

#### 2. Enumerated Values

```sql
-- CHECK constraints for valid values
CREATE TABLE users (
  role VARCHAR(20) DEFAULT 'student' CHECK (role IN (
    'student', 'teacher', 'front_desk', 'manager', 'owner', 'admin'
  ))
);

-- Alternative: Lookup table (for dynamic values)
CREATE TABLE class_types (id UUID, name VARCHAR);
CREATE TABLE classes (class_type_id UUID REFERENCES class_types(id));
```

#### 3. JSON Columns (Flexible Data)

```sql
-- For configuration that doesn't need to be queried
CREATE TABLE notification_campaigns (
  trigger_config JSONB  -- {"days_before": 7, "threshold": 5}
);

-- Use when:
-- - Structure varies by record
-- - No need to query/index individual fields
-- - Want schema flexibility
```

#### 4. Many-to-Many Relationships

```sql
-- JOIN table pattern
CREATE TABLE user_tags (
  user_id UUID REFERENCES users(id),
  tag_id UUID REFERENCES tags(id),
  PRIMARY KEY (user_id, tag_id)  -- Composite key prevents duplicates
);
```

### Indexing Strategy

**Rules**:
1. **Foreign Keys**: Always index (for JOINs)
2. **WHERE Clauses**: Index columns frequently filtered
3. **ORDER BY**: Index columns frequently sorted
4. **Composite Indexes**: For multi-column WHERE clauses (order matters)
5. **Unique Constraints**: Automatically create indexes

**Examples**:
```sql
-- Single column index
CREATE INDEX idx_users_email ON users(email);

-- Composite index (order matters)
CREATE INDEX idx_classes_date_location ON classes(date, location_id);
-- Good for: WHERE date = X AND location_id = Y
-- Good for: WHERE date = X (uses prefix)
-- Bad for: WHERE location_id = Y (wrong order)

-- Conditional index (partial)
CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;
-- Smaller index, faster queries for active users only
```

### Query Optimization

**EXPLAIN ANALYZE** is your friend:
```sql
EXPLAIN ANALYZE
SELECT c.*, COUNT(b.id) as booking_count
FROM classes c
LEFT JOIN bookings b ON c.id = b.class_id
WHERE c.date >= CURRENT_DATE
GROUP BY c.id;
```

**Optimization Techniques**:
1. **Use FILTER instead of WHERE in aggregate functions**:
```sql
-- GOOD (single table scan)
SELECT
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_count
FROM memberships;

-- BAD (two table scans)
SELECT
  (SELECT COUNT(*) FROM memberships WHERE status = 'active') as active_count,
  (SELECT COUNT(*) FROM memberships WHERE status = 'expired') as expired_count;
```

2. **Avoid N+1 Queries** (use JOINs):
```sql
-- BAD (N+1 queries)
SELECT * FROM classes;  -- 1 query
-- Then for each class:
SELECT * FROM bookings WHERE class_id = ?;  -- N queries

-- GOOD (single query)
SELECT c.*, b.*
FROM classes c
LEFT JOIN bookings b ON c.id = b.class_id;
```

3. **Use CTEs for readability** (Common Table Expressions):
```sql
WITH active_members AS (
  SELECT * FROM users WHERE role = 'student' AND is_active = true
),
recent_bookings AS (
  SELECT * FROM bookings WHERE booked_at > NOW() - INTERVAL '30 days'
)
SELECT am.*, COUNT(rb.id) as recent_booking_count
FROM active_members am
LEFT JOIN recent_bookings rb ON am.id = rb.user_id
GROUP BY am.id;
```

---

## Backend Architecture

### Request Lifecycle

```
1. Client Request
     ↓
2. Middleware Stack
     ├─ Helmet (security headers)
     ├─ Morgan (logging)
     ├─ CORS (origin check)
     ├─ Body Parser (parse JSON)
     └─ [Continue if all pass]
     ↓
3. Authentication Middleware (if required)
     ├─ Extract JWT from Authorization header
     ├─ Verify signature
     ├─ Load user from database
     ├─ Inject req.user = { id, email, role, ... }
     └─ [403 if fails, continue if passes]
     ↓
4. Permission Middleware (if required)
     ├─ Load user permissions (with cache)
     ├─ Check against required permissions
     └─ [403 if insufficient, continue if passes]
     ↓
5. Route Handler
     ├─ Validate input (express-validator)
     ├─ Business logic
     ├─ Database queries
     ├─ Format response
     └─ Return JSON
     ↓
6. Global Error Handler (if error thrown)
     ├─ Log error
     ├─ Format error response
     └─ Return 4xx/5xx with error message
```

### Middleware Architecture

**Core Middleware** (applied globally):
```javascript
// backend/src/index.js
app.use(helmet());              // Security headers (XSS, clickjacking, etc.)
app.use(morgan('combined'));    // Request logging
app.use(cors({ origin: CORS_ORIGIN }));  // CORS policy
app.use(express.json());        // Parse JSON body
app.use(express.static('frontend/dist'));  // Serve frontend
```

**Route-Specific Middleware**:
```javascript
router.get('/data',
  authenticate,                           // 1. Verify JWT
  requirePermission('data.view'),         // 2. Check permission
  async (req, res, next) => { /* ... */ } // 3. Handler
);
```

### Service Layer Pattern

**When to use**:
- Logic used by multiple routes
- Background/scheduled jobs
- Complex business logic (>50 lines)
- External API integrations

**Example**:
```javascript
// backend/src/services/notifications.js
async function sendEmail(to, subject, body) {
  if (process.env.SENDGRID_API_KEY) {
    await sendgrid.send({ to, subject, text: body });
  } else {
    console.log('[EMAIL]', to, subject, body);  // Fallback for dev
  }
}

module.exports = { sendEmail };

// Used in multiple routes
const notifications = require('../services/notifications');
await notifications.sendEmail(user.email, 'Welcome!', 'Thanks for joining...');
```

### Error Handling Strategy

**Centralized Error Handler**:
```javascript
// backend/src/index.js
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // PostgreSQL errors
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Invalid reference' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Default
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});
```

**Benefits**:
- Single place to handle all errors
- Consistent error format
- Avoid exposing sensitive details in production
- Easy to add monitoring (Sentry, LogRocket)

---

## Frontend Architecture

### Component Hierarchy

```
App.jsx (Root Component)
├─ LoginPage (unauthenticated state)
└─ Authenticated Layout
    ├─ Sidebar (navigation)
    │   ├─ Logo
    │   ├─ Navigation Items (filtered by role)
    │   └─ User Profile + Logout
    │
    └─ Main Content (current page)
        ├─ DashboardPage
        ├─ CheckInPage
        ├─ SchedulePage
        ├─ ClientsPage
        ├─ SellPage
        ├─ SubRequestsPage
        ├─ ReportsPage
        ├─ CMS (separate component tree)
        ├─ SettingsPage
        └─ MyAccountPage
```

### State Management Pattern

**Global State** (useContext):
```javascript
const AuthContext = createContext(null);

function App() {
  const [user, setUser] = useState(null);

  return (
    <AuthContext.Provider value={{ user, api }}>
      {/* Child components can access user and api */}
    </AuthContext.Provider>
  );
}

// Usage in child components
function SomeComponent() {
  const { user } = useContext(AuthContext);
  return <div>Hello {user.first_name}</div>;
}
```

**Local State** (useState):
```javascript
function SchedulePage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Each page manages its own state
}
```

**When to use what**:
- **Context**: Auth state, API utility function (shared across all components)
- **Local State**: Page-specific data, form inputs, UI state

### Data Fetching Pattern

```javascript
function MyPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const result = await api('/endpoint');
        setData(result.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []); // Empty array = run once on mount

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;

  return <div>{/* Render data */}</div>;
}
```

### API Utility Function

```javascript
// Centralized API client
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('staff_token');

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    },
  });

  // Auto-logout on 401
  if (res.status === 401) {
    localStorage.removeItem('staff_token');
    window.location.reload();
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
```

**Benefits**:
- Automatic auth header injection
- Automatic logout on 401
- Consistent error handling
- Single place to add interceptors, logging, etc.

---

## Security Architecture

### Authentication Flow

```
1. User submits login (email + password)
     ↓
2. Backend verifies password (bcrypt.compare)
     ↓
3. Backend generates JWT (7-day expiration)
     ├─ Payload: { userId, email, role }
     ├─ Signature: HMAC-SHA256 with JWT_SECRET
     └─ No sensitive data in JWT!
     ↓
4. Frontend stores JWT in localStorage
     ↓
5. Frontend sends JWT in Authorization header
     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ↓
6. Backend verifies JWT on every request
     ├─ Check signature (tampering detection)
     ├─ Check expiration
     └─ Load user from database (verify still active)
```

### Authorization (RBAC)

**Permission Check Flow**:
```
1. User makes request requiring permission
     ↓
2. Middleware extracts user from JWT
     ↓
3. Load permissions (with 5-minute cache)
     ├─ User-specific grants (user_permissions table)
     ├─ Role-based permissions (role_permissions table)
     └─ Merge: Grants win, Denies override
     ↓
4. Check if required permission in list
     ├─ If yes: Continue to handler
     └─ If no: Return 403 Forbidden
```

**Permission Caching**:
```javascript
const cache = new Map();  // In-memory cache
const TTL = 5 * 60 * 1000;  // 5 minutes

async function getUserPermissions(userId) {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.permissions;
  }

  const permissions = await db.query(/* ... */);
  cache.set(userId, { permissions, timestamp: Date.now() });
  return permissions;
}
```

### Input Validation

**Defense in Depth**:
```
1. Frontend validation (UX, quick feedback)
     ├─ Required fields
     ├─ Format checks (email, phone)
     └─ Length limits
     ↓
2. Backend validation (SECURITY - never trust client)
     ├─ express-validator rules
     ├─ Type coercion
     └─ Sanitization
     ↓
3. Database constraints (last line of defense)
     ├─ NOT NULL
     ├─ CHECK constraints
     ├─ UNIQUE constraints
     └─ Foreign key constraints
```

### SQL Injection Prevention

**Always use parameterized queries**:
```javascript
// SAFE (parameterized)
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [userInput]  // Library escapes this
);

// DANGEROUS (string concatenation)
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
// If userInput = "' OR '1'='1", entire table is returned!
```

### XSS Prevention

**React auto-escapes by default**:
```jsx
// SAFE (React escapes)
<div>{userInput}</div>

// DANGEROUS (dangerouslySetInnerHTML)
<div dangerouslySetInnerHTML={{ __html: userInput }} />
// Only use if you control the content!
```

**CSP Headers** (Helmet):
```javascript
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],  // Vite requires inline scripts
    styleSrc: ["'self'", "'unsafe-inline'"]
  }
}));
```

---

## Deployment Architecture

### Current Setup (Railway)

```
Railway Project
├─ PostgreSQL Service
│   ├─ Database: railway
│   ├─ SSL: Enabled
│   ├─ Backups: Automated
│   └─ Connection: Internal network + public URL
│
└─ Backend Service (Node.js)
    ├─ Build: npm run build
    ├─ Start: npm start
    ├─ Environment Variables
    │   ├─ DATABASE_URL (reference to PostgreSQL)
    │   ├─ JWT_SECRET
    │   ├─ STRIPE_SECRET_KEY
    │   └─ ... (9 total vars)
    │
    ├─ Health Check: /api/health
    ├─ Auto-deploy: On git push
    └─ Public URL: thestudio-reno-production.up.railway.app
```

### Environment Variables

**Development** (`.env.local`):
```bash
DATABASE_URL=postgresql://localhost/thestudio_dev
JWT_SECRET=dev_secret_change_in_production
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**Production** (Railway environment variables):
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Reference
JWT_SECRET=<64+ character random string>
NODE_ENV=production
CORS_ORIGIN=https://thestudio-reno-production.up.railway.app
DB_SSL_REJECT_UNAUTHORIZED=false
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Build Process

```bash
# Frontend build (Vite)
cd frontend
npm run build
# Outputs to: frontend/dist/

# Backend serves frontend
# backend/src/index.js
app.use(express.static('frontend/dist'));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
```

**Benefits**:
- Single deployment (frontend + backend together)
- No CORS issues (same origin)
- Simpler infrastructure
- Faster initial page load (no API roundtrip)

---

## Scaling Strategy

### Current Capacity (Single Instance)

- **Concurrent Users**: 100-500
- **Requests/Second**: 50-100
- **Database Connections**: 20 max
- **Memory**: 512MB
- **CPU**: 1 vCPU

### Scaling Plan (Q2 Multi-Tenant)

#### Vertical Scaling (Short Term)

**When**: 500-1,000 concurrent users

**Actions**:
1. Upgrade Railway plan (more CPU/memory)
2. Increase PostgreSQL connection pool to 50
3. Add Redis for caching (sessions, permissions)

**Cost**: $50-$100/month

---

#### Horizontal Scaling (Long Term)

**When**: 1,000+ concurrent users, 100+ studios

**Architecture**:
```
                  Load Balancer (Railway/Cloudflare)
                           |
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                 ↓
    App Instance 1   App Instance 2   App Instance 3
         |                 |                 |
         └─────────────────┼─────────────────┘
                           ↓
                   PostgreSQL Primary
                           |
              ┌────────────┴────────────┐
              ↓                         ↓
         Read Replica 1            Read Replica 2
```

**Changes Required**:
1. **Stateless App Servers** (already stateless - JWT, no sessions)
2. **Shared Cache Layer** - Redis for permissions, sessions
3. **Read Replicas** - Route read queries to replicas
4. **CDN** - Cloudflare for static assets
5. **Queue System** - Bull + Redis for background jobs

**Cost**: $500-$1,000/month (at 10,000+ users)

---

#### Database Scaling

**Query Optimization** (first priority):
1. Add indexes for slow queries (EXPLAIN ANALYZE)
2. Materialized views for complex reports
3. Denormalization for hot paths (cache user counts)

**Read Replicas** (for analytics):
- Primary: Write + critical reads
- Replica: Reports, dashboards, analytics
- Lag: <1 second (acceptable for non-critical data)

**Partitioning** (for massive data):
```sql
-- Partition bookings by month (if >10M records)
CREATE TABLE bookings_2026_01 PARTITION OF bookings
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Sharding** (last resort):
- Shard by studio_id (each studio on different database)
- Only if single database can't handle load (unlikely for years)

---

## Performance Targets

### Response Times

- **API Endpoints**: <200ms (p95)
- **Database Queries**: <50ms (p95)
- **Page Load**: <2s (p95)
- **Time to Interactive**: <3s (p95)

### Availability

- **Uptime**: 99.9% (8.76 hours downtime/year)
- **Planned Maintenance**: <1 hour/month
- **Recovery Time**: <15 minutes

### Monitoring

**Current**: Railway built-in metrics
**Q2**: Add Sentry (error tracking) + UptimeRobot (uptime monitoring)

---

## Technology Decision Rationale

### Why PostgreSQL over MySQL?

- **JSON support**: Native JSONB type for flexible data
- **Array types**: Store tags, certifications as arrays
- **Advanced features**: CTEs, window functions, full-text search
- **ACID compliance**: Stronger guarantees
- **Extensions**: PostGIS (future location features), pg_cron

### Why Express over Fastify?

- **Ecosystem**: More middleware, larger community
- **Stability**: Battle-tested for 10+ years
- **Documentation**: Extensive, well-written
- **Trade-off**: Fastify is faster, but Express is "fast enough"

### Why React over Vue/Svelte?

- **Ecosystem**: Largest component library (shadcn/ui, MUI, etc.)
- **Hiring**: Easier to find React developers
- **Longevity**: Backed by Meta, unlikely to disappear
- **Trade-off**: Vue is simpler, Svelte is faster, but React has momentum

### Why Vite over Webpack?

- **Speed**: 10-100x faster builds
- **Developer Experience**: Instant HMR, <1s startup
- **Future-proof**: ESM-native, modern approach
- **No trade-offs**: Webpack compatibility layer available

### Why TailwindCSS over styled-components?

- **Speed**: No runtime overhead (pure CSS)
- **Consistency**: Utility classes enforce design system
- **Bundle size**: Smaller than CSS-in-JS
- **Trade-off**: HTML looks verbose, but editor autocomplete helps

---

## Future Considerations

### Microservices (Not Yet)

**Current**: Monolithic backend (single Express app)
**Future**: Consider splitting if:
- Team grows to 10+ developers
- Different services need different scaling (e.g., campaign service needs more CPU)
- Independent deployment needed

**Candidates for microservices**:
- Campaign execution service
- Payment processing service
- Analytics service

### GraphQL (Not Yet)

**Current**: REST API
**Future**: Consider GraphQL if:
- Mobile app needs complex, nested data
- Frontend needs fine-grained data fetching
- Overfetching becomes a problem

**Trade-off**: More complexity, harder to cache

### TypeScript (Maybe Q2)

**Current**: JavaScript
**Future**: Consider TypeScript for:
- Better IDE autocomplete
- Catch errors at compile time
- Self-documenting code

**Trade-off**: Setup overhead, slower iteration

---

**Document Version**: 1.0
**Last Updated**: 2026-01-17
**Next Review**: After Q1 completion
