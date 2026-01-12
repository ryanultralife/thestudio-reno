-- ============================================
-- THE STUDIO RENO - CMS & SETTINGS SCHEMA
-- Content management for public website
-- ============================================

-- ============================================
-- SITE SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- ============================================
-- LOCATIONS (Multi-location support)
-- ============================================

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100) DEFAULT 'Reno',
  state VARCHAR(50) DEFAULT 'NV',
  zip VARCHAR(20),
  phone VARCHAR(30),
  email VARCHAR(255),
  
  -- Display
  description TEXT,
  image_url TEXT,
  images JSONB DEFAULT '[]',
  
  -- Hours
  hours JSONB DEFAULT '{}',
  
  -- Features
  has_tea_lounge BOOLEAN DEFAULT false,
  has_retail BOOLEAN DEFAULT false,
  
  -- Maps
  google_maps_url TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDIA LIBRARY
-- ============================================

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  mime_type VARCHAR(100),
  file_size INTEGER,
  
  -- URLs (Cloudinary or local)
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Metadata
  alt_text VARCHAR(255),
  caption TEXT,
  
  -- Organization
  folder VARCHAR(100) DEFAULT 'general',
  tags TEXT[],
  
  -- Cloudinary specific
  cloudinary_public_id VARCHAR(255),
  
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAGE CONTENT BLOCKS
-- ============================================

CREATE TABLE IF NOT EXISTS content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location
  page VARCHAR(50) NOT NULL,           -- home, about, tea-lounge, etc.
  section VARCHAR(50) NOT NULL,        -- hero, intro, features, etc.
  
  -- Content
  title TEXT,
  subtitle TEXT,
  body TEXT,
  
  -- Media
  image_id UUID REFERENCES media(id),
  image_url TEXT,                      -- Direct URL fallback
  background_image_url TEXT,
  video_url TEXT,
  
  -- Button/CTA
  button_text VARCHAR(100),
  button_url TEXT,
  button_style VARCHAR(30) DEFAULT 'primary',
  
  -- Layout
  layout VARCHAR(30) DEFAULT 'default', -- default, split, full-width, cards
  alignment VARCHAR(20) DEFAULT 'center',
  
  -- Styling
  background_color VARCHAR(20),
  text_color VARCHAR(20),
  custom_classes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- ============================================
-- WORKSHOPS & EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  
  -- Timing
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,               -- iCal RRULE format
  
  -- Location
  location_id UUID REFERENCES locations(id),
  location_name VARCHAR(200),          -- For external venues
  
  -- Pricing
  price DECIMAL(10,2),
  member_price DECIMAL(10,2),
  early_bird_price DECIMAL(10,2),
  early_bird_deadline DATE,
  
  -- Capacity
  capacity INTEGER,
  registered_count INTEGER DEFAULT 0,
  waitlist_enabled BOOLEAN DEFAULT true,
  
  -- Media
  image_url TEXT,
  images JSONB DEFAULT '[]',
  
  -- Instructor
  instructor_id UUID REFERENCES users(id),
  instructor_name VARCHAR(200),
  
  -- Registration
  registration_url TEXT,               -- External link if needed
  registration_open BOOLEAN DEFAULT true,
  
  -- Categorization
  event_type VARCHAR(50),              -- workshop, sound_bath, training, party, etc.
  tags TEXT[],
  
  -- Status
  status VARCHAR(30) DEFAULT 'published', -- draft, published, cancelled
  is_featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EVENT REGISTRATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID REFERENCES users(id),
  
  -- Contact info (for guests)
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(30),
  
  -- Registration
  quantity INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'confirmed', -- confirmed, cancelled, waitlist
  
  -- Payment
  amount_paid DECIMAL(10,2),
  payment_method VARCHAR(30),
  transaction_id UUID,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BLOG POSTS
-- ============================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT,
  
  -- Media
  featured_image_url TEXT,
  
  -- Author
  author_id UUID REFERENCES users(id),
  author_name VARCHAR(200),
  
  -- Categorization
  category VARCHAR(50),
  tags TEXT[],
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  
  -- Status
  status VARCHAR(30) DEFAULT 'draft',   -- draft, published, archived
  published_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEACHER PROFILES (extended)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialties TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- ============================================
-- TESTIMONIALS
-- ============================================

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  quote TEXT NOT NULL,
  author_name VARCHAR(100),
  author_title VARCHAR(100),          -- e.g., "Member since 2020"
  author_photo_url TEXT,
  
  -- Rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  
  -- Display
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- Source
  source VARCHAR(50),                  -- google, yelp, direct, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Preferences
  subscribed_lists TEXT[] DEFAULT ARRAY['general'],
  
  -- Status
  status VARCHAR(30) DEFAULT 'active',  -- active, unsubscribed, bounced
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  
  -- Source
  source VARCHAR(50) DEFAULT 'website', -- website, checkout, event, import
  
  -- SMS
  phone VARCHAR(30),
  sms_opt_in BOOLEAN DEFAULT false,
  sms_opt_in_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_media_folder ON media(folder);
CREATE INDEX idx_content_page ON content_blocks(page, section);
CREATE INDEX idx_events_date ON events(start_date);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_blog_status ON blog_posts(status, published_at);
CREATE INDEX idx_newsletter_status ON newsletter_subscribers(status);

-- ============================================
-- SEED: LOCATIONS
-- ============================================

INSERT INTO locations (name, slug, address_line1, city, state, zip, phone, email, description, has_tea_lounge, google_maps_url, sort_order) VALUES
('The Studio - Original', 'south-virginia', '1085 S Virginia St', 'Reno', 'NV', '89502', '(775) 284-5545', 'thestudioreno@gmail.com', 'Our original location featuring the Tea & Elixir Lounge', true, 'https://www.google.com/maps/place/The+Studio+Reno/@39.513131,-119.807137,15z', 1),
('The Studio - Moran', 'moran-street', '600 S Virginia St', 'Reno', 'NV', '89501', '(775) 284-5545', 'thestudioreno@gmail.com', 'Our second location with entrance on Moran Street', false, 'https://goo.gl/maps/WZ4tESMspe1mdMm66', 2);

-- ============================================
-- SEED: SITE SETTINGS
-- ============================================

INSERT INTO site_settings (key, value) VALUES
('branding', '{
  "logo_url": "https://thestudioreno.com/wp-content/uploads/2025/06/400-the-studio.png",
  "tagline": "Your Conscious Community Center",
  "mission": "Our mission is to create a safe place where people can come to share their gifts, connect with other like-minded people, and grow their practice.",
  "footer_text": "namasté"
}'),
('colors', '{
  "primary": "#8B7355",
  "secondary": "#D4C5B5", 
  "accent": "#C9A86C",
  "dark": "#3D3D3D",
  "light": "#FAF8F5"
}'),
('fonts', '{
  "heading": "Cormorant Garamond",
  "body": "Lato",
  "accent": "Sacramento"
}'),
('social', '{
  "instagram": "thestudioreno",
  "facebook": "thestudioreno",
  "email": "thestudioreno@gmail.com"
}'),
('tea_lounge', '{
  "enabled": true,
  "name": "Tea & Elixir Lounge",
  "tagline": "Renos only late night Tea and Elixir Lounge",
  "hours": [
    {"day": "Wednesday", "open": "8:00 PM", "close": "1:00 AM"},
    {"day": "Friday", "open": "8:00 PM", "close": "1:00 AM"}
  ]
}'),
('intro_offer', '{
  "enabled": true,
  "title": "New Student Special",
  "description": "First month for $40",
  "price": 40,
  "duration_days": 30
}');

-- ============================================
-- SEED: HOMEPAGE CONTENT BLOCKS
-- ============================================

INSERT INTO content_blocks (page, section, title, subtitle, body, button_text, button_url, sort_order) VALUES
('home', 'hero', 'Welcome to The Studio', 'Your Conscious Community Center', 'A place to nurture minds, bodies & spirits.', 'View Schedule', '/schedule', 1),
('home', 'intro', 'Enliven & Enlighten', NULL, 'The atmosphere at The Studio is relaxing, comfortable, and inviting. It is our priority to make your experience enjoyable and revitalizing. We have made it easy to find your source of health and wellness, whether you are ready to make yoga a part of your life, or have been practicing for years!', 'About Us', '/about', 2),
('home', 'new-student', 'New to The Studio?', 'First yoga class? We have got you covered.', 'New students enjoy our Intro month for $40', 'Get Started', '/pricing', 3),
('home', 'tea-lounge', 'Tea & Elixir Lounge', 'Renos only late night Tea and Elixir Lounge', 'Offering specialty teas, elixirs, and community. Open Wednesdays and Fridays 8pm-1am.', 'Learn More', '/tea-lounge', 4),
('home', 'community', 'Find Your Community', NULL, 'Join The Studio and connect with like-minded people on a journey of growth and wellness.', 'Join Now', '/pricing', 5);

-- ============================================
-- SEED: SAMPLE EVENTS
-- ============================================

INSERT INTO events (title, slug, description, short_description, start_date, start_time, end_time, price, capacity, event_type, is_featured, status) VALUES
('First Friday Sound Meditation', 'first-friday-sound-jan', 'Experience somatic grounding to ease you into the sound meditation, allowing your body to soften, your breath to deepen, and your whole system to receive the full restorative effect of the planetary gongs.', 'Start the new year with a powerful and grounding experience.', '2025-01-03', '19:00', '20:30', 40.00, 30, 'sound_bath', true, 'published'),
('Winter Solstice Sound Immersion', 'winter-solstice-2024', 'Celebrate the Solstice with a beautifully curated evening of intention, breath, and sound. Featuring tea, breath work and sound.', 'Celebrate the Solstice with intention, breath, and sound.', '2024-12-21', '19:30', '21:00', 55.00, 25, 'sound_bath', true, 'published');

-- ============================================
-- CMS PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, category) VALUES
('manage_content', 'Edit website content blocks', 'cms'),
('manage_media', 'Upload and manage media files', 'cms'),
('manage_events', 'Create and manage events/workshops', 'cms'),
('manage_blog', 'Create and manage blog posts', 'cms'),
('manage_settings', 'Edit site settings and branding', 'cms'),
('manage_locations', 'Manage studio locations', 'cms')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE category = 'cms'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE category = 'cms'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN ('manage_content', 'manage_media', 'manage_events', 'manage_blog')
ON CONFLICT DO NOTHING;

-- ============================================
-- DISPLAY BOARD / DIGITAL SIGNAGE
-- ============================================

CREATE TABLE IF NOT EXISTS display_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title VARCHAR(255),
  subtitle TEXT,
  body TEXT,
  
  -- Media
  image_url TEXT,
  background_url TEXT,
  video_url TEXT,
  
  -- Styling
  layout VARCHAR(30) DEFAULT 'centered',  -- centered, split, full-image
  text_color VARCHAR(20) DEFAULT 'white',
  overlay_opacity DECIMAL(3,2) DEFAULT 0.5,
  
  -- Scheduling
  start_date DATE,
  end_date DATE,
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sun, 6=Sat
  start_time TIME,
  end_time TIME,
  
  -- Display settings
  duration_seconds INTEGER DEFAULT 15,
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  slide_type VARCHAR(30) DEFAULT 'promo',  -- promo, announcement, event, custom
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Display settings
INSERT INTO site_settings (key, value) VALUES
('display', '{
  "enabled": true,
  "show_schedule": true,
  "show_events": true,
  "show_promos": true,
  "schedule_slide_duration": 15,
  "promo_slide_duration": 10,
  "refresh_interval": 300,
  "theme": "dark"
}')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX idx_display_slides_active ON display_slides(is_active, start_date, end_date);
