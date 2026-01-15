// ============================================
// UNIFIED NOTIFICATION SERVICE
// Email + SMS with preference checking
// ============================================

const db = require('../database/connection');

// ============================================
// PROVIDER CLIENTS
// ============================================

let sgMail = null;
let twilioClient = null;

function initProviders() {
  // SendGrid
  if (process.env.SENDGRID_API_KEY) {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  // Twilio
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
}

// Initialize on first use
let initialized = false;
function ensureInit() {
  if (!initialized) {
    initProviders();
    initialized = true;
  }
}

// ============================================
// EMAIL SENDING
// ============================================

async function sendEmail(to, subject, html, text = null) {
  ensureInit();
  
  const fromEmail = process.env.FROM_EMAIL || 'thestudioreno@gmail.com';
  const fromName = process.env.FROM_NAME || 'The Studio Reno';

  try {
    if (sgMail) {
      await sgMail.send({
        to,
        from: { email: fromEmail, name: fromName },
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
    } else {
      console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
    }
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// SMS SENDING
// ============================================

async function sendSMS(to, message) {
  ensureInit();
  
  // Format phone number
  let phone = to.replace(/\D/g, '');
  if (phone.length === 10) phone = '1' + phone;
  if (!phone.startsWith('+')) phone = '+' + phone;

  try {
    if (twilioClient) {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
    } else {
      console.log(`[SMS] To: ${phone}, Message: ${message}`);
    }
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// GET USER PREFERENCES
// ============================================

async function getPreferences(userId) {
  const result = await db.query(`
    SELECT np.*, u.email, u.first_name, u.phone
    FROM notification_preferences np
    JOIN users u ON np.user_id = u.id
    WHERE np.user_id = $1
  `, [userId]);

  if (result.rows.length === 0) {
    // Get basic user info if no preferences set
    const user = await db.query(
      'SELECT email, first_name, phone FROM users WHERE id = $1',
      [userId]
    );
    return user.rows[0] ? { 
      ...user.rows[0], 
      email_enabled: true, 
      sms_enabled: false 
    } : null;
  }

  return result.rows[0];
}

// ============================================
// TEMPLATE PROCESSING
// ============================================

function processTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

// Email templates
const emailTemplates = {
  booking_confirmation: {
    subject: 'Class Booked: {{class_name}}',
    html: `<h2>You're booked!</h2>
<p>Hi {{first_name}},</p>
<p>You're confirmed for <strong>{{class_name}}</strong></p>
<p>📅 {{date}} at {{time}}<br>📍 {{location}}<br>🧘 {{teacher}}</p>
<p>Please arrive 10-15 minutes early.</p>
<p>Namaste,<br>The Studio Reno</p>`,
  },
  
  booking_cancelled: {
    subject: 'Booking Cancelled: {{class_name}}',
    html: `<p>Hi {{first_name}},</p>
<p>Your booking for {{class_name}} on {{date}} has been cancelled.</p>
<p>The Studio Reno</p>`,
  },
  
  class_reminder: {
    subject: 'Tomorrow: {{class_name}}',
    html: `<p>Hi {{first_name}},</p>
<p>Reminder: <strong>{{class_name}}</strong> tomorrow at {{time}}.</p>
<p>📍 {{location}}</p>
<p>See you on the mat!</p>`,
  },
  
  waitlist_spot: {
    subject: 'Spot Open: {{class_name}}',
    html: `<p>Hi {{first_name}},</p>
<p>A spot opened up for <strong>{{class_name}}</strong> on {{date}}!</p>
<p>Book now before it fills up.</p>`,
  },
  
  welcome: {
    subject: 'Welcome to The Studio Reno!',
    html: `<h2>Welcome, {{first_name}}!</h2>
<p>We're excited to have you join our community.</p>
<p>New students: Get unlimited classes for just $40 your first month!</p>
<p>Ready to book your first class? Visit thestudioreno.com/schedule</p>
<p>Namaste,<br>The Studio Reno</p>`,
  },
  
  membership_expiring: {
    subject: 'Your Membership Expires Soon',
    html: `<p>Hi {{first_name}},</p>
<p>Your {{membership_name}} expires in {{days}} days.</p>
<p>Renew now to keep your practice going!</p>`,
  },
  
  low_credits: {
    subject: 'Low Credits Reminder',
    html: `<p>Hi {{first_name}},</p>
<p>You have {{credits}} class credits remaining.</p>
<p>Top up to keep your practice going!</p>`,
  },
};

// SMS templates
const smsTemplates = {
  booking_confirmation: 'Booked: {{class_name}} on {{date}} at {{time}}. See you at {{location}}! -The Studio',
  booking_cancelled: 'Cancelled: {{class_name}} on {{date}}. -The Studio',
  class_reminder: 'Tomorrow: {{class_name}} at {{time}} at {{location}}. See you! -The Studio',
  waitlist_spot: 'Spot open! {{class_name}} on {{date}}. Book now! -The Studio',
  welcome: 'Welcome to The Studio Reno, {{first_name}}! Book your first class at thestudioreno.com',
  membership_expiring: '{{first_name}}, your membership expires in {{days}} days. Renew at thestudioreno.com',
};

// ============================================
// MAIN NOTIFICATION FUNCTION
// ============================================

/**
 * Send notification based on user preferences
 * @param {string} userId - User ID
 * @param {string} type - Notification type (booking_confirmation, etc.)
 * @param {object} data - Template data
 * @param {object} options - Override options
 */
async function notify(userId, type, data, options = {}) {
  const prefs = await getPreferences(userId);
  if (!prefs) {
    console.warn(`No user found for notification: ${userId}`);
    return { email: false, sms: false };
  }

  const results = { email: false, sms: false };
  const templateData = { first_name: prefs.first_name, ...data };

  // Determine preference keys
  const emailPrefKey = `email_${type.replace('_confirmation', '').replace('_cancelled', '')}`;
  const smsPrefKey = `sms_${type.replace('_confirmation', '').replace('_cancelled', '')}`;

  // Send email if enabled
  const shouldEmail = options.forceEmail || (
    prefs.email_enabled && 
    prefs.email && 
    (prefs[emailPrefKey] !== false)
  );

  if (shouldEmail && emailTemplates[type]) {
    const template = emailTemplates[type];
    const result = await sendEmail(
      prefs.email,
      processTemplate(template.subject, templateData),
      processTemplate(template.html, templateData)
    );
    results.email = result.success;

    // Log
    await db.query(`
      INSERT INTO notification_log (user_id, channel, template_name, recipient, subject, status)
      VALUES ($1, 'email', $2, $3, $4, $5)
    `, [userId, type, prefs.email, template.subject, result.success ? 'sent' : 'failed']);
  }

  // Send SMS if enabled
  const shouldSMS = options.forceSMS || (
    prefs.sms_enabled && 
    (prefs.sms_phone || prefs.phone) && 
    (prefs[smsPrefKey] !== false)
  );

  if (shouldSMS && smsTemplates[type]) {
    const phone = prefs.sms_phone || prefs.phone;
    const message = processTemplate(smsTemplates[type], templateData);
    const result = await sendSMS(phone, message);
    results.sms = result.success;

    // Log
    await db.query(`
      INSERT INTO notification_log (user_id, channel, template_name, recipient, status)
      VALUES ($1, 'sms', $2, $3, $4)
    `, [userId, type, phone, result.success ? 'sent' : 'failed']);
  }

  return results;
}

// ============================================
// CONVENIENCE METHODS
// ============================================

async function notifyBookingConfirmation(userId, classData) {
  return notify(userId, 'booking_confirmation', {
    class_name: classData.class_name,
    date: formatDate(classData.date),
    time: formatTime(classData.start_time),
    location: classData.location_name,
    teacher: `${classData.teacher_first_name} ${classData.teacher_last_name}`,
  });
}

async function notifyBookingCancelled(userId, bookingData) {
  return notify(userId, 'booking_cancelled', {
    class_name: bookingData.class_name,
    date: formatDate(bookingData.date),
  });
}

async function notifyClassReminder(userId, classData) {
  return notify(userId, 'class_reminder', {
    class_name: classData.class_name,
    time: formatTime(classData.start_time),
    location: classData.location_name,
  });
}

async function notifyWaitlistSpot(userId, classData) {
  return notify(userId, 'waitlist_spot', {
    class_name: classData.class_name,
    date: formatDate(classData.date),
  });
}

async function notifyWelcome(userId) {
  return notify(userId, 'welcome', {});
}

async function notifyMembershipExpiring(userId, membershipData) {
  return notify(userId, 'membership_expiring', {
    membership_name: membershipData.membership_name,
    days: membershipData.days_until_expiry,
  });
}

async function notifyLowCredits(userId, credits) {
  return notify(userId, 'low_credits', { credits });
}

// ============================================
// BULK NOTIFICATIONS
// ============================================

async function notifyBulk(userIds, type, data) {
  const results = await Promise.allSettled(
    userIds.map(userId => notify(userId, type, data))
  );

  return {
    total: userIds.length,
    succeeded: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  };
}

// ============================================
// HELPERS
// ============================================

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(time) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

// ============================================
// RENTAL INQUIRY NOTIFICATION
// ============================================

async function sendRentalInquiryNotification(inquiry) {
  const {
    id,
    first_name,
    last_name,
    email,
    phone,
    room_type,
    rental_type,
    practice_type,
    message,
  } = inquiry;

  const roomTypeLabel = {
    large: 'Large Room (~25 capacity)',
    small: 'Small Room (~12 capacity)',
    either: 'Either room',
  }[room_type] || room_type;

  const rentalTypeLabel = {
    hourly: 'Hourly rental',
    monthly: 'Monthly rental',
    not_sure: 'Not sure yet',
  }[rental_type] || rental_type;

  // Email to admin
  const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || 'thestudioreno@gmail.com';

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">New Space Rental Inquiry</h2>

      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Contact Information</h3>
        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      </div>

      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Rental Preferences</h3>
        <p><strong>Room:</strong> ${roomTypeLabel}</p>
        <p><strong>Rental Type:</strong> ${rentalTypeLabel}</p>
        ${practice_type ? `<p><strong>Practice Type:</strong> ${practice_type}</p>` : ''}
      </div>

      ${message ? `
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Message</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
      ` : ''}

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        View full details in the admin portal: Inquiry ID ${id}
      </p>
    </div>
  `;

  await sendEmail(
    adminEmail,
    `New Space Rental Inquiry - ${first_name} ${last_name}`,
    adminHtml
  );

  // Confirmation email to inquirer
  const confirmationHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Thank You for Your Interest!</h2>

      <p>Hi ${first_name},</p>

      <p>Thanks for reaching out about renting space at The Studio Reno! We received your inquiry and will be in touch within 1-2 business days.</p>

      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">What's Next?</h3>
        <ul style="line-height: 1.8;">
          <li>We'll review your information</li>
          <li>Reach out to schedule a tour of the space</li>
          <li>Discuss availability and pricing details</li>
          <li>Answer any questions you have</li>
        </ul>
      </div>

      <p>In the meantime, feel free to check out our <a href="${process.env.FRONTEND_URL || 'https://thestudioreno.com'}/for-teachers" style="color: #7c3aed;">For Teachers page</a> for more details about our spaces and pricing.</p>

      <p>Looking forward to connecting!</p>

      <p style="margin-top: 30px;">
        <strong>The Studio Reno Team</strong><br/>
        ${process.env.FROM_EMAIL || 'thestudioreno@gmail.com'}<br/>
        ${process.env.STUDIO_PHONE || '(775) 555-5924'}
      </p>
    </div>
  `;

  await sendEmail(
    email,
    'Thank you for your inquiry - The Studio Reno',
    confirmationHtml
  );

  return { success: true };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core
  sendEmail,
  sendSMS,
  notify,
  notifyBulk,

  // Convenience
  notifyBookingConfirmation,
  notifyBookingCancelled,
  notifyClassReminder,
  notifyWaitlistSpot,
  notifyWelcome,
  notifyMembershipExpiring,
  notifyLowCredits,
  sendRentalInquiryNotification,

  // Helpers
  getPreferences,
  processTemplate,
};
