-- ============================================
-- THE STUDIO RENO - RETAIL & INVENTORY SCHEMA
-- Future-proofed for wholesale/white-label
-- ============================================

-- ============================================
-- PRODUCT CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  
  -- Pricing
  cost_price DECIMAL(10,2),              -- What we pay
  retail_price DECIMAL(10,2) NOT NULL,   -- In-studio price
  online_price DECIMAL(10,2),            -- Website price (if different)
  wholesale_price DECIMAL(10,2),         -- B2B price (Phase 3)
  
  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Product type for future wholesale
  product_type VARCHAR(50) DEFAULT 'retail', -- retail, wholesale, both
  is_customizable BOOLEAN DEFAULT false,     -- Can add custom logo?
  base_product_id UUID REFERENCES products(id), -- For variants
  
  -- Media
  image_url TEXT,
  images JSONB DEFAULT '[]',
  
  -- Metadata
  brand VARCHAR(100) DEFAULT 'The Studio',
  vendor VARCHAR(100),
  tags TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  available_online BOOLEAN DEFAULT true,
  available_instore BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT VARIANTS (Size/Color combos)
-- ============================================

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),                     -- e.g., "Small / Black"
  
  -- Options
  size VARCHAR(20),
  color VARCHAR(50),
  color_hex VARCHAR(7),                  -- For UI display
  
  -- Pricing (override product price if set)
  retail_price DECIMAL(10,2),
  wholesale_price DECIMAL(10,2),
  
  -- Inventory
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,   -- In carts, pending orders
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVENTORY TRANSACTIONS (Stock movements)
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  
  -- Transaction type
  transaction_type VARCHAR(30) NOT NULL, -- purchase, sale, adjustment, return, transfer, shrinkage
  
  -- Quantities
  quantity INTEGER NOT NULL,             -- Positive for in, negative for out
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  
  -- Reference
  reference_type VARCHAR(30),            -- order, purchase_order, adjustment
  reference_id UUID,
  
  -- Details
  unit_cost DECIMAL(10,2),
  notes TEXT,
  
  -- Who/when
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RETAIL ORDERS (Online + In-store)
-- ============================================

CREATE TABLE IF NOT EXISTS retail_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE NOT NULL,
  
  -- Customer (can be guest for online)
  user_id UUID REFERENCES users(id),
  customer_email VARCHAR(255),
  customer_name VARCHAR(200),
  customer_phone VARCHAR(30),
  
  -- Order type
  order_type VARCHAR(20) DEFAULT 'in_store', -- in_store, online, wholesale
  order_source VARCHAR(50) DEFAULT 'pos',     -- pos, website, wholesale_portal
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending',       -- pending, paid, processing, shipped, delivered, cancelled, refunded
  payment_status VARCHAR(30) DEFAULT 'pending', -- pending, paid, partial, refunded
  fulfillment_status VARCHAR(30) DEFAULT 'unfulfilled', -- unfulfilled, partial, fulfilled
  
  -- Totals
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Discount
  discount_code VARCHAR(50),
  discount_id UUID REFERENCES discounts(id),
  
  -- Payment
  payment_method VARCHAR(30),
  stripe_payment_intent_id VARCHAR(255),
  paid_at TIMESTAMPTZ,
  
  -- Shipping (for online orders)
  shipping_address JSONB,
  shipping_method VARCHAR(50),
  tracking_number VARCHAR(100),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Staff
  staff_id UUID REFERENCES users(id),        -- Who processed the sale
  location_id UUID REFERENCES locations(id), -- Which studio
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RETAIL ORDER ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS retail_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES retail_orders(id) ON DELETE CASCADE,
  
  -- Product
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  
  -- Snapshot (in case product changes)
  product_name VARCHAR(200) NOT NULL,
  variant_name VARCHAR(200),
  sku VARCHAR(50),
  
  -- Quantities
  quantity INTEGER NOT NULL DEFAULT 1,
  quantity_fulfilled INTEGER DEFAULT 0,
  
  -- Pricing
  unit_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- For customizable products (wholesale)
  customization JSONB,                   -- {logo_url, placement, color, etc.}
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCOUNTS / PROMO CODES
-- ============================================

CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  
  -- Type
  discount_type VARCHAR(20) NOT NULL,    -- percentage, fixed_amount, free_shipping
  discount_value DECIMAL(10,2) NOT NULL,
  
  -- Scope
  applies_to VARCHAR(30) DEFAULT 'all',  -- all, specific_products, specific_categories
  product_ids UUID[],
  category_ids UUID[],
  
  -- Limits
  minimum_purchase DECIMAL(10,2),
  maximum_discount DECIMAL(10,2),
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  one_per_customer BOOLEAN DEFAULT true,
  
  -- Validity
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Wholesale only?
  wholesale_only BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WHOLESALE ACCOUNTS (Phase 3 prep)
-- ============================================

CREATE TABLE IF NOT EXISTS wholesale_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  -- Business info
  business_name VARCHAR(200) NOT NULL,
  business_type VARCHAR(50),             -- yoga_studio, gym, retail_store, brand
  tax_id VARCHAR(50),
  website VARCHAR(255),
  
  -- Contact
  contact_name VARCHAR(200),
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(30),
  
  -- Address
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Pricing tier
  pricing_tier VARCHAR(30) DEFAULT 'standard', -- standard, premium, vip
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Credit
  credit_limit DECIMAL(10,2) DEFAULT 0,
  credit_balance DECIMAL(10,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 0,       -- Net days (0 = prepay)
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending',  -- pending, approved, suspended
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUPPLIERS / VENDORS (for your supply chain)
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(30),
  website VARCHAR(255),
  
  -- Address
  address JSONB,
  
  -- Terms
  payment_terms INTEGER DEFAULT 30,
  minimum_order DECIMAL(10,2),
  lead_time_days INTEGER,
  
  -- Capabilities
  services TEXT[],                       -- screen_print, dtg, embroidery, etc.
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PURCHASE ORDERS (Restocking)
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(20) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  
  -- Status
  status VARCHAR(30) DEFAULT 'draft',    -- draft, submitted, confirmed, partial, received, cancelled
  
  -- Totals
  subtotal DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Dates
  order_date TIMESTAMPTZ,
  expected_date TIMESTAMPTZ,
  received_date TIMESTAMPTZ,
  
  -- Shipping
  shipping_method VARCHAR(100),
  tracking_number VARCHAR(100),
  
  notes TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  
  -- Details
  description VARCHAR(255),
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_inventory_variant ON inventory_transactions(variant_id);
CREATE INDEX idx_orders_user ON retail_orders(user_id);
CREATE INDEX idx_orders_status ON retail_orders(status);
CREATE INDEX idx_orders_date ON retail_orders(created_at);
CREATE INDEX idx_order_items_order ON retail_order_items(order_id);
CREATE INDEX idx_wholesale_status ON wholesale_accounts(status);

-- ============================================
-- SEED DATA - PRODUCT CATEGORIES
-- ============================================

INSERT INTO product_categories (name, slug, description, sort_order) VALUES
('Apparel', 'apparel', 'Yoga and athleisure clothing', 1),
('Tops', 'tops', 'Tanks, tees, and long sleeves', 2),
('Bottoms', 'bottoms', 'Leggings, shorts, and joggers', 3),
('Outerwear', 'outerwear', 'Hoodies, jackets, and wraps', 4),
('Accessories', 'accessories', 'Mats, towels, bags, and more', 5),
('Equipment', 'equipment', 'Yoga props and equipment', 6);

-- Link subcategories
UPDATE product_categories SET parent_id = (SELECT id FROM product_categories WHERE slug = 'apparel') WHERE slug IN ('tops', 'bottoms', 'outerwear');

-- ============================================
-- SEED DATA - SAMPLE PRODUCTS
-- ============================================

INSERT INTO products (sku, name, slug, description, category_id, cost_price, retail_price, wholesale_price, product_type, is_customizable, brand, tags) VALUES
-- Studio branded
('TSR-TANK-001', 'The Studio Flow Tank', 'studio-flow-tank', 'Lightweight, breathable tank perfect for hot yoga. Features our signature logo.', (SELECT id FROM product_categories WHERE slug = 'tops'), 8.00, 32.00, 18.00, 'both', false, 'The Studio', ARRAY['bestseller', 'yoga', 'tank']),
('TSR-LEG-001', 'The Studio High-Rise Legging', 'studio-high-rise-legging', 'Buttery soft high-rise leggings with hidden pocket. 4-way stretch.', (SELECT id FROM product_categories WHERE slug = 'bottoms'), 12.00, 68.00, 35.00, 'both', false, 'The Studio', ARRAY['bestseller', 'yoga', 'legging']),
('TSR-HOOD-001', 'The Studio Zip Hoodie', 'studio-zip-hoodie', 'Cozy zip-up hoodie for before and after class.', (SELECT id FROM product_categories WHERE slug = 'outerwear'), 15.00, 58.00, 32.00, 'both', false, 'The Studio', ARRAY['hoodie', 'warmup']),
-- Customizable blanks for wholesale
('BLK-TANK-001', 'Blank Flow Tank', 'blank-flow-tank', 'Premium blank tank ready for your custom logo.', (SELECT id FROM product_categories WHERE slug = 'tops'), 6.00, 24.00, 12.00, 'wholesale', true, 'The Studio Supply', ARRAY['blank', 'customizable']),
('BLK-LEG-001', 'Blank High-Rise Legging', 'blank-high-rise-legging', 'Premium blank legging ready for your custom branding.', (SELECT id FROM product_categories WHERE slug = 'bottoms'), 10.00, 48.00, 24.00, 'wholesale', true, 'The Studio Supply', ARRAY['blank', 'customizable']),
-- Accessories
('TSR-MAT-001', 'The Studio Yoga Mat', 'studio-yoga-mat', '5mm eco-friendly yoga mat with alignment lines.', (SELECT id FROM product_categories WHERE slug = 'equipment'), 18.00, 68.00, 38.00, 'retail', false, 'The Studio', ARRAY['mat', 'eco']),
('TSR-TWL-001', 'Hot Yoga Towel', 'hot-yoga-towel', 'Microfiber towel with grip dots. Mat-sized.', (SELECT id FROM product_categories WHERE slug = 'accessories'), 8.00, 28.00, 16.00, 'both', false, 'The Studio', ARRAY['towel', 'hot yoga']),
('TSR-BAG-001', 'The Studio Tote', 'studio-tote', 'Canvas tote for your yoga gear.', (SELECT id FROM product_categories WHERE slug = 'accessories'), 5.00, 22.00, 12.00, 'both', true, 'The Studio', ARRAY['bag', 'tote']);

-- ============================================
-- SEED DATA - PRODUCT VARIANTS
-- ============================================

-- Flow Tank variants
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand) 
SELECT p.id, CONCAT('TSR-TANK-001-', s.size, '-', c.color_code), CONCAT(s.size, ' / ', c.color_name), s.size, c.color_name, c.color_hex, 10
FROM products p
CROSS JOIN (VALUES ('XS'), ('S'), ('M'), ('L'), ('XL')) AS s(size)
CROSS JOIN (VALUES ('BLK', 'Black', '#000000'), ('WHT', 'White', '#FFFFFF'), ('NVY', 'Navy', '#1e3a5f')) AS c(color_code, color_name, color_hex)
WHERE p.sku = 'TSR-TANK-001';

-- Legging variants
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand) 
SELECT p.id, CONCAT('TSR-LEG-001-', s.size, '-', c.color_code), CONCAT(s.size, ' / ', c.color_name), s.size, c.color_name, c.color_hex, 8
FROM products p
CROSS JOIN (VALUES ('XS'), ('S'), ('M'), ('L'), ('XL')) AS s(size)
CROSS JOIN (VALUES ('BLK', 'Black', '#000000'), ('CHAR', 'Charcoal', '#36454F'), ('WINE', 'Wine', '#722F37')) AS c(color_code, color_name, color_hex)
WHERE p.sku = 'TSR-LEG-001';

-- Hoodie variants
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand) 
SELECT p.id, CONCAT('TSR-HOOD-001-', s.size, '-', c.color_code), CONCAT(s.size, ' / ', c.color_name), s.size, c.color_name, c.color_hex, 6
FROM products p
CROSS JOIN (VALUES ('XS'), ('S'), ('M'), ('L'), ('XL'), ('2XL')) AS s(size)
CROSS JOIN (VALUES ('BLK', 'Black', '#000000'), ('HTH', 'Heather Grey', '#9CA3AF')) AS c(color_code, color_name, color_hex)
WHERE p.sku = 'TSR-HOOD-001';

-- Single variant products (mats, towels, bags)
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand)
SELECT id, CONCAT(sku, '-STD'), 'Standard', NULL, 'Sage', '#9CAF88', 15 FROM products WHERE sku = 'TSR-MAT-001';

INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand)
SELECT id, CONCAT(sku, '-STD'), 'Standard', NULL, 'Charcoal', '#36454F', 20 FROM products WHERE sku = 'TSR-TWL-001';

INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand)
SELECT id, CONCAT(sku, '-STD'), 'Standard', NULL, 'Natural', '#F5F5DC', 12 FROM products WHERE sku = 'TSR-BAG-001';

-- ============================================
-- SAMPLE DISCOUNT CODES
-- ============================================

INSERT INTO discounts (code, description, discount_type, discount_value, minimum_purchase, expires_at) VALUES
('WELCOME10', 'Welcome discount - 10% off first purchase', 'percentage', 10.00, 25.00, NOW() + INTERVAL '1 year'),
('MEMBER15', 'Member discount - 15% off retail', 'percentage', 15.00, NULL, NULL),
('FREESHIP50', 'Free shipping on orders $50+', 'free_shipping', 0, 50.00, NOW() + INTERVAL '6 months');

-- ============================================
-- RETAIL PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, category) VALUES
-- Retail/Inventory permissions
('view_products', 'View product catalog', 'retail'),
('manage_products', 'Create and edit products', 'retail'),
('manage_inventory', 'Adjust inventory levels', 'retail'),
('view_retail_orders', 'View retail orders', 'retail'),
('manage_retail_orders', 'Process retail orders', 'retail'),
('manage_discounts', 'Create and manage discount codes', 'retail'),
-- Wholesale permissions (Phase 3)
('view_wholesale', 'Access wholesale portal', 'wholesale'),
('manage_wholesale_accounts', 'Approve wholesale accounts', 'wholesale'),
('view_wholesale_pricing', 'View wholesale pricing', 'wholesale')
ON CONFLICT (name) DO NOTHING;

-- Grant retail permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'front_desk', id FROM permissions WHERE name IN ('view_products', 'manage_retail_orders', 'view_retail_orders')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN ('view_products', 'manage_products', 'manage_inventory', 'view_retail_orders', 'manage_retail_orders', 'manage_discounts')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE name IN ('view_products', 'manage_products', 'manage_inventory', 'view_retail_orders', 'manage_retail_orders', 'manage_discounts', 'view_wholesale', 'manage_wholesale_accounts', 'view_wholesale_pricing')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE category IN ('retail', 'wholesale')
ON CONFLICT DO NOTHING;
