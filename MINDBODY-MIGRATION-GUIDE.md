# Mindbody Migration Guide

## Overview

This guide walks through migrating 10,000+ clients and their complete history from Mindbody to The Studio Reno platform.

## Pre-Migration Checklist

### 1. Mindbody API Access
- [ ] Register as Mindbody Network Partner at [developers.mindbodyonline.com](https://developers.mindbodyonline.com)
- [ ] Obtain API Key and Site ID
- [ ] Set up OAuth 2.0 credentials (Client ID, Client Secret)
- [ ] Test authentication with a few API calls
- [ ] Request increased rate limits (1,000/day default may not be enough)

### 2. Data Export Decision
**Option A: API-Only Migration (Free)**
- ✅ Email opt-in status (9k+)
- ✅ Client profiles (10k+)
- ✅ Visit history
- ✅ Membership status
- ✅ Credits/packages
- ❌ SMS opt-in status (NOT available via API)

**Option B: API + Paid Export ($500)**
- ✅ Everything from Option A
- ✅ SMS opt-in status (1,500+)
- ✅ Complete financial data
- ✅ All historical records guaranteed

**Recommendation:** Option B ($500) - SMS opt-in data is critical for your 1,500+ text subscribers and worth the investment for a complete migration.

### 3. Environment Setup
```bash
# Install dependencies
cd backend
npm install axios dotenv p-limit p-retry

# Set environment variables in .env
MINDBODY_API_KEY=your_api_key
MINDBODY_SITE_ID=your_site_id
MINDBODY_CLIENT_ID=your_oauth_client_id
MINDBODY_CLIENT_SECRET=your_oauth_client_secret
```

## Migration Strategy

### Phase 1: Client Profiles (Day 1)
- Import all 10,000+ client records
- Capture email opt-in status (9,000+)
- Create user accounts with temporary passwords
- **Estimated Time:** 4-6 hours with rate limiting
- **API Calls:** ~100 requests (100 clients per page)

### Phase 2: SMS Opt-in Data (Day 1)
- **If using paid export:** Parse CSV and match clients
- **If using API:** Unfortunately not available - manual entry required
- **Estimated Time:** 2 hours for CSV import

### Phase 3: Visit History (Day 2-3)
- Import class attendance for each client
- Build engagement metrics (last visit, total classes, etc.)
- **Estimated Time:** 8-12 hours
- **API Calls:** ~10,000 requests (one per client)

### Phase 4: Memberships & Contracts (Day 3)
- Import active memberships
- Set expiration dates and autopay schedules
- **Estimated Time:** 4 hours
- **API Calls:** ~10,000 requests

### Phase 5: Credits & Packages (Day 4)
- Import remaining credits
- Import purchased packages
- **Estimated Time:** 4 hours
- **API Calls:** ~10,000 requests

### Phase 6: Teacher Relationships (Day 4)
- Extract favorite teachers from visit history
- **Estimated Time:** 2 hours (processed from existing visit data)

## Rate Limiting Strategy

**Default Rate Limit:** 1,000 calls/day ($0.0033 per call after)

**Recommended Approach:**
1. Request increased rate limit from Mindbody (contact API support)
2. Use rate limiter in migration scripts (2 requests/second max)
3. Run migration over 4-5 days to stay within limits
4. Consider paying for overage (~10,000 calls × $0.0033 = $33 total)

**Cost Analysis:**
- Option A: ~30,000 API calls × $0.0033 = ~$100 in API overage fees
- Option B: $500 data export + minimal API calls = ~$500-550 total
- **Recommendation:** If budget allows, Option B provides complete data and peace of mind

## Data Mapping

### Mindbody → Studio Reno

| Mindbody Field | Studio Reno Field | Notes |
|----------------|-------------------|-------|
| `ClientId` | `mindbody_id` | Store for reference |
| `FirstName` | `first_name` | Direct map |
| `LastName` | `last_name` | Direct map |
| `Email` | `email` | Direct map |
| `MobilePhone` | `phone` | Direct map |
| `PromotionalEmailOptIn` | `email_opt_in` | Marketing emails |
| `EmailOptIn` | `notifications_enabled` | System emails |
| SMS opt-in (CSV) | `sms_opt_in` | From paid export |
| `BirthDate` | `date_of_birth` | Birthday campaigns |
| `AddressLine1` | `address_line1` | Direct map |
| `City` | `city` | Direct map |
| `State` | `state` | Direct map |
| `PostalCode` | `zip` | Direct map |

### Visit History Mapping

| Mindbody Field | Studio Reno Field |
|----------------|-------------------|
| `VisitId` | Reference only |
| `ClassID` | `class_id` |
| `StartDateTime` | `visit_date` |
| `StaffId` | `teacher_id` |
| `LocationID` | `location_id` |

### Membership Mapping

| Mindbody Field | Studio Reno Field |
|----------------|-------------------|
| `ContractId` | `mindbody_contract_id` |
| `ProductId` | Map to membership type |
| `StartDate` | `start_date` |
| `EndDate` | `end_date` |
| `RemainingUses` | `credits_remaining` |

## Migration Scripts

Located in `backend/src/scripts/mindbody-migration/`:

1. **`1-import-clients.js`** - Import client profiles and email opt-in
2. **`2-import-sms-optin.js`** - Import SMS opt-in from CSV export
3. **`3-import-visits.js`** - Import visit history for engagement metrics
4. **`4-import-memberships.js`** - Import active memberships and contracts
5. **`5-import-credits.js`** - Import remaining credits and packages
6. **`6-calculate-metrics.js`** - Calculate engagement scores

## Running the Migration

### Dry Run (Recommended First)
```bash
cd backend/src/scripts/mindbody-migration
node 1-import-clients.js --dry-run
```

### Full Migration
```bash
# Run each script in order
node 1-import-clients.js
node 2-import-sms-optin.js --csv=/path/to/mindbody_export.csv
node 3-import-visits.js
node 4-import-memberships.js
node 5-import-credits.js
node 6-calculate-metrics.js
```

### Monitor Progress
Access the admin dashboard at `/admin/migration` to see:
- Import progress (% complete)
- Records processed
- Errors encountered
- Estimated time remaining

## Post-Migration Tasks

### 1. Send Welcome Emails
```sql
-- Generate password reset tokens for all imported clients
UPDATE users
SET password_reset_required = true
WHERE imported_from_mindbody = true;
```

Send bulk email: "Welcome to our new platform! Click here to set your password."

### 2. Verify Data Accuracy
- [ ] Spot-check 50-100 random client records
- [ ] Verify membership expiration dates
- [ ] Confirm visit history looks correct
- [ ] Test engagement campaigns with small group first

### 3. Enable Automated Campaigns
- Go to CMS → Auto Emails
- Set Outreach Intensity to "Gentle" initially
- Enable key campaigns:
  - Membership expiring (3 days before)
  - Inactive members (30 days no visit)
  - Welcome new members
- Monitor send rates for first week

### 4. Client Communication Timeline
**Week 1:** Soft launch - inform staff only
**Week 2:** Email top 100 most active clients with early access
**Week 3:** Bulk email to all 9,000+ opted-in clients
**Week 4:** SMS to 1,500+ opted-in for text (announce new platform)

## Troubleshooting

### Rate Limit Errors
```
Error: 429 Too Many Requests
```
**Solution:** Scripts automatically retry with exponential backoff. If persistent, reduce `REQUESTS_PER_SECOND` in config.

### Authentication Failures
```
Error: 401 Unauthorized
```
**Solution:** Refresh OAuth token. Run `node scripts/refresh-mindbody-token.js`

### Missing SMS Data
**Solution:** Purchase Subscriber Data Export ($500) from [email protected]

### Duplicate Records
**Solution:** Scripts check for existing `mindbody_id` before inserting. Re-running is safe.

## Support

- Mindbody API Support: https://developers.mindbodyonline.com/
- Mindbody Technical Support: [email protected]
- Rate Limit Increases: Contact your Mindbody account manager

## Timeline Summary

| Phase | Duration | API Calls | Cost |
|-------|----------|-----------|------|
| Setup & Testing | 1 day | ~10 | Free |
| Client Profiles | 4-6 hours | ~100 | Free |
| SMS Data (CSV) | 2 hours | 0 | $500 |
| Visit History | 8-12 hours | ~10,000 | ~$30 |
| Memberships | 4 hours | ~10,000 | ~$30 |
| Credits | 4 hours | ~10,000 | ~$30 |
| **Total** | **4-5 days** | **~30,000** | **~$590** |

## Next Steps

1. **Decision:** Choose Option A (API-only) or Option B (API + $500 export)
2. **Register:** Sign up as Mindbody Network Partner
3. **Purchase:** If Option B, request Subscriber Data Export
4. **Test:** Run dry-run imports on test database
5. **Execute:** Run full migration over 4-5 days
6. **Verify:** Spot-check data accuracy
7. **Launch:** Enable campaigns and notify clients

---

*This migration will bring 10,000+ clients with their complete history into your new platform, enabling powerful automated engagement campaigns from day one.*
