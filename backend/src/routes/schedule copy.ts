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
 * POST /api/schedule/auto-generate
 * Auto-generate weekly schedule based on goals and availability
 */
router.post('/auto-generate', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`🤖 Auto-generating schedule for user ${user_id}`);

    // 1. Get user's active goals with plans
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .not('plan', 'is', null);

    if (goalsError) throw goalsError;

    if (!goals || goals.length === 0) {
      return res.status(400).json({ 
        error: 'No active goals with plans found',
        message: 'Please create goals and generate training plans first'
      });
    }

    // 2. Get user availability
    const { data: availability, error: availError } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (availError || !availability) {
      return res.status(400).json({ 
        error: 'No availability data found',
        message: 'Please set your availability first'
      });
    }

    // 3. Clear existing schedule for this week
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    await supabase
      .from('schedule_blocks')
      .delete()
      .eq('user_id', user_id)
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString());

    // 4. Generate schedule using smart algorithm
    const schedule = generateSmartSchedule(goals, availability, startOfWeek);

    // 5. Insert generated blocks into database
    if (schedule.length > 0) {
      const { error: insertError } = await supabase
        .from('schedule_blocks')
        .insert(schedule);

      if (insertError) throw insertError;
    }

    console.log(`✅ Generated ${schedule.length} schedule blocks`);

    return res.json({
      success: true,
      schedule,
      message: `Generated ${schedule.length} training blocks for this week`
    });

  } catch (error: any) {
    console.error('❌ Auto-schedule generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate schedule',
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

/**
 * Smart scheduling algorithm
 */
function generateSmartSchedule(
  goals: any[],
  availability: any,
  startOfWeek: Date
): any[] {
  const blocks: any[] = [];
  
  // Parse availability times
  const wakeTime = parseTimeHelper(availability.wake_time); // e.g., "06:00"
  const sleepTime = parseTimeHelper(availability.sleep_time); // e.g., "22:00"
  const workSchedule = availability.work_schedule || {};
  const preferredWorkoutTime = availability.preferred_workout_time || 'morning';
  
  // Calculate sessions per goal
  const sessionsPerGoal: any = {};
  
  goals.forEach(goal => {
    const weeklyHours = goal.plan?.weekly_hours || 5;
    
    // For fitness goals, typically 4-5 sessions per week
    if (goal.category === 'fitness') {
      sessionsPerGoal[goal.id] = {
        count: weeklyHours <= 3 ? 3 : weeklyHours <= 6 ? 4 : 5,
        avgDuration: Math.round((weeklyHours * 60) / (weeklyHours <= 3 ? 3 : weeklyHours <= 6 ? 4 : 5))
      };
    } else {
      // For other goals, spread across 5 days
      sessionsPerGoal[goal.id] = {
        count: 5,
        avgDuration: Math.round((weeklyHours * 60) / 5)
      };
    }
  });

  // Generate schedule for each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDay = new Date(startOfWeek);
    currentDay.setDate(startOfWeek.getDate() + dayOffset);
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOffset];
    
    // Skip if it's a rest day (e.g., Sunday and Thursday for running)
    if (dayOffset === 0 || dayOffset === 4) {
      continue; // Rest days
    }

    // Get work hours for this day
    const workHours = workSchedule[dayName] || { start: '09:00', end: '17:00' };
    const workStart = parseTimeHelper(workHours.start);
    const workEnd = parseTimeHelper(workHours.end);

    // Schedule sessions for each goal
    goals.forEach(goal => {
      const sessions = sessionsPerGoal[goal.id];
      
      // Distribute sessions across the week
      const sessionDays = distributeSessionDays(sessions.count, goal.category);
      
      if (sessionDays.includes(dayOffset)) {
        // Determine best time slot
        let scheduledTime: Date;
        
        if (preferredWorkoutTime === 'morning' && goal.category === 'fitness') {
          // Morning workout before work
          scheduledTime = new Date(currentDay);
          scheduledTime.setHours(wakeTime.hours, wakeTime.minutes + 30, 0, 0);
        } else if (preferredWorkoutTime === 'evening' && goal.category === 'fitness') {
          // Evening workout after work
          scheduledTime = new Date(currentDay);
          scheduledTime.setHours(workEnd.hours + 1, 0, 0, 0);
        } else {
          // Work-related goals during work hours or evening
          scheduledTime = new Date(currentDay);
          if (goal.category === 'fitness') {
            scheduledTime.setHours(wakeTime.hours, wakeTime.minutes + 30, 0, 0);
          } else {
            scheduledTime.setHours(workEnd.hours + 1, 0, 0, 0);
          }
        }

        // Create schedule block
        blocks.push({
          user_id: goal.user_id,
          goal_id: goal.id,
          type: goal.category === 'fitness' ? 'workout' : 'work',
          scheduled_start: scheduledTime.toISOString(),
          duration_mins: sessions.avgDuration,
          status: 'pending',
          notes: `${goal.name} - Training session`,
          created_by: 'auto',
          flexibility: 'movable'
        });
      }
    });
  }

  return blocks;
}

/**
 * Helper: Parse time string to hours/minutes
 */
function parseTimeHelper(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Helper: Distribute sessions across week
 */
function distributeSessionDays(sessionCount: number, category: string): number[] {
  // Fitness: Mon, Tue, Wed, Fri, Sat (skip Sun & Thu for rest)
  // Other: Mon, Tue, Wed, Thu, Fri
  
  if (category === 'fitness') {
    const fitnessDays = [1, 2, 3, 5, 6]; // Mon, Tue, Wed, Fri, Sat
    return fitnessDays.slice(0, sessionCount);
  } else {
    const workDays = [1, 2, 3, 4, 5]; // Mon-Fri
    return workDays.slice(0, sessionCount);
  }
}

export default router;