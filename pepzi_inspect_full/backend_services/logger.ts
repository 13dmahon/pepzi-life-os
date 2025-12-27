import { supabase } from './supabase';

/**
 * Log an activity
 */
export async function createLog(
  userId: string,
  goalId: string | null,
  type: string,
  data: any,
  source: string = 'user_message'
) {
  try {
    const { data: log, error } = await supabase
      .from('log_entries')
      .insert({
        user_id: userId,
        goal_id: goalId,
        timestamp: new Date().toISOString(),
        type,
        data,
        source
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`📝 Logged ${type}:`, data);

    // Check if this log completes any micro-goals
    if (goalId) {
      await checkMicroGoalCompletion(goalId, data);
    }

    return log;
  } catch (error) {
    console.error('Error creating log:', error);
    throw error;
  }
}

/**
 * Check if a log entry completes any micro-goals
 */
async function checkMicroGoalCompletion(goalId: string, logData: any) {
  try {
    // Get incomplete micro-goals for this goal
    const { data: microGoals, error } = await supabase
      .from('micro_goals')
      .select('*')
      .eq('goal_id', goalId)
      .eq('completed', false)
      .order('order_index', { ascending: true });

    if (error) throw error;
    if (!microGoals || microGoals.length === 0) return;

    // Check each micro-goal's completion criteria
    for (const microGoal of microGoals) {
      const criteria = microGoal.completion_criteria;
      let isComplete = false;

      // Check different types of criteria
      if (criteria.type === 'performance') {
        // Example: run 5k under 24:00
        if (criteria.metric && logData[criteria.metric]) {
          const value = logData[criteria.metric];
          const threshold = criteria.threshold;
          
          if (criteria.operator === 'less_than' && value < threshold) {
            isComplete = true;
          } else if (criteria.operator === 'greater_than' && value > threshold) {
            isComplete = true;
          } else if (criteria.operator === 'equals' && value === threshold) {
            isComplete = true;
          }
        }
      }

      if (isComplete) {
        // Mark micro-goal as complete
        await supabase
          .from('micro_goals')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
            completion_data: logData
          })
          .eq('id', microGoal.id);

        console.log(`🎉 Micro-goal completed: ${microGoal.name}`);

        // Update goal progress
        await updateGoalProgress(goalId);
      }
    }
  } catch (error) {
    console.error('Error checking micro-goal completion:', error);
  }
}

/**
 * Update goal progress based on completed micro-goals
 */
async function updateGoalProgress(goalId: string) {
  try {
    // Get all micro-goals for this goal
    const { data: microGoals, error } = await supabase
      .from('micro_goals')
      .select('*')
      .eq('goal_id', goalId);

    if (error) throw error;
    if (!microGoals || microGoals.length === 0) return;

    const totalMicroGoals = microGoals.length;
    const completedMicroGoals = microGoals.filter(mg => mg.completed).length;
    const percentComplete = Math.round((completedMicroGoals / totalMicroGoals) * 100);

    // Update goal progress
    await supabase
      .from('goals')
      .update({
        progress: {
          percent_complete: percentComplete,
          completed_micro_goals: completedMicroGoals,
          total_micro_goals: totalMicroGoals,
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', goalId);

    console.log(`📊 Goal progress updated: ${percentComplete}%`);
  } catch (error) {
    console.error('Error updating goal progress:', error);
  }
}

/**
 * Get recent logs for a user
 */
export async function getRecentLogs(userId: string, days: number = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: logs, error } = await supabase
      .from('log_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', cutoffDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;

    return logs || [];
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}
