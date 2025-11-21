import { supabase } from './supabase';

/**
 * Build context for AI from user's data
 * This gives Pepzi awareness of the user's goals, schedule, and recent activity
 */
export async function buildUserContext(userId: string) {
  try {
    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Get active goals
    const { data: goals } = await supabase
      .from('goals')
      .select(`
        *,
        micro_goals (*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    // Get today's schedule
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySchedule } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_start', `${today}T00:00:00`)
      .lt('scheduled_start', `${today}T23:59:59`)
      .order('scheduled_start', { ascending: true });

    // Get recent logs (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentLogs } = await supabase
      .from('log_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', sevenDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(20);

    // Get recent messages (last 10)
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(10);

    return {
      user,
      goals: goals || [],
      todaySchedule: todaySchedule || [],
      recentLogs: recentLogs || [],
      recentMessages: (recentMessages || []).reverse(), // Oldest first for conversation flow
      currentDate: new Date().toISOString(),
      currentTime: new Date().toTimeString().split(' ')[0]
    };
  } catch (error) {
    console.error('Error building context:', error);
    throw error;
  }
}

/**
 * Format context for display/logging
 */
export function formatContextSummary(context: any): string {
  return `
User: ${context.user?.name || 'Unknown'}
Active Goals: ${context.goals?.length || 0}
Today's Schedule: ${context.todaySchedule?.length || 0} blocks
Recent Logs: ${context.recentLogs?.length || 0}
`.trim();
}
