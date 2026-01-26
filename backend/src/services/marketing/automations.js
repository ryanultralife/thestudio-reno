// ============================================
// MARKETING AUTOMATION SERVICE
// Lifecycle emails triggered by events
// ============================================

const db = require('../../database/connection');
const { sendEmail } = require('../notifications');
const { SegmentationEngine } = require('./segments');
const { CampaignService } = require('./campaigns');

const segmentEngine = new SegmentationEngine();
const campaignService = new CampaignService();

class AutomationService {
  /**
   * Trigger an automation for a user based on event
   */
  async trigger(triggerType, userId, contextData = {}) {
    console.log(`[Automation] Trigger: ${triggerType} for user ${userId}`);

    // Find active automations for this trigger
    const automations = await db.query(`
      SELECT * FROM marketing_automations
      WHERE trigger_type = $1 AND is_active = true
    `, [triggerType]);

    for (const automation of automations.rows) {
      try {
        // Check if user matches segment (if specified)
        if (automation.segment_id) {
          const matches = await segmentEngine.userMatchesSegment(userId, automation.segment_id);
          if (!matches) {
            console.log(`[Automation] User doesn't match segment for "${automation.name}"`);
            continue;
          }
        }

        // Check trigger config
        if (!this.checkTriggerConfig(automation, contextData)) {
          continue;
        }

        // Enroll user in automation
        await this.enrollUser(automation.id, userId, contextData);
      } catch (error) {
        console.error(`[Automation] Error triggering "${automation.name}":`, error.message);
      }
    }
  }

  /**
   * Check if trigger config matches context
   */
  checkTriggerConfig(automation, contextData) {
    const config = automation.trigger_config || {};

    switch (automation.trigger_type) {
      case 'membership_expiring':
        // Check days_before matches
        if (config.days_before && contextData.days_remaining !== config.days_before) {
          return false;
        }
        break;

      case 'inactive_days':
        // Check if user has been inactive long enough
        if (config.days && contextData.inactive_days < config.days) {
          return false;
        }
        break;

      case 'credits_low':
        // Check credit threshold
        if (config.threshold && contextData.credits_remaining > config.threshold) {
          return false;
        }
        break;

      case 'tag_added':
        // Check tag name matches
        if (config.tag && contextData.tag !== config.tag) {
          return false;
        }
        break;
    }

    return true;
  }

  /**
   * Enroll a user in an automation
   */
  async enrollUser(automationId, userId, contextData = {}) {
    // Check if already enrolled
    const existing = await db.query(`
      SELECT * FROM marketing_automation_enrollments
      WHERE automation_id = $1 AND user_id = $2 AND status = 'active'
    `, [automationId, userId]);

    if (existing.rows.length > 0) {
      console.log(`[Automation] User already enrolled in automation ${automationId}`);
      return;
    }

    // Get first step
    const firstStep = await db.query(`
      SELECT * FROM marketing_automation_steps
      WHERE automation_id = $1
      ORDER BY step_order ASC
      LIMIT 1
    `, [automationId]);

    // Calculate when to run first step
    const nextStepAt = firstStep.rows[0]?.step_type === 'wait'
      ? this.calculateWaitTime(firstStep.rows[0].config)
      : new Date();

    // Create enrollment
    const result = await db.query(`
      INSERT INTO marketing_automation_enrollments (automation_id, user_id, context_data, next_step_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (automation_id, user_id) DO UPDATE SET
        status = 'active',
        current_step = 0,
        next_step_at = $4,
        context_data = $3,
        enrolled_at = NOW()
      RETURNING id
    `, [automationId, userId, contextData, nextStepAt]);

    // Update automation stats
    await db.query(`
      UPDATE marketing_automations SET total_enrolled = total_enrolled + 1 WHERE id = $1
    `, [automationId]);

    console.log(`[Automation] Enrolled user ${userId} in automation ${automationId}`);

    // If first step is immediate (not wait), execute it
    if (firstStep.rows[0] && firstStep.rows[0].step_type !== 'wait') {
      await this.executeStep(result.rows[0].id, firstStep.rows[0]);
    }

    return result.rows[0].id;
  }

  /**
   * Process pending automation steps (called by cron job)
   */
  async processAutomationSteps() {
    // Get enrollments that are ready for next step
    const pending = await db.query(`
      SELECT e.*, a.name as automation_name
      FROM marketing_automation_enrollments e
      JOIN marketing_automations a ON e.automation_id = a.id
      WHERE e.status = 'active'
        AND e.next_step_at <= NOW()
        AND a.is_active = true
      LIMIT 100
    `);

    console.log(`[Automation] Processing ${pending.rows.length} pending steps`);

    for (const enrollment of pending.rows) {
      try {
        await this.processEnrollment(enrollment);
      } catch (error) {
        console.error(`[Automation] Error processing enrollment ${enrollment.id}:`, error.message);
      }
    }

    return { processed: pending.rows.length };
  }

  /**
   * Process a single enrollment
   */
  async processEnrollment(enrollment) {
    // Get next step
    const step = await db.query(`
      SELECT * FROM marketing_automation_steps
      WHERE automation_id = $1 AND step_order = $2 AND is_active = true
    `, [enrollment.automation_id, enrollment.current_step + 1]);

    if (!step.rows[0]) {
      // No more steps - complete automation
      await this.completeEnrollment(enrollment.id);
      return;
    }

    // Execute the step
    await this.executeStep(enrollment.id, step.rows[0]);
  }

  /**
   * Execute an automation step
   */
  async executeStep(enrollmentId, step) {
    const startTime = Date.now();
    let status = 'success';
    let result = {};
    let errorMessage = null;

    const enrollment = await db.query(
      'SELECT * FROM marketing_automation_enrollments WHERE id = $1',
      [enrollmentId]
    );

    if (!enrollment.rows[0]) return;

    const contextData = enrollment.rows[0].context_data || {};

    try {
      switch (step.step_type) {
        case 'send_email':
          result = await this.executeSendEmail(enrollment.rows[0], step.config);
          break;

        case 'wait':
          result = await this.executeWait(enrollmentId, step.config);
          return; // Wait step schedules next execution, don't proceed

        case 'condition':
          result = await this.executeCondition(enrollment.rows[0], step.config);
          break;

        case 'add_tag':
          result = await this.executeAddTag(enrollment.rows[0].user_id, step.config);
          break;

        case 'remove_tag':
          result = await this.executeRemoveTag(enrollment.rows[0].user_id, step.config);
          break;

        case 'notify_staff':
          result = await this.executeNotifyStaff(enrollment.rows[0], step.config);
          break;

        case 'enroll_in_automation':
          result = await this.executeEnrollInAutomation(enrollment.rows[0].user_id, step.config);
          break;

        default:
          console.warn(`[Automation] Unknown step type: ${step.step_type}`);
          status = 'skipped';
      }
    } catch (error) {
      status = 'failed';
      errorMessage = error.message;
      console.error(`[Automation] Step failed:`, error.message);
    }

    // Log step execution
    await db.query(`
      INSERT INTO marketing_automation_log (enrollment_id, step_id, step_type, status, result, error_message, duration_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [enrollmentId, step.id, step.step_type, status, result, errorMessage, Date.now() - startTime]);

    // Advance to next step
    if (status === 'success') {
      await this.advanceEnrollment(enrollmentId, step.step_order);
    } else if (status === 'failed') {
      // Mark enrollment as failed after too many errors
      await db.query(`
        UPDATE marketing_automation_enrollments
        SET status = 'failed', exited_at = NOW(), exit_reason = $1
        WHERE id = $2
      `, [errorMessage, enrollmentId]);
    }
  }

  /**
   * Execute send_email step
   */
  async executeSendEmail(enrollment, config) {
    // Get user
    const user = await db.query('SELECT * FROM users WHERE id = $1', [enrollment.user_id]);
    if (!user.rows[0]) {
      throw new Error('User not found');
    }

    // Check if user can receive marketing emails
    const canReceive = await db.query('SELECT can_receive_marketing_email($1) as allowed', [enrollment.user_id]);
    if (!canReceive.rows[0]?.allowed) {
      console.log(`[Automation] User ${enrollment.user_id} opted out of marketing emails`);
      return { skipped: true, reason: 'opted_out' };
    }

    // Get template
    const template = await db.query(
      'SELECT * FROM marketing_email_templates WHERE id = $1',
      [config.template_id]
    );

    if (!template.rows[0]) {
      throw new Error('Email template not found');
    }

    // Build personalization
    const personalization = campaignService.buildPersonalizationData(
      { ...user.rows[0], ...enrollment.context_data },
      { customData: config.custom_data }
    );

    // Process template
    const subject = config.subject_override
      ? campaignService.processTemplate(config.subject_override, personalization)
      : campaignService.processTemplate(template.rows[0].subject, personalization);

    const html = campaignService.processTemplate(template.rows[0].body_html, personalization);

    // Send email
    const result = await sendEmail(user.rows[0].email, subject, html);

    return { sent: result.success, email: user.rows[0].email };
  }

  /**
   * Execute wait step
   */
  async executeWait(enrollmentId, config) {
    const nextStepAt = this.calculateWaitTime(config);

    await db.query(`
      UPDATE marketing_automation_enrollments
      SET next_step_at = $1, current_step = current_step + 1
      WHERE id = $2
    `, [nextStepAt, enrollmentId]);

    return { waitUntil: nextStepAt };
  }

  /**
   * Calculate wait time from config
   */
  calculateWaitTime(config) {
    if (config.until === 'specific_time') {
      // Wait until specific time today or tomorrow
      const [hours, minutes] = config.time.split(':').map(Number);
      const now = new Date();
      const targetTime = new Date(now);
      targetTime.setHours(hours, minutes, 0, 0);

      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      return targetTime;
    }

    // Duration-based wait
    const duration = config.duration || 1;
    const unit = config.unit || 'days';

    const ms = {
      minutes: duration * 60 * 1000,
      hours: duration * 60 * 60 * 1000,
      days: duration * 24 * 60 * 60 * 1000,
      weeks: duration * 7 * 24 * 60 * 60 * 1000,
    }[unit] || duration * 24 * 60 * 60 * 1000;

    return new Date(Date.now() + ms);
  }

  /**
   * Execute condition step
   */
  async executeCondition(enrollment, config) {
    const user = await db.query(`
      SELECT u.*, um.status as membership_status, mt.type as membership_type, um.credits_remaining
      FROM users u
      LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
      LEFT JOIN membership_types mt ON mt.id = um.membership_type_id
      WHERE u.id = $1
    `, [enrollment.user_id]);

    if (!user.rows[0]) {
      throw new Error('User not found');
    }

    const userData = user.rows[0];
    let conditionMet = false;

    // Evaluate condition
    const value = userData[config.field] || enrollment.context_data?.[config.field];

    switch (config.operator) {
      case 'equals':
        conditionMet = value === config.value;
        break;
      case 'not_equals':
        conditionMet = value !== config.value;
        break;
      case 'greater_than':
        conditionMet = value > config.value;
        break;
      case 'less_than':
        conditionMet = value < config.value;
        break;
      case 'is_null':
        conditionMet = value == null;
        break;
      case 'is_not_null':
        conditionMet = value != null;
        break;
    }

    // Jump to appropriate step
    const nextStep = conditionMet ? config.true_step : config.false_step;

    if (nextStep) {
      await db.query(`
        UPDATE marketing_automation_enrollments
        SET current_step = $1 - 1
        WHERE id = $2
      `, [nextStep, enrollment.id]);
    }

    return { conditionMet, nextStep };
  }

  /**
   * Execute add_tag step
   */
  async executeAddTag(userId, config) {
    const tag = await db.query('SELECT id FROM tags WHERE name = $1', [config.tag]);

    if (!tag.rows[0]) {
      // Create tag if doesn't exist
      const newTag = await db.query(`
        INSERT INTO tags (name) VALUES ($1) RETURNING id
      `, [config.tag]);
      tag.rows[0] = newTag.rows[0];
    }

    await db.query(`
      INSERT INTO user_tags (user_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [userId, tag.rows[0].id]);

    return { tagAdded: config.tag };
  }

  /**
   * Execute remove_tag step
   */
  async executeRemoveTag(userId, config) {
    await db.query(`
      DELETE FROM user_tags ut
      USING tags t
      WHERE ut.tag_id = t.id AND ut.user_id = $1 AND t.name = $2
    `, [userId, config.tag]);

    return { tagRemoved: config.tag };
  }

  /**
   * Execute notify_staff step
   */
  async executeNotifyStaff(enrollment, config) {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [enrollment.user_id]);
    const message = campaignService.processTemplate(config.message || 'Automation notification', {
      first_name: user.rows[0]?.first_name,
      last_name: user.rows[0]?.last_name,
      email: user.rows[0]?.email,
      ...enrollment.context_data,
    });

    for (const email of config.emails || []) {
      await sendEmail(email, 'Automation Notification', `<p>${message}</p>`);
    }

    return { notified: config.emails };
  }

  /**
   * Execute enroll_in_automation step
   */
  async executeEnrollInAutomation(userId, config) {
    await this.enrollUser(config.automation_id, userId, {});
    return { enrolled: config.automation_id };
  }

  /**
   * Advance enrollment to next step
   */
  async advanceEnrollment(enrollmentId, currentStepOrder) {
    // Get next step
    const enrollment = await db.query(
      'SELECT automation_id FROM marketing_automation_enrollments WHERE id = $1',
      [enrollmentId]
    );

    const nextStep = await db.query(`
      SELECT * FROM marketing_automation_steps
      WHERE automation_id = $1 AND step_order > $2 AND is_active = true
      ORDER BY step_order ASC
      LIMIT 1
    `, [enrollment.rows[0].automation_id, currentStepOrder]);

    if (!nextStep.rows[0]) {
      // No more steps
      await this.completeEnrollment(enrollmentId);
      return;
    }

    // Calculate next step time
    let nextStepAt = new Date();
    if (nextStep.rows[0].step_type === 'wait') {
      nextStepAt = this.calculateWaitTime(nextStep.rows[0].config);
    }

    await db.query(`
      UPDATE marketing_automation_enrollments
      SET current_step = $1, next_step_at = $2
      WHERE id = $3
    `, [currentStepOrder, nextStepAt, enrollmentId]);
  }

  /**
   * Complete an enrollment
   */
  async completeEnrollment(enrollmentId) {
    await db.query(`
      UPDATE marketing_automation_enrollments
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
    `, [enrollmentId]);

    // Update automation stats
    await db.query(`
      UPDATE marketing_automations a
      SET total_completed = total_completed + 1
      WHERE id = (SELECT automation_id FROM marketing_automation_enrollments WHERE id = $1)
    `, [enrollmentId]);

    console.log(`[Automation] Enrollment ${enrollmentId} completed`);
  }

  /**
   * Get automation stats
   */
  async getAutomationStats(automationId) {
    const stats = await db.query('SELECT * FROM marketing_automation_stats WHERE id = $1', [automationId]);
    return stats.rows[0];
  }

  /**
   * List all automations
   */
  async listAutomations() {
    return db.query('SELECT * FROM marketing_automation_stats ORDER BY name');
  }

  /**
   * Check for trigger conditions (called by cron)
   * This handles time-based triggers like membership_expiring, inactive_days
   */
  async checkTriggerConditions() {
    console.log('[Automation] Checking trigger conditions...');

    // Check membership expiring
    await this.checkMembershipExpiringTrigger();

    // Check inactive users
    await this.checkInactiveUsersTrigger();

    // Check low credits
    await this.checkLowCreditsTrigger();

    // Check birthdays
    await this.checkBirthdayTrigger();
  }

  async checkMembershipExpiringTrigger() {
    // Find users with memberships expiring at configured days
    const automations = await db.query(`
      SELECT * FROM marketing_automations
      WHERE trigger_type = 'membership_expiring' AND is_active = true
    `);

    for (const automation of automations.rows) {
      const daysBefore = automation.trigger_config?.days_before || 7;

      const users = await db.query(`
        SELECT u.id, um.end_date, mt.name as membership_name,
               EXTRACT(DAY FROM um.end_date - NOW()) as days_remaining
        FROM users u
        JOIN user_memberships um ON um.user_id = u.id
        JOIN membership_types mt ON mt.id = um.membership_type_id
        WHERE um.status = 'active'
          AND um.end_date::date = (CURRENT_DATE + INTERVAL '${daysBefore} days')::date
      `);

      for (const user of users.rows) {
        await this.trigger('membership_expiring', user.id, {
          days_remaining: daysBefore,
          membership_name: user.membership_name,
          expiry_date: user.end_date,
        });
      }
    }
  }

  async checkInactiveUsersTrigger() {
    const automations = await db.query(`
      SELECT * FROM marketing_automations
      WHERE trigger_type = 'inactive_days' AND is_active = true
    `);

    for (const automation of automations.rows) {
      const inactiveDays = automation.trigger_config?.days || 30;

      const { users } = await segmentEngine.getUsersByBehavior({ inactiveDays });

      for (const user of users) {
        await this.trigger('inactive_days', user.id, { inactive_days: inactiveDays });
      }
    }
  }

  async checkLowCreditsTrigger() {
    const automations = await db.query(`
      SELECT * FROM marketing_automations
      WHERE trigger_type = 'credits_low' AND is_active = true
    `);

    for (const automation of automations.rows) {
      const threshold = automation.trigger_config?.threshold || 3;

      const { users } = await segmentEngine.getUsersByBehavior({ lowCredits: threshold });

      for (const user of users) {
        await this.trigger('credits_low', user.id, { credits_remaining: user.credits_remaining });
      }
    }
  }

  async checkBirthdayTrigger() {
    const users = await db.query(`
      SELECT id, first_name, date_of_birth
      FROM users
      WHERE is_active = true
        AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
    `);

    for (const user of users.rows) {
      await this.trigger('birthday', user.id, {
        first_name: user.first_name,
        birthday: user.date_of_birth,
      });
    }
  }
}

module.exports = { AutomationService };
