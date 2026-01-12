// Email Templates for The Studio Reno
// These are used by the notification service

const STUDIO_NAME = process.env.STUDIO_NAME || 'The Studio Reno';
const STUDIO_URL = process.env.FRONTEND_URL || 'https://thestudioreno.com';

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${STUDIO_NAME}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #d97706 0%, #ea580c 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #d97706; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px 30px; text-align: center; font-size: 14px; color: #6b7280; }
    .class-card { background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .class-card h3 { margin: 0 0 10px 0; color: #92400e; }
    .class-detail { margin: 5px 0; color: #78350f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${STUDIO_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${STUDIO_NAME}</p>
      <p>1085 S Virginia St, Reno, NV 89502</p>
      <p><a href="${STUDIO_URL}">Visit our website</a></p>
    </div>
  </div>
</body>
</html>
`;

const templates = {
  // Welcome email for new registrations
  welcome: (data) => ({
    subject: `Welcome to ${STUDIO_NAME}!`,
    html: baseTemplate(`
      <h2>Welcome, ${data.first_name}!</h2>
      <p>We're so excited to have you join our community at ${STUDIO_NAME}.</p>
      <p>Your account has been created and you're ready to start booking classes.</p>
      <a href="${STUDIO_URL}/schedule" class="button">View Schedule</a>
      <p>If you're new to yoga or our studio, we recommend trying one of our beginner-friendly classes to start.</p>
      <p>See you on the mat!</p>
      <p>With love,<br>The ${STUDIO_NAME} Team</p>
    `),
    text: `Welcome to ${STUDIO_NAME}, ${data.first_name}! Your account has been created. Visit ${STUDIO_URL}/schedule to book your first class.`
  }),

  // Booking confirmation
  bookingConfirmation: (data) => ({
    subject: `You're booked! ${data.class_name} on ${data.date}`,
    html: baseTemplate(`
      <h2>You're all set, ${data.first_name}!</h2>
      <p>Your spot is reserved for:</p>
      <div class="class-card">
        <h3>${data.class_name}</h3>
        <p class="class-detail"><strong>Date:</strong> ${data.date}</p>
        <p class="class-detail"><strong>Time:</strong> ${data.time}</p>
        <p class="class-detail"><strong>Teacher:</strong> ${data.teacher_name}</p>
        <p class="class-detail"><strong>Location:</strong> ${data.location}</p>
      </div>
      <p><strong>What to bring:</strong> Water, a yoga mat (or rent one for $3), and an open mind!</p>
      <p><strong>Arrival:</strong> Please arrive 10-15 minutes early, especially if it's your first time.</p>
      <a href="${STUDIO_URL}/account" class="button">View My Bookings</a>
      <p>Need to cancel? Please do so at least 2 hours before class to avoid losing your credit.</p>
    `),
    text: `You're booked for ${data.class_name} on ${data.date} at ${data.time} with ${data.teacher_name}. Please arrive 10-15 minutes early.`
  }),

  // Class reminder (sent day before or morning of)
  classReminder: (data) => ({
    subject: `Reminder: ${data.class_name} ${data.is_tomorrow ? 'tomorrow' : 'today'} at ${data.time}`,
    html: baseTemplate(`
      <h2>See you ${data.is_tomorrow ? 'tomorrow' : 'soon'}, ${data.first_name}!</h2>
      <p>This is a friendly reminder about your upcoming class:</p>
      <div class="class-card">
        <h3>${data.class_name}</h3>
        <p class="class-detail"><strong>Date:</strong> ${data.date}</p>
        <p class="class-detail"><strong>Time:</strong> ${data.time}</p>
        <p class="class-detail"><strong>Teacher:</strong> ${data.teacher_name}</p>
        <p class="class-detail"><strong>Location:</strong> ${data.location}</p>
      </div>
      <p>Remember to bring water and arrive 10-15 minutes early!</p>
      <p>Need to cancel? Please do so at least 2 hours before class.</p>
    `),
    text: `Reminder: ${data.class_name} ${data.is_tomorrow ? 'tomorrow' : 'today'} at ${data.time} with ${data.teacher_name}. See you there!`
  }),

  // Booking cancellation
  bookingCancellation: (data) => ({
    subject: `Booking cancelled: ${data.class_name}`,
    html: baseTemplate(`
      <h2>Booking Cancelled</h2>
      <p>Hi ${data.first_name},</p>
      <p>Your booking for the following class has been cancelled:</p>
      <div class="class-card">
        <h3>${data.class_name}</h3>
        <p class="class-detail"><strong>Date:</strong> ${data.date}</p>
        <p class="class-detail"><strong>Time:</strong> ${data.time}</p>
      </div>
      ${data.credit_refunded ? '<p>Your class credit has been refunded.</p>' : '<p>As this was a late cancellation, no credit has been refunded.</p>'}
      <a href="${STUDIO_URL}/schedule" class="button">Book Another Class</a>
    `),
    text: `Your booking for ${data.class_name} on ${data.date} has been cancelled. ${data.credit_refunded ? 'Your credit has been refunded.' : 'Late cancellation - no credit refunded.'}`
  }),

  // Waitlist notification
  waitlistSpotOpen: (data) => ({
    subject: `A spot opened up in ${data.class_name}!`,
    html: baseTemplate(`
      <h2>Good news, ${data.first_name}!</h2>
      <p>A spot just opened up in a class you were waiting for:</p>
      <div class="class-card">
        <h3>${data.class_name}</h3>
        <p class="class-detail"><strong>Date:</strong> ${data.date}</p>
        <p class="class-detail"><strong>Time:</strong> ${data.time}</p>
        <p class="class-detail"><strong>Teacher:</strong> ${data.teacher_name}</p>
      </div>
      <p><strong>⏰ Act fast!</strong> This spot is held for you for ${data.hold_minutes} minutes.</p>
      <a href="${STUDIO_URL}/schedule" class="button">Book Now</a>
      <p>After ${data.hold_minutes} minutes, the spot will be offered to the next person on the waitlist.</p>
    `),
    text: `A spot opened up in ${data.class_name} on ${data.date}! Book now - it's held for ${data.hold_minutes} minutes.`
  }),

  // Membership purchase confirmation
  membershipPurchase: (data) => ({
    subject: `Welcome to your new ${data.membership_name} membership!`,
    html: baseTemplate(`
      <h2>Thank you, ${data.first_name}!</h2>
      <p>Your membership purchase is confirmed:</p>
      <div class="class-card">
        <h3>${data.membership_name}</h3>
        <p class="class-detail"><strong>Type:</strong> ${data.type === 'unlimited' ? 'Unlimited Classes' : `${data.credits} Class Credits`}</p>
        ${data.end_date ? `<p class="class-detail"><strong>Valid until:</strong> ${data.end_date}</p>` : ''}
        <p class="class-detail"><strong>Amount paid:</strong> $${data.amount}</p>
      </div>
      <a href="${STUDIO_URL}/schedule" class="button">Start Booking Classes</a>
      <p>Questions about your membership? Just reply to this email.</p>
    `),
    text: `Your ${data.membership_name} membership is confirmed! ${data.type === 'unlimited' ? 'Unlimited classes' : `${data.credits} credits`} for $${data.amount}.`
  }),

  // Membership expiring soon
  membershipExpiring: (data) => ({
    subject: `Your membership expires in ${data.days_left} days`,
    html: baseTemplate(`
      <h2>Hi ${data.first_name},</h2>
      <p>Just a heads up that your membership is expiring soon:</p>
      <div class="class-card">
        <h3>${data.membership_name}</h3>
        <p class="class-detail"><strong>Expires:</strong> ${data.end_date}</p>
        ${data.credits_remaining ? `<p class="class-detail"><strong>Credits remaining:</strong> ${data.credits_remaining}</p>` : ''}
      </div>
      <p>Don't miss a class! Renew your membership to keep your practice going.</p>
      <a href="${STUDIO_URL}/pricing" class="button">Renew Membership</a>
      <p>Questions? Just reply to this email.</p>
    `),
    text: `Your ${data.membership_name} membership expires on ${data.end_date}. Visit ${STUDIO_URL}/pricing to renew.`
  }),

  // Class cancelled by studio
  classCancelledByStudio: (data) => ({
    subject: `Class Cancelled: ${data.class_name} on ${data.date}`,
    html: baseTemplate(`
      <h2>Class Cancelled</h2>
      <p>Hi ${data.first_name},</p>
      <p>Unfortunately, we had to cancel the following class:</p>
      <div class="class-card">
        <h3>${data.class_name}</h3>
        <p class="class-detail"><strong>Date:</strong> ${data.date}</p>
        <p class="class-detail"><strong>Time:</strong> ${data.time}</p>
        <p class="class-detail"><strong>Teacher:</strong> ${data.teacher_name}</p>
      </div>
      <p>${data.reason || "We apologize for any inconvenience."}</p>
      <p>Your class credit has been automatically refunded.</p>
      <a href="${STUDIO_URL}/schedule" class="button">Book Another Class</a>
    `),
    text: `${data.class_name} on ${data.date} has been cancelled. Your credit has been refunded. We apologize for the inconvenience.`
  }),

  // Password reset
  passwordReset: (data) => ({
    subject: `Reset your ${STUDIO_NAME} password`,
    html: baseTemplate(`
      <h2>Password Reset Request</h2>
      <p>Hi ${data.first_name},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <a href="${data.reset_url}" class="button">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
    `),
    text: `Reset your password: ${data.reset_url} (expires in 1 hour)`
  }),

  // Receipt
  receipt: (data) => ({
    subject: `Your receipt from ${STUDIO_NAME}`,
    html: baseTemplate(`
      <h2>Receipt</h2>
      <p>Hi ${data.first_name},</p>
      <p>Thank you for your purchase!</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Item:</strong> ${data.item_name}</p>
        <p><strong>Amount:</strong> $${data.amount}</p>
        <p><strong>Payment method:</strong> ${data.payment_method}</p>
        ${data.transaction_id ? `<p><strong>Transaction ID:</strong> ${data.transaction_id}</p>` : ''}
      </div>
      <p>Questions? Just reply to this email.</p>
    `),
    text: `Receipt from ${STUDIO_NAME}: ${data.item_name} - $${data.amount} on ${data.date}`
  }),
};

module.exports = templates;
