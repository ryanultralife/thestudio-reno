// ============================================
// MARKETING SERVICE INDEX
// Central export for all marketing services
// ============================================

const { SegmentationEngine } = require('./segments');
const { CampaignService } = require('./campaigns');
const { AutomationService } = require('./automations');

module.exports = {
  SegmentationEngine,
  CampaignService,
  AutomationService,
};
