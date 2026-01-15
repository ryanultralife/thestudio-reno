# Content Population Guide

Use this guide to populate your website with real content using the CMS.

## 🚀 Quick Start

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Login to Staff Portal**
   - Go to http://localhost:5173/admin
   - Email: `admin@thestudioreno.com`
   - Password: `admin123`

3. **Click "Website" in sidebar** (🌐 icon)

---

## 📍 Step 1: Update Locations

Click on **Locations** tab.

### OG Location (South Virginia)
Update with your actual information:
- **Address**: Your real street address
- **Phone**: Your actual phone number
- **Email**: Your contact email
- **Description**: Brief description of this location
- **Toggle "Has Tea Lounge"** if applicable

### Moran St Location
Update with your actual information:
- Same fields as above
- This is your hybrid space (traditional + co-op classes)

**Save each location** when done.

---

## 👨‍🏫 Step 2: Add Teacher Profiles

Click on **Teachers** tab.

For each teacher, you'll want to add:

### Required Info
- **Photo URL**: Upload photo to Cloudinary or use existing URL
  - Tip: 400x400px square photos work best
  - Professional headshots recommended

- **Bio**: 2-3 paragraphs about the teacher
  - Their yoga journey
  - Teaching style
  - What makes their classes special
  - Certifications/training

### Optional but Recommended
- **Specialties**: Comma-separated (e.g., "Vinyasa, Yin, Restorative")
- **Certifications**: Comma-separated (e.g., "RYT-200, RYT-500")
- **Instagram**: Handle without @ (e.g., "thestudioreno")
- **Website**: Full URL if they have one

### Example Teacher Bio

```
Sarah has been practicing yoga for over 15 years and teaching for 8.
She discovered yoga during a difficult period in her life and it became
her anchor. Her classes blend mindful movement with breathwork, creating
a space for students to find their own inner peace.

Sarah's teaching style is warm, inclusive, and accessible to all levels.
She believes yoga is for every body and focuses on helping students
connect with themselves rather than achieving perfect poses.

When she's not on the mat, you can find Sarah hiking in the Sierras or
enjoying a cup of tea in the lounge.
```

---

## 📸 Step 3: Upload Photos

### Using Cloudinary (Recommended)

1. Create free account at https://cloudinary.com
2. Upload photos (teacher headshots, studio photos)
3. Copy the image URLs
4. Paste into CMS (teacher photo_url, location image_url)

### Photo Checklist
- [ ] Teacher headshots (all active teachers)
- [ ] OG Location exterior
- [ ] OG Location interior (main studio)
- [ ] Tea Lounge photo
- [ ] Moran St Location exterior
- [ ] Moran St Large Room
- [ ] Moran St Small Room

---

## 📅 Step 4: Add Class Schedule

**Use the main Staff Portal** for this (not CMS):

1. Go to **Schedule** in sidebar
2. Click **Create Class**
3. Add your regular weekly classes:
   - Class name (e.g., "Morning Flow")
   - Teacher
   - Day of week
   - Time
   - Location (OG or Moran)
   - Duration
   - Capacity

### Recommended Classes to Start

- **Monday-Friday Mornings**: 6am or 9am flow
- **Weekday Evenings**: 5:30pm or 6:30pm classes
- **Weekend Classes**: Saturday/Sunday options
- **Specialty Classes**: Yin, Restorative, etc.

---

## ⚙️ Step 5: Verify Settings

### Check These Settings
- [ ] Location hours are correct
- [ ] Contact information is accurate
- [ ] Pricing matches your actual rates
- [ ] Tea Lounge hours (if applicable)

---

## ✅ Content Checklist

Before launching, make sure you have:

### Locations
- [ ] Both locations have accurate addresses
- [ ] Phone numbers are correct
- [ ] Emails are working
- [ ] Descriptions are written
- [ ] Photos uploaded (optional but recommended)

### Teachers
- [ ] All active teachers have profiles
- [ ] Each teacher has a photo
- [ ] Each teacher has a bio (2-3 paragraphs)
- [ ] Specialties listed
- [ ] Certifications listed (if applicable)

### Classes
- [ ] Weekly schedule is populated
- [ ] Teachers assigned to classes
- [ ] Times and locations are correct
- [ ] Capacity limits set

### Contact Info
- [ ] Main phone number works
- [ ] Main email is monitored
- [ ] Social media links are correct

---

## 🚀 Ready to Launch?

Once you've populated this content:

1. **Test everything locally**
   - Book a class
   - Submit a teacher inquiry
   - Check mobile view

2. **Deploy to Railway** (we'll do this next)

3. **Final checks on production**
   - All content appears correctly
   - Forms work
   - Emails send
   - Payments process

---

## 💡 Tips

- **Start with essentials**: Get locations and main teachers done first
- **Use placeholders**: If you don't have photos yet, use text-only profiles
- **Iterate**: You can always update content later
- **Test on mobile**: Most users will view on phones

---

## 🆘 Need Help?

If something isn't working:
1. Check browser console for errors (F12)
2. Verify you're logged in as admin/manager/owner
3. Check network tab to see API responses
4. Make sure backend is running (`npm run dev`)

Your content management journey starts now! 🎉
