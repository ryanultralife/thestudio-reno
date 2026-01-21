// ============================================
// CO-OP ROUTES - MAIN ROUTER
// ============================================

const express = require('express');
const { authenticate, requirePermission, requireRole } = require('../../middleware/auth');
const { isCoopEnabled } = require('../../services/coop/settings');

const router = express.Router();

// All co-op routes require authentication
router.use(authenticate);

// Middleware to check if co-op is enabled
async function checkCoopEnabled(req, res, next) {
  try {
    const enabled = await isCoopEnabled();
    if (!enabled) {
      return res.status(503).json({
        error: 'Co-op features are not enabled',
        code: 'COOP_DISABLED',
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Apply co-op check to all routes except settings (admin can configure)
router.use((req, res, next) => {
  // Allow settings routes through without co-op check (for admins to enable it)
  if (req.path.startsWith('/settings')) {
    return next();
  }
  checkCoopEnabled(req, res, next);
});

// ============================================
// MOUNT SUB-ROUTES
// ============================================

router.use('/settings', require('./settings'));
router.use('/rooms', require('./rooms'));
router.use('/tiers', require('./tiers'));
router.use('/agreements', require('./agreements'));
router.use('/classes', require('./classes'));
router.use('/bookings', require('./bookings'));
router.use('/credits', require('./credits'));
router.use('/earnings', require('./earnings'));
router.use('/payouts', require('./payouts'));
router.use('/connect', require('./connect'));

module.exports = router;
