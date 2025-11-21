import { supabase } from './supabase';
import { addDays, startOfDay, setHours } from 'date-fns';

/**
 * Generate weekly schedule for a user
 */
export async function generateWeeklySchedule(userId: string) {
  try {
    console.log(`📅 Generating weekly schedule for user ${userId}`);

    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;
    if (!goals || goals.length === 0) {
      return { message: 'No active goals found' };
    }

    const totalHoursNeeded = goals.reduce((sum, goal) => {
      return sum + (goal.plan?.weekly_hours || 0);
    }, 0);

    console.log(`⏰ Total weekly hours needed: ${totalHoursNeeded}`);

    const blocks: any[] = [];
    const today = startOfDay(new Date());

    for (const goal of goals) {
      const weeklyHours = goal.plan?.weekly_hours || 0;
      if (weeklyHours === 0) continue;

      const sessionsPerWeek = Math.ceil(weeklyHours / 1.5);
      const hoursPerSession = weeklyHours / sessionsPerWeek;

      for (let i = 0; i < sessionsPerWeek && i < 7; i++) {
        const day = addDays(today, i);
        const startTime = setHours(day, 9 + (i * 2) % 12);

        blocks.push({
          user_id: userId,
          goal_id: goal.id,
          type: getBlockType(goal.category),
          scheduled_start: startTime.toISOString(),
          duration_mins: Math.round(hoursPerSession * 60),
          flexibility: 'movable',
          created_by: 'ai',
          status: 'scheduled'
        });
      }
    }

    const { data: savedBlocks, error: saveError } = await supabase
      .from('schedule_blocks')
      .insert(blocks)
      .select();

    if (saveError) throw saveError;

    console.log(`✅ Created ${savedBlocks?.length || 0} schedule blocks`);

    return {
      blocks: savedBlocks,
      total_hours: totalHoursNeeded,
      message: `Generated ${savedBlocks?.length} schedule blocks for the week`
    };

  } catch (error) {
    console.error('Error generating schedule:', error);
    throw error;
  }
}

/**
 * Get block type based on goal category
 */
function getBlockType(category: string): string {
  const typeMap: { [key: string]: string } = {
    'fitness': 'workout',
    'money': 'deep_work',
    'skill': 'practice',
    'social': 'social',
    'travel': 'planning',
    'habit': 'routine',
    'experience': 'event'
  };
  return typeMap[category] || 'activity';
}

/**
 * Reschedule a block
 */
export async function rescheduleBlock(
  blockId: string,
  newStartTime: Date
) {
  try {
    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .update({
        scheduled_start: newStartTime.toISOString(),
        status: 'rescheduled'
      })
      .eq('id', blockId)
      .select()
      .single();

    if (error) throw error;

    console.log(`🔄 Rescheduled block to ${newStartTime.toISOString()}`);

    return block;
  } catch (error) {
    console.error('Error rescheduling block:', error);
    throw error;
  }
}
