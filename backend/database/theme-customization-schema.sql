-- ============================================
-- THEME CUSTOMIZATION FOR SAAS/WHITE-LABELING
-- Allows each studio to customize branding and appearance
-- ============================================

-- Create studios table first (for multi-tenant support)
CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL, -- subdomain or path
  name VARCHAR(100) NOT NULL,
  owner_id UUID REFERENCES users(id),
  subscription_tier VARCHAR(20) DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled')),
  custom_domain VARCHAR(100) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE studios IS
'Multi-tenant studio management. Each studio gets its own subdomain/custom domain and theme customization.
For single-tenant deployments, there will be just one studio record.';

-- Theme settings table (for multi-tenant SaaS)
CREATE TABLE IF NOT EXISTS theme_settings (
  id SERIAL PRIMARY KEY,

  -- Multi-tenant support (null = default theme)
  studio_id UUID REFERENCES studios(id) ON DELETE CASCADE,

  -- Branding
  studio_name VARCHAR(100) DEFAULT 'The Studio',
  logo_url TEXT,
  favicon_url TEXT,

  -- Color Scheme (CSS color values)
  primary_color VARCHAR(20) DEFAULT '#d97706', -- amber-600
  primary_hover VARCHAR(20) DEFAULT '#b45309', -- amber-700
  secondary_color VARCHAR(20) DEFAULT '#ea580c', -- orange-600
  accent_color VARCHAR(20) DEFAULT '#f59e0b', -- amber-500

  -- Text Colors
  text_primary VARCHAR(20) DEFAULT '#111827', -- gray-900
  text_secondary VARCHAR(20) DEFAULT '#6b7280', -- gray-500

  -- Background Colors
  bg_primary VARCHAR(20) DEFAULT '#ffffff',
  bg_secondary VARCHAR(20) DEFAULT '#f9fafb', -- gray-50
  bg_accent VARCHAR(20) DEFAULT '#fef3c7', -- amber-50

  -- Typography
  font_heading VARCHAR(100) DEFAULT 'system-ui, -apple-system, sans-serif',
  font_body VARCHAR(100) DEFAULT 'system-ui, -apple-system, sans-serif',

  -- Layout Options
  layout_style VARCHAR(20) DEFAULT 'modern' CHECK (layout_style IN ('modern', 'classic', 'minimal', 'bold')),
  border_radius VARCHAR(10) DEFAULT 'lg', -- sm, md, lg, xl, 2xl, full

  -- Public Website Settings
  hero_image_url TEXT,
  hero_title TEXT DEFAULT 'Find Your Balance',
  hero_subtitle TEXT DEFAULT 'Join our community and discover the transformative power of yoga',

  -- Custom CSS (advanced)
  custom_css TEXT,

  -- Social Media
  instagram_url TEXT,
  facebook_url TEXT,
  twitter_url TEXT,

  -- Contact Info
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_address TEXT,

  -- Business Hours
  hours_of_operation JSONB DEFAULT '{"monday": "6am-8pm", "tuesday": "6am-8pm", "wednesday": "6am-8pm", "thursday": "6am-8pm", "friday": "6am-8pm", "saturday": "8am-6pm", "sunday": "8am-6pm"}',

  -- Feature Flags
  show_retail_shop BOOLEAN DEFAULT false,
  show_teacher_rentals BOOLEAN DEFAULT false,
  show_tea_lounge BOOLEAN DEFAULT false,
  enable_dark_mode BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Only one theme per studio
  UNIQUE(studio_id)
);

COMMENT ON TABLE theme_settings IS
'Theme customization settings per studio. Allows white-labeling for SaaS.
Each studio can customize colors, fonts, logos, and layout to match their brand.';

-- Insert default theme
INSERT INTO theme_settings (studio_id, studio_name) VALUES (NULL, 'The Studio')
ON CONFLICT (studio_id) DO NOTHING;

-- Color presets for quick theming
CREATE TABLE IF NOT EXISTS theme_presets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  primary_color VARCHAR(20),
  primary_hover VARCHAR(20),
  secondary_color VARCHAR(20),
  accent_color VARCHAR(20),
  bg_accent VARCHAR(20),
  preview_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed some preset themes
INSERT INTO theme_presets (name, description, primary_color, primary_hover, secondary_color, accent_color, bg_accent, preview_image_url) VALUES
('Amber Warmth', 'Warm, welcoming amber tones (default)', '#d97706', '#b45309', '#ea580c', '#f59e0b', '#fef3c7', NULL),
('Ocean Blue', 'Calming blue like ocean waves', '#0ea5e9', '#0284c7', '#06b6d4', '#38bdf8', '#e0f2fe', NULL),
('Forest Green', 'Natural, grounding green tones', '#10b981', '#059669', '#14b8a6', '#34d399', '#d1fae5', NULL),
('Sunset Purple', 'Spiritual purple and violet', '#8b5cf6', '#7c3aed', '#a78bfa', '#c4b5fd', '#ede9fe', NULL),
('Rose Pink', 'Gentle, feminine pink', '#ec4899', '#db2777', '#f472b6', '#f9a8d4', '#fce7f3', NULL),
('Slate Minimal', 'Modern, minimalist gray', '#64748b', '#475569', '#94a3b8', '#cbd5e1', '#f1f5f9', NULL),
('Earth Terracotta', 'Earthy, warm terracotta', '#ea580c', '#c2410c', '#f97316', '#fb923c', '#fed7aa', NULL)
ON CONFLICT (name) DO NOTHING;

-- View for getting theme with fallback to defaults
CREATE OR REPLACE VIEW active_theme_settings AS
SELECT
  COALESCE(ts.id, 1) as id,
  ts.studio_id,
  COALESCE(ts.studio_name, 'The Studio') as studio_name,
  COALESCE(ts.logo_url, '') as logo_url,
  COALESCE(ts.favicon_url, '') as favicon_url,
  COALESCE(ts.primary_color, '#d97706') as primary_color,
  COALESCE(ts.primary_hover, '#b45309') as primary_hover,
  COALESCE(ts.secondary_color, '#ea580c') as secondary_color,
  COALESCE(ts.accent_color, '#f59e0b') as accent_color,
  COALESCE(ts.text_primary, '#111827') as text_primary,
  COALESCE(ts.text_secondary, '#6b7280') as text_secondary,
  COALESCE(ts.bg_primary, '#ffffff') as bg_primary,
  COALESCE(ts.bg_secondary, '#f9fafb') as bg_secondary,
  COALESCE(ts.bg_accent, '#fef3c7') as bg_accent,
  COALESCE(ts.font_heading, 'system-ui, -apple-system, sans-serif') as font_heading,
  COALESCE(ts.font_body, 'system-ui, -apple-system, sans-serif') as font_body,
  COALESCE(ts.layout_style, 'modern') as layout_style,
  COALESCE(ts.border_radius, 'lg') as border_radius,
  COALESCE(ts.hero_image_url, '') as hero_image_url,
  COALESCE(ts.hero_title, 'Find Your Balance') as hero_title,
  COALESCE(ts.hero_subtitle, 'Join our community and discover the transformative power of yoga') as hero_subtitle,
  COALESCE(ts.custom_css, '') as custom_css,
  COALESCE(ts.instagram_url, '') as instagram_url,
  COALESCE(ts.facebook_url, '') as facebook_url,
  COALESCE(ts.twitter_url, '') as twitter_url,
  COALESCE(ts.contact_email, '') as contact_email,
  COALESCE(ts.contact_phone, '') as contact_phone,
  COALESCE(ts.contact_address, '') as contact_address,
  COALESCE(ts.hours_of_operation, '{}') as hours_of_operation,
  COALESCE(ts.show_retail_shop, false) as show_retail_shop,
  COALESCE(ts.show_teacher_rentals, false) as show_teacher_rentals,
  COALESCE(ts.show_tea_lounge, false) as show_tea_lounge,
  COALESCE(ts.enable_dark_mode, false) as enable_dark_mode
FROM theme_settings ts
WHERE ts.studio_id IS NULL; -- Default theme

-- Function to generate CSS variables from theme
CREATE OR REPLACE FUNCTION get_theme_css(studio_id_param UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  theme RECORD;
  css_output TEXT;
BEGIN
  -- Get theme settings
  SELECT * INTO theme FROM theme_settings WHERE studio_id = studio_id_param OR (studio_id_param IS NULL AND studio_id IS NULL) LIMIT 1;

  -- Generate CSS custom properties
  css_output := ':root {
  --color-primary: ' || COALESCE(theme.primary_color, '#d97706') || ';
  --color-primary-hover: ' || COALESCE(theme.primary_hover, '#b45309') || ';
  --color-secondary: ' || COALESCE(theme.secondary_color, '#ea580c') || ';
  --color-accent: ' || COALESCE(theme.accent_color, '#f59e0b') || ';
  --color-text-primary: ' || COALESCE(theme.text_primary, '#111827') || ';
  --color-text-secondary: ' || COALESCE(theme.text_secondary, '#6b7280') || ';
  --color-bg-primary: ' || COALESCE(theme.bg_primary, '#ffffff') || ';
  --color-bg-secondary: ' || COALESCE(theme.bg_secondary, '#f9fafb') || ';
  --color-bg-accent: ' || COALESCE(theme.bg_accent, '#fef3c7') || ';
  --font-heading: ' || COALESCE(theme.font_heading, 'system-ui, -apple-system, sans-serif') || ';
  --font-body: ' || COALESCE(theme.font_body, 'system-ui, -apple-system, sans-serif') || ';
  --border-radius: ' ||
    CASE COALESCE(theme.border_radius, 'lg')
      WHEN 'sm' THEN '0.125rem'
      WHEN 'md' THEN '0.375rem'
      WHEN 'lg' THEN '0.5rem'
      WHEN 'xl' THEN '0.75rem'
      WHEN '2xl' THEN '1rem'
      WHEN 'full' THEN '9999px'
      ELSE '0.5rem'
    END || ';
}';

  RETURN css_output;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_theme_settings_studio_id ON theme_settings(studio_id);
CREATE INDEX IF NOT EXISTS idx_studios_slug ON studios(slug);
CREATE INDEX IF NOT EXISTS idx_studios_custom_domain ON studios(custom_domain);

-- Permissions
GRANT ALL ON theme_settings TO thestudio_admin;
GRANT ALL ON theme_presets TO thestudio_admin;
GRANT ALL ON studios TO thestudio_admin;
GRANT SELECT ON active_theme_settings TO thestudio_admin;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_theme_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER theme_settings_updated_at
BEFORE UPDATE ON theme_settings
FOR EACH ROW EXECUTE FUNCTION update_theme_updated_at();
