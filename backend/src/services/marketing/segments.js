// ============================================
// SEGMENTATION ENGINE
// Dynamic user targeting based on behavior
// ============================================

const db = require('../../database/connection');

/**
 * Segment rule operators and their SQL translations
 */
const OPERATORS = {
  equals: (field, value) => `${field} = '${value}'`,
  not_equals: (field, value) => `${field} != '${value}'`,
  contains: (field, value) => `${field} ILIKE '%${value}%'`,
  starts_with: (field, value) => `${field} ILIKE '${value}%'`,
  greater_than: (field, value) => `${field} > ${value}`,
  less_than: (field, value) => `${field} < ${value}`,
  greater_than_or_equal: (field, value) => `${field} >= ${value}`,
  less_than_or_equal: (field, value) => `${field} <= ${value}`,
  is_null: (field) => `${field} IS NULL`,
  is_not_null: (field) => `${field} IS NOT NULL`,
  in: (field, value) => `${field} IN (${Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : `'${value}'`})`,
  not_in: (field, value) => `${field} NOT IN (${Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : `'${value}'`})`,
  within_days: (field, value) => `${field} >= NOW() - INTERVAL '${value} days'`,
  more_than_days_ago: (field, value) => `${field} < NOW() - INTERVAL '${value} days'`,
  between: (field, value) => `${field} BETWEEN '${value[0]}' AND '${value[1]}'`,
};

/**
 * Field mappings to actual SQL expressions
 */
const FIELD_MAPPINGS = {
  // User fields
  email: 'u.email',
  first_name: 'u.first_name',
  last_name: 'u.last_name',
  role: 'u.role',
  created_at: 'u.created_at',
  is_active: 'u.is_active',

  // Membership fields
  membership_status: 'um.status',
  membership_type: 'mt.type',
  membership_name: 'mt.name',
  membership_start_date: 'um.start_date',
  membership_end_date: 'um.end_date',
  credits_remaining: 'um.credits_remaining',
  membership_expires_in_days: "EXTRACT(DAY FROM um.end_date - NOW())",

  // Behavior fields (computed)
  last_visit: '(SELECT MAX(c.date) FROM bookings b JOIN classes c ON b.class_id = c.id WHERE b.user_id = u.id AND b.status = \'checked_in\')',
  total_classes: '(SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id AND b.status = \'checked_in\')',
  total_bookings: '(SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id)',

  // Tag fields
  has_tag: null, // Special handling

  // Class attendance patterns
  attended_workshop: '(SELECT EXISTS(SELECT 1 FROM bookings b JOIN classes c ON b.class_id = c.id JOIN class_types ct ON c.class_type_id = ct.id WHERE b.user_id = u.id AND b.status = \'checked_in\' AND ct.category = \'workshop\'))',
  attended_class_category: null, // Special handling
  preferred_class_time: null, // Special handling
};

class SegmentationEngine {
  /**
   * Get all users in a segment
   */
  async getSegmentMembers(segmentId, options = {}) {
    const segment = await db.query(
      'SELECT * FROM marketing_segments WHERE id = $1',
      [segmentId]
    );

    if (!segment.rows[0]) {
      throw new Error('Segment not found');
    }

    return this.evaluateSegment(segment.rows[0].rules, options);
  }

  /**
   * Evaluate segment rules and return matching users
   */
  async evaluateSegment(rules, options = {}) {
    const { limit = 1000, offset = 0, countOnly = false } = options;

    const whereClause = this.buildWhereClause(rules);

    const baseQuery = `
      FROM users u
      LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
      LEFT JOIN membership_types mt ON mt.id = um.membership_type_id
      WHERE u.is_active = true
        AND u.role = 'student'
        ${whereClause ? `AND (${whereClause})` : ''}
    `;

    if (countOnly) {
      const countResult = await db.query(`SELECT COUNT(DISTINCT u.id) ${baseQuery}`);
      return { count: parseInt(countResult.rows[0].count) };
    }

    const result = await db.query(`
      SELECT DISTINCT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.created_at,
        um.status as membership_status,
        mt.name as membership_name,
        mt.type as membership_type,
        um.end_date as membership_end_date,
        um.credits_remaining
      ${baseQuery}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return { users: result.rows };
  }

  /**
   * Build WHERE clause from segment rules
   */
  buildWhereClause(rules) {
    if (!rules || !rules.conditions || rules.conditions.length === 0) {
      return '';
    }

    const conditions = rules.conditions
      .map(condition => this.buildCondition(condition))
      .filter(Boolean);

    if (conditions.length === 0) return '';

    const joiner = rules.match === 'any' ? ' OR ' : ' AND ';
    return conditions.join(joiner);
  }

  /**
   * Build a single condition SQL
   */
  buildCondition(condition) {
    const { field, operator, value } = condition;

    // Special field handling
    if (field === 'has_tag') {
      return `EXISTS(SELECT 1 FROM user_tags ut JOIN tags t ON ut.tag_id = t.id WHERE ut.user_id = u.id AND t.name = '${value}')`;
    }

    if (field === 'attended_class_category') {
      const minCount = condition.min_count || 1;
      return `(SELECT COUNT(*) FROM bookings b JOIN classes c ON b.class_id = c.id JOIN class_types ct ON c.class_type_id = ct.id WHERE b.user_id = u.id AND b.status = 'checked_in' AND ct.category = '${value}') >= ${minCount}`;
    }

    if (field === 'preferred_class_time') {
      const timeRanges = {
        morning: ['05:00', '11:00'],
        afternoon: ['11:00', '17:00'],
        evening: ['17:00', '22:00'],
      };
      const range = timeRanges[value];
      if (!range) return null;
      return `(SELECT COUNT(*) FROM bookings b JOIN classes c ON b.class_id = c.id WHERE b.user_id = u.id AND b.status = 'checked_in' AND c.start_time BETWEEN '${range[0]}' AND '${range[1]}') > (SELECT COUNT(*) FROM bookings b2 JOIN classes c2 ON b2.class_id = c2.id WHERE b2.user_id = u.id AND b2.status = 'checked_in' AND c2.start_time NOT BETWEEN '${range[0]}' AND '${range[1]}')`;
    }

    const fieldSql = FIELD_MAPPINGS[field];
    if (!fieldSql) {
      console.warn(`Unknown segment field: ${field}`);
      return null;
    }

    const operatorFn = OPERATORS[operator];
    if (!operatorFn) {
      console.warn(`Unknown segment operator: ${operator}`);
      return null;
    }

    return operatorFn(fieldSql, value);
  }

  /**
   * Check if a single user matches a segment
   */
  async userMatchesSegment(userId, segmentId) {
    const segment = await db.query(
      'SELECT * FROM marketing_segments WHERE id = $1',
      [segmentId]
    );

    if (!segment.rows[0]) {
      return false;
    }

    const whereClause = this.buildWhereClause(segment.rows[0].rules);

    const result = await db.query(`
      SELECT EXISTS(
        SELECT 1 FROM users u
        LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
        LEFT JOIN membership_types mt ON mt.id = um.membership_type_id
        WHERE u.id = $1
          AND u.is_active = true
          ${whereClause ? `AND (${whereClause})` : ''}
      ) as matches
    `, [userId]);

    return result.rows[0].matches;
  }

  /**
   * Update segment member counts (run periodically)
   */
  async updateSegmentCounts() {
    const segments = await db.query('SELECT id, rules FROM marketing_segments WHERE is_active = true');

    for (const segment of segments.rows) {
      try {
        const { count } = await this.evaluateSegment(segment.rules, { countOnly: true });
        await db.query(`
          UPDATE marketing_segments
          SET member_count = $1, last_calculated_at = NOW()
          WHERE id = $2
        `, [count, segment.id]);
      } catch (error) {
        console.error(`Error updating segment ${segment.id}:`, error.message);
      }
    }
  }

  /**
   * Create a new segment
   */
  async createSegment(name, description, rules, createdBy) {
    const result = await db.query(`
      INSERT INTO marketing_segments (name, description, rules, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description, rules, createdBy]);

    // Calculate initial count
    const { count } = await this.evaluateSegment(rules, { countOnly: true });
    await db.query(`
      UPDATE marketing_segments SET member_count = $1, last_calculated_at = NOW() WHERE id = $2
    `, [count, result.rows[0].id]);

    return { ...result.rows[0], member_count: count };
  }

  /**
   * Preview segment rules without saving
   */
  async previewSegment(rules, limit = 50) {
    const { count } = await this.evaluateSegment(rules, { countOnly: true });
    const { users } = await this.evaluateSegment(rules, { limit });

    return { count, users };
  }

  /**
   * Get users who match specific behavioral criteria
   */
  async getUsersByBehavior(criteria) {
    const rules = { match: 'all', conditions: [] };

    if (criteria.inactiveDays) {
      rules.conditions.push({
        field: 'last_visit',
        operator: 'more_than_days_ago',
        value: criteria.inactiveDays,
      });
    }

    if (criteria.membershipExpiresDays) {
      rules.conditions.push({
        field: 'membership_expires_in_days',
        operator: 'less_than_or_equal',
        value: criteria.membershipExpiresDays,
      });
      rules.conditions.push({
        field: 'membership_expires_in_days',
        operator: 'greater_than',
        value: 0,
      });
    }

    if (criteria.lowCredits) {
      rules.conditions.push({
        field: 'credits_remaining',
        operator: 'less_than_or_equal',
        value: criteria.lowCredits,
      });
      rules.conditions.push({
        field: 'membership_type',
        operator: 'equals',
        value: 'credits',
      });
    }

    if (criteria.hasTag) {
      rules.conditions.push({
        field: 'has_tag',
        operator: 'equals',
        value: criteria.hasTag,
      });
    }

    if (criteria.membershipType) {
      rules.conditions.push({
        field: 'membership_type',
        operator: 'equals',
        value: criteria.membershipType,
      });
    }

    return this.evaluateSegment(rules, { limit: criteria.limit || 1000 });
  }
}

module.exports = { SegmentationEngine };
