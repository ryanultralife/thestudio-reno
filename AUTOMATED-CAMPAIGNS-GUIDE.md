# Automated Email Campaigns Guide

Your platform now includes a powerful automated notification system that can trigger emails/SMS based on member and teacher behavior!

## 🎯 What's Been Built

### Backend System
- **Campaign Database** - Store campaign rules and configurations
- **Rules Engine** - Check conditions and find eligible users
- **Scheduler** - Runs campaigns every hour automatically
- **Tracking** - Monitor opens, clicks, and performance
- **API** - Full REST API for managing campaigns

### Pre-Built Campaigns

Your system comes with 7 ready-to-use campaigns:

#### Member Engagement
1. **Membership Expiring Soon** - Remind 7 days before expiration
2. **Inactive Member Check-in** - Reach out after 14 days of no visits
3. **Declining Attendance Alert** - Engage members whose visits are dropping
4. **Low Credits Warning** - Alert when credits below 2
5. **No Upcoming Bookings** - Nudge members with no future bookings
6. **10 Class Milestone** - Celebrate completing 10 classes

#### Teacher Engagement
7. **Teacher Inactive Check-in** - Check in after 21 days of no teaching

---

## 📊 How It Works

### 1. Campaign Triggers

Each campaign watches for specific conditions:

| Trigger | What It Watches |
|---------|----------------|
| `membership_expiring` | Days until membership ends |
| `inactive_member` | Days since last visit |
| `declining_attendance` | Attendance trend (increasing/decreasing) |
| `low_credits` | Credits remaining |
| `no_upcoming_bookings` | Future bookings count |
| `teacher_no_classes` | Days since last taught |
| `attendance_milestone` | Total classes completed |

### 2. Automated Checks

The system runs **every hour** and:
- Checks which campaigns are due to run
- Finds users matching each campaign's criteria
- Sends personalized emails/SMS
- Logs everything for reporting
- Updates next run time

### 3. Smart Features

**Cooldown Periods** - Won't resend to same user within X days (default 30)

**Send Limits** - Can cap sends per run to prevent email overload

**Opt-Out Respect** - Honors user notification preferences

**Personalization** - Uses merge tags like `{{first_name}}`, `{{expiration_date}}`

**Engagement Tracking** - Tracks opens and clicks via tracking pixels

---

## 🚀 Using the System

### Via API (For Now)

#### List All Campaigns
```bash
GET /api/campaigns
Authorization: Bearer <token>
```

#### Get Campaign Details & Stats
```bash
GET /api/campaigns/:id
```

#### Create New Campaign
```bash
POST /api/campaigns
Content-Type: application/json

{
  "name": "Birthday Celebration",
  "description": "Send birthday wishes",
  "trigger_type": "birthday",
  "target_type": "members",
  "target_roles": ["student"],
  "channel": "email",
  "email_subject": "Happy Birthday {{first_name}}! 🎉",
  "email_body": "Hi {{first_name}},\n\nHappy Birthday! We'd love to celebrate with you.\n\nEnjoy a complimentary class this week!\n\nNameste,\nThe Studio Team",
  "run_frequency": "daily",
  "run_time": "09:00:00",
  "cooldown_days": 365,
  "is_active": true
}
```

#### Preview Who Would Receive Campaign
```bash
GET /api/campaigns/:id/preview
```

#### Run Campaign Manually (Test)
```bash
POST /api/campaigns/:id/run
```

#### Get Performance Stats
```bash
GET /api/campaigns/:id/stats
```

Returns:
- Total sends
- Open rate
- Click rate
- Recent sends

---

## 📝 Available Merge Tags

Use these in email subject/body for personalization:

| Tag | Description |
|-----|-------------|
| `{{first_name}}` | User's first name |
| `{{last_name}}` | User's last name |
| `{{email}}` | User's email |
| `{{expiration_date}}` | Membership end date |
| `{{credits_remaining}}` | Credits left |
| `{{classes_last_month}}` | Classes attended last 30 days |
| `{{days_since_visit}}` | Days since last class |
| `{{schedule_link}}` | Link to schedule page |
| `{{renewal_link}}` | Link to pricing page |
| `{{purchase_link}}` | Link to purchase credits |
| `{{account_link}}` | Link to user account |

---

## 🎨 Campaign Configuration

### Trigger Configuration (JSON)

Each trigger type can have configuration:

```json
// Membership Expiring
{"days_before": 7}

// Inactive Member
{"days_inactive": 14}

// Declining Attendance
{"threshold_percent": 50}

// Low Credits
{"threshold": 2}

// Teacher Inactive
{"days_inactive": 21}

// Attendance Milestone
{"milestone": 10}
```

### Scheduling Options

**Frequency**:
- `hourly` - Every hour
- `daily` - Once per day at specified time
- `weekly` - Once per week

**Run Time**: `"09:00:00"` (24-hour format)

**Cooldown**: Prevents resending to same user (days)

**Max Sends Per Run**: Limit batch size (prevents email throttling)

---

## 📈 Engagement Metrics View

The system automatically calculates these for each member:

### Member Metrics
- Classes last 30 days vs previous 30 days
- Last class date & days since
- Upcoming bookings count
- Days until membership expiration
- Credits remaining
- Engagement trend (increasing/decreasing/stable)
- Risk flags (expiring soon, inactive, low credits)

### Teacher Metrics
- Classes taught last 30 days
- Days since last taught
- Upcoming classes count
- Average attendance
- Activity flags (inactive, no upcoming)

---

## 🛠️ Adding Custom Campaigns

### Example: Re-engagement Campaign

Target members who haven't visited in 30 days:

```json
{
  "name": "We Miss You - 30 Day Check-in",
  "trigger_type": "inactive_member",
  "trigger_config": {"days_inactive": 30},
  "channel": "email",
  "email_subject": "Come back to your practice",
  "email_body": "Hi {{first_name}},\n\nIt's been a month since we've seen you! Life gets busy, we understand.\n\nYour mat is waiting for you. Book a class this week:\n{{schedule_link}}\n\nWe'd love to support you in getting back to your practice.",
  "run_frequency": "daily",
  "cooldown_days": 90
}
```

### Example: Milestone Campaign

Celebrate 50 classes:

```json
{
  "name": "50 Class Milestone",
  "trigger_type": "attendance_milestone",
  "trigger_config": {"milestone": 50},
  "channel": "both",
  "email_subject": "🎉 You've completed 50 classes!",
  "email_body": "Hi {{first_name}},\n\nWOW! You've completed 50 classes at The Studio Reno.\n\nYour dedication is truly inspiring. This is a huge milestone!\n\nKeep showing up for yourself. 🙏",
  "sms_message": "🎉 {{first_name}}, you did it! 50 classes complete! Your dedication inspires us. - The Studio",
  "run_frequency": "daily",
  "cooldown_days": 9999
}
```

---

## 🔍 Monitoring & Optimization

### Check Campaign Performance

1. **View Stats**: `GET /api/campaigns/:id/stats`
2. **Check Recent Sends**: See who received emails and when
3. **Monitor Open Rates**: Is subject line working?
4. **Track Clicks**: Are CTAs effective?

### Optimization Tips

**Low Open Rates?**
- Test different subject lines
- Check spam score
- Verify sender email is authenticated

**Low Click Rates?**
- Make CTA clearer
- Add urgency
- Simplify message

**Too Many Sends?**
- Adjust `max_sends_per_run`
- Increase `cooldown_days`
- Refine trigger criteria

**Not Enough Engagement?**
- Personalize more
- Add value (tips, offers)
- Test send times

---

## 🚫 User Opt-Out

Users can manage preferences via `user_notification_preferences` table:

```sql
UPDATE user_notification_preferences
SET attendance_nudges = false
WHERE user_id = '<user_id>';
```

Future: Add preference center UI in member accounts.

---

## 🎯 Best Practices

### Email Content
- ✅ Personal and warm tone
- ✅ Clear single call-to-action
- ✅ Mobile-friendly (short paragraphs)
- ✅ Value-first (not salesy)
- ❌ Multiple CTAs (confusing)
- ❌ Long paragraphs
- ❌ Heavy images (slow load)

### Timing
- Send mornings (9-11am) for best open rates
- Avoid Mondays (inbox overload)
- Test different days/times

### Frequency
- Don't over-email (max 1-2/week per user)
- Use cooldown periods
- Quality over quantity

### Testing
- Preview campaigns before activating
- Test with yourself first
- Monitor stats closely first week
- Adjust based on data

---

## 📅 Recommended Campaign Calendar

| Day | Time | Campaign |
|-----|------|----------|
| Every Day | 9am | Membership Expiring (7 days) |
| Every Day | 9am | Low Credits Warning |
| Every Day | 10am | No Upcoming Bookings |
| Every Day | 10am | Milestones (10, 50, 100 classes) |
| Monday | 9am | Inactive 14 Days |
| Wednesday | 9am | Declining Attendance |
| Friday | 9am | Teacher Inactive Check-in |

---

## 🔧 Technical Details

### Database Tables

**`notification_campaigns`** - Campaign definitions

**`notification_campaign_logs`** - Send history (who, when, status)

**`user_notification_preferences`** - Opt-out settings

**`member_engagement_metrics` (view)** - Computed engagement data

**`teacher_engagement_metrics` (view)** - Teacher activity data

### Scheduler

Runs via `node-cron` every hour: `0 * * * *`

Located in: `backend/src/services/scheduler.js`

### Service

Campaign logic: `backend/src/services/campaigns.js`

Key functions:
- `runCampaigns()` - Check and run due campaigns
- `runSingleCampaign(campaign)` - Execute one campaign
- `getCampaignPreview(id)` - Preview target list
- `getCampaignStats(id)` - Get performance metrics

---

## 🚀 Next Steps

### Phase 1: Setup
1. Run database migration: `campaigns-schema.sql`
2. Install node-cron: `npm install node-cron`
3. Restart server (scheduler auto-starts)
4. Verify campaigns exist: `GET /api/campaigns`

### Phase 2: Test
1. Create test campaign with short cooldown
2. Preview targets: `GET /api/campaigns/:id/preview`
3. Run manually: `POST /api/campaigns/:id/run`
4. Check logs for sends
5. Verify emails received

### Phase 3: Activate
1. Review and customize default campaigns
2. Set appropriate cooldown periods
3. Activate campaigns one at a time
4. Monitor stats daily first week
5. Adjust based on performance

### Phase 4: Expand
1. Add more milestone campaigns
2. Create seasonal campaigns
3. Build preference center UI
4. Add SMS campaigns
5. Implement A/B testing

---

## 💡 Campaign Ideas

### Retention
- "It's been 60 days" - strong re-engagement offer
- "Your membership is on hold" - reactivation
- "We noticed you downgraded" - upgrade incentive

### Growth
- "Bring a friend" - referral program
- "Try something new" - cross-sell to new class types
- "Upgrade and save" - class pack → unlimited

### Community
- "New classes this month"
- "Teacher spotlight: Meet Sarah"
- "Member of the month"
- "Studio anniversary"

### Seasonal
- "New Year, New You" (January)
- "Spring into Wellness" (March)
- "Summer Wellness Challenge" (June)
- "Fall Reset" (September)

---

## 🆘 Troubleshooting

**Campaigns not sending?**
- Check `is_active = true`
- Verify `next_run_at` is in past
- Check scheduler is running
- Review application logs

**Wrong users receiving?**
- Review trigger configuration
- Check `get_campaign_targets()` function
- Test with preview endpoint

**Emails not delivering?**
- Verify SendGrid API key
- Check sender email is authenticated
- Review SendGrid activity log
- Check spam filters

**Stats not tracking?**
- Ensure tracking pixel in email HTML
- Check click tracking URLs
- Verify API endpoints working

---

## 📞 Support

For questions or issues:
1. Check application logs: `docker logs` or Railway logs
2. Test API endpoints with curl/Postman
3. Review database for campaign logs
4. Check scheduler console output

---

**Built with ❤️ for The Studio Reno**

This automated system will help you retain members, re-engage inactive students, and build stronger relationships with your community!
