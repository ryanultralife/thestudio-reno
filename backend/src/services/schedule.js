// ============================================
// SCHEDULE GENERATOR SERVICE
// Creates class instances from schedule templates
// ============================================

const db = require('../database/connection');

/**
 * Generate class instances from templates for a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {boolean} skipExisting - Don't create if class already exists
 */
async function generateSchedule(startDate, endDate, skipExisting = true) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    // Get active templates
    const templates = await client.query(`
      SELECT 
        t.id, t.class_type_id, t.teacher_id, t.location_id,
        t.day_of_week, t.start_time, t.capacity,
        ct.duration, ct.default_capacity
      FROM class_schedule_templates t
      JOIN class_types ct ON t.class_type_id = ct.id
      WHERE t.is_active = true
        AND (t.valid_from IS NULL OR t.valid_from <= $2)
        AND (t.valid_until IS NULL OR t.valid_until >= $1)
    `, [startDate, endDate]);

    let created = 0;
    let skipped = 0;

    // Iterate through each day in range
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday
      const dateStr = currentDate.toISOString().split('T')[0];

      // Find templates for this day
      const dayTemplates = templates.rows.filter(t => t.day_of_week === dayOfWeek);

      for (const template of dayTemplates) {
        // Check if class already exists
        if (skipExisting) {
          const existing = await client.query(`
            SELECT id FROM classes 
            WHERE class_type_id = $1 AND location_id = $2 AND date = $3 AND start_time = $4
          `, [template.class_type_id, template.location_id, dateStr, template.start_time]);

          if (existing.rows.length > 0) {
            skipped++;
            continue;
          }
        }

        // Calculate end time
        const [hours, minutes] = template.start_time.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + template.duration;
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

        // Create class instance
        await client.query(`
          INSERT INTO classes (class_type_id, teacher_id, location_id, template_id, date, start_time, end_time, capacity)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          template.class_type_id,
          template.teacher_id,
          template.location_id,
          template.id,
          dateStr,
          template.start_time,
          endTime,
          template.capacity || template.default_capacity
        ]);

        created++;
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    await client.query('COMMIT');

    return { created, skipped };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate schedule for the next N weeks
 */
async function generateWeeksAhead(weeks = 2) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (weeks * 7));
  
  return generateSchedule(startDate, endDate);
}

module.exports = {
  generateSchedule,
  generateWeeksAhead,
};
