# AI-Assisted Development Guide

**The Studio Reno - Optimized for LLM Development**

> **Purpose**: This document is specifically designed for AI assistants (Claude, GPT, etc.) to efficiently understand, navigate, and modify this codebase. It provides explicit patterns, location maps, and decision trees for common tasks.

---

## Table of Contents

1. [Quick Start for AI](#quick-start-for-ai)
2. [File Location Map](#file-location-map)
3. [Common Tasks & Solutions](#common-tasks--solutions)
4. [Code Patterns Reference](#code-patterns-reference)
5. [Decision Trees](#decision-trees)
6. [Testing Checklist](#testing-checklist)
7. [Deployment Workflow](#deployment-workflow)

---

## Quick Start for AI

### Context Window Optimization

**Priority Files** (read these first for context):
1. `/docs/DATABASE-SCHEMA.md` - Database structure
2. `/docs/API-REFERENCE.md` - API endpoints
3. `/backend/src/index.js` - Server entry point (176 lines)
4. `/frontend/src/App.jsx` - Frontend main (985 lines)

**File Size Reference**:
- Small (<200 lines): Quick read
- Medium (200-500 lines): Moderate context
- Large (500-1000 lines): Read specific sections
- Very Large (>1000 lines): Use search, read targeted sections

### Codebase Statistics

```
Backend:
  - Routes: 19 files (~200 lines each)
  - Services: 4 files (~300 lines each)
  - Database: 11 SQL files (6,855 total lines)

Frontend:
  - App.jsx: 985 lines (main staff portal)
  - CMS.jsx: 1,200 lines (content management)
  - PublicWebsite.jsx: 2,800 lines (customer site)
  - Other components: 10+ files
```

---

## File Location Map

**"Where do I modify X?"**

### Authentication & Users

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Login/Register | `backend/src/routes/auth.js` | `frontend/src/App.jsx` (LoginPage) |
| Permissions | `backend/src/middleware/auth.js` | `backend/database/schema.sql` |
| User CRUD | `backend/src/routes/users.js` | `frontend/src/App.jsx` (ClientsPage) |
| Password change | `backend/src/routes/auth.js:267` | `frontend/src/App.jsx:805` (MyAccountPage) |

### Classes & Schedule

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Schedule API | `backend/src/routes/classes.js` | `backend/database/schema.sql` |
| Schedule UI | `frontend/src/App.jsx:400` (SchedulePage) | `frontend/src/PublicWebsite.jsx` |
| Class types | `backend/src/routes/admin.js` | `frontend/src/App.jsx:690` (SettingsPage) |
| Booking logic | `backend/src/routes/bookings.js` | `frontend/src/App.jsx` |

### Memberships & Payments

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Membership purchase | `backend/src/routes/memberships.js` | `frontend/src/App.jsx:523` (SellPage) |
| Stripe integration | `backend/src/routes/webhooks.js` | Environment vars |
| Transaction history | `backend/src/routes/transactions.js` | `frontend/src/App.jsx` (Reports) |

### Retail & Inventory

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Product catalog | `backend/src/routes/retail.js` | `backend/database/retail-schema.sql` |
| Inventory | `backend/src/routes/retail.js:200+` | `frontend/src/App.jsx` |
| Orders | `backend/src/routes/retail.js:400+` | Database |

### CMS & Content

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| CMS backend | `backend/src/routes/cms.js` | `backend/database/cms-schema.sql` |
| CMS editor | `frontend/src/CMS.jsx` | All pages |
| Public website | `frontend/src/PublicWebsite.jsx` | CMS data |
| Site settings | `backend/src/routes/cms.js:50` | Database site_settings table |

### Campaigns & Notifications

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Campaign config | `backend/src/routes/campaigns.js` | `backend/database/campaigns-schema.sql` |
| Campaign execution | `backend/src/services/campaigns.js` | `backend/src/services/scheduler.js` |
| Email/SMS sending | `backend/src/services/notifications.js` | SendGrid/Twilio config |

### Reports & Analytics

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Dashboard metrics | `backend/src/routes/reports.js` | `frontend/src/App.jsx:180` (DashboardPage) |
| Custom reports | `backend/src/routes/reports.js:200+` | SQL views |

### Multi-Tenant (Q2)

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Studios table | `backend/database/theme-customization-schema.sql` | Future: add studio_id to all tables |
| Theme settings | `backend/src/routes/theme.js` | `backend/database/theme-customization-schema.sql` |
| White-labeling | `backend/src/routes/theme.js:100+` | Frontend components |

---

## Common Tasks & Solutions

### Task 1: Add a New Permission

**Steps**:

1. **Database** - Add permission to schema:
```sql
-- backend/database/schema.sql (find existing INSERT INTO permissions)
INSERT INTO permissions (name, description) VALUES
  ('feature.new_action', 'Description of new permission');
```

2. **Assign to Roles** - Add to role_permissions:
```sql
-- backend/database/schema.sql (find INSERT INTO role_permissions)
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name = 'feature.new_action';
```

3. **Use in Route** - Apply middleware:
```javascript
// backend/src/routes/your-route.js
const { requirePermission } = require('../middleware/auth');

router.post('/endpoint', requirePermission('feature.new_action'), async (req, res) => {
  // Implementation
});
```

4. **Frontend** - Conditionally show UI:
```javascript
// frontend/src/App.jsx
const hasPermission = await api('/auth/permissions').then(p =>
  p.permissions.includes('feature.new_action')
);

{hasPermission && <button>New Action</button>}
```

5. **Test** - Run migration:
```bash
npm run db:reset
# Login and verify permission works
```

---

### Task 2: Add a New API Endpoint

**Steps**:

1. **Choose Route File** - Select existing or create new:
```javascript
// backend/src/routes/your-feature.js
const express = require('express');
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Your endpoints here

module.exports = router;
```

2. **Implement Endpoint**:
```javascript
router.post('/items', authenticate, [
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { name, description } = req.body;

    const result = await db.query(
      `INSERT INTO items (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, req.user.id]
    );

    res.status(201).json({
      message: 'Item created',
      item: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});
```

3. **Register Route** - Add to index.js:
```javascript
// backend/src/index.js
const yourFeatureRoutes = require('./routes/your-feature');
app.use('/api/your-feature', yourFeatureRoutes);
```

4. **Test** - Use curl or frontend:
```bash
curl -X POST http://localhost:3000/api/your-feature/items \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","description":"Test"}'
```

5. **Document** - Add to API-REFERENCE.md

---

### Task 3: Add a Database Table

**Steps**:

1. **Create Migration File**:
```bash
# backend/database/add-your-feature.sql
```

2. **Write SQL**:
```sql
-- Add to existing schema file or create new migration
CREATE TABLE IF NOT EXISTS your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_your_table_user ON your_table(user_id);
CREATE INDEX idx_your_table_created_at ON your_table(created_at);
```

3. **Add to Migration Order** - Update setup scripts:
```javascript
// backend/database/setup-railway-local.js
const MIGRATIONS = [
  'schema.sql',
  // ... existing migrations
  'add-your-feature.sql',  // Add new migration
];
```

4. **Run Migration**:
```bash
cd backend/database
node setup-railway-local.js
```

5. **Document** - Add to DATABASE-SCHEMA.md

---

### Task 4: Add Frontend Page to Staff Portal

**Steps**:

1. **Create Page Component** in App.jsx:
```javascript
// frontend/src/App.jsx (before export default function App())
function YourNewPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await api('/your-feature/items');
        setData(result.items);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Your Feature</h1>
      {/* Your UI here */}
    </div>
  );
}
```

2. **Add to Sidebar** - Find Sidebar component:
```javascript
// frontend/src/App.jsx (Sidebar component, around line 100)
function Sidebar({ user, currentPage, setCurrentPage, onLogout, collapsed = false }) {
  const nav = [
    // ... existing nav items
    {
      id: 'your-feature',
      label: 'Your Feature',
      icon: Icons.Star,  // Choose appropriate icon
      roles: ['manager', 'admin']  // Who can see it
    },
  ];

  // Rest of Sidebar component
}
```

3. **Add to Router** - Update renderPage:
```javascript
// frontend/src/App.jsx (renderPage function)
const renderPage = () => {
  const token = localStorage.getItem('staff_token');
  switch (currentPage) {
    case 'dashboard': return <DashboardPage />;
    // ... existing cases
    case 'your-feature': return <YourNewPage />;
    default: return <DashboardPage />;
  }
};
```

4. **Test** - Run dev server:
```bash
npm run dev
# Navigate to http://localhost:5173/staff
# Login and check sidebar
```

---

### Task 5: Add Email/SMS Campaign Trigger

**Steps**:

1. **Add Trigger Type** to schema CHECK constraint:
```sql
-- backend/database/campaigns-schema.sql
CREATE TABLE notification_campaigns (
  -- ...
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
    'membership_expiring',
    -- ... existing types
    'your_new_trigger'  -- Add here
  )),
  -- ...
);
```

2. **Create Targeting Function** (optional, for complex queries):
```sql
-- backend/database/campaigns-schema.sql
CREATE OR REPLACE FUNCTION get_your_trigger_targets(campaign_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  -- ... custom fields
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.first_name, u.last_name
  FROM users u
  WHERE /* your targeting logic */;
END;
$$ LANGUAGE plpgsql;
```

3. **Update Campaign Service**:
```javascript
// backend/src/services/campaigns.js
async function getTargetsForCampaign(campaign) {
  // ... existing switch/if logic
  if (campaign.trigger_type === 'your_new_trigger') {
    const { custom_param } = campaign.trigger_config;
    return await db.query(`
      SELECT * FROM get_your_trigger_targets($1)
    `, [campaign.id]);
  }
  // ...
}
```

4. **Add to Frontend** - Campaign creation form:
```javascript
// frontend/src/App.jsx or CMS.jsx (Campaign editor)
const triggerTypes = [
  // ... existing types
  {
    value: 'your_new_trigger',
    label: 'Your New Trigger',
    config_fields: ['custom_param']  // What fields to show
  }
];
```

5. **Test**:
```bash
# Create campaign via UI or API
# Manually trigger: node backend/src/services/campaigns.js
```

---

### Task 6: Modify Existing Feature (Safe Pattern)

**Steps**:

1. **Read Current Implementation**:
```bash
# Use grep to find all usages
grep -r "function_name" backend/src/
grep -r "ComponentName" frontend/src/
```

2. **Check Dependencies**:
- Database schema changes needed?
- API contract changes (breaking)?
- Frontend components affected?
- Permissions required?

3. **Make Backward-Compatible Changes**:
```javascript
// GOOD - Backward compatible
router.get('/items', async (req, res) => {
  const { new_filter } = req.query;  // Optional new filter

  let query = 'SELECT * FROM items WHERE 1=1';
  const params = [];

  // Existing filters still work
  if (req.query.old_filter) {
    query += ` AND old_column = $${params.length + 1}`;
    params.push(req.query.old_filter);
  }

  // New filter (optional)
  if (new_filter) {
    query += ` AND new_column = $${params.length + 1}`;
    params.push(new_filter);
  }

  // ... execute query
});

// BAD - Breaking change
router.get('/items', async (req, res) => {
  const { new_filter } = req.query;  // Required!
  if (!new_filter) {
    return res.status(400).json({ error: 'new_filter required' });
  }
  // ... breaks existing clients
});
```

4. **Test Old and New Behavior**:
```bash
# Old behavior still works
curl http://localhost:3000/api/items?old_filter=value

# New behavior works
curl http://localhost:3000/api/items?new_filter=value

# Both work together
curl http://localhost:3000/api/items?old_filter=value&new_filter=value
```

---

## Code Patterns Reference

### Database Query Patterns

#### 1. Simple SELECT with Parameters

```javascript
const result = await db.query(
  'SELECT * FROM users WHERE email = $1 AND is_active = $2',
  [email, true]
);

if (result.rows.length === 0) {
  return res.status(404).json({ error: 'User not found' });
}

const user = result.rows[0];
```

#### 2. Dynamic WHERE Clause

```javascript
let query = 'SELECT * FROM classes WHERE 1=1';
const params = [];
let paramIndex = 1;

if (location_id) {
  query += ` AND location_id = $${paramIndex}`;
  params.push(location_id);
  paramIndex++;
}

if (teacher_id) {
  query += ` AND teacher_id = $${paramIndex}`;
  params.push(teacher_id);
  paramIndex++;
}

query += ' ORDER BY date, start_time';
const result = await db.query(query, params);
```

#### 3. Transaction with Row Locking

```javascript
const client = await db.getClient();
try {
  await client.query('BEGIN');

  // Lock row for update
  const classResult = await client.query(
    'SELECT * FROM classes WHERE id = $1 FOR UPDATE',
    [class_id]
  );

  // Check capacity
  const bookedCount = await client.query(
    'SELECT COUNT(*) FROM bookings WHERE class_id = $1 AND status = $2',
    [class_id, 'booked']
  );

  if (bookedCount.rows[0].count >= classResult.rows[0].capacity) {
    throw new Error('Class full');
  }

  // Create booking
  await client.query(
    'INSERT INTO bookings (user_id, class_id) VALUES ($1, $2)',
    [user_id, class_id]
  );

  // Deduct credit
  await client.query(
    'UPDATE user_memberships SET credits_remaining = credits_remaining - 1 WHERE id = $1',
    [membership_id]
  );

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

#### 4. Complex JOIN with Aggregation

```javascript
const result = await db.query(`
  SELECT
    c.*,
    ct.name as class_name,
    ct.color,
    l.name as location_name,
    CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
    COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked_count,
    c.capacity - COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as spots_left
  FROM classes c
  JOIN class_types ct ON c.class_type_id = ct.id
  JOIN locations l ON c.location_id = l.id
  JOIN teachers t_record ON c.teacher_id = t_record.id
  JOIN users t ON t_record.user_id = t.id
  LEFT JOIN bookings b ON c.id = b.class_id
  WHERE c.date BETWEEN $1 AND $2
  GROUP BY c.id, ct.id, l.id, t.id
  ORDER BY c.date, c.start_time
`, [start_date, end_date]);
```

---

### Express Route Patterns

#### 1. Simple GET

```javascript
router.get('/items', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM items ORDER BY created_at DESC');
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});
```

#### 2. POST with Validation

```javascript
router.post('/items', authenticate, [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().normalizeEmail(),
  body('quantity').optional().isInt({ min: 1 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { name, email, quantity } = req.body;

    const result = await db.query(
      `INSERT INTO items (name, email, quantity, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, quantity || 1, req.user.id]
    );

    res.status(201).json({
      message: 'Item created',
      item: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});
```

#### 3. PUT/PATCH (Partial Update)

```javascript
router.put('/items/:id', authenticate, requirePermission('items.edit'), async (req, res, next) => {
  try {
    const allowedFields = ['name', 'description', 'quantity'];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await db.query(
      `UPDATE items SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item updated', item: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
```

#### 4. DELETE

```javascript
router.delete('/items/:id', authenticate, requirePermission('items.delete'), async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM items WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
});
```

---

### React Component Patterns

#### 1. Data Fetching with Loading State

```javascript
function MyComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const result = await api('/items');
        setData(result.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-600">{error}</div>;
  if (data.length === 0) return <EmptyState message="No items found" />;

  return (
    <div>
      {data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

#### 2. Form with Submission

```javascript
function CreateItemForm({ onSuccess }) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api('/items', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="text-red-600 mb-4">{error}</div>}

      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
        className="..."
      />

      <button type="submit" disabled={loading} className="...">
        {loading ? 'Creating...' : 'Create Item'}
      </button>
    </form>
  );
}
```

#### 3. Modal Pattern

```javascript
function MyPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setSelectedItem(null);
  };

  return (
    <div>
      {/* Item list */}
      <button onClick={() => handleEdit(item)}>Edit</button>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={handleClose} title="Edit Item">
        <EditItemForm item={selectedItem} onSuccess={() => {
          handleClose();
          // Reload data
        }} />
      </Modal>
    </div>
  );
}
```

---

## Decision Trees

### "Should I add a new file or modify existing?"

```
START
  ├─ Is this a new feature domain (e.g., loyalty program)?
  │   └─ YES → Create new route file (backend/src/routes/loyalty.js)
  │
  └─ Is this extending existing feature (e.g., add field to users)?
      └─ YES → Modify existing file
          ├─ Database: ALTER TABLE in migration
          ├─ Backend: Update route in existing file
          └─ Frontend: Modify component in App.jsx
```

### "Should this be a migration or schema change?"

```
START
  ├─ Is database empty (fresh development)?
  │   └─ YES → Modify schema.sql directly
  │
  └─ Is database in production?
      └─ YES → Create new migration file
          └─ Use ALTER TABLE (never DROP)
```

### "Where should business logic go?"

```
START
  ├─ Is it used by multiple routes?
  │   └─ YES → Create service (backend/src/services/feature.js)
  │
  ├─ Is it scheduled/background task?
  │   └─ YES → Create service + add to scheduler.js
  │
  └─ Is it single-route specific?
      └─ YES → Keep in route file
```

### "Should I use a transaction?"

```
START
  ├─ Does operation modify multiple tables?
  │   └─ YES → Use transaction
  │
  ├─ Does operation check then modify (race condition possible)?
  │   └─ YES → Use transaction with row locking
  │
  └─ Simple single INSERT/UPDATE/DELETE?
      └─ NO → No transaction needed
```

---

## Testing Checklist

### Before Committing Code

- [ ] **Syntax**: Code runs without errors
- [ ] **Database**: Schema changes applied (`npm run db:reset`)
- [ ] **API**: Endpoint returns expected response (test with curl/Postman)
- [ ] **Frontend**: Component renders without errors
- [ ] **Permissions**: Only authorized users can access
- [ ] **Validation**: Invalid input returns 400 with clear message
- [ ] **Error Handling**: Errors don't crash server, return meaningful messages
- [ ] **Documentation**: API-REFERENCE.md updated if API changed

### Integration Testing

```bash
# 1. Reset database with changes
npm run db:reset

# 2. Start servers
npm run dev

# 3. Test auth flow
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@thestudio.com","password":"admin123"}'
# Copy token

# 4. Test new endpoint
curl http://localhost:3000/api/your-endpoint \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Test in frontend
# Navigate to feature in browser, check console for errors
```

---

## Deployment Workflow

### Development to Production

```
1. LOCAL DEVELOPMENT
   ├─ Modify code
   ├─ Test with npm run dev
   └─ Commit to branch

2. GIT WORKFLOW
   ├─ Branch: claude/feature-name-xxxxx
   ├─ Commit with clear messages
   └─ Push to origin

3. RAILWAY DEPLOYMENT (Auto)
   ├─ Railway monitors branch
   ├─ Auto-builds on push
   └─ Auto-deploys if build succeeds

4. DATABASE MIGRATIONS (Manual)
   ├─ SSH into Railway or use dashboard
   ├─ Run: node backend/database/setup-railway-local.js
   └─ Verify schema updated

5. VERIFICATION
   ├─ Check Railway logs for errors
   ├─ Test API: https://thestudio-reno-production.up.railway.app/api/health
   ├─ Test frontend: https://thestudio-reno-production.up.railway.app/staff
   └─ Monitor for 24 hours
```

### Environment Variables

**Required in Railway**:
```
DATABASE_URL (reference:postgresql://...)
JWT_SECRET (random 64+ char string)
NODE_ENV=production
CORS_ORIGIN=https://thestudio-reno-production.up.railway.app
DB_SSL_REJECT_UNAUTHORIZED=false
```

**Optional** (enable features):
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

## AI-Specific Tips

### When Context Window is Full

**Prioritize**:
1. Keep DATABASE-SCHEMA.md in context (critical for queries)
2. Keep API-REFERENCE.md for endpoint you're modifying
3. Read only the specific route file you're editing
4. Use grep to find usages instead of reading full files

**Example**:
```bash
# Instead of reading all of App.jsx (985 lines)
grep -n "SchedulePage" frontend/src/App.jsx
# Read only lines 400-500 where SchedulePage is defined
```

### Making Safe Modifications

**Always Prefer**:
- ✅ ALTER TABLE over DROP TABLE
- ✅ Optional parameters over required
- ✅ New fields with defaults over modifying existing
- ✅ Additive changes over destructive
- ✅ Versioned endpoints over modifying existing

**Example**:
```sql
-- SAFE
ALTER TABLE users ADD COLUMN new_field VARCHAR(100) DEFAULT 'default_value';

-- DANGEROUS
ALTER TABLE users DROP COLUMN existing_field;  -- Data loss!
```

### Debugging Approach

```
1. CHECK LOGS
   ├─ Railway dashboard → Logs tab
   └─ Look for stack traces

2. VERIFY DATABASE
   ├─ Railway dashboard → Data tab
   ├─ Check table exists
   └─ Check data format

3. TEST API DIRECTLY
   ├─ Use curl to isolate issue
   └─ Check response status and body

4. CHECK PERMISSIONS
   ├─ Verify user has permission
   └─ Check middleware is applied

5. VERIFY ENVIRONMENT
   └─ Check Railway environment variables
```

---

## Quick Reference Commands

```bash
# Development
npm run dev                          # Start dev servers
npm run db:reset                     # Reset database + seed

# Database
npm run db:setup                     # Schema only
npm run db:seed                      # Seed data only
node backend/database/check-admin.js # Verify admin user

# Git
git add .
git commit -m "feat: description"
git push -u origin claude/feature-xxxxx

# Testing
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@thestudio.com","password":"admin123"}'

# Search
grep -r "search_term" backend/src/
grep -r "ComponentName" frontend/src/
```

---

## Common Pitfalls

### 1. Forgetting Authentication

```javascript
// BAD - No auth
router.get('/sensitive-data', async (req, res) => {
  // Anyone can access!
});

// GOOD
router.get('/sensitive-data', authenticate, requirePermission('data.view'), async (req, res) => {
  // Only authorized users
});
```

### 2. SQL Injection

```javascript
// BAD - Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);
```

### 3. Not Releasing Database Connections

```javascript
// BAD - Connection leak
const client = await db.getClient();
const result = await client.query('SELECT * FROM users');
// If error occurs, connection never released!

// GOOD - Always release
const client = await db.getClient();
try {
  const result = await client.query('SELECT * FROM users');
  return result.rows;
} finally {
  client.release();  // Always runs
}
```

### 4. Forgetting to Commit Transaction

```javascript
// BAD
await client.query('BEGIN');
await client.query('INSERT INTO ...');
// Never committed! Data lost on disconnect

// GOOD
await client.query('BEGIN');
try {
  await client.query('INSERT INTO ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

---

## Summary for AI

**This codebase is optimized for AI-assisted development**:

1. **Consistent patterns** - Copy existing code and adapt
2. **Clear file organization** - Easy to locate features
3. **Explicit documentation** - DATABASE-SCHEMA.md, API-REFERENCE.md
4. **Safe modification paths** - Always backward compatible
5. **Complete examples** - Every pattern demonstrated

**When in doubt**:
- Search for similar existing implementation
- Follow the patterns in this guide
- Test incrementally
- Document changes

**World is changing** - This codebase embraces AI-first development:
- Optimized for LLM context windows
- Explicit over implicit
- Examples over theory
- Safe defaults everywhere

---

**Document Version**: 1.0
**Last Updated**: 2026-01-17
**Optimized For**: Claude, GPT-4, and future LLMs
