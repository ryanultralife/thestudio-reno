// ============================================
// THEME CUSTOMIZATION ROUTES
// White-labeling and branding for SaaS
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');

// Get current theme settings
router.get('/current', async (req, res, next) => {
  try {
    // For now, get default theme (studio_id = NULL)
    // In multi-tenant mode, would get based on req.studio_id
    const result = await pool.query(
      'SELECT * FROM active_theme_settings LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({
        // Return default theme if none exists
        studio_name: 'The Studio',
        primary_color: '#d97706',
        primary_hover: '#b45309',
        secondary_color: '#ea580c',
        accent_color: '#f59e0b',
        // ... other defaults
      });
    }

    res.json({ theme: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Get theme as CSS
router.get('/css', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT get_theme_css() as css');
    res.setHeader('Content-Type', 'text/css');
    res.send(result.rows[0].css);
  } catch (err) {
    next(err);
  }
});

// Get available theme presets
router.get('/presets', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM theme_presets ORDER BY name'
    );
    res.json({ presets: result.rows });
  } catch (err) {
    next(err);
  }
});

// Update theme settings (admin only)
router.put('/settings', authenticate, requirePermission('manage_settings'), async (req, res, next) => {
  try {
    const {
      studio_name,
      logo_url,
      favicon_url,
      primary_color,
      primary_hover,
      secondary_color,
      accent_color,
      text_primary,
      text_secondary,
      bg_primary,
      bg_secondary,
      bg_accent,
      font_heading,
      font_body,
      layout_style,
      border_radius,
      hero_image_url,
      hero_title,
      hero_subtitle,
      custom_css,
      instagram_url,
      facebook_url,
      twitter_url,
      contact_email,
      contact_phone,
      contact_address,
      hours_of_operation,
      show_retail_shop,
      show_teacher_rentals,
      show_tea_lounge,
      enable_dark_mode
    } = req.body;

    // Update or insert theme settings
    const result = await pool.query(
      `INSERT INTO theme_settings (
        studio_id, studio_name, logo_url, favicon_url,
        primary_color, primary_hover, secondary_color, accent_color,
        text_primary, text_secondary, bg_primary, bg_secondary, bg_accent,
        font_heading, font_body, layout_style, border_radius,
        hero_image_url, hero_title, hero_subtitle, custom_css,
        instagram_url, facebook_url, twitter_url,
        contact_email, contact_phone, contact_address,
        hours_of_operation,
        show_retail_shop, show_teacher_rentals, show_tea_lounge, enable_dark_mode
      ) VALUES (
        NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31
      )
      ON CONFLICT (studio_id)
      DO UPDATE SET
        studio_name = EXCLUDED.studio_name,
        logo_url = EXCLUDED.logo_url,
        favicon_url = EXCLUDED.favicon_url,
        primary_color = EXCLUDED.primary_color,
        primary_hover = EXCLUDED.primary_hover,
        secondary_color = EXCLUDED.secondary_color,
        accent_color = EXCLUDED.accent_color,
        text_primary = EXCLUDED.text_primary,
        text_secondary = EXCLUDED.text_secondary,
        bg_primary = EXCLUDED.bg_primary,
        bg_secondary = EXCLUDED.bg_secondary,
        bg_accent = EXCLUDED.bg_accent,
        font_heading = EXCLUDED.font_heading,
        font_body = EXCLUDED.font_body,
        layout_style = EXCLUDED.layout_style,
        border_radius = EXCLUDED.border_radius,
        hero_image_url = EXCLUDED.hero_image_url,
        hero_title = EXCLUDED.hero_title,
        hero_subtitle = EXCLUDED.hero_subtitle,
        custom_css = EXCLUDED.custom_css,
        instagram_url = EXCLUDED.instagram_url,
        facebook_url = EXCLUDED.facebook_url,
        twitter_url = EXCLUDED.twitter_url,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone,
        contact_address = EXCLUDED.contact_address,
        hours_of_operation = EXCLUDED.hours_of_operation,
        show_retail_shop = EXCLUDED.show_retail_shop,
        show_teacher_rentals = EXCLUDED.show_teacher_rentals,
        show_tea_lounge = EXCLUDED.show_tea_lounge,
        enable_dark_mode = EXCLUDED.enable_dark_mode,
        updated_at = NOW()
      RETURNING *`,
      [
        studio_name, logo_url, favicon_url,
        primary_color, primary_hover, secondary_color, accent_color,
        text_primary, text_secondary, bg_primary, bg_secondary, bg_accent,
        font_heading, font_body, layout_style, border_radius,
        hero_image_url, hero_title, hero_subtitle, custom_css,
        instagram_url, facebook_url, twitter_url,
        contact_email, contact_phone, contact_address,
        hours_of_operation ? JSON.stringify(hours_of_operation) : null,
        show_retail_shop, show_teacher_rentals, show_tea_lounge, enable_dark_mode
      ]
    );

    res.json({
      message: 'Theme updated successfully',
      theme: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// Apply a preset theme
router.post('/apply-preset/:presetName', authenticate, requirePermission('manage_settings'), async (req, res, next) => {
  try {
    const { presetName } = req.params;

    // Get preset
    const presetResult = await pool.query(
      'SELECT * FROM theme_presets WHERE name = $1',
      [presetName]
    );

    if (presetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const preset = presetResult.rows[0];

    // Apply preset to theme settings
    const result = await pool.query(
      `INSERT INTO theme_settings (
        studio_id, primary_color, primary_hover, secondary_color, accent_color, bg_accent
      ) VALUES (NULL, $1, $2, $3, $4, $5)
      ON CONFLICT (studio_id)
      DO UPDATE SET
        primary_color = EXCLUDED.primary_color,
        primary_hover = EXCLUDED.primary_hover,
        secondary_color = EXCLUDED.secondary_color,
        accent_color = EXCLUDED.accent_color,
        bg_accent = EXCLUDED.bg_accent,
        updated_at = NOW()
      RETURNING *`,
      [preset.primary_color, preset.primary_hover, preset.secondary_color, preset.accent_color, preset.bg_accent]
    );

    res.json({
      message: `Applied ${presetName} theme`,
      theme: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// Reset to default theme
router.post('/reset', authenticate, requirePermission('manage_settings'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM theme_settings WHERE studio_id IS NULL');

    res.json({ message: 'Theme reset to defaults' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
