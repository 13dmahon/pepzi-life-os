import { Router, Request, Response } from 'express';
import { 
  summarizeWeek, 
  getRecentMemories, 
  storeMemory,
  getRelevantMemories 
} from '../services/memory';

const router = Router();

/**
 * POST /api/memory/summarize-week
 * Manually trigger weekly summary generation (for testing or admin)
 */
router.post('/summarize-week', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id'
      });
    }

    console.log(`📊 Manually triggering weekly summary for ${user_id}`);

    await summarizeWeek(user_id);

    return res.json({
      message: 'Weekly summary generated successfully',
      user_id
    });

  } catch (error: any) {
    console.error('❌ Weekly summary error:', error);
    return res.status(500).json({
      error: 'Failed to generate weekly summary',
      message: error.message
    });
  }
});

/**
 * GET /api/memory/recent
 * Get recent memories for a user (for debugging/admin)
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const { user_id, limit } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id query parameter'
      });
    }

    const memories = await getRecentMemories(
      user_id as string,
      parseInt(limit as string) || 20
    );

    return res.json({
      memories,
      count: memories.length
    });

  } catch (error: any) {
    console.error('❌ Get memories error:', error);
    return res.status(500).json({
      error: 'Failed to fetch memories',
      message: error.message
    });
  }
});

/**
 * POST /api/memory/search
 * Search memories by query (for testing similarity search)
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { user_id, query, limit } = req.body;

    if (!user_id || !query) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'query']
      });
    }

    const memories = await getRelevantMemories(
      user_id,
      query,
      limit || 5
    );

    return res.json({
      query,
      memories,
      count: memories.length
    });

  } catch (error: any) {
    console.error('❌ Memory search error:', error);
    return res.status(500).json({
      error: 'Failed to search memories',
      message: error.message
    });
  }
});

/**
 * POST /api/memory/store
 * Manually store a memory (for testing or admin)
 */
router.post('/store', async (req: Request, res: Response) => {
  try {
    const { user_id, content, metadata } = req.body;

    if (!user_id || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'content']
      });
    }

    await storeMemory({
      user_id,
      content,
      metadata: metadata || {}
    });

    return res.json({
      message: 'Memory stored successfully'
    });

  } catch (error: any) {
    console.error('❌ Store memory error:', error);
    return res.status(500).json({
      error: 'Failed to store memory',
      message: error.message
    });
  }
});

export default router;