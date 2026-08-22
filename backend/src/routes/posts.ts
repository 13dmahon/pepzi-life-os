import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';

const router = Router();

// ============================================================
// POST /api/posts - Create a new feed post
// ============================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      goal_id,
      goal_name,
      goal_emoji,
      caption,
      photo_url,
      media_urls,
      session_id,
      session_name,
      session_number,
      total_sessions,
      duration_mins,
      progress_percent,
      streak_days,
      is_public = true,
    } = req.body;

    if (!user_id || !goal_name) {
      return res.status(400).json({ error: 'Missing user_id or goal_name' });
    }

    console.log(`📝 Creating feed post for goal: ${goal_name}`);

    // Create the post using existing schema
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id,
        goal_id: goal_id || null,
        goal_name,
        goal_emoji: goal_emoji || '⭐',
        caption: caption || null,
        photo_url: photo_url || null,
        media_urls: media_urls || [],
        session_id: session_id || null,
        session_name: session_name || null,
        session_number: session_number || null,
        total_sessions: total_sessions || null,
        duration_mins: duration_mins || null,
        progress_percent: progress_percent || 100,
        streak_days: streak_days || 0,
        is_public,
        likes_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Feed post created: ${post.id}`);

    return res.json({
      success: true,
      post,
      message: 'Post shared to feed!',
    });

  } catch (error: any) {
    console.error('❌ Create post error:', error);
    return res.status(500).json({
      error: 'Failed to create post',
      message: error.message,
    });
  }
});

// ============================================================
// GET /api/posts - Get feed posts
// ============================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, limit = 20, offset = 0 } = req.query;

    console.log('📖 Fetching feed posts');

    // Get public posts, ordered by newest first
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        users (id, name, email, display_name, avatar_url)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    // Get likes for current user if provided
    let userLikes: string[] = [];
    if (user_id) {
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user_id as string);
      
      userLikes = (likes || []).map(l => l.post_id);
    }

    // Format response for frontend
    const formattedPosts = (posts || []).map(post => ({
      id: post.id,
      user: {
        id: post.user_id,
        name: post.users?.display_name || post.users?.name || post.users?.email?.split('@')[0] || 'Anonymous',
        avatar: (post.users?.display_name || post.users?.name || post.users?.email || 'A').slice(0, 2).toUpperCase(),
        avatarUrl: post.users?.avatar_url,
      },
      book: {
        id: post.goal_id,
        name: post.goal_name,
        emoji: post.goal_emoji || '⭐',
        totalSessions: post.total_sessions || 0,
        totalHours: Math.round((post.duration_mins || 0) / 60 * 10) / 10,
        completedDate: post.created_at,
      },
      post: {
        caption: post.caption,
        image: post.photo_url || (post.media_urls?.length ? post.media_urls[0] : null),
        mediaUrls: post.media_urls || [],
        timeAgo: getTimeAgo(new Date(post.created_at)),
      },
      stats: {
        likes: post.likes_count || 0,
        comments: 0, // Add comments count if you have a comments table
        liked: userLikes.includes(post.id),
      },
      meta: {
        sessionName: post.session_name,
        sessionNumber: post.session_number,
        progressPercent: post.progress_percent,
        streakDays: post.streak_days,
      },
    }));

    return res.json({
      posts: formattedPosts,
      total: formattedPosts.length,
    });

  } catch (error: any) {
    console.error('❌ Fetch posts error:', error);
    return res.status(500).json({
      error: 'Failed to fetch posts',
      message: error.message,
    });
  }
});

// ============================================================
// POST /api/posts/:id/like - Like/unlike a post
// ============================================================
router.post('/:id/like', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user_id)
      .single();

    if (existingLike) {
      // Unlike - delete the like
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', id)
        .eq('user_id', user_id);

      // Decrement count
      await supabase
        .from('posts')
        .update({ 
          likes_count: supabase.rpc('decrement', { x: 1 }),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      // Manual decrement since rpc might not exist
      const { data: post } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('id', id)
        .single();
      
      await supabase
        .from('posts')
        .update({ likes_count: Math.max(0, (post?.likes_count || 1) - 1) })
        .eq('id', id);

      return res.json({ liked: false, message: 'Post unliked' });
    } else {
      // Like - create the like
      await supabase
        .from('post_likes')
        .insert({ 
          post_id: id, 
          user_id, 
          created_at: new Date().toISOString() 
        });

      // Increment count
      const { data: post } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('id', id)
        .single();
      
      await supabase
        .from('posts')
        .update({ 
          likes_count: (post?.likes_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      return res.json({ liked: true, message: 'Post liked' });
    }

  } catch (error: any) {
    console.error('❌ Like error:', error);
    return res.status(500).json({
      error: 'Failed to like post',
      message: error.message,
    });
  }
});

// ============================================================
// GET /api/posts/:id - Get single post
// ============================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        users (id, name, email, display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user liked
    let liked = false;
    if (user_id) {
      const { data: like } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', user_id as string)
        .single();
      liked = !!like;
    }

    return res.json({
      post: {
        ...post,
        liked,
      },
    });

  } catch (error: any) {
    console.error('❌ Get post error:', error);
    return res.status(500).json({
      error: 'Failed to get post',
      message: error.message,
    });
  }
});

// ============================================================
// DELETE /api/posts/:id - Delete a post
// ============================================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    // Verify ownership
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!post || post.user_id !== user_id) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Delete likes first
    await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', id);

    // Delete the post
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'Post deleted' });

  } catch (error: any) {
    console.error('❌ Delete post error:', error);
    return res.status(500).json({
      error: 'Failed to delete post',
      message: error.message,
    });
  }
});

// ============================================================
// Helper: Get time ago string
// ============================================================
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
  return `${Math.floor(seconds / 2592000)}mo`;
}

export default router;