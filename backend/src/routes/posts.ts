import { Router } from 'express';
import { supabase } from '../services/supabase';

const router = Router();

// ============================================================
// GET /api/posts/feed
// Get posts for the user's feed
// ============================================================
router.get('/feed', async (req, res) => {
  try {
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching feed:', error);
      return res.status(500).json({ error: 'Failed to fetch feed' });
    }

    // Check if current user has liked each post
    const postIds = (posts || []).map((p: any) => p.id);
    let likedPostIds = new Set<string>();
    
    if (postIds.length > 0) {
      const { data: userLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      likedPostIds = new Set((userLikes || []).map((l: any) => l.post_id));
    }

    const postsWithLikeStatus = (posts || []).map((post: any) => ({
      ...post,
      user_has_liked: likedPostIds.has(post.id),
    }));

    return res.json({ posts: postsWithLikeStatus });
  } catch (err) {
    console.error('Feed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/posts
// Create a new post
// ============================================================
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      caption,
      photo_url,
      goal_id,
      session_id,
      goal_name,
      goal_emoji,
      session_name,
      session_number,
      total_sessions,
      duration_mins,
      streak_days,
      progress_percent,
      is_public,
    } = req.body;

    if (!user_id || !goal_name) {
      return res.status(400).json({ error: 'user_id and goal_name are required' });
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id,
        caption,
        photo_url,
        goal_id,
        session_id,
        goal_name,
        goal_emoji: goal_emoji || '⭐',
        session_name,
        session_number,
        total_sessions,
        duration_mins,
        streak_days: streak_days || 0,
        progress_percent: progress_percent || 0,
        is_public: is_public || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return res.status(500).json({ error: 'Failed to create post' });
    }

    return res.status(201).json({ post });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// DELETE /api/posts/:id
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting post:', error);
      return res.status(500).json({ error: 'Failed to delete post' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/posts/:id/like
// ============================================================
router.post('/:id/like', async (req, res) => {
  try {
    const postId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { error } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id,
      });

    if (error) {
      if (error.code === '23505') {
        return res.json({ success: true, already_liked: true });
      }
      console.error('Error liking post:', error);
      return res.status(500).json({ error: 'Failed to like post' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Like post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// DELETE /api/posts/:id/like
// ============================================================
router.delete('/:id/like', async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error unliking post:', error);
      return res.status(500).json({ error: 'Failed to unlike post' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Unlike post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/posts/upload-image
// ============================================================
router.post('/upload-image', async (req, res) => {
  try {
    const { user_id, image_base64, file_name } = req.body;

    if (!user_id || !image_base64) {
      return res.status(400).json({ error: 'user_id and image_base64 are required' });
    }

    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const timestamp = Date.now();
    const fileName = `${user_id}/${timestamp}_${file_name || 'image.jpg'}`;

    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    const { data: urlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName);

    return res.json({ 
      success: true, 
      url: urlData.publicUrl,
      path: data.path,
    });
  } catch (err) {
    console.error('Upload image error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;