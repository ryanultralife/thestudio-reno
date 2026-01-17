# Production Testing Checklist

**The Studio Reno - Q1 Feature Verification**

> **Purpose**: Verify all features work correctly in production before Q2 expansion.

**Production URL**: https://thestudio-reno-production.up.railway.app

---

## 🎯 Testing Priority

**P0** - Critical (must work)
**P1** - Important (should work)
**P2** - Nice-to-have (can defer)

---

## Authentication & Authorization

### P0: Login Flow
- [ ] Navigate to `/staff`
- [ ] Login with `admin@thestudio.com` / `admin123`
- [ ] Verify dashboard loads successfully
- [ ] Verify user name displays in sidebar
- [ ] Logout works
- [ ] Re-login works

### P0: Password Change
- [ ] Click "My Account" in sidebar
- [ ] Profile information displays correctly
- [ ] Enter current password: `admin123`
- [ ] Enter new password (min 8 chars)
- [ ] Confirm new password matches
- [ ] Submit form
- [ ] Verify success message
- [ ] Logout
- [ ] Login with new password
- [ ] Change password back to `admin123` (for consistency)

### P1: Permission System
- [ ] Create test user with limited permissions
- [ ] Login as limited user
- [ ] Verify restricted pages are hidden/blocked
- [ ] Login as admin again
- [ ] Delete test user

---

## Dashboard & Metrics

### P0: Dashboard Loads
- [ ] Dashboard displays without errors
- [ ] Today's date is correct
- [ ] Metrics show (even if zero): classes, bookings, memberships

### P1: Dashboard Data
- [ ] Classes scheduled for today show count
- [ ] Upcoming classes listed
- [ ] Recent activity shows (if any)

---

## Class Management

### P0: View Schedule
- [ ] Navigate to "Schedule" page
- [ ] Calendar displays current month
- [ ] Can navigate to next/previous week
- [ ] Classes display (if any scheduled)

### P1: Create Class
- [ ] Click "Add Class" or similar
- [ ] Select class type
- [ ] Select location
- [ ] Select teacher
- [ ] Set date and time
- [ ] Set capacity
- [ ] Save class
- [ ] Verify class appears in schedule

### P1: Edit Class
- [ ] Click on existing class
- [ ] Modify time or capacity
- [ ] Save changes
- [ ] Verify changes persist

### P1: Cancel Class
- [ ] Click on existing class
- [ ] Cancel class with reason
- [ ] Verify class marked as cancelled

---

## Bookings

### P1: Create Booking
- [ ] Navigate to "Clients" or "Schedule"
- [ ] Select a user
- [ ] Book them for a class
- [ ] Verify booking created
- [ ] Check user's membership credits deducted (if applicable)

### P1: Check-In
- [ ] Navigate to "Check In" page
- [ ] Find user with booking
- [ ] Mark as checked in
- [ ] Verify status changed

### P1: Cancel Booking
- [ ] Find user's booking
- [ ] Cancel booking
- [ ] Verify credits refunded (if applicable)

---

## Client Management

### P0: Search Clients
- [ ] Navigate to "Clients" page
- [ ] Search box appears
- [ ] Type email or name
- [ ] Results filter correctly

### P1: View Client Profile
- [ ] Click on a client
- [ ] Profile loads with: name, email, membership, bookings
- [ ] Membership status displays correctly
- [ ] Upcoming classes listed

### P1: Add Client Note
- [ ] In client profile, add a note
- [ ] Save note
- [ ] Verify note appears in timeline

---

## Memberships & Sales

### P0: View Membership Types
- [ ] Navigate to "Sell" or "Settings"
- [ ] List of membership types displays
- [ ] Prices are correct

### P1: Purchase Membership (Stripe Test Mode)
**Note**: Only test if Stripe test keys configured
- [ ] Navigate to "Sell" page
- [ ] Select membership type
- [ ] Select user
- [ ] Click purchase
- [ ] Stripe checkout opens
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Complete purchase
- [ ] Verify webhook processes (check Railway logs)
- [ ] Verify membership added to user

### P2: Transaction History
- [ ] Navigate to "Reports" or similar
- [ ] View transaction history
- [ ] Verify recent transactions listed

---

## CMS & Website

### P1: Access CMS
- [ ] Navigate to "Website" in sidebar
- [ ] CMS editor loads
- [ ] Tabs display: Home, Schedule, About, etc.

### P1: Edit Content
- [ ] Select "Home" page
- [ ] Edit hero section text
- [ ] Save changes
- [ ] Navigate to public site (`/`)
- [ ] Verify changes appear

### P1: View Public Website
- [ ] Navigate to `/` (public site)
- [ ] Home page loads
- [ ] Schedule page loads (`/schedule`)
- [ ] About page loads
- [ ] Pricing page loads

### P2: Theme Customization
- [ ] In CMS, navigate to Theme settings
- [ ] Change primary color
- [ ] Save
- [ ] Verify color changes on public site

---

## Reports & Analytics

### P1: Dashboard Report
- [ ] Navigate to "Reports" > "Dashboard"
- [ ] Select date range
- [ ] Verify metrics display

### P1: Attendance Report
- [ ] Navigate to "Reports" > "Attendance"
- [ ] Select date range
- [ ] Verify report generates

### P1: Revenue Report
- [ ] Navigate to "Reports" > "Revenue"
- [ ] Select date range
- [ ] Verify totals display

---

## Settings & Configuration

### P1: Class Types
- [ ] Navigate to "Settings"
- [ ] View class types list
- [ ] Edit a class type (name, duration, capacity)
- [ ] Save changes

### P1: Locations
- [ ] In Settings, view locations
- [ ] Edit location details (address, phone)
- [ ] Save changes

### P2: Membership Types
- [ ] View membership types
- [ ] Edit pricing or credits
- [ ] Save changes

---

## API Health & Performance

### P0: Health Check
- [ ] Navigate to: `/api/health`
- [ ] Verify returns: `{"status":"ok","timestamp":"..."}`

### P0: API Response Time
- [ ] Open browser DevTools > Network tab
- [ ] Navigate through app
- [ ] Verify API calls < 500ms average

### P1: Database Connection
- [ ] Check Railway logs for database errors
- [ ] Verify no connection pool exhaustion

---

## Email & Notifications

### P2: Email Sending (if SendGrid configured)
- [ ] Trigger welcome email (create new user)
- [ ] Check SendGrid activity log
- [ ] Verify email sent successfully

### P2: Campaign Execution
- [ ] Navigate to Campaigns (if UI exists)
- [ ] View campaign list
- [ ] Check logs for recent runs

---

## Security

### P0: JWT Expiration
- [ ] Login
- [ ] Wait 7+ days (or manually expire token)
- [ ] Attempt API call
- [ ] Verify auto-logout on 401

### P0: CORS Policy
- [ ] Open DevTools Console
- [ ] Check for CORS errors
- [ ] Verify none exist

### P1: Input Validation
- [ ] Try to create class with invalid data (e.g., negative capacity)
- [ ] Verify returns 400 error with message
- [ ] Try to create booking for full class
- [ ] Verify returns error

### P1: Permission Enforcement
- [ ] Try to access admin endpoint without permission
- [ ] Verify returns 403 Forbidden

---

## Mobile Responsiveness

### P1: Mobile View
- [ ] Open site on mobile device or DevTools mobile emulator
- [ ] Verify layout adapts
- [ ] Verify buttons are tappable
- [ ] Verify text is readable

### P1: Key Flows on Mobile
- [ ] Login works on mobile
- [ ] Schedule is viewable/scrollable
- [ ] Check-in works on mobile
- [ ] Public site is mobile-friendly

---

## Error Handling

### P0: 404 Pages
- [ ] Navigate to `/nonexistent-page`
- [ ] Verify 404 handling (not blank page)

### P0: API Errors
- [ ] Force an error (e.g., invalid data)
- [ ] Verify error message displays to user (not crash)

### P1: Network Errors
- [ ] Disconnect network
- [ ] Attempt action
- [ ] Verify graceful error handling
- [ ] Reconnect
- [ ] Verify recovery

---

## Data Integrity

### P1: Database Consistency
- [ ] Create booking → Verify deducts credit
- [ ] Cancel booking → Verify refunds credit
- [ ] Delete class → Verify cancels bookings

### P1: Transaction Rollback
- [ ] Attempt invalid operation (e.g., book full class)
- [ ] Verify no partial data written

---

## Performance

### P1: Page Load Time
- [ ] Measure homepage load: `< 2 seconds`
- [ ] Measure staff portal load: `< 2 seconds`
- [ ] Measure dashboard load: `< 1 second`

### P1: Database Query Performance
- [ ] Check Railway logs for slow queries (>1s)
- [ ] Verify no N+1 query issues

---

## Backup & Recovery

### P2: Database Backup
- [ ] Verify Railway PostgreSQL backups enabled
- [ ] Check backup schedule
- [ ] Test restore procedure (staging only)

---

## Monitoring & Alerting

### P2: Error Monitoring
- [ ] Set up Sentry or similar (if not done)
- [ ] Trigger test error
- [ ] Verify alert received

### P2: Uptime Monitoring
- [ ] Set up UptimeRobot or similar (if not done)
- [ ] Configure alerts for downtime

---

## Test Results

**Date Tested**: _____________
**Tester**: _____________
**Environment**: Production / Staging
**Overall Status**: ✅ Pass / ⚠️ Partial / ❌ Fail

### Critical Issues Found
1. _____________
2. _____________

### Non-Critical Issues Found
1. _____________
2. _____________

### Recommended Actions
1. _____________
2. _____________

---

## Testing Notes

**Authentication**: _____________

**Performance**: _____________

**User Experience**: _____________

**Data Integrity**: _____________

---

## Sign-Off

**Tested By**: _____________
**Date**: _____________
**Status**: Ready for Q1 Launch / Needs Fixes / Blocked

---

**Next Steps**:
1. Fix critical issues
2. Document known limitations
3. Create user training materials
4. Begin Q2 planning

---

**Document Version**: 1.0
**Last Updated**: 2026-01-17
