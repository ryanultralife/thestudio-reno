// ============================================
// RETAIL & PRODUCTS ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');
const { authenticate, requirePermission, optionalAuth } = require('../middleware/auth');

// ============================================
// PUBLIC - PRODUCT CATALOG
// ============================================

// Get all product categories
router.get('/categories', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, name, slug, description, parent_id, sort_order
      FROM product_categories
      WHERE is_active = true
      ORDER BY sort_order, name
    `);
    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get all products (public catalog)
router.get('/products', async (req, res, next) => {
  try {
    const { category, search, type, featured, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT p.*, 
        c.name as category_name, c.slug as category_slug,
        (SELECT json_agg(json_build_object(
          'id', v.id, 'sku', v.sku, 'name', v.name,
          'size', v.size, 'color', v.color, 'color_hex', v.color_hex,
          'retail_price', COALESCE(v.retail_price, p.retail_price),
          'quantity_available', v.quantity_available,
          'is_active', v.is_active
        )) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = true) as variants
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.is_active = true
        AND p.available_online = true
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (category) {
      paramCount++;
      query += ` AND (c.slug = $${paramCount} OR c.parent_id = (SELECT id FROM product_categories WHERE slug = $${paramCount}))`;
      params.push(category);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (type && type !== 'all') {
      paramCount++;
      query += ` AND (p.product_type = $${paramCount} OR p.product_type = 'both')`;
      params.push(type);
    } else {
      // Default to retail products for public
      query += ` AND (p.product_type = 'retail' OR p.product_type = 'both')`;
    }
    
    if (featured === 'true') {
      query += ` AND p.is_featured = true`;
    }
    
    query += ` ORDER BY p.is_featured DESC, p.created_at DESC`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.is_active = true AND p.available_online = true
    `;
    // Add same filters for count...
    
    res.json({ 
      products: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length // simplified
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get single product by slug
router.get('/products/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const result = await pool.query(`
      SELECT p.*, 
        c.name as category_name, c.slug as category_slug,
        (SELECT json_agg(json_build_object(
          'id', v.id, 'sku', v.sku, 'name', v.name,
          'size', v.size, 'color', v.color, 'color_hex', v.color_hex,
          'retail_price', COALESCE(v.retail_price, p.retail_price),
          'quantity_available', v.quantity_available,
          'is_active', v.is_active
        ) ORDER BY v.size, v.color) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = true) as variants
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.slug = $1 AND p.is_active = true
    `, [slug]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ product: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================
// POS - QUICK PRODUCT LOOKUP
// ============================================

// Search products for POS
router.get('/pos/search', authenticate, async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ products: [] });
    }
    
    const result = await pool.query(`
      SELECT p.id, p.sku, p.name, p.retail_price, p.image_url,
        (SELECT json_agg(json_build_object(
          'id', v.id, 'sku', v.sku, 'name', v.name,
          'size', v.size, 'color', v.color,
          'retail_price', COALESCE(v.retail_price, p.retail_price),
          'quantity_available', v.quantity_available
        )) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = true AND v.quantity_available > 0) as variants
      FROM products p
      WHERE p.is_active = true 
        AND p.available_instore = true
        AND (p.name ILIKE $1 OR p.sku ILIKE $1)
      ORDER BY p.name
      LIMIT 10
    `, [`%${q}%`]);
    
    res.json({ products: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get product by SKU/barcode for POS
router.get('/pos/sku/:sku', authenticate, async (req, res, next) => {
  try {
    const { sku } = req.params;
    
    // Try variant SKU first
    let result = await pool.query(`
      SELECT v.*, p.name as product_name, p.image_url,
        COALESCE(v.retail_price, p.retail_price) as price
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      WHERE v.sku = $1 AND v.is_active = true AND p.is_active = true
    `, [sku]);
    
    if (result.rows.length > 0) {
      return res.json({ item: result.rows[0], type: 'variant' });
    }
    
    // Try product SKU
    result = await pool.query(`
      SELECT p.*, 
        (SELECT json_agg(json_build_object(
          'id', v.id, 'sku', v.sku, 'name', v.name,
          'size', v.size, 'color', v.color,
          'retail_price', COALESCE(v.retail_price, p.retail_price),
          'quantity_available', v.quantity_available
        )) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = true) as variants
      FROM products p
      WHERE p.sku = $1 AND p.is_active = true
    `, [sku]);
    
    if (result.rows.length > 0) {
      return res.json({ item: result.rows[0], type: 'product' });
    }
    
    res.status(404).json({ error: 'Product not found' });
  } catch (err) {
    next(err);
  }
});

// ============================================
// ORDERS - CREATE & MANAGE
// ============================================

// Create order (POS or online checkout)
router.post('/orders', optionalAuth, async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      items, 
      customer_email, 
      customer_name, 
      customer_phone,
      discount_code,
      payment_method,
      shipping_address,
      order_type = 'in_store',
      notes 
    } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }
    
    // Generate order number
    const orderNum = `TS${Date.now().toString(36).toUpperCase()}`;
    
    // Calculate totals
    let subtotal = 0;
    const orderItems = [];
    
    for (const item of items) {
      // Get variant/product details
      const variantResult = await client.query(`
        SELECT v.*, p.name as product_name, p.id as product_id,
          COALESCE(v.retail_price, p.retail_price) as price
        FROM product_variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.id = $1 AND v.is_active = true
      `, [item.variant_id]);
      
      if (variantResult.rows.length === 0) {
        throw new Error(`Product variant not found: ${item.variant_id}`);
      }
      
      const variant = variantResult.rows[0];
      
      // Check inventory
      if (variant.quantity_available < item.quantity) {
        throw new Error(`Insufficient stock for ${variant.product_name} (${variant.name})`);
      }
      
      const itemTotal = parseFloat(variant.price) * item.quantity;
      subtotal += itemTotal;
      
      orderItems.push({
        product_id: variant.product_id,
        variant_id: variant.id,
        product_name: variant.product_name,
        variant_name: variant.name,
        sku: variant.sku,
        quantity: item.quantity,
        unit_price: variant.price,
        total_amount: itemTotal
      });
      
      // Reserve inventory
      await client.query(`
        UPDATE product_variants 
        SET quantity_reserved = quantity_reserved + $1
        WHERE id = $2
      `, [item.quantity, item.variant_id]);
    }
    
    // Apply discount if provided
    let discountAmount = 0;
    let discountId = null;
    
    if (discount_code) {
      const discountResult = await client.query(`
        SELECT * FROM discounts
        WHERE code = $1 
          AND is_active = true
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (usage_limit IS NULL OR usage_count < usage_limit)
      `, [discount_code.toUpperCase()]);
      
      if (discountResult.rows.length > 0) {
        const discount = discountResult.rows[0];
        
        if (!discount.minimum_purchase || subtotal >= parseFloat(discount.minimum_purchase)) {
          discountId = discount.id;
          
          if (discount.discount_type === 'percentage') {
            discountAmount = subtotal * (parseFloat(discount.discount_value) / 100);
          } else if (discount.discount_type === 'fixed_amount') {
            discountAmount = parseFloat(discount.discount_value);
          }
          
          if (discount.maximum_discount) {
            discountAmount = Math.min(discountAmount, parseFloat(discount.maximum_discount));
          }
          
          // Increment usage
          await client.query(`
            UPDATE discounts SET usage_count = usage_count + 1 WHERE id = $1
          `, [discount.id]);
        }
      }
    }
    
    // Calculate tax (example: 8.265% for Reno, NV)
    const taxRate = 0.08265;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    
    // Shipping (simplified - free for in-store)
    const shippingAmount = order_type === 'online' ? (subtotal >= 50 ? 0 : 8.99) : 0;
    
    const totalAmount = taxableAmount + taxAmount + shippingAmount;
    
    // Create order
    const orderResult = await client.query(`
      INSERT INTO retail_orders (
        order_number, user_id, customer_email, customer_name, customer_phone,
        order_type, order_source, status, payment_status,
        subtotal, discount_amount, tax_amount, shipping_amount, total_amount,
        discount_code, discount_id, payment_method, shipping_address,
        staff_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      orderNum,
      req.user?.id || null,
      customer_email,
      customer_name,
      customer_phone,
      order_type,
      order_type === 'in_store' ? 'pos' : 'website',
      payment_method ? 'paid' : 'pending',
      payment_method ? 'paid' : 'pending',
      subtotal,
      discountAmount,
      taxAmount,
      shippingAmount,
      totalAmount,
      discount_code,
      discountId,
      payment_method,
      shipping_address ? JSON.stringify(shipping_address) : null,
      req.user?.role && ['front_desk', 'manager', 'owner', 'admin'].includes(req.user.role) ? req.user.id : null,
      notes
    ]);
    
    const order = orderResult.rows[0];
    
    // Create order items
    for (const item of orderItems) {
      await client.query(`
        INSERT INTO retail_order_items (
          order_id, product_id, variant_id, product_name, variant_name, sku,
          quantity, unit_price, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        order.id, item.product_id, item.variant_id, item.product_name, item.variant_name, item.sku,
        item.quantity, item.unit_price, item.total_amount
      ]);
      
      // If paid, deduct inventory
      if (payment_method) {
        await client.query(`
          UPDATE product_variants 
          SET quantity_on_hand = quantity_on_hand - $1,
              quantity_reserved = quantity_reserved - $1
          WHERE id = $2
        `, [item.quantity, item.variant_id]);
        
        // Log inventory transaction
        await client.query(`
          INSERT INTO inventory_transactions (
            variant_id, transaction_type, quantity, quantity_before, quantity_after,
            reference_type, reference_id, created_by
          ) VALUES ($1, 'sale', $2, $3, $4, 'order', $5, $6)
        `, [
          item.variant_id,
          -item.quantity,
          item.quantity, // This should be fetched but simplified here
          item.quantity - item.quantity,
          order.id,
          req.user?.id
        ]);
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({ 
      order: {
        ...order,
        items: orderItems
      },
      message: 'Order created successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Get order by ID or order number
router.get('/orders/:identifier', authenticate, async (req, res, next) => {
  try {
    const { identifier } = req.params;
    
    const result = await pool.query(`
      SELECT o.*,
        (SELECT json_agg(json_build_object(
          'id', oi.id, 'product_name', oi.product_name, 'variant_name', oi.variant_name,
          'sku', oi.sku, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'total_amount', oi.total_amount
        )) FROM retail_order_items oi WHERE oi.order_id = o.id) as items
      FROM retail_orders o
      WHERE o.id = $1 OR o.order_number = $1
    `, [identifier]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ order: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// List orders (staff)
router.get('/orders', authenticate, requirePermission('view_transactions'), async (req, res, next) => {
  try {
    const { status, type, start_date, end_date, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT o.*, u.first_name || ' ' || u.last_name as customer_name_full
      FROM retail_orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
    }
    
    if (type) {
      paramCount++;
      query += ` AND o.order_type = $${paramCount}`;
      params.push(type);
    }
    
    if (start_date) {
      paramCount++;
      query += ` AND o.created_at >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      query += ` AND o.created_at <= $${paramCount}`;
      params.push(end_date);
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({ orders: result.rows });
  } catch (err) {
    next(err);
  }
});

// ============================================
// INVENTORY MANAGEMENT (Staff)
// ============================================

// Get inventory levels
router.get('/inventory', authenticate, requirePermission('manage_inventory'), async (req, res, next) => {
  try {
    const { low_stock, category } = req.query;
    
    let query = `
      SELECT v.*, p.name as product_name, p.sku as product_sku, p.low_stock_threshold,
        c.name as category_name
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE v.is_active = true
    `;
    const params = [];
    
    if (low_stock === 'true') {
      query += ` AND v.quantity_available <= p.low_stock_threshold`;
    }
    
    if (category) {
      params.push(category);
      query += ` AND c.slug = $${params.length}`;
    }
    
    query += ` ORDER BY p.name, v.size, v.color`;
    
    const result = await pool.query(query, params);
    
    res.json({ inventory: result.rows });
  } catch (err) {
    next(err);
  }
});

// Adjust inventory
router.post('/inventory/adjust', authenticate, requirePermission('manage_inventory'), async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { variant_id, adjustment, reason, notes } = req.body;
    
    // Get current quantity
    const current = await client.query(`
      SELECT quantity_on_hand FROM product_variants WHERE id = $1
    `, [variant_id]);
    
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    
    const quantityBefore = current.rows[0].quantity_on_hand;
    const quantityAfter = quantityBefore + adjustment;
    
    if (quantityAfter < 0) {
      return res.status(400).json({ error: 'Cannot reduce below zero' });
    }
    
    // Update inventory
    await client.query(`
      UPDATE product_variants SET quantity_on_hand = $1 WHERE id = $2
    `, [quantityAfter, variant_id]);
    
    // Log transaction
    await client.query(`
      INSERT INTO inventory_transactions (
        variant_id, transaction_type, quantity, quantity_before, quantity_after,
        reference_type, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'adjustment', $6, $7)
    `, [
      variant_id,
      reason || 'adjustment',
      adjustment,
      quantityBefore,
      quantityAfter,
      notes,
      req.user.id
    ]);
    
    await client.query('COMMIT');
    
    res.json({ 
      message: 'Inventory adjusted',
      quantity_before: quantityBefore,
      quantity_after: quantityAfter
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============================================
// ADMIN - PRODUCT MANAGEMENT
// ============================================

// Create product
router.post('/admin/products', authenticate, requirePermission('manage_products'), async (req, res, next) => {
  try {
    const {
      sku, name, description, category_id,
      cost_price, retail_price, wholesale_price,
      product_type, is_customizable, image_url, tags
    } = req.body;
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const result = await pool.query(`
      INSERT INTO products (
        sku, name, slug, description, category_id,
        cost_price, retail_price, wholesale_price,
        product_type, is_customizable, image_url, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [sku, name, slug, description, category_id, cost_price, retail_price, wholesale_price, product_type || 'retail', is_customizable || false, image_url, tags || []]);
    
    res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Update product
router.put('/admin/products/:id', authenticate, requirePermission('manage_products'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const fields = ['name', 'description', 'category_id', 'cost_price', 'retail_price', 'wholesale_price', 'product_type', 'is_customizable', 'image_url', 'tags', 'is_active', 'is_featured'];
    const setClauses = [];
    const values = [];
    let paramCount = 0;
    
    for (const field of fields) {
      if (updates[field] !== undefined) {
        paramCount++;
        setClauses.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
      }
    }
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    setClauses.push('updated_at = NOW()');
    values.push(id);
    
    const result = await pool.query(`
      UPDATE products SET ${setClauses.join(', ')} WHERE id = $${paramCount + 1} RETURNING *
    `, values);
    
    res.json({ product: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Create variant
router.post('/admin/products/:productId/variants', authenticate, requirePermission('manage_products'), async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { sku, name, size, color, color_hex, retail_price, quantity_on_hand = 0 } = req.body;
    
    const result = await pool.query(`
      INSERT INTO product_variants (
        product_id, sku, name, size, color, color_hex, retail_price, quantity_on_hand
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [productId, sku, name, size, color, color_hex, retail_price, quantity_on_hand]);
    
    res.status(201).json({ variant: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================
// DISCOUNTS
// ============================================

// Validate discount code
router.post('/discounts/validate', async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    
    const result = await pool.query(`
      SELECT * FROM discounts
      WHERE code = $1 
        AND is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (usage_limit IS NULL OR usage_count < usage_limit)
    `, [code.toUpperCase()]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired code' });
    }
    
    const discount = result.rows[0];
    
    if (discount.minimum_purchase && subtotal < parseFloat(discount.minimum_purchase)) {
      return res.status(400).json({ 
        valid: false, 
        error: `Minimum purchase of $${discount.minimum_purchase} required` 
      });
    }
    
    let discountAmount = 0;
    if (discount.discount_type === 'percentage') {
      discountAmount = subtotal * (parseFloat(discount.discount_value) / 100);
    } else if (discount.discount_type === 'fixed_amount') {
      discountAmount = parseFloat(discount.discount_value);
    }
    
    if (discount.maximum_discount) {
      discountAmount = Math.min(discountAmount, parseFloat(discount.maximum_discount));
    }
    
    res.json({ 
      valid: true, 
      discount: {
        code: discount.code,
        description: discount.description,
        discount_type: discount.discount_type,
        discount_amount: discountAmount
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
