// ============================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================

const jwt = require('jsonwebtoken');
const db = require('../database/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

// ============================================
// JWT TOKEN MANAGEMENT
// ============================================

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, is_active 
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(error);
  }
}

// ============================================
// PERMISSION CHECKING
// ============================================

// Cache for role permissions (refresh every 5 minutes)
let permissionCache = {};
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadPermissions() {
  const now = Date.now();
  if (now - cacheTime < CACHE_TTL && Object.keys(permissionCache).length > 0) {
    return permissionCache;
  }

  const result = await db.query(`
    SELECT rp.role, p.name as permission
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
  `);

  permissionCache = {};
  for (const row of result.rows) {
    if (!permissionCache[row.role]) {
      permissionCache[row.role] = new Set();
    }
    permissionCache[row.role].add(row.permission);
  }

  cacheTime = now;
  return permissionCache;
}

async function userHasPermission(userId, permission) {
  // First check user-specific overrides
  const overrideResult = await db.query(`
    SELECT up.granted
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = $1 AND p.name = $2
  `, [userId, permission]);

  if (overrideResult.rows.length > 0) {
    return overrideResult.rows[0].granted;
  }

  // Get user role and check role permissions
  const userResult = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) return false;

  const role = userResult.rows[0].role;
  const permissions = await loadPermissions();

  return permissions[role]?.has(permission) || false;
}

// ============================================
// MIDDLEWARE FACTORIES
// ============================================

/**
 * Require specific permission(s)
 * @param {string|string[]} permissions - Single permission or array of permissions (OR logic)
 */
function requirePermission(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      for (const perm of permissions) {
        if (await userHasPermission(req.user.id, perm)) {
          return next();
        }
      }

      return res.status(403).json({ 
        error: 'Permission denied',
        required: permissions,
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require ALL specified permissions (AND logic)
 */
function requireAllPermissions(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      for (const perm of permissions) {
        if (!(await userHasPermission(req.user.id, perm))) {
          return res.status(403).json({ 
            error: 'Permission denied',
            missing: perm,
          });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
}

// ============================================
// OPTIONAL AUTHENTICATION
// ============================================

/**
 * Optional authentication - populates req.user if valid token, otherwise continues
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(); // No token, continue without user
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, is_active
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length > 0 && result.rows[0].is_active) {
      req.user = result.rows[0];
    }

    next();
  } catch (error) {
    // Invalid token, continue without user
    next();
  }
}

// ============================================
// CONVENIENCE MIDDLEWARE
// ============================================

// Legacy compatibility
const requireStaff = requireRole('front_desk', 'teacher', 'manager', 'owner', 'admin');
const requireManager = requireRole('manager', 'owner', 'admin');
const requireAdmin = requireRole('admin');
const requireOwner = requireRole('owner', 'admin');

// Check if accessing own resource or has permission
function requireOwnershipOr(permission, getUserId) {
  return async (req, res, next) => {
    try {
      const resourceUserId = typeof getUserId === 'function' 
        ? await getUserId(req) 
        : req.params[getUserId];

      // Owner of resource
      if (resourceUserId === req.user.id) {
        return next();
      }

      // Has permission to access others
      if (await userHasPermission(req.user.id, permission)) {
        return next();
      }

      return res.status(403).json({ error: 'Permission denied' });
    } catch (error) {
      next(error);
    }
  };
}

// For teachers - check if they own the class
async function isTeacherOfClass(req) {
  const classId = req.params.classId || req.params.id || req.body.class_id;
  if (!classId) return false;

  const result = await db.query(`
    SELECT t.user_id 
    FROM classes c 
    JOIN teachers t ON (c.teacher_id = t.id OR c.substitute_teacher_id = t.id)
    WHERE c.id = $1
  `, [classId]);

  return result.rows.some(row => row.user_id === req.user.id);
}

function requireClassAccess() {
  return async (req, res, next) => {
    try {
      // Admin/manager/front_desk can access any class
      if (await userHasPermission(req.user.id, 'class.view_roster_all')) {
        return next();
      }

      // Teachers can access their own classes
      if (req.user.role === 'teacher' && await isTeacherOfClass(req)) {
        return next();
      }

      return res.status(403).json({ error: 'No access to this class' });
    } catch (error) {
      next(error);
    }
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,

  // Permission checks
  userHasPermission,

  // Middleware factories
  requirePermission,
  requireAllPermissions,
  requireRole,
  requireOwnershipOr,
  requireClassAccess,

  // Convenience
  requireStaff,
  requireManager,
  requireOwner,
  requireAdmin,

  // Helpers
  isTeacherOfClass,
  loadPermissions,
};
