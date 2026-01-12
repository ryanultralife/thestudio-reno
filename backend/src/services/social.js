// ============================================
// SOCIAL MEDIA SERVICE
// Auto-post to Facebook and Instagram
// ============================================

const db = require('../database/connection');

// Facebook/Instagram Graph API base URL
const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Post to Facebook Page
 */
async function postToFacebook(content) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    console.log('Facebook credentials not configured, skipping post');
    return null;
  }

  try {
    const response = await fetch(`${GRAPH_API_URL}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content.message,
        link: content.link,
        access_token: accessToken,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Facebook post failed:', data.error);
      return null;
    }

    console.log('✅ Posted to Facebook:', data.id);
    return data.id;
  } catch (error) {
    console.error('Facebook post error:', error);
    return null;
  }
}

/**
 * Post photo to Facebook Page
 */
async function postPhotoToFacebook(content) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${GRAPH_API_URL}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: content.imageUrl,
        caption: content.message,
        access_token: accessToken,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Facebook photo post failed:', data.error);
      return null;
    }

    console.log('✅ Posted photo to Facebook:', data.id);
    return data.id;
  } catch (error) {
    console.error('Facebook photo error:', error);
    return null;
  }
}

/**
 * Post to Instagram Business Account
 */
async function postToInstagram(content) {
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN; // Same token works for IG

  if (!igAccountId || !accessToken || !content.imageUrl) {
    console.log('Instagram credentials not configured or no image, skipping post');
    return null;
  }

  try {
    // Step 1: Create media container
    const containerResponse = await fetch(`${GRAPH_API_URL}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: content.imageUrl,
        caption: content.message,
        access_token: accessToken,
      }),
    });

    const containerData = await containerResponse.json();
    
    if (containerData.error) {
      console.error('Instagram container creation failed:', containerData.error);
      return null;
    }

    // Step 2: Publish the container
    const publishResponse = await fetch(`${GRAPH_API_URL}/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken,
      }),
    });

    const publishData = await publishResponse.json();
    
    if (publishData.error) {
      console.error('Instagram publish failed:', publishData.error);
      return null;
    }

    console.log('✅ Posted to Instagram:', publishData.id);
    return publishData.id;
  } catch (error) {
    console.error('Instagram post error:', error);
    return null;
  }
}

/**
 * Generate social media content for a new class
 */
function generateClassPost(classData) {
  const { class_name, teacher_name, date, start_time, location_name, description } = classData;
  
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  
  const formattedTime = start_time.slice(0, 5);
  const period = parseInt(start_time.slice(0, 2)) >= 12 ? 'PM' : 'AM';
  const hour12 = parseInt(start_time.slice(0, 2)) % 12 || 12;
  const timeStr = `${hour12}:${start_time.slice(3, 5)} ${period}`;

  const message = `🧘 ${class_name} with ${teacher_name}

📅 ${formattedDate}
⏰ ${timeStr}
📍 ${location_name}

${description || 'Join us on the mat for a transformative practice. All levels welcome!'}

Book now at thestudioreno.com/schedule

#TheStudioReno #YogaReno #RenoYoga #${class_name.replace(/\s+/g, '')}`;

  return {
    message,
    link: `${process.env.FRONTEND_URL}/schedule`,
  };
}

/**
 * Generate social media content for a special event/workshop
 */
function generateEventPost(eventData) {
  const { name, date, start_time, price, description, teacher_name } = eventData;
  
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const message = `✨ Special Event: ${name}

${description}

📅 ${formattedDate}
⏰ ${start_time}
${teacher_name ? `👤 Led by ${teacher_name}` : ''}
💰 ${price ? `$${price}` : 'Free'}

Limited spots available! Reserve yours now at thestudioreno.com

#TheStudioReno #YogaWorkshop #RenoEvents #Wellness`;

  return {
    message,
    link: `${process.env.FRONTEND_URL}/events`,
  };
}

/**
 * Post new class announcement to social media
 */
async function announceNewClass(classId) {
  try {
    const result = await db.query(`
      SELECT 
        c.date, c.start_time,
        ct.name as class_name, ct.description,
        l.name as location_name,
        u.first_name || ' ' || u.last_name as teacher_name
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE c.id = $1
    `, [classId]);

    if (result.rows.length === 0) return;

    const classData = result.rows[0];
    const content = generateClassPost(classData);

    // Post to both platforms
    const [fbId, igId] = await Promise.all([
      postToFacebook(content),
      // Instagram requires an image, skip if we don't have one
      // postToInstagram({ ...content, imageUrl: classData.image_url }),
    ]);

    // Log the posts
    if (fbId || igId) {
      await db.query(`
        INSERT INTO social_posts (class_id, facebook_post_id, instagram_post_id, content, posted_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [classId, fbId, igId, content.message]);
    }

    return { facebook: fbId, instagram: igId };
  } catch (error) {
    console.error('Failed to announce class:', error);
    return null;
  }
}

/**
 * Schedule a post for later
 */
async function schedulePost(content, scheduledFor, platforms = ['facebook', 'instagram']) {
  try {
    const result = await db.query(`
      INSERT INTO scheduled_social_posts (content, image_url, scheduled_for, platforms, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id
    `, [content.message, content.imageUrl, scheduledFor, platforms]);

    return result.rows[0].id;
  } catch (error) {
    console.error('Failed to schedule post:', error);
    return null;
  }
}

/**
 * Process scheduled posts (call from cron)
 */
async function processScheduledPosts() {
  try {
    const posts = await db.query(`
      SELECT * FROM scheduled_social_posts
      WHERE status = 'pending' AND scheduled_for <= NOW()
    `);

    for (const post of posts.rows) {
      const content = {
        message: post.content,
        imageUrl: post.image_url,
        link: post.link,
      };

      const results = {};

      if (post.platforms.includes('facebook')) {
        results.facebook = post.image_url 
          ? await postPhotoToFacebook(content)
          : await postToFacebook(content);
      }

      if (post.platforms.includes('instagram') && post.image_url) {
        results.instagram = await postToInstagram(content);
      }

      await db.query(`
        UPDATE scheduled_social_posts 
        SET status = 'posted', posted_at = NOW(), result = $1
        WHERE id = $2
      `, [JSON.stringify(results), post.id]);
    }

    return posts.rows.length;
  } catch (error) {
    console.error('Failed to process scheduled posts:', error);
    return 0;
  }
}

module.exports = {
  postToFacebook,
  postPhotoToFacebook,
  postToInstagram,
  generateClassPost,
  generateEventPost,
  announceNewClass,
  schedulePost,
  processScheduledPosts,
};
