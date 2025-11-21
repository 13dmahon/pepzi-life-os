import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { parseRelativeTime, parseTime, combineDateAndTime } from '../utils/timeParser';
import { rescheduleBlock } from '../services/planner';

const router = Router();

/**
 * GET /api/schedule
 * Get schedule blocks for a date range
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, start_date, end_date } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id query parameter'
      });
    }

    let query = supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (name, category)
      `)
      .eq('user_id', user_id as string);

    if (start_date) {
      query = query.gte('scheduled_start', start_date as string);
    }

    if (end_date) {
      query = query.lte('scheduled_start', end_date as string);
    }

    const { data: blocks, error } = await query.order('scheduled_start', { ascending: true });

    if (error) throw error;

    return res.json({
      blocks: blocks || [],
      count: blocks?.length || 0
    });

  } catch (error: any) {
    console.error('❌ Schedule fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch schedule',
      message: error.message
    });
  }
});

/**
 * GET /api/schedule/today
 * Get today's schedule
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id query parameter'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: blocks, error } = await supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (name, category)
      `)
      .eq('user_id', user_id as string)
      .gte('scheduled_start', `${today}T00:00:00`)
      .lt('scheduled_start', `${today}T23:59:59`)
      .order('scheduled_start', { ascending: true });

    if (error) throw error;

    return res.json({
      date: today,
      blocks: blocks || [],
      count: blocks?.length || 0
    });

  } catch (error: any) {
    console.error('❌ Today schedule error:', error);
    return res.status(500).json({
      error: 'Failed to fetch today\'s schedule',
      message: error.message
    });
  }
});

/**
 * POST /api/schedule
 * Create a new schedule block
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      goal_id,
      type,
      scheduled_start,
      duration_mins,
      notes
    } = req.body;

    if (!user_id || !type || !scheduled_start || !duration_mins) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'type', 'scheduled_start', 'duration_mins']
      });
    }

    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .insert({
        user_id,
        goal_id: goal_id || null,
        type,
        scheduled_start,
        duration_mins,
        notes: notes || null,
        flexibility: 'movable',
        created_by: 'user',
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Created schedule block: ${type} at ${scheduled_start}`);

    return res.json({
      block,
      message: 'Schedule block created'
    });

  } catch (error: any) {
    console.error('❌ Schedule creation error:', error);
    return res.status(500).json({
      error: 'Failed to create schedule block',
      message: error.message
    });
  }
});

/**
 * PATCH /api/schedule/:id/reschedule
 * Reschedule a block
 */
router.patch('/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_start_time } = req.body;

    if (!new_start_time) {
      return res.status(400).json({
        error: 'Missing new_start_time'
      });
    }

    const newDate = new Date(new_start_time);
    const block = await rescheduleBlock(id, newDate);

    return res.json({
      block,
      message: 'Block rescheduled successfully'
    });

  } catch (error: any) {
    console.error('❌ Reschedule error:', error);
    return res.status(500).json({
      error: 'Failed to reschedule block',
      message: error.message
    });
  }
});

/**
 * DELETE /api/schedule/:id
 * Delete a schedule block
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`🗑️ Deleted schedule block: ${id}`);

    return res.json({
      message: 'Schedule block deleted'
    });

  } catch (error: any) {
    console.error('❌ Delete error:', error);
    return res.status(500).json({
      error: 'Failed to delete block',
      message: error.message
    });
  }
});

/**
 * PATCH /api/schedule/:id/complete
 * Mark a block as completed
 */
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Marked block complete: ${id}`);

    return res.json({
      block,
      message: 'Block marked as completed'
    });

  } catch (error: any) {
    console.error('❌ Complete error:', error);
    return res.status(500).json({
      error: 'Failed to mark block complete',
      message: error.message
    });
  }
});

export default router;
