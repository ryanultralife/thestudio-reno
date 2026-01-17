# API Reference Documentation

**The Studio Reno - Complete REST API**

> **For AI Assistants**: This document provides explicit API endpoint definitions with request/response formats, authentication requirements, and code examples. Use this when implementing frontend features or API integrations.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Users & Profiles](#users--profiles)
4. [Classes & Schedule](#classes--schedule)
5. [Bookings](#bookings)
6. [Memberships](#memberships)
7. [Retail & Products](#retail--products)
8. [Rentals](#rentals)
9. [CMS & Content](#cms--content)
10. [Campaigns & Notifications](#campaigns--notifications)
11. [Reports & Analytics](#reports--analytics)
12. [Admin & Settings](#admin--settings)
13. [Webhooks](#webhooks)

---

## API Overview

**Base URL**:
- Development: `http://localhost:3000/api`
- Production: `https://thestudio-reno-production.up.railway.app/api`

**Authentication**: JWT Bearer Token (7-day expiration)

**Response Format**: JSON

**Error Response**:
```json
{
  "error": "Error message",
  "details": []  // Optional validation details
}
```

**HTTP Status Codes**:
- `200` OK - Success
- `201` Created - Resource created
- `400` Bad Request - Validation error
- `401` Unauthorized - Not authenticated
- `403` Forbidden - Insufficient permissions
- `404` Not Found - Resource not found
- `409` Conflict - Duplicate entry
- `500` Internal Server Error

---

## Authentication

### POST `/api/auth/register`

Create a new user account.

**Auth**: None

**Request**:
```json
{
  "email": "student@example.com",
  "password": "secure_password123",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+1234567890",
  "email_opt_in": true,
  "sms_opt_in": false
}
```

**Validation**:
- `email`: Valid email format, unique
- `password`: Minimum 8 characters
- `first_name`: Required, non-empty
- `last_name`: Optional
- `phone`: Optional
- `email_opt_in`: Optional boolean (default: true)
- `sms_opt_in`: Optional boolean (default: false)

**Response** (201):
```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "pending_waivers": [
    {
      "id": "uuid",
      "name": "Liability Waiver"
    }
  ]
}
```

**Errors**:
- `409`: Email already registered
- `400`: Validation failed

---

### POST `/api/auth/login`

Authenticate user and receive JWT token.

**Auth**: None

**Request**:
```json
{
  "email": "admin@thestudio.com",
  "password": "admin123"
}
```

**Response** (200):
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "admin@thestudio.com",
    "first_name": "Admin",
    "last_name": "User",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "pending_waivers": []
}
```

**Errors**:
- `401`: Invalid credentials
- `403`: Account deactivated

**Usage**:
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token, user } = await response.json();
localStorage.setItem('staff_token', token);
```

---

### GET `/api/auth/me`

Get current authenticated user's profile.

**Auth**: Required

**Response** (200):
```json
{
  "id": "uuid",
  "email": "admin@thestudio.com",
  "first_name": "Admin",
  "last_name": "User",
  "phone": "+1234567890",
  "role": "admin",
  "avatar_url": null,
  "date_of_birth": "1990-01-01",
  "emergency_contact_name": "John Doe",
  "emergency_contact_phone": "+1987654321",
  "created_at": "2026-01-01T00:00:00Z",
  "membership_name": "Monthly Unlimited",
  "membership_type": "unlimited",
  "membership_expires": "2026-02-01",
  "credits_remaining": null,
  "membership_status": "active",
  "upcoming_bookings": 5,
  "tags": [
    { "name": "VIP", "color": "#f59e0b" }
  ]
}
```

---

### POST `/api/auth/change-password`

Change current user's password.

**Auth**: Required

**Request**:
```json
{
  "current_password": "old_password",
  "new_password": "new_secure_password"
}
```

**Validation**:
- `current_password`: Must match existing password
- `new_password`: Minimum 8 characters

**Response** (200):
```json
{
  "message": "Password updated"
}
```

**Errors**:
- `401`: Current password incorrect

---

### POST `/api/auth/waivers/:waiverId/sign`

Sign a required waiver.

**Auth**: Required

**Request**:
```json
{
  "signature_data": "data:image/png;base64,...",
  "signature_type": "drawn"
}
```

**Response** (200):
```json
{
  "message": "Waiver signed",
  "waiver": "Liability Waiver"
}
```

---

## Users & Profiles

### GET `/api/users`

Search and list users (staff only).

**Auth**: Required (Permission: `user.view_all`)

**Query Parameters**:
- `search`: Search email, name, phone
- `role`: Filter by role
- `tag`: Filter by tag
- `membership_status`: Filter by membership status
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset (default: 0)

**Response** (200):
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "student@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "phone": "+1234567890",
      "role": "student",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z",
      "last_login": "2026-01-15T10:30:00Z",
      "membership_name": "10-Class Pack",
      "credits_remaining": 7,
      "upcoming_classes": 2
    }
  ],
  "total": 145,
  "limit": 50,
  "offset": 0
}
```

---

### GET `/api/users/:userId`

Get detailed user profile.

**Auth**: Required (Permission: `user.view_all` or own profile)

**Response** (200):
```json
{
  "id": "uuid",
  "email": "student@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+1234567890",
  "role": "student",
  "date_of_birth": "1995-05-15",
  "avatar_url": null,
  "emergency_contact_name": "John Doe",
  "emergency_contact_phone": "+1987654321",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z",
  "last_login": "2026-01-15T10:30:00Z",

  "memberships": [
    {
      "id": "uuid",
      "name": "10-Class Pack",
      "status": "active",
      "start_date": "2026-01-01",
      "end_date": "2027-01-01",
      "credits_total": 10,
      "credits_remaining": 7
    }
  ],

  "bookings": [
    {
      "id": "uuid",
      "class_date": "2026-01-20",
      "class_time": "10:00:00",
      "class_name": "Vinyasa Flow",
      "teacher": "Sarah Johnson",
      "location": "Main Studio",
      "status": "booked"
    }
  ],

  "tags": [
    { "name": "New Student", "color": "#10b981" }
  ],

  "notes": [
    {
      "id": "uuid",
      "note": "Prefers morning classes",
      "created_by": "Admin User",
      "created_at": "2026-01-05T14:20:00Z"
    }
  ]
}
```

---

### PUT `/api/auth/me`

Update own profile.

**Auth**: Required

**Request**:
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+1234567890",
  "date_of_birth": "1995-05-15",
  "emergency_contact_name": "John Smith",
  "emergency_contact_phone": "+1987654321",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

**Response** (200):
```json
{
  "message": "Profile updated",
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+1234567890",
    "role": "student"
  }
}
```

---

## Classes & Schedule

### GET `/api/classes`

Get class schedule.

**Auth**: Optional (returns only public classes if not authenticated)

**Query Parameters**:
- `start_date`: Filter start (YYYY-MM-DD)
- `end_date`: Filter end (YYYY-MM-DD)
- `location_id`: Filter by location UUID
- `class_type_id`: Filter by class type UUID
- `teacher_id`: Filter by teacher UUID
- `limit`: Results per page (default: 100)
- `offset`: Pagination offset

**Response** (200):
```json
{
  "classes": [
    {
      "id": "uuid",
      "date": "2026-01-20",
      "start_time": "10:00:00",
      "end_time": "11:00:00",
      "class_type": {
        "id": "uuid",
        "name": "Vinyasa Flow",
        "color": "#f59e0b",
        "duration_minutes": 60
      },
      "location": {
        "id": "uuid",
        "name": "Main Studio"
      },
      "teacher": {
        "id": "uuid",
        "first_name": "Sarah",
        "last_name": "Johnson",
        "photo_url": "https://..."
      },
      "substitute_teacher": null,
      "capacity": 20,
      "booked_count": 15,
      "spots_left": 5,
      "status": "scheduled",
      "user_booking": null  // or { "id": "uuid", "status": "booked" } if authenticated and booked
    }
  ],
  "total": 42
}
```

---

### POST `/api/classes`

Create a new class.

**Auth**: Required (Permission: `class.create`)

**Request**:
```json
{
  "class_type_id": "uuid",
  "location_id": "uuid",
  "teacher_id": "uuid",
  "date": "2026-01-25",
  "start_time": "10:00",
  "duration_minutes": 60,
  "capacity": 20
}
```

**Response** (201):
```json
{
  "message": "Class created",
  "class": {
    "id": "uuid",
    "date": "2026-01-25",
    "start_time": "10:00:00",
    "end_time": "11:00:00",
    "capacity": 20
  }
}
```

---

### PUT `/api/classes/:classId`

Update a class.

**Auth**: Required (Permission: `class.edit`)

**Request**:
```json
{
  "date": "2026-01-25",
  "start_time": "11:00",
  "teacher_id": "uuid",
  "substitute_teacher_id": "uuid",
  "capacity": 25,
  "status": "scheduled"
}
```

**Response** (200):
```json
{
  "message": "Class updated",
  "class": { /* updated class object */ }
}
```

---

### DELETE `/api/classes/:classId`

Cancel a class.

**Auth**: Required (Permission: `class.delete`)

**Request**:
```json
{
  "cancellation_reason": "Teacher illness"
}
```

**Response** (200):
```json
{
  "message": "Class cancelled",
  "affected_bookings": 12
}
```

**Side Effects**: All bookings are cancelled and credits refunded.

---

## Bookings

### POST `/api/bookings`

Book a class for self or another user.

**Auth**: Required (Permission: `booking.create_self` or `booking.create_others`)

**Request**:
```json
{
  "class_id": "uuid",
  "user_id": "uuid",  // Optional (defaults to current user)
  "membership_id": "uuid"  // Optional (auto-selected if omitted)
}
```

**Validation**:
- Class must have available spots
- User must have active membership with credits (or unlimited)
- User cannot already be booked for this class

**Response** (201):
```json
{
  "message": "Booking successful",
  "booking": {
    "id": "uuid",
    "class_id": "uuid",
    "user_id": "uuid",
    "status": "booked",
    "booked_at": "2026-01-17T10:30:00Z"
  },
  "credits_remaining": 6
}
```

**Errors**:
- `400`: Class full, no credits, or already booked
- `403`: Insufficient permissions

---

### GET `/api/bookings`

Get user's bookings.

**Auth**: Required

**Query Parameters**:
- `user_id`: Filter by user (requires permission)
- `class_id`: Filter by class
- `status`: Filter by status (booked, checked_in, cancelled, no_show)
- `upcoming`: Boolean - only future bookings
- `limit`, `offset`: Pagination

**Response** (200):
```json
{
  "bookings": [
    {
      "id": "uuid",
      "status": "booked",
      "booked_at": "2026-01-15T10:00:00Z",
      "class": {
        "id": "uuid",
        "date": "2026-01-20",
        "start_time": "10:00:00",
        "class_type": "Vinyasa Flow",
        "teacher": "Sarah Johnson",
        "location": "Main Studio"
      }
    }
  ],
  "total": 12
}
```

---

### POST `/api/bookings/:bookingId/checkin`

Check in a user for their booking.

**Auth**: Required (Permission: `booking.checkin`)

**Response** (200):
```json
{
  "message": "Checked in successfully",
  "booking": {
    "id": "uuid",
    "status": "checked_in",
    "checked_in_at": "2026-01-20T10:05:00Z"
  }
}
```

---

### DELETE `/api/bookings/:bookingId`

Cancel a booking.

**Auth**: Required (Permission: `booking.cancel_self` or `booking.cancel_others`)

**Request**:
```json
{
  "reason": "Schedule conflict"
}
```

**Response** (200):
```json
{
  "message": "Booking cancelled",
  "credits_refunded": true
}
```

**Errors**:
- `400`: Past cancellation deadline (24 hours before class)

---

## Memberships

### GET `/api/memberships/types`

Get all available membership types.

**Auth**: None

**Response** (200):
```json
{
  "membership_types": [
    {
      "id": "uuid",
      "name": "Monthly Unlimited",
      "description": "Unlimited classes for 30 days",
      "price": 99.00,
      "duration_days": 30,
      "credits": null,
      "auto_renew": true,
      "is_intro_offer": false,
      "is_active": true
    },
    {
      "id": "uuid",
      "name": "10-Class Pack",
      "description": "10 classes valid for 1 year",
      "price": 180.00,
      "duration_days": 365,
      "credits": 10,
      "auto_renew": false,
      "is_intro_offer": false,
      "is_active": true
    }
  ]
}
```

---

### POST `/api/memberships/purchase`

Purchase a membership (creates Stripe checkout session).

**Auth**: Required

**Request**:
```json
{
  "membership_type_id": "uuid",
  "user_id": "uuid",  // Optional (staff can purchase for others)
  "success_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel"
}
```

**Response** (200):
```json
{
  "message": "Checkout session created",
  "session_url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Usage**:
```javascript
const { session_url } = await api('/memberships/purchase', {
  method: 'POST',
  body: JSON.stringify({ membership_type_id })
});
window.location.href = session_url;  // Redirect to Stripe checkout
```

**Note**: Membership activation happens via Stripe webhook after successful payment.

---

### GET `/api/memberships`

Get user's memberships.

**Auth**: Required

**Query Parameters**:
- `user_id`: Filter by user (requires permission)
- `status`: Filter by status (active, expired, cancelled, paused)

**Response** (200):
```json
{
  "memberships": [
    {
      "id": "uuid",
      "membership_type": {
        "id": "uuid",
        "name": "10-Class Pack"
      },
      "status": "active",
      "start_date": "2026-01-01",
      "end_date": "2027-01-01",
      "credits_total": 10,
      "credits_remaining": 7,
      "stripe_subscription_id": null,
      "created_at": "2026-01-01T10:00:00Z"
    }
  ]
}
```

---

## Retail & Products

### GET `/api/retail/products`

Get product catalog.

**Auth**: Optional (public endpoint)

**Query Parameters**:
- `category_id`: Filter by category
- `search`: Search name/description
- `is_featured`: Boolean - featured products only
- `product_type`: Filter by type (physical, digital, service, subscription)
- `limit`, `offset`: Pagination

**Response** (200):
```json
{
  "products": [
    {
      "id": "uuid",
      "name": "Yoga Mat - Premium",
      "description": "High-quality non-slip yoga mat",
      "sku": "MAT-001",
      "price": 45.00,
      "image_urls": ["https://..."],
      "category": {
        "id": "uuid",
        "name": "Equipment"
      },
      "in_stock": true,
      "quantity_available": 15,
      "has_variants": true,
      "variants": [
        {
          "id": "uuid",
          "name": "Purple",
          "sku": "MAT-001-PUR",
          "price": 45.00,
          "quantity_on_hand": 8
        },
        {
          "id": "uuid",
          "name": "Teal",
          "sku": "MAT-001-TEA",
          "price": 45.00,
          "quantity_on_hand": 7
        }
      ]
    }
  ],
  "total": 42
}
```

---

### POST `/api/retail/orders`

Create a retail order (POS or online).

**Auth**: Required (Permission: `retail.create_order` for staff, or self-purchase)

**Request**:
```json
{
  "user_id": "uuid",  // Optional (defaults to current user)
  "items": [
    {
      "product_id": "uuid",
      "variant_id": "uuid",  // Optional
      "quantity": 2
    }
  ],
  "discount_code": "WELCOME10",  // Optional
  "payment_method": "stripe"  // stripe, cash, check, comp
}
```

**Response** (201):
```json
{
  "message": "Order created",
  "order": {
    "id": "uuid",
    "total": 81.00,
    "discount_amount": 9.00,
    "status": "pending",
    "payment_url": "https://checkout.stripe.com/..."  // If payment_method = stripe
  }
}
```

---

## Rentals

### POST `/api/rentals/inquiries`

Submit a space rental inquiry (public form).

**Auth**: None

**Request**:
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "practice_type": "Pilates",
  "experience_level": "Certified Instructor",
  "group_size": "1-5 people",
  "preferred_days": ["Monday", "Wednesday", "Friday"],
  "preferred_times": ["Morning (6am-12pm)"],
  "has_insurance": true,
  "insurance_details": "Professional liability coverage",
  "message": "Interested in renting space for weekly Pilates classes"
}
```

**Response** (201):
```json
{
  "message": "Inquiry submitted successfully",
  "inquiry": {
    "id": "uuid",
    "status": "new",
    "created_at": "2026-01-17T10:30:00Z"
  }
}
```

**Side Effects**: Email notification sent to admin.

---

### GET `/api/rentals/inquiries`

List all rental inquiries (admin only).

**Auth**: Required (Permission: `admin.view_inquiries`)

**Query Parameters**:
- `status`: Filter by status (new, contacted, quoted, converted, declined)
- `limit`, `offset`: Pagination

**Response** (200):
```json
{
  "inquiries": [
    {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "practice_type": "Pilates",
      "status": "new",
      "created_at": "2026-01-17T10:30:00Z",
      "notes": [
        {
          "note": "Called and left voicemail",
          "created_by": "Admin User",
          "created_at": "2026-01-17T14:00:00Z"
        }
      ]
    }
  ],
  "total": 23
}
```

---

## CMS & Content

### GET `/api/cms/settings`

Get all site settings.

**Auth**: Optional (public settings visible to all)

**Response** (200):
```json
{
  "settings": {
    "studio_name": "The Studio Reno",
    "tagline": "Find Your Balance",
    "phone": "(775) 123-4567",
    "email": "info@thestudioreno.com",
    "address": "105 Vassar St, Reno NV 89502",
    "facebook_url": "https://facebook.com/thestudioreno",
    "instagram_url": "https://instagram.com/thestudioreno",
    "booking_cancellation_hours": 24,
    "enable_retail": true,
    "enable_rentals": true
  }
}
```

---

### PUT `/api/cms/settings`

Update site settings.

**Auth**: Required (Permission: `admin.manage_settings`)

**Request**:
```json
{
  "studio_name": "The Studio Reno",
  "phone": "(775) 123-4567",
  "booking_cancellation_hours": 12
}
```

**Response** (200):
```json
{
  "message": "Settings updated",
  "settings": { /* updated settings */ }
}
```

---

### GET `/api/cms/content-blocks`

Get content blocks for a page.

**Auth**: None

**Query Parameters**:
- `page`: Page name (home, about, pricing, contact)

**Response** (200):
```json
{
  "content_blocks": [
    {
      "id": "uuid",
      "page": "home",
      "section": "hero",
      "content": {
        "heading": "Find Your Balance",
        "subheading": "Reno's premier yoga studio",
        "cta_text": "Start Your Journey",
        "background_image": "https://..."
      },
      "display_order": 1,
      "is_active": true
    }
  ]
}
```

---

### PUT `/api/cms/content-blocks/:blockId`

Update a content block.

**Auth**: Required (Permission: `admin.manage_content`)

**Request**:
```json
{
  "content": {
    "heading": "Discover Inner Peace",
    "subheading": "Join our community",
    "cta_text": "Book Now"
  }
}
```

**Response** (200):
```json
{
  "message": "Content updated",
  "block": { /* updated block */ }
}
```

---

## Campaigns & Notifications

### GET `/api/campaigns`

List all notification campaigns.

**Auth**: Required (Permission: `admin.view_campaigns`)

**Response** (200):
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "name": "Membership Expiring Reminder",
      "trigger_type": "membership_expiring",
      "trigger_config": { "days_before": 7 },
      "channel": "email",
      "subject": "Your membership expires soon!",
      "frequency": "daily",
      "run_time": "09:00:00",
      "is_active": true,
      "last_run_at": "2026-01-17T09:00:00Z",
      "next_run_at": "2026-01-18T09:00:00Z"
    }
  ]
}
```

---

### POST `/api/campaigns`

Create a new campaign.

**Auth**: Required (Permission: `admin.manage_campaigns`)

**Request**:
```json
{
  "name": "Welcome New Members",
  "trigger_type": "new_member_welcome",
  "trigger_config": { "days_after": 1 },
  "channel": "email",
  "subject": "Welcome to The Studio!",
  "message_template": "Hi {{first_name}}, welcome to our community!",
  "frequency": "daily",
  "run_time": "10:00",
  "is_active": true
}
```

**Response** (201):
```json
{
  "message": "Campaign created",
  "campaign": { /* created campaign */ }
}
```

---

### GET `/api/campaigns/:campaignId/logs`

Get campaign execution logs.

**Auth**: Required (Permission: `admin.view_campaigns`)

**Query Parameters**:
- `limit`, `offset`: Pagination

**Response** (200):
```json
{
  "logs": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "email": "student@example.com",
        "first_name": "Jane"
      },
      "channel": "email",
      "status": "opened",
      "sent_at": "2026-01-17T09:15:00Z",
      "opened_at": "2026-01-17T10:30:00Z"
    }
  ],
  "total": 142,
  "metrics": {
    "total_sent": 142,
    "delivered": 140,
    "opened": 95,
    "clicked": 23,
    "open_rate": 67.86,
    "click_rate": 16.43
  }
}
```

---

## Reports & Analytics

### GET `/api/reports/dashboard`

Get dashboard metrics.

**Auth**: Required (Permission: `financial.view_revenue` or `admin.view_reports`)

**Query Parameters**:
- `date`: Date for metrics (default: today, YYYY-MM-DD)

**Response** (200):
```json
{
  "date": "2026-01-17",
  "classes": {
    "total": 12,
    "completed": 7,
    "upcoming": 5,
    "cancelled": 0
  },
  "bookings": {
    "total": 145,
    "checked_in": 98,
    "booked": 47
  },
  "memberships": {
    "active": 234,
    "new_today": 5,
    "expiring_soon": 23
  },
  "revenue": {
    "today": 1245.00,
    "week": 8432.00,
    "month": 34567.00
  }
}
```

---

### GET `/api/reports/attendance`

Get attendance report.

**Auth**: Required (Permission: `admin.view_reports`)

**Query Parameters**:
- `start_date`, `end_date`: Date range
- `location_id`: Filter by location
- `class_type_id`: Filter by class type
- `group_by`: Grouping (day, week, month)

**Response** (200):
```json
{
  "report": [
    {
      "date": "2026-01-17",
      "classes_held": 12,
      "total_capacity": 240,
      "total_booked": 198,
      "total_checked_in": 175,
      "fill_rate": 82.50,
      "attendance_rate": 88.38
    }
  ]
}
```

---

### GET `/api/reports/revenue`

Get revenue report.

**Auth**: Required (Permission: `financial.view_revenue`)

**Query Parameters**:
- `start_date`, `end_date`: Date range
- `group_by`: Grouping (day, week, month)
- `type`: Filter by transaction type

**Response** (200):
```json
{
  "report": [
    {
      "date": "2026-01-17",
      "membership_revenue": 990.00,
      "retail_revenue": 255.00,
      "total_revenue": 1245.00,
      "transaction_count": 14
    }
  ],
  "summary": {
    "total_revenue": 34567.00,
    "avg_daily_revenue": 1234.54,
    "top_revenue_type": "membership"
  }
}
```

---

## Admin & Settings

### GET `/api/admin/class-types`

Get all class types.

**Auth**: Required (Permission: `admin.view_settings`)

**Response** (200):
```json
{
  "class_types": [
    {
      "id": "uuid",
      "name": "Vinyasa Flow",
      "description": "Dynamic flowing yoga sequences",
      "duration_minutes": 60,
      "default_capacity": 20,
      "color": "#f59e0b",
      "is_active": true
    }
  ]
}
```

---

### POST `/api/admin/class-types`

Create a new class type.

**Auth**: Required (Permission: `admin.manage_settings`)

**Request**:
```json
{
  "name": "Aerial Yoga",
  "description": "Yoga using aerial silks",
  "duration_minutes": 75,
  "default_capacity": 10,
  "color": "#8b5cf6"
}
```

**Response** (201):
```json
{
  "message": "Class type created",
  "class_type": { /* created class type */ }
}
```

---

### GET `/api/admin/permissions`

Get all permissions.

**Auth**: Required (Permission: `admin.view_permissions`)

**Response** (200):
```json
{
  "permissions": [
    {
      "id": "uuid",
      "name": "booking.create_self",
      "description": "Book own classes"
    },
    {
      "id": "uuid",
      "name": "user.edit_all",
      "description": "Edit any user profile"
    }
  ]
}
```

---

### PUT `/api/admin/users/:userId/permissions`

Grant or deny permissions to a user.

**Auth**: Required (Permission: `admin.manage_permissions`)

**Request**:
```json
{
  "grant": ["user.edit_all", "financial.view_revenue"],
  "deny": ["user.delete"]
}
```

**Response** (200):
```json
{
  "message": "Permissions updated",
  "user_permissions": [
    { "permission": "user.edit_all", "granted": true },
    { "permission": "financial.view_revenue", "granted": true },
    { "permission": "user.delete", "granted": false }
  ]
}
```

---

## Webhooks

### POST `/api/webhooks/stripe`

Stripe webhook endpoint (automated).

**Auth**: Stripe signature verification

**Headers**:
- `stripe-signature`: Webhook signature

**Events Handled**:
- `checkout.session.completed` - Membership purchase
- `invoice.payment_succeeded` - Recurring payment
- `invoice.payment_failed` - Payment failure
- `customer.subscription.deleted` - Cancellation

**Response** (200):
```json
{
  "received": true
}
```

**Security**:
- Signature verification with `STRIPE_WEBHOOK_SECRET`
- Replay attack prevention (event ID tracking)
- Concurrent processing prevention
- Idempotent handling

---

## Authentication Usage Examples

### Frontend API Utility

```javascript
// API utility function
const API_URL = import.meta.env.VITE_API_URL || '/api';

async function api(endpoint, options = {}) {
  const token = localStorage.getItem('staff_token');

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    },
  });

  // Auto-logout on 401
  if (res.status === 401) {
    localStorage.removeItem('staff_token');
    window.location.reload();
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Usage examples
const data = await api('/classes?start_date=2026-01-20');
const booking = await api('/bookings', {
  method: 'POST',
  body: JSON.stringify({ class_id: 'uuid' })
});
```

---

## Error Handling

**Common Error Responses**:

```json
// Validation error
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}

// Duplicate entry
{
  "error": "Duplicate entry",
  "message": "Email already registered"
}

// Insufficient permissions
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}

// Not found
{
  "error": "Not found",
  "message": "Class not found"
}

// Business logic error
{
  "error": "Booking failed",
  "message": "Class is at full capacity"
}
```

---

## Rate Limiting

**Not currently implemented** - Consider adding:
- `express-rate-limit` middleware
- 100 requests per 15 minutes per IP
- Different limits for authenticated vs public endpoints

---

## API Versioning

**Current**: No versioning (single production version)

**Future Multi-Tenant SaaS**: Consider versioning:
- URL versioning: `/api/v1/`, `/api/v2/`
- Header versioning: `Accept: application/vnd.thestudio.v2+json`

---

## Best Practices for AI Development

**When Adding New Endpoints**:
1. Follow REST conventions (GET, POST, PUT, DELETE)
2. Use plural nouns for resources (`/users`, `/classes`)
3. Add authentication middleware (`authenticate`, `requirePermission`)
4. Validate input with `express-validator`
5. Use parameterized queries (prevent SQL injection)
6. Return consistent error format
7. Document in this file

**When Modifying Existing Endpoints**:
1. Check for breaking changes (deprecate instead)
2. Update frontend components that use the endpoint
3. Add migration path for old clients
4. Test with frontend integration

---

**Document Version**: 1.0
**Last Updated**: 2026-01-17
**Total Endpoints**: 60+
