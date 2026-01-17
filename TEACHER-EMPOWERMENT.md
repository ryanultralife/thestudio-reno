# Teacher Empowerment & Insights System

## Overview

This system provides teachers with comprehensive insights into their performance, earnings, student engagement, and community impact. Teachers can view detailed analytics about their classes, track their growth, and manage their co-op offerings and training programs.

---

## 🎯 Teacher Dashboard Features

### 1. **Dashboard Overview** (`GET /api/teacher-insights/dashboard`)

**What Teachers See:**
- **This Week's Summary**
  - Total classes scheduled
  - Active vs cancelled classes
  - Total bookings
  - Actual attendance

- **Upcoming Classes (Next 7 Days)**
  - Class schedule with times and locations
  - Current booking counts
  - Capacity status
  - Co-op class indicators

- **Recent Trends (Last 4 Weeks)**
  - Weekly class count
  - Weekly attendance
  - Average fill rate percentage

- **Co-op Performance (Last 30 Days)**
  - Total co-op classes taught
  - Total co-op attendance
  - Estimated revenue from co-op classes

**Why It Matters:**
- Quick snapshot of current status
- See what's coming up
- Track momentum week-over-week
- Understand co-op class impact

---

### 2. **Performance Metrics** (`GET /api/teacher-insights/performance`)

**Parameters:**
- `start_date`, `end_date` - Date range
- `group_by` - 'week' or 'month'

**What Teachers See:**
- **Period-by-Period Breakdown**
  - Classes taught per period
  - Total attendance
  - Average fill rate (%)
  - Unique students
  - Returning students

- **Summary Statistics**
  - Total classes in date range
  - Total student visits
  - Overall average fill rate
  - Total unique students reached
  - Average students per class

**Insights Provided:**
- **Growth Trends**: Are your classes growing?
- **Retention**: How many students come back?
- **Consistency**: Maintaining steady attendance?
- **Reach**: Expanding your student base?

**Example:**
```json
{
  "summary": {
    "total_classes": 48,
    "total_attendance": 672,
    "avg_fill_rate": 84.5,
    "unique_students": 142,
    "avg_students_per_class": 14.0
  },
  "data": [
    {
      "period": "2026-01-06",
      "classes_taught": 12,
      "total_attendance": 168,
      "avg_fill_rate": 85.2,
      "unique_students": 48,
      "returning_students": 32
    }
  ]
}
```

---

### 3. **Class Breakdown** (`GET /api/teacher-insights/classes/breakdown`)

**What Teachers See:**
- Performance by class type
  - Vinyasa, Power, Yin, etc.
  - Co-op vs Studio classes

**For Each Class Type:**
- Classes taught
- Total attendance
- Average per class
- Average fill rate
- Peak attendance (best class ever)

**Why It Matters:**
- **Identify Strengths**: Which classes are most popular?
- **Optimize Schedule**: Should you teach more Power Flow?
- **Co-op Comparison**: How do your co-op classes perform vs studio classes?

**Example Use Case:**
> "I see my Yin classes average 18 students (90% full), but my Power Flow averages 12 (60% full). Maybe I should add another Yin class!"

---

### 4. **Student Engagement** (`GET /api/teacher-insights/students/engagement`)

**What Teachers See:**

**Top Students (Your Biggest Fans)**
- Name and contact
- Total classes attended with you
- First and last visit dates
- Average classes per week
- Which class types they love

**New Students**
- Recently attended your class for first time
- Their first class type
- Total classes since joining

**Retention Cohorts**
- Students who started each month
- How many returned after 1, 2, 3 months
- Retention percentages

**Why It Matters:**
- **Recognize Loyalty**: Know your regulars
- **Personalize Experience**: "Hey Sarah, I see you love Yin!"
- **Track Retention**: Are new students sticking around?
- **Engagement Strategy**: Reach out to at-risk students

**Example:**
```json
{
  "top_students": [
    {
      "first_name": "Sarah",
      "last_name": "Johnson",
      "classes_attended": 42,
      "first_class": "2025-09-15",
      "last_class": "2026-01-12",
      "avg_per_week": 2.8,
      "class_types_attended": ["Vinyasa Flow", "Yin Yoga", "Power Flow"]
    }
  ],
  "new_students": [
    {
      "first_name": "Mike",
      "first_class_date": "2026-01-10",
      "first_class_type": "Beginner Flow",
      "total_classes_since": 3
    }
  ],
  "retention": [
    {
      "cohort_month": "2025-12-01",
      "students": 24,
      "retained_month_1": 18,  // 75% came back
      "retained_month_2": 12,  // 50% still coming
      "retained_month_3": 9    // 37.5% long-term
    }
  ]
}
```

---

### 5. **Earnings Summary** (`GET /api/teacher-insights/earnings`)

**What Teachers See:**

**Co-op Class Earnings**
- Classes taught
- Drop-in bookings (paid with cash/card)
- Drop-in revenue earned
- Credit bookings (membership credits used)
- Total credits consumed

**Series Earnings**
- Program registrations
- Total revenue from programs
- Amount collected so far
- Outstanding payments

**Summary Totals**
- Total co-op classes created
- Total co-op revenue
- Active series/programs
- Total series revenue

**Why It Matters:**
- **Financial Transparency**: See what you're earning
- **Revenue Tracking**: Monitor co-op class income
- **Payment Plans**: Track outstanding payments
- **Business Planning**: Make informed decisions

**Example Use Case:**
> "My co-op meditation series generated $1,200 this month through drop-ins and my 200-Hour YTT has $15,000 in registrations!"

---

### 6. **My Co-op Classes** (`GET /api/teacher-insights/coop-classes`)

**Parameters:**
- `status` - 'upcoming', 'past', or 'all'

**What Teachers See:**
- All your co-op classes
- Date, time, location
- Custom pricing set
- Credit requirements
- Booking status
- Attendance count
- Revenue per class

**Management Actions:**
- View class details
- See who's booked
- Track revenue
- Monitor fill rates

---

### 7. **My Series Programs** (`GET /api/teacher-insights/series`)

**Parameters:**
- `status` - 'active', 'completed', or 'all'

**What Teachers See:**
- All your teacher trainings and workshop series
- Enrollment counts
- Waitlist counts
- Scheduled sessions
- Revenue collected vs expected
- Payment plan status

**Example:**
```json
{
  "series": [
    {
      "name": "200-Hour Yoga Teacher Training Spring 2026",
      "start_date": "2026-02-01",
      "end_date": "2026-05-31",
      "total_price": 2995,
      "enrolled_count": 18,
      "waitlist_count": 5,
      "scheduled_sessions": 30,
      "total_collected": 28500,
      "expected_revenue": 53910
    }
  ]
}
```

---

### 8. **Impact Report** (`GET /api/teacher-insights/impact`)

**What Teachers See:**

**All-Time Impact**
- Total classes taught (career)
- Total students served
- Unique students reached
- Teaching since (date you started)
- Total hours taught

**This Year**
- Classes taught
- Students served
- Unique students

**Co-op Impact**
- Co-op classes created
- Students served through co-op
- Series programs created

**Series Impact**
- Programs created (YTT, workshops)
- Total training hours delivered
- Students trained
- Certificates issued

**Why It Matters:**
- **See Your Impact**: Thousands of students touched
- **Career Milestones**: "I've taught 500 classes!"
- **Community Building**: Track co-op contributions
- **Professional Development**: Certificates issued

**Example:**
```json
{
  "all_time": {
    "total_classes_taught": 847,
    "total_students_served": 12453,
    "unique_students": 342,
    "teaching_since": "2018-03-15",
    "total_hours_taught": 1270.5
  },
  "coop_impact": {
    "coop_classes_created": 64,
    "coop_students_served": 892,
    "series_created": 3
  },
  "series_impact": {
    "programs_created": 3,
    "total_training_hours": 450,
    "students_trained": 47,
    "certificates_issued": 41
  }
}
```

---

### 9. **Schedule View** (`GET /api/teacher-insights/schedule`)

**Parameters:**
- `start_date`, `end_date` - Date range (default: today to +30 days)

**What Teachers See:**
- Complete upcoming schedule
- Class details, times, locations
- Booking counts
- Series indicators
- Cancellation status

**Why It Matters:**
- **Plan Ahead**: See your full schedule
- **Prepare**: Know which classes are full
- **Manage**: Track series sessions

---

## 📊 Complete API Reference

| Endpoint | Purpose | Key Metrics |
|----------|---------|-------------|
| `/api/teacher-insights/dashboard` | Homepage overview | Weekly summary, upcoming classes, trends |
| `/api/teacher-insights/performance` | Detailed performance over time | Classes, attendance, fill rates, retention |
| `/api/teacher-insights/classes/breakdown` | Performance by class type | Popularity by category |
| `/api/teacher-insights/students/engagement` | Student loyalty & retention | Top students, new students, cohort retention |
| `/api/teacher-insights/earnings` | Revenue from co-op & series | Drop-in revenue, series income, outstanding |
| `/api/teacher-insights/coop-classes` | Manage co-op classes | Bookings, revenue, attendance |
| `/api/teacher-insights/series` | Manage programs | Enrollments, payments, sessions |
| `/api/teacher-insights/impact` | Career impact report | All-time stats, community reach |
| `/api/teacher-insights/schedule` | Upcoming schedule | Next 30 days by default |

---

## 🎨 Frontend Dashboard Design Recommendations

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 👋 Welcome back, [Teacher Name]!                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  This Week                    Next 7 Days                   │
│  ┌──────────────┐            ┌──────────────────────┐      │
│  │ 12 Classes   │            │ Mon 1/20 - 9:00am    │      │
│  │ 156 Students │            │ Vinyasa Flow         │      │
│  │ 89% Fill     │            │ 16/18 booked         │      │
│  └──────────────┘            └──────────────────────┘      │
│                                                              │
│  Recent Trends (4 Weeks)                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        ▂▄▆█▆▅▄                                        │  │
│  │ Fill Rate: 85% avg                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Navigation Tabs:                                           │
│  [Performance] [Students] [Earnings] [Co-op] [Impact]      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Performance Tab

- **Date Range Selector** (Last 30 days, 3 months, 6 months, 1 year, Custom)
- **Group By** (Week or Month)
- **Charts:**
  - Line chart: Attendance over time
  - Bar chart: Fill rate by period
  - Donut chart: Class type distribution
- **Summary Cards:**
  - Total classes taught
  - Total students
  - Average fill rate
  - Unique students

### Students Tab

- **Top Students Table**
  - Sortable by attendance, loyalty, recency
  - Contact buttons (email, phone)
  - Quick notes

- **New Students**
  - Welcome message suggestions
  - First class date
  - Follow-up reminders

- **Retention Chart**
  - Cohort analysis visualization
  - Month-over-month retention
  - At-risk student alerts

### Earnings Tab

- **Revenue Overview Cards**
  - Co-op earnings (MTD, YTD)
  - Series revenue
  - Outstanding payments

- **Charts:**
  - Monthly revenue trends
  - Co-op vs Series breakdown
  - Payment collection rate

- **Payment Plan Tracking**
  - Upcoming payment due dates
  - Overdue payments
  - Collection status

### Co-op Classes Tab

- **Create New Co-op Class Button** (prominent)
- **Upcoming Co-op Classes**
  - Calendar view
  - List view
  - Edit/Cancel buttons

- **Past Co-op Classes**
  - Performance summary
  - Revenue per class
  - Student feedback

### Impact Tab

- **Career Highlights**
  - Total students served (big number)
  - Total hours taught
  - Years teaching

- **Milestones**
  - Badges/achievements
  - "100 classes taught!"
  - "50 students trained!"

- **Community Contribution**
  - Co-op classes created
  - Programs developed
  - Certificates issued

---

## 🔑 Key Insights Teachers Can Act On

### 1. **Optimize Class Schedule**
- See which class types are most popular
- Identify best time slots
- Adjust capacity based on fill rates

### 2. **Improve Retention**
- Spot declining attendance trends early
- Reach out to students who haven't returned
- Personalize experience for top students

### 3. **Grow Revenue**
- Create co-op classes for popular formats
- Launch training programs for engaged students
- Track payment collection efficiently

### 4. **Build Community**
- Recognize loyal students
- Welcome new students personally
- Track your teaching impact over time

### 5. **Professional Development**
- See career growth milestones
- Track training hours delivered
- Monitor certification completion rates

---

## 🚀 Teacher Empowerment Benefits

### For Teachers:
✅ **Financial Transparency** - See what you're earning
✅ **Performance Insights** - Data-driven improvement
✅ **Student Relationships** - Know your regulars
✅ **Autonomy** - Create and price co-op classes
✅ **Growth Tracking** - Career progression visibility
✅ **Business Tools** - Run teacher trainings & series

### For Studio:
✅ **Teacher Retention** - Empowered teachers stay longer
✅ **Quality Improvement** - Data helps teachers improve
✅ **Revenue Growth** - More co-op offerings = more revenue
✅ **Community Building** - Teachers invested in success
✅ **Scalability** - Teachers manage their own programs

### For Students:
✅ **Better Classes** - Teachers using data to improve
✅ **More Options** - Co-op classes expand offerings
✅ **Personal Touch** - Teachers know their students
✅ **Specialized Training** - Teacher-led programs available

---

## 🔐 Security & Permissions

**Teachers Can:**
- View only THEIR OWN class data
- See only students who attended THEIR classes
- View only THEIR co-op/series earnings
- Cannot see other teachers' data
- Cannot access studio financial reports

**Verification:**
- All endpoints verify `req.teacherId` from `teachers` table
- Middleware checks `user_id` matches authenticated user
- Queries filtered by `teacher_id` or `created_by`

---

## 📈 Future Enhancements

### Phase 2 (Potential):
- **Student Messaging** - Direct communication with students
- **Feedback Collection** - Post-class surveys
- **Goal Setting** - Set and track personal goals
- **Comparative Analytics** - Anonymous benchmarking
- **Scheduling Tools** - Request time slots
- **Substitute Management** - Handle sub requests
- **Resource Library** - Playlists, sequences, class plans

### Phase 3 (Potential):
- **Mobile App** - Dashboard on iOS/Android
- **Push Notifications** - "Class starting in 30 min"
- **Social Features** - Share achievements
- **Gamification** - Badges, streaks, challenges
- **AI Insights** - "Students who attend Monday Vinyasa also love..."

---

## 🎯 Success Metrics

Track these to measure teacher empowerment success:

**Adoption:**
- % of teachers logging into dashboard weekly
- Average time spent on insights pages
- Features used most frequently

**Engagement:**
- Co-op classes created per teacher
- Series programs launched
- Student engagement actions taken

**Outcomes:**
- Teacher retention rate
- Average class fill rates
- Student retention improvements
- Revenue from teacher-led programs

**Satisfaction:**
- Teacher NPS score
- Feature requests
- Testimonials

---

## 💡 Quick Start for Teachers

1. **Login** to staff portal
2. **Navigate** to "My Insights" or "Dashboard"
3. **Explore:**
   - Check this week's summary
   - Review performance trends
   - See your top students
   - Track co-op earnings
4. **Take Action:**
   - Create new co-op classes
   - Launch a workshop series
   - Reach out to at-risk students
   - Celebrate milestones!

---

## 🤝 Multi-Studio Rollout Strategy

### Phase 1: Studio Reno (Pilot)
- Launch full teacher insights
- Gather feedback
- Iterate on features
- Document success stories

### Phase 2: Studio Expansion
- Roll out to additional locations
- Cross-location benchmarking
- Multi-studio teacher scheduling
- Shared best practices

### Phase 3: White Label Platform
- Offer to other yoga studios
- Customizable branding
- SaaS pricing model
- Teacher empowerment as competitive advantage

---

## 📞 Support & Training

**For Teachers:**
- Dashboard walkthrough video
- Monthly "Insights Office Hours"
- Feature request portal
- Help documentation

**For Studio Managers:**
- Teacher onboarding checklist
- Dashboard setup guide
- Interpretation guide for insights
- ROI tracking

---

## Summary

This Teacher Empowerment & Insights system provides comprehensive analytics, financial transparency, and business tools that enable teachers to:
- **Understand** their performance and impact
- **Engage** meaningfully with students
- **Grow** their revenue through co-op offerings
- **Build** successful teacher training programs
- **Thrive** as empowered community leaders

By giving teachers visibility into their data and control over their offerings, you create a win-win-win for teachers, students, and the studio.
