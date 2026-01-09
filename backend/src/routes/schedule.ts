import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai } from '../services/openai';
import { parseRelativeTime, parseTime, combineDateAndTime } from '../utils/timeParser';
import { rescheduleBlock } from '../services/planner';
const router = Router();
type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'any';
// ============================================================
// HELPER FUNCTIONS
// ============================================================
/**
 * Parse time string to hours/minutes
 */
function parseTimeHelper(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}
/**
 * Convert hours/minutes to total minutes from midnight
 */
function toMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}
/**
 * Convert minutes from midnight to time string
 */
function fromMinutes(totalMinutes: number): { hours: number; minutes: number } {
  return {
    hours: Math.floor(totalMinutes / 60) % 24,
    minutes: totalMinutes % 60,
  };
}
/**
 * Calculate goal progress and return status message
 */
async function calculateGoalProgress(goalId: string): Promise<{ message: string; daysAhead: number } | null> {
  try {
    // Get goal details
    const { data: goal } = await supabase
      .from('goals')
      .select('*, plan')
      .eq('id', goalId)
      .single();
    if (!goal) return null;
    // Get all completed blocks for this goal
    const { data: completed } = await supabase
      .from('schedule_blocks')
      .select('duration_mins, completed_at')
      .eq('goal_id', goalId)
      .eq('status', 'completed');
    // Get all remaining scheduled blocks
    const { data: remaining } = await supabase
      .from('schedule_blocks')
      .select('scheduled_start')
      .eq('goal_id', goalId)
      .eq('status', 'scheduled')
      .gt('scheduled_start', new Date().toISOString());
    const totalCompleted = completed?.length || 0;
    const totalRemaining = remaining?.length || 0;
    const totalHoursLogged = (completed || []).reduce((sum, b) => sum + (b.duration_mins || 0), 0) / 60;
    const targetHours = goal.plan?.total_estimated_hours || 50;
    // Calculate if ahead or behind
    const percentComplete = Math.round((totalHoursLogged / targetHours) * 100);
    
    // Estimate days ahead/behind based on progress vs expected
    const totalWeeks = goal.plan?.total_weeks || 12;
    const startDate = new Date(goal.created_at);
    const now = new Date();
    const weeksSinceStart = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const expectedPercent = Math.min(100, Math.round((weeksSinceStart / totalWeeks) * 100));
    const daysAhead = Math.round((percentComplete - expectedPercent) * totalWeeks * 7 / 100);
    let message = '';
    if (daysAhead > 0) {
      message = `You're ${daysAhead} day${daysAhead > 1 ? 's' : ''} ahead! 🔥`;
    } else if (daysAhead < 0) {
      message = `${Math.abs(daysAhead)} day${Math.abs(daysAhead) > 1 ? 's' : ''} behind - keep pushing! 💪`;
    } else {
      message = `Right on track! ✅`;
    }
    return { message, daysAhead };
  } catch (error) {
    console.error('Error calculating progress:', error);
    return null;
  }
}
/**
 * Get available time slots for a day
 * Uses user's wake_time / sleep_time (from onboarding/settings)
 */
function getAvailableSlots(
  dayName: string,
  availability: any,
  userBlocksForDay: Array<{ start: number; end: number }> = []
): Array<{ start: number; end: number }> {
  const slots: Array<{ start: number; end: number }> = [];
  // Use availability settings or sensible defaults (align with UI defaults 07:00–23:00)
  const wake = parseTimeHelper(availability?.wake_time || '07:00');
  const sleep = parseTimeHelper(availability?.sleep_time || '23:00');
  const wakeMinutes = toMinutes(wake.hours, wake.minutes);
  const sleepMinutes = toMinutes(sleep.hours, sleep.minutes);
  // Build blocked times from ALL sources
  const blocked: Array<{ start: number; end: number }> = [];
  // 1. Work schedule from availability (if exists)
  const workSchedule = availability?.work_schedule?.[dayName];
  if (workSchedule && workSchedule.start && workSchedule.end) {
    const workStart = parseTimeHelper(workSchedule.start);
    const workEnd = parseTimeHelper(workSchedule.end);
    blocked.push({
      start: toMinutes(workStart.hours, workStart.minutes),
      end: toMinutes(workEnd.hours, workEnd.minutes),
    });
    // Add commute before/after work
    const commuteMins = availability?.daily_commute_mins || 0;
    if (commuteMins > 0) {
      blocked.push({
        start: toMinutes(workStart.hours, workStart.minutes) - commuteMins,
        end: toMinutes(workStart.hours, workStart.minutes),
      });
      blocked.push({
        start: toMinutes(workEnd.hours, workEnd.minutes),
        end: toMinutes(workEnd.hours, workEnd.minutes) + commuteMins,
      });
    }
  }
  // 2. Fixed commitments from availability (if exists)
  const fixedCommitments = (availability?.fixed_commitments || [])
    .filter((c: any) => c.day?.toLowerCase() === dayName)
    .map((c: any) => ({
      start: toMinutes(...Object.values(parseTimeHelper(c.start)) as [number, number]),
      end: toMinutes(...Object.values(parseTimeHelper(c.end)) as [number, number]),
    }));
  blocked.push(...fixedCommitments);
  // 3. User-created blocks from calendar (work, commute, events added via UI)
  blocked.push(...userBlocksForDay);
  // Sort blocked times
  blocked.sort((a, b) => a.start - b.start);
  // Merge overlapping blocks
  const mergedBlocked: Array<{ start: number; end: number }> = [];
  for (const block of blocked) {
    if (mergedBlocked.length === 0 || block.start > mergedBlocked[mergedBlocked.length - 1].end) {
      mergedBlocked.push({ ...block });
    } else {
      mergedBlocked[mergedBlocked.length - 1].end = Math.max(
        mergedBlocked[mergedBlocked.length - 1].end,
        block.end
      );
    }
  }
  // Find free slots between wake and sleep
  let currentTime = wakeMinutes;
  for (const block of mergedBlocked) {
    if (block.start > currentTime && block.start < sleepMinutes) {
      // Free slot before this block
      slots.push({ start: currentTime, end: Math.min(block.start, sleepMinutes) });
    }
    currentTime = Math.max(currentTime, block.end);
  }
  // Final slot until sleep
  if (currentTime < sleepMinutes) {
    slots.push({ start: currentTime, end: sleepMinutes });
  }
  return slots;
}
/**
 * Find best available slot with VARIED start times
 * Respects preferred time-of-day
 */
function findBestSlot(
  availableSlots: Array<{ start: number; end: number }>,
  scheduledSlots: Array<{ start: number; end: number; goalId: string }>,
  duration: number,
  preference: PreferredTime,
  goalId: string,
  sessionIndex: number = 0
): { start: number; end: number } | null {
  const BUFFER = 15;
  
  const TIME_OFFSETS = [0, 45, 90, 30, 75, 15, 60, 105];
  const offset = TIME_OFFSETS[sessionIndex % TIME_OFFSETS.length];
  const timeRanges: Record<Exclude<PreferredTime, 'any'>, { start: number; end: number }> = {
    morning: { start: 5 * 60, end: 12 * 60 },
    afternoon: { start: 12 * 60, end: 17 * 60 },
    evening: { start: 17 * 60, end: 23 * 60 },
  };
  const candidateSlots: Array<{ start: number; end: number; score: number }> = [];
  for (const availSlot of availableSlots) {
    const scheduledInSlot = scheduledSlots
      .filter((s) => s.start < availSlot.end && s.end > availSlot.start)
      .sort((a, b) => a.start - b.start);
    let searchStart = availSlot.start;
    for (const scheduled of scheduledInSlot) {
      const gapEnd = scheduled.start - BUFFER;
      if (gapEnd - searchStart >= duration) {
        const adjustedStart = Math.min(searchStart + offset, gapEnd - duration);
        candidateSlots.push({
          start: Math.max(searchStart, adjustedStart),
          end: Math.max(searchStart, adjustedStart) + duration,
          score: 0,
        });
      }
      searchStart = Math.max(searchStart, scheduled.end + BUFFER);
    }
    if (availSlot.end - searchStart >= duration) {
      const maxStart = availSlot.end - duration;
      const adjustedStart = Math.min(searchStart + offset, maxStart);
      candidateSlots.push({
        start: Math.max(searchStart, adjustedStart),
        end: Math.max(searchStart, adjustedStart) + duration,
        score: 0,
      });
    }
  }
  if (candidateSlots.length === 0) return null;
  for (const candidate of candidateSlots) {
    if (preference !== 'any') {
      const range = timeRanges[preference];
      if (candidate.start >= range.start && candidate.start < range.end) {
        candidate.score += 100;
      }
    }
    // Penalise super early if not a morning pref
    if (candidate.start < 7 * 60 && preference !== 'morning') {
      candidate.score -= 50;
    }
    const startMins = candidate.start % 60;
    // Prefer :00 / :30
    if (startMins === 0 || startMins === 30) {
      candidate.score += 10;
    } else if (startMins === 15 || startMins === 45) {
      candidate.score += 5;
    }
  }
  candidateSlots.sort((a, b) => b.score - a.score);
  return { start: candidateSlots[0].start, end: candidateSlots[0].end };
}
/**
 * Smart scheduling with better spreading and user block support
 * + per-goal preferred_time / preferred_days support
 */
function generateSmartSchedule(
  goals: any[],
  availability: any,
  startOfWeek: Date,
  existingUserBlocks: any[] = []
): { blocks: any[]; warning: string | null } {
  const blocks: any[] = [];
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let warning: string | null = null;
  const scheduledByDay: Record<string, Array<{ start: number; end: number; goalId: string }>> = {};
  DAYS.forEach((day) => {
    scheduledByDay[day] = [];
  });
  const userBlocksByDay: Record<string, Array<{ start: number; end: number }>> = {};
  DAYS.forEach((day) => {
    userBlocksByDay[day] = [];
  });
  existingUserBlocks.forEach((block) => {
    const blockDate = new Date(block.scheduled_start);
    const dayIndex = blockDate.getDay();
    const dayName = DAYS[dayIndex];
    
    const startMins = blockDate.getHours() * 60 + blockDate.getMinutes();
    const endMins = startMins + block.duration_mins;
    
    userBlocksByDay[dayName].push({
      start: startMins,
      end: endMins,
    });
    
    scheduledByDay[dayName].push({
      start: startMins,
      end: endMins,
      goalId: block.goal_id || 'user',
    });
  });
  console.log(`\n📦 User blocks by day:`);
  DAYS.forEach((day) => {
    if (userBlocksByDay[day].length > 0) {
      console.log(`   ${day}: ${userBlocksByDay[day].length} blocks`);
    }
  });
  const getGoalWeekNumber = (goal: any): number => {
    const createdAt = new Date(goal.created_at || new Date());
    const weeksSinceCreation = Math.floor(
      (startOfWeek.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, weeksSinceCreation + 1);
  };
  interface PlannedSession {
    goalId: string;
    oderId: string;
    goalName: string;
    category: string;
    sessionName: string;
    sessionDuration: number;
    sessionDescription?: string;
    sessionTip?: string;
    preferredTime: PreferredTime;
    preferredDays?: string[]; // 🆕 per-goal preferred days
    scheduled: boolean;
  }
  const plannedSessions: PlannedSession[] = [];
  goals
    .filter((goal) => goal.plan && goal.plan.weekly_hours > 0)
    .forEach((goal) => {
      const currentWeek = getGoalWeekNumber(goal);
      
      const weeklyPlans = goal.plan?.weekly_plan?.weeks || goal.plan?.weekly_plans || [];
      
      let weekPlan = weeklyPlans.find((wp: any) => wp.week === currentWeek);
      if (!weekPlan && weeklyPlans.length > 0) {
        const weekIndex = (currentWeek - 1) % weeklyPlans.length;
        weekPlan = weeklyPlans[weekIndex];
      }
      // 🆕 Resolve per-goal preferred time
      let preferredTime: PreferredTime =
        (goal.preferred_time as PreferredTime) ||
        (goal.plan?.preferred_time as PreferredTime) ||
        'any';
      // Fallback to your old heuristics if still 'any'
      if (!preferredTime || preferredTime === 'any') {
        if (goal.category === 'fitness' || goal.category === 'climbing') {
          preferredTime = availability.preferred_workout_time || 'morning';
        } else if (goal.category === 'business' || goal.category === 'career') {
          preferredTime = 'evening';
        } else if (goal.category === 'languages') {
          preferredTime = 'morning';
        }
      }
      // 🆕 Per-goal preferred days
      const preferredDays: string[] | undefined =
        goal.preferred_days ||
        goal.plan?.preferred_days ||
        undefined;
      const normalizedPreferredDays = preferredDays?.map((d: string) => d.toLowerCase());
      if (weekPlan && weekPlan.sessions && weekPlan.sessions.length > 0) {
        console.log(`   📋 ${goal.name} Week ${currentWeek}: ${weekPlan.sessions.length} specific sessions`);
        
        weekPlan.sessions.forEach((session: any) => {
          plannedSessions.push({
            goalId: goal.id,
            oderId: goal.user_id,
            goalName: goal.name,
            category: goal.category,
            sessionName: session.name || session.title || 'Training Session',
            sessionDuration: session.duration_mins || session.duration || 60,
            sessionDescription: session.description || session.focus || '',
            sessionTip: session.notes || session.tip || session.coach_tip || '',
            preferredTime,
            preferredDays: normalizedPreferredDays,
            scheduled: false,
          });
        });
      } else {
        const weeklyHours = goal.plan?.weekly_hours || 5;
        const sessionsPerWeek = goal.plan?.sessions_per_week || Math.ceil(weeklyHours);
        const sessionDuration = Math.round((weeklyHours * 60) / sessionsPerWeek);
        
        console.log(`   ⚠️ ${goal.name}: No weekly_plans found, creating ${sessionsPerWeek} generic sessions`);
        
        for (let i = 0; i < sessionsPerWeek; i++) {
          plannedSessions.push({
            goalId: goal.id,
            oderId: goal.user_id,
            goalName: goal.name,
            category: goal.category,
            sessionName: `${goal.name} - Session ${i + 1}`,
            sessionDuration: Math.min(Math.max(sessionDuration, 15), 120),
            preferredTime,
            preferredDays: normalizedPreferredDays,
            scheduled: false,
          });
        }
      }
    });
  plannedSessions.sort((a, b) => b.sessionDuration - a.sessionDuration);
  console.log(`\n📊 Sessions to schedule: ${plannedSessions.length} total`);
  plannedSessions.forEach((ps) => {
    console.log(
      `   ${ps.goalName}: "${ps.sessionName}" (${ps.sessionDuration}min) [${ps.preferredTime}]${
        ps.preferredDays ? ` days=${ps.preferredDays.join(',')}` : ''
      }`
    );
  });
  const availableByDay: Record<string, Array<{ start: number; end: number }>> = {};
  DAYS.forEach((day) => {
    availableByDay[day] = getAvailableSlots(day, availability, userBlocksByDay[day]);
  });
  console.log(`\n📅 Available time per day:`);
  let totalAvailableMins = 0;
  DAYS.forEach((day) => {
    const totalMins = availableByDay[day].reduce((sum, slot) => sum + (slot.end - slot.start), 0);
    totalAvailableMins += totalMins;
    const hours = Math.round((totalMins / 60) * 10) / 10;
    console.log(`   ${day}: ${hours}h free`);
  });
  const totalNeededMins = plannedSessions.reduce((sum, ps) => sum + ps.sessionDuration, 0);
  if (totalNeededMins > totalAvailableMins * 0.8) {
    warning = `You need ${Math.round(totalNeededMins / 60)}h/week for all goals, but only have ~${Math.round(
      totalAvailableMins / 60
    )}h available. Some sessions may not fit.`;
    console.log(`\n⚠️ ${warning}`);
  }
  let globalSessionIndex = 0;
  
  const sessionsByGoal: Record<string, PlannedSession[]> = {};
  plannedSessions.forEach((ps) => {
    if (!sessionsByGoal[ps.goalId]) sessionsByGoal[ps.goalId] = [];
    sessionsByGoal[ps.goalId].push(ps);
  });
  let round = 0;
  const MAX_ROUNDS = 50;
  while (round < MAX_ROUNDS) {
    let anyScheduledThisRound = false;
    const dayOrder = [...DAYS];
    if (round > 0) {
      const rotateBy = round % 7;
      for (let i = 0; i < rotateBy; i++) {
        dayOrder.push(dayOrder.shift()!);
      }
    }
    for (const dayName of dayOrder) {
      const dayIndex = DAYS.indexOf(dayName);
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + dayIndex);
      for (const goalId of Object.keys(sessionsByGoal)) {
        const goalSessions = sessionsByGoal[goalId];
        const nextSession = goalSessions.find((s) => !s.scheduled);
        
        if (!nextSession) continue;
        // 🆕 Respect per-goal preferred_days if set
        if (
          nextSession.preferredDays &&
          !nextSession.preferredDays.includes(dayName.toLowerCase())
        ) {
          continue;
        }
        const sessionsThisDayForGoal = scheduledByDay[dayName].filter(
          (s) => s.goalId === goalId
        ).length;
        
        const maxPerDay = Math.max(Math.ceil(goalSessions.length / 5), 2);
        if (sessionsThisDayForGoal >= maxPerDay) continue;
        const slot = findBestSlot(
          availableByDay[dayName],
          scheduledByDay[dayName],
          nextSession.sessionDuration,
          nextSession.preferredTime,
          nextSession.goalId,
          globalSessionIndex
        );
        if (slot) {
          const scheduledTime = new Date(currentDay);
          const { hours, minutes } = fromMinutes(slot.start);
          scheduledTime.setHours(hours, minutes, 0, 0);
          const notesData = [
            nextSession.sessionName,
            nextSession.sessionDescription || '',
            nextSession.sessionTip || ''
          ].join('|||');
          blocks.push({
            user_id: nextSession.oderId,
            goal_id: nextSession.goalId,
            type: nextSession.category === 'fitness' || nextSession.category === 'climbing' ? 'workout' : 'training',
            scheduled_start: scheduledTime.toISOString(),
            duration_mins: nextSession.sessionDuration,
            status: 'scheduled',
            notes: notesData,
            created_by: 'auto',
            flexibility: 'movable',
          });
          scheduledByDay[dayName].push({
            start: slot.start,
            end: slot.end,
            goalId: nextSession.goalId,
          });
          nextSession.scheduled = true;
          globalSessionIndex++;
          anyScheduledThisRound = true;
        }
      }
    }
    round++;
    const allDone = plannedSessions.every((ps) => ps.scheduled);
    if (allDone) {
      console.log(`\n✅ All ${plannedSessions.length} sessions scheduled after ${round} rounds`);
      break;
    }
    if (!anyScheduledThisRound) {
      console.log(`\n⚠️ No more slots available after ${round} rounds`);
      
      const unscheduled = plannedSessions.filter((ps) => !ps.scheduled);
      if (unscheduled.length > 0) {
        const details = unscheduled
          .slice(0, 3)
          .map((ps) => `"${ps.sessionName}" (${ps.sessionDuration}min)`)
          .join(', ');
        
        warning = `Couldn't fit ${unscheduled.length} sessions: ${details}${
          unscheduled.length > 3 ? '...' : ''
        }. Consider adjusting your schedule or reducing session count.`;
      }
      break;
    }
  }
  const scheduledCount = plannedSessions.filter((ps) => ps.scheduled).length;
  const totalHours = Math.round(blocks.reduce((sum, b) => sum + b.duration_mins, 0) / 60);
  console.log(`\n✅ Generated ${blocks.length} sessions (${totalHours}h total)`);
  console.log(`   Scheduled: ${scheduledCount}/${plannedSessions.length} sessions`);
  return { blocks, warning };
}
// ============================================================
// ROUTES
// ============================================================
/**
 * GET /api/schedule
 * Get schedule blocks for a date range
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id query parameter',
      });
    }
    let query = supabase
      .from('schedule_blocks')
      .select(
        `
        *,
        goals (name, category, description)
      `
      )
      .eq('user_id', user_id as string);
    if (start_date) {
      query = query.gte('scheduled_start', start_date as string);
    }
    if (end_date) {
      query = query.lte('scheduled_start', end_date as string);
    }
    const { data: blocks, error } = await query.order('scheduled_start', {
      ascending: true,
    });
    if (error) throw error;
    return res.json({
      blocks: blocks || [],
      count: blocks?.length || 0,
    });
  } catch (error: any) {
    console.error('❌ Schedule fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch schedule',
      message: error.message,
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
        error: 'Missing user_id query parameter',
      });
    }
    const today = new Date().toISOString().split('T')[0];
    const { data: blocks, error } = await supabase
      .from('schedule_blocks')
      .select(
        `
        *,
        goals (name, category, description)
      `
      )
      .eq('user_id', user_id as string)
      .gte('scheduled_start', `${today}T00:00:00`)
      .lt('scheduled_start', `${today}T23:59:59`)
      .order('scheduled_start', { ascending: true });
    if (error) throw error;
    return res.json({
      date: today,
      blocks: blocks || [],
      count: blocks?.length || 0,
    });
  } catch (error: any) {
    console.error('❌ Today schedule error:', error);
    return res.status(500).json({
      error: "Failed to fetch today's schedule",
      message: error.message,
    });
  }
});

/**
 * GET /api/schedule/backlog
 * Get overdue sessions that weren't completed
 * Returns sessions with deadline info (when next session is scheduled)
 */
router.get('/backlog', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id query parameter',
      });
    }

    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    console.log(`\n📋 ========== FETCHING BACKLOG ==========`);
    console.log(`👤 User: ${user_id}`);
    console.log(`📅 Looking for sessions before: ${todayStr}`);

    // Get all overdue sessions (scheduled before today, not completed/skipped)
    const { data: overdueBlocks, error: overdueError } = await supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (id, name, category, plan, resource_link, resource_link_label)
      `)
      .eq('user_id', user_id as string)
      .lt('scheduled_start', todayStr)
      .eq('status', 'scheduled')
      .in('type', ['training', 'workout'])
      .order('scheduled_start', { ascending: true });

    if (overdueError) throw overdueError;

    if (!overdueBlocks || overdueBlocks.length === 0) {
      console.log(`✅ No backlog sessions found`);
      return res.json({
        sessions: [],
        count: 0,
      });
    }

    console.log(`📦 Found ${overdueBlocks.length} overdue sessions`);

    // For each overdue session, find the next scheduled session for that goal
    // to calculate "days until slip"
    const backlogSessions = await Promise.all(
      overdueBlocks.map(async (block) => {
        // Parse session name from notes
        const notesParts = (block.notes || '').split('|||');
        const sessionName = notesParts[0] || 'Session';

        // Find next scheduled session for this goal (after today)
        const { data: nextSession } = await supabase
          .from('schedule_blocks')
          .select('scheduled_start')
          .eq('goal_id', block.goal_id)
          .eq('status', 'scheduled')
          .gte('scheduled_start', todayStr)
          .order('scheduled_start', { ascending: true })
          .limit(1)
          .single();

        // Calculate days until the next session (deadline)
        let daysUntilSlip = 7; // Default: 7 days if no next session found
        let deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + 7);

        if (nextSession) {
          const nextDate = new Date(nextSession.scheduled_start);
          deadlineDate = nextDate;
          const diffTime = nextDate.getTime() - today.getTime();
          daysUntilSlip = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // Calculate how many days overdue
        const scheduledDate = new Date(block.scheduled_start);
        const daysOverdue = Math.floor((today.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: block.id,
          name: sessionName,
          description: notesParts[1] || '',
          goal_id: block.goal_id,
          goal_name: block.goals?.name || 'Unknown Goal',
          category: block.goals?.category || 'default',
          duration_mins: block.duration_mins,
          scheduled_date: block.scheduled_start,
          days_overdue: daysOverdue,
          deadline: deadlineDate.toISOString(),
          days_until_slip: daysUntilSlip,
          slip_days: block.goals?.plan?.sessions_per_week 
            ? Math.ceil(7 / block.goals.plan.sessions_per_week)
            : 2, // How many days goal slips if not completed
          resource_link: block.goals?.resource_link || null,
          resource_link_label: block.goals?.resource_link_label || null,
        };
      })
    );

    // Sort by urgency (days_until_slip ascending, then days_overdue descending)
    backlogSessions.sort((a, b) => {
      if (a.days_until_slip !== b.days_until_slip) {
        return a.days_until_slip - b.days_until_slip;
      }
      return b.days_overdue - a.days_overdue;
    });

    console.log(`✅ Returning ${backlogSessions.length} backlog sessions`);

    return res.json({
      sessions: backlogSessions,
      count: backlogSessions.length,
    });

  } catch (error: any) {
    console.error('❌ Backlog fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch backlog',
      message: error.message,
    });
  }
});

/**
 * POST /api/schedule
 * Create a new schedule block
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, goal_id, type, scheduled_start, duration_mins, notes } =
      req.body;
    if (!user_id || !type || !scheduled_start || !duration_mins) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'type', 'scheduled_start', 'duration_mins'],
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
        status: 'scheduled',
      })
      .select()
      .single();
    if (error) throw error;
    console.log(`✅ Created schedule block: ${type} at ${scheduled_start}`);
    return res.json({
      block,
      message: 'Schedule block created',
    });
  } catch (error: any) {
    console.error('❌ Schedule creation error:', error);
    return res.status(500).json({
      error: 'Failed to create schedule block',
      message: error.message,
    });
  }
});

// ============================================================
// SCHEDULE CHAT - AI-powered scheduling assistant
// ============================================================

/**
 * POST /api/schedule/chat
 * AI-powered scheduling assistant that creates events from natural language
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { user_id, message, context } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: 'Missing user_id or message' });
    }

    console.log(`\n📅 ========== SCHEDULE CHAT ==========`);
    console.log(`👤 User: ${user_id}`);
    console.log(`💬 Message: "${message}"`);

    // Get current date/time context
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dayOfWeek = now.toLocaleDateString('en-GB', { weekday: 'long' });

    // Helper to get next occurrence of a day
    const getNextDayDate = (dayName: string): string => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.indexOf(dayName.toLowerCase());
      if (targetDay === -1) return today;
      const todayDate = new Date();
      const currentDay = todayDate.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const targetDate = new Date(todayDate);
      targetDate.setDate(todayDate.getDate() + daysUntil);
      return targetDate.toISOString().split('T')[0];
    };

    // Get this week's schedule for context
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 14);

    const { data: existingBlocks } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name)')
      .eq('user_id', user_id)
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString())
      .order('scheduled_start', { ascending: true });

    const scheduleContext = (existingBlocks || []).map(b => {
      const date = new Date(b.scheduled_start);
      return `- ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}: ${b.notes || b.type}${b.goals?.name ? ` (${b.goals.name})` : ''} (${b.duration_mins}min)`;
    }).join('\n');

    const recentMessages = context?.recent_messages || [];
    const conversationHistory = recentMessages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const systemPrompt = `You are Pepzi's scheduling assistant. Help users add events to their calendar.

CURRENT CONTEXT:
- Today: ${dayOfWeek}, ${today}
- Current time: ${currentTime}

EXISTING SCHEDULE (next 2 weeks):
${scheduleContext || 'No events scheduled yet.'}

RULES:
1. Extract: what, when (date), start time, end time/duration
2. Time RANGE like "6pm to 11:45pm" = full event duration, use the ENTIRE range!
3. If missing info, ask naturally (don't repeat yourself)
4. Once you have all details, CREATE THE EVENT - don't keep asking for confirmation
5. "yes", "confirm", "confirmed", "do it" = execute immediately
6. For days like "friday", use: ${getNextDayDate('friday')}

RESPOND WITH JSON:
{
  "message": "Your response",
  "action": {
    "type": "create_event" | "create_recurring" | "none",
    "event_name": "Name",
    "event_type": "event" | "work" | "commute" | "social",
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "duration_mins": number,
    "days": ["monday", "tuesday"],
    "notes": "notes"
  }
}

EXAMPLES:
- "curry friday 6pm-11:45pm" → type: create_event, date: ${getNextDayDate('friday')}, start: 18:00, end: 23:45
- "work 9-6 mon to fri" → type: create_recurring, days: [monday,tuesday,wednesday,thursday,friday], start: 09:00, end: 18:00
- User confirms with "yes" → Execute the pending action immediately`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || '{}';
    console.log(`🤖 AI Response: ${content}`);
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return res.json({
        message: "Sorry, I had trouble understanding. Could you try again?",
        schedule_updated: false,
      });
    }

    let scheduleUpdated = false;
    let resultMessage = parsed.message;

    // Execute create_event action
    if (parsed.action && parsed.action.type === 'create_event' && parsed.action.date && parsed.action.start_time) {
      const action = parsed.action;
      const startDateTime = new Date(`${action.date}T${action.start_time}:00`);
      
      let durationMins = action.duration_mins || 60;
      if (action.end_time) {
        const [endH, endM] = action.end_time.split(':').map(Number);
        const [startH, startM] = action.start_time.split(':').map(Number);
        durationMins = (endH * 60 + endM) - (startH * 60 + startM);
        if (durationMins <= 0) durationMins = 60;
      }

      const { error } = await supabase
        .from('schedule_blocks')
        .insert({
          user_id,
          goal_id: null,
          type: action.event_type || 'event',
          scheduled_start: startDateTime.toISOString(),
          duration_mins: durationMins,
          notes: action.event_name || 'Event',
          flexibility: 'fixed',
          created_by: 'user',
          status: 'scheduled',
        });

      if (!error) {
        scheduleUpdated = true;
        const friendlyDate = startDateTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        const friendlyTime = startDateTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(startDateTime.getTime() + durationMins * 60000);
        const friendlyEndTime = endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        resultMessage = `✅ Done! Added "${action.event_name || 'Event'}" to your calendar:\n\n📅 ${friendlyDate}\n⏰ ${friendlyTime} - ${friendlyEndTime}`;
        console.log(`✅ Created: ${action.event_name} on ${action.date}`);
      } else {
        console.error('❌ Insert error:', error);
        resultMessage = `Sorry, I couldn't save that. Please try again.`;
      }
    } 
    // Execute create_recurring action
    else if (parsed.action && parsed.action.type === 'create_recurring' && parsed.action.days?.length > 0 && parsed.action.start_time) {
      const action = parsed.action;
      
      let durationMins = action.duration_mins || 60;
      if (action.end_time) {
        const [endH, endM] = action.end_time.split(':').map(Number);
        const [startH, startM] = action.start_time.split(':').map(Number);
        durationMins = (endH * 60 + endM) - (startH * 60 + startM);
      }

      const DAYS_MAP: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6,
      };

      const blocksToCreate: any[] = [];
      const scheduleStart = new Date();
      scheduleStart.setHours(0, 0, 0, 0);
      const scheduleEnd = new Date(scheduleStart);
      scheduleEnd.setDate(scheduleEnd.getDate() + 12 * 7); // 12 weeks

      const [startH, startM] = action.start_time.split(':').map(Number);
      const currentDate = new Date(scheduleStart);
      
      while (currentDate <= scheduleEnd) {
        const dayIndex = currentDate.getDay();
        const dayName = Object.keys(DAYS_MAP).find(k => DAYS_MAP[k] === dayIndex);
        
        if (dayName && action.days.map((d: string) => d.toLowerCase()).includes(dayName)) {
          const scheduledStart = new Date(currentDate);
          scheduledStart.setHours(startH, startM, 0, 0);
          if (scheduledStart > new Date()) {
            blocksToCreate.push({
              user_id,
              goal_id: null,
              type: action.event_type || 'event',
              scheduled_start: scheduledStart.toISOString(),
              duration_mins: durationMins,
              notes: action.event_name || action.event_type || 'Recurring',
              flexibility: 'fixed',
              created_by: 'user',
              status: 'scheduled',
            });
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (blocksToCreate.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < blocksToCreate.length; i += BATCH_SIZE) {
          const batch = blocksToCreate.slice(i, i + BATCH_SIZE);
          await supabase.from('schedule_blocks').insert(batch);
        }
        scheduleUpdated = true;
        const daysFormatted = action.days.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
        resultMessage = `✅ Done! Added "${action.event_name || action.event_type}":\n\n📅 Every ${daysFormatted}\n⏰ ${action.start_time}${action.end_time ? ' - ' + action.end_time : ''}\n📆 ${blocksToCreate.length} sessions created`;
        console.log(`✅ Created ${blocksToCreate.length} recurring blocks`);
      }
    }

    return res.json({
      message: resultMessage,
      schedule_updated: scheduleUpdated,
      actions: parsed.actions || [],
    });

  } catch (error: any) {
    console.error('❌ Schedule chat error:', error);
    return res.status(500).json({
      message: "Sorry, something went wrong. Please try again.",
      schedule_updated: false,
    });
  }
});

// ============================================================
// END OF SCHEDULE CHAT
// ============================================================

/**
 * POST /api/schedule/recurring
 * Create recurring blocks across multiple days for the entire calendar
 */
router.post('/recurring', async (req: Request, res: Response) => {
  try {
    const { user_id, type, days, start_time, end_time, notes } = req.body;
    if (!user_id || !type || !days || !Array.isArray(days) || days.length === 0 || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'type', 'days (array)', 'start_time', 'end_time'],
        example: {
          user_id: 'uuid',
          type: 'work',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          start_time: '09:00',
          end_time: '18:00',
          notes: 'Office work'
        }
      });
    }
    const [startHours, startMins] = start_time.split(':').map(Number);
    const [endHours, endMins] = end_time.split(':').map(Number);
    const durationMins = (endHours * 60 + endMins) - (startHours * 60 + startMins);
    if (durationMins <= 0) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }
    console.log(`\n📅 ========== CREATING RECURRING BLOCKS ==========
👤 User: ${user_id}
📋 Type: ${type}
📆 Days: ${days.join(', ')}
⏰ Time: ${start_time} - ${end_time} (${durationMins} mins)`);
    const { data: goals } = await supabase
      .from('goals')
      .select('target_date')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .not('target_date', 'is', null)
      .order('target_date', { ascending: false })
      .limit(1);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    let scheduleEndDate: Date;
    if (goals && goals.length > 0 && goals[0].target_date) {
      scheduleEndDate = new Date(goals[0].target_date);
      scheduleEndDate.setDate(scheduleEndDate.getDate() + 7);
    } else {
      scheduleEndDate = new Date(todayDate);
      scheduleEndDate.setDate(scheduleEndDate.getDate() + 12 * 7);
    }
    console.log(`📆 Scheduling from ${todayDate.toDateString()} to ${scheduleEndDate.toDateString()}`);
    const DAYS_MAP: Record<string, number> = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
    };
    const targetDayIndices = days
      .map((d: string) => DAYS_MAP[d.toLowerCase()])
      .filter((d: number | undefined) => d !== undefined);
    if (targetDayIndices.length === 0) {
      return res.status(400).json({ error: 'Invalid day names provided' });
    }
    const blocksToCreate: any[] = [];
    const currentDate = new Date(todayDate);
    while (currentDate <= scheduleEndDate) {
      const dayIndex = currentDate.getDay();
      
      if (targetDayIndices.includes(dayIndex)) {
        const scheduledStart = new Date(currentDate);
        scheduledStart.setHours(startHours, startMins, 0, 0);
        blocksToCreate.push({
          user_id,
          goal_id: null,
          type,
          scheduled_start: scheduledStart.toISOString(),
          duration_mins: durationMins,
          notes: notes || null,
          flexibility: 'fixed',
          created_by: 'user',
          status: 'scheduled',
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    console.log(`📦 Creating ${blocksToCreate.length} blocks...`);
    for (const block of blocksToCreate) {
      await supabase
        .from('schedule_blocks')
        .delete()
        .eq('user_id', user_id)
        .eq('type', type)
        .eq('scheduled_start', block.scheduled_start)
        .eq('created_by', 'user');
    }
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    for (let i = 0; i < blocksToCreate.length; i += BATCH_SIZE) {
      const batch = blocksToCreate.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('schedule_blocks')
        .insert(batch);
      if (insertError) {
        console.error('Batch insert error:', insertError);
        throw insertError;
      }
      insertedCount += batch.length;
    }
    console.log(`✅ Created ${insertedCount} recurring blocks`);
    return res.json({
      success: true,
      blocksCreated: insertedCount,
      type,
      days,
      time: `${start_time} - ${end_time}`,
      duration_mins: durationMins,
      schedule_until: scheduleEndDate.toISOString().split('T')[0],
      message: `Created ${insertedCount} ${type} blocks for ${days.join(', ')} from ${start_time} to ${end_time}`,
    });
  } catch (error: any) {
    console.error('❌ Recurring block creation error:', error);
    return res.status(500).json({
      error: 'Failed to create recurring blocks',
      message: error.message,
    });
  }
});
/**
 * Generate schedule for a SINGLE GOAL for its ENTIRE DURATION
 * Respects preferred_days / preferred_time if available
 * 
 * FIX #1: Uses 'users' table instead of 'user_availability'
 * FIX #2: Properly handles "today" - doesn't skip it
 * FIX #3: Distributes sessions evenly across preferred days
 */
async function generateFullGoalSchedule(
  goal: any,
  userId: string,
  preferredDays: string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  preferredTime: PreferredTime = 'any'
): Promise<{ blocksCreated: number; warning: string | null }> {
  console.log(`\n🗓️ ========== GENERATING FULL SCHEDULE FOR GOAL ==========
📋 Goal: ${goal.name}
📅 Preferred days: ${preferredDays.join(', ')}
⏰ Preferred time: ${preferredTime}`);
  const plan = goal.plan;
  if (!plan || !plan.weekly_hours || plan.weekly_hours <= 0) {
    console.log('⚠️ No valid plan found');
    return { blocksCreated: 0, warning: 'No valid training plan' };
  }
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  let endDate: Date;
  if (goal.target_date) {
    endDate = new Date(goal.target_date);
  } else {
    const totalWeeks = plan.total_weeks || Math.ceil((plan.total_estimated_hours || 50) / plan.weekly_hours);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalWeeks * 7);
  }
  const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  console.log(`📆 Duration: ${totalWeeks} weeks (${startDate.toDateString()} → ${endDate.toDateString()})`);

  // ✅ FIX #1: Use 'users' table instead of 'user_availability'
  const { data: availability } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  const effectiveAvailability = availability || {
    wake_time: '07:00',
    sleep_time: '23:00',
    work_schedule: {},
    fixed_commitments: [],
    daily_commute_mins: 0,
    preferred_workout_time: preferredTime,
  };
  
  console.log(`📅 Availability: ${availability ? 'Custom set' : 'Using defaults (7am-11pm)'}`);

  const { data: existingUserBlocks } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_start', startDate.toISOString())
    .lt('scheduled_start', endDate.toISOString())
    .or('created_by.eq.user,type.in.(work,commute,event,social)');
  console.log(`📦 Existing blocks to schedule around: ${existingUserBlocks?.length || 0}`);
  await supabase
    .from('schedule_blocks')
    .delete()
    .eq('user_id', userId)
    .eq('goal_id', goal.id)
    .eq('created_by', 'auto');
  const weeklyPlan = plan.weekly_plan;
  const allBlocks: any[] = [];
  let warning: string | null = null;
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const sessionsPerWeek = plan.sessions_per_week || 3;
  
  // ✅ FIX #3: Calculate max sessions per day for even distribution
  const normalizedPreferredDays = preferredDays.map(d => d.toLowerCase());
  const maxSessionsPerDay = Math.max(1, Math.ceil(sessionsPerWeek / normalizedPreferredDays.length));
  console.log(`📊 Max ${maxSessionsPerDay} sessions per day (${sessionsPerWeek} sessions / ${normalizedPreferredDays.length} days)`);
  

  for (let weekNum = 0; weekNum < totalWeeks; weekNum++) {
    // ✅ FIX: Align to actual calendar weeks (Sunday-based)
    const todayDate = new Date(startDate);
    const currentDayOfWeek = todayDate.getDay(); // 0=Sunday
    
    // Calculate Sunday of current week
    const currentWeekSunday = new Date(todayDate);
    currentWeekSunday.setDate(todayDate.getDate() - currentDayOfWeek);
    currentWeekSunday.setHours(0, 0, 0, 0);
    
    // weekStart = Sunday of week N
    const weekStart = new Date(currentWeekSunday);
    weekStart.setDate(currentWeekSunday.getDate() + weekNum * 7);
    
    let weekSessions: any[] = [];

    
    if (weeklyPlan?.weeks && weeklyPlan.weeks[weekNum]) {
      weekSessions = weeklyPlan.weeks[weekNum].sessions || [];
    } else if (weeklyPlan?.weeks && weeklyPlan.weeks.length > 0) {
      const cycleIndex = weekNum % weeklyPlan.weeks.length;
      weekSessions = weeklyPlan.weeks[cycleIndex]?.sessions || [];
    } else {
      const sessionDuration = Math.round((plan.weekly_hours * 60) / sessionsPerWeek);
      for (let i = 0; i < sessionsPerWeek; i++) {
        weekSessions.push({
          name: `${goal.name} Session`,
          duration_mins: sessionDuration,
          description: `Training session ${i + 1}`,
        });
      }
    }
    const scheduledThisWeek: Array<{ day: string; start: number; end: number }> = [];
    const userBlocksByDay: Record<string, Array<{ start: number; end: number }>> = {};
    DAYS.forEach(day => { userBlocksByDay[day] = []; });
    (existingUserBlocks || []).forEach((block: any) => {
      const blockDate = new Date(block.scheduled_start);
      const blockWeekStart = new Date(blockDate);
      blockWeekStart.setDate(blockDate.getDate() - blockDate.getDay());
      blockWeekStart.setHours(0, 0, 0, 0);
      if (blockWeekStart.getTime() === weekStart.getTime()) {
        const dayName = DAYS[blockDate.getDay()];
        const startMins = blockDate.getHours() * 60 + blockDate.getMinutes();
        userBlocksByDay[dayName].push({
          start: startMins,
          end: startMins + (block.duration_mins || 60),
        });
      }
    });

    let sessionIndex = 0;
    for (const session of weekSessions) {
      const duration = session.duration_mins || 60;
      let scheduled = false;
      
      // ✅ FIX #3: Sort preferred days by least scheduled first for even distribution
      const sortedPreferredDays = [...normalizedPreferredDays].sort((a, b) => {
        const countA = scheduledThisWeek.filter(s => s.day === a).length;
        const countB = scheduledThisWeek.filter(s => s.day === b).length;
        return countA - countB;
      });
      
      // 1) Try preferredDays first
      for (const dayName of sortedPreferredDays) {
        if (scheduled) break;
        
        const dayIndex = DAYS.indexOf(dayName);
        if (dayIndex === -1) continue;
        
        // ✅ FIX #3: Check if this day already has max sessions
        const sessionsOnThisDay = scheduledThisWeek.filter(s => s.day === dayName).length;
        if (sessionsOnThisDay >= maxSessionsPerDay) {
          console.log(`   ⏭️ Skipping ${dayName}: already has ${sessionsOnThisDay}/${maxSessionsPerDay} sessions`);
          continue;
        }
        
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex);
        
        // ✅ FIX #2: Only skip days that are BEFORE today, not today itself
        const todayCheck = new Date();
        todayCheck.setHours(0, 0, 0, 0);
        const dayDateNormalized = new Date(dayDate);
        dayDateNormalized.setHours(0, 0, 0, 0);
        
        if (dayDateNormalized < todayCheck) {
          continue; // Skip past days
        }
        
        const availSlots = getAvailableSlots(dayName, effectiveAvailability, userBlocksByDay[dayName]);
        const scheduledSlotsForDay = scheduledThisWeek
          .filter(s => s.day === dayName)
          .map(s => ({ start: s.start, end: s.end, goalId: goal.id as string }));
        const slot = findBestSlot(
          availSlots,
          scheduledSlotsForDay,
          duration,
          preferredTime,
          goal.id,
          sessionIndex
        );
        if (!slot) continue;
        const candidateStart = slot.start;
        const candidateEnd = slot.end;
        // Make sure we don't collide within the same week/day
        let hasConflict = false;
        for (const existing of scheduledThisWeek.filter(s => s.day === dayName)) {
          if (candidateStart < existing.end + 15 && candidateEnd > existing.start - 15) {
            hasConflict = true;
            break;
          }
        }
        if (!hasConflict) {
          const scheduledTime = new Date(dayDate);
          scheduledTime.setHours(Math.floor(candidateStart / 60), candidateStart % 60, 0, 0);
          allBlocks.push({
            user_id: userId,
            goal_id: goal.id,
            type: goal.category === 'fitness' || goal.category === 'climbing' ? 'workout' : 'training',
            scheduled_start: scheduledTime.toISOString(),
            duration_mins: duration,
            status: 'scheduled',
            notes: [session.name, session.description || '', session.tip || ''].join('|||'),
            created_by: 'auto',
            flexibility: 'movable',
          });
          scheduledThisWeek.push({ day: dayName, start: candidateStart, end: candidateEnd });
          scheduled = true;
        }
      }
      // 2) If still not scheduled, allow any day as fallback
      if (!scheduled) {
        for (const dayName of DAYS) {
          if (scheduled) break;
          if (normalizedPreferredDays.includes(dayName)) continue;
          const dayIndex = DAYS.indexOf(dayName);
          const dayDate = new Date(weekStart);
          dayDate.setDate(weekStart.getDate() + dayIndex);
          
          // ✅ FIX #2: Only skip days that are BEFORE today, not today itself
          const todayCheck = new Date();
          todayCheck.setHours(0, 0, 0, 0);
          const dayDateNormalized = new Date(dayDate);
          dayDateNormalized.setHours(0, 0, 0, 0);
          
          if (dayDateNormalized < todayCheck) {
            continue; // Skip past days
          }
          
          const availSlots = getAvailableSlots(dayName, effectiveAvailability, userBlocksByDay[dayName]);
          const scheduledSlotsForDay = scheduledThisWeek
            .filter(s => s.day === dayName)
            .map(s => ({ start: s.start, end: s.end, goalId: goal.id as string }));
          const slot = findBestSlot(
            availSlots,
            scheduledSlotsForDay,
            duration,
            preferredTime,
            goal.id,
            sessionIndex
          );
          if (!slot) continue;
          const candidateStart = slot.start;
          const candidateEnd = slot.end;
          let hasConflict = false;
          for (const existing of scheduledThisWeek.filter(s => s.day === dayName)) {
            if (candidateStart < existing.end + 15 && candidateEnd > existing.start - 15) {
              hasConflict = true;
              break;
            }
          }
          if (!hasConflict) {
            const scheduledTime = new Date(dayDate);
            scheduledTime.setHours(Math.floor(candidateStart / 60), candidateStart % 60, 0, 0);
            allBlocks.push({
              user_id: userId,
              goal_id: goal.id,
              type: goal.category === 'fitness' || goal.category === 'climbing' ? 'workout' : 'training',
              scheduled_start: scheduledTime.toISOString(),
              duration_mins: duration,
              status: 'scheduled',
              notes: [session.name, session.description || '', session.tip || ''].join('|||'),
              created_by: 'auto',
              flexibility: 'movable',
            });
            scheduledThisWeek.push({ day: dayName, start: candidateStart, end: candidateEnd });
            scheduled = true;
          }
        }
      }
      if (!scheduled) {
        warning = `Some sessions couldn't be scheduled. Consider adjusting your availability or reducing weekly hours.`;
      }
      sessionIndex++;
    }
  }
  if (allBlocks.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < allBlocks.length; i += BATCH_SIZE) {
      const batch = allBlocks.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('schedule_blocks')
        .insert(batch);
      if (insertError) {
        console.error('Insert batch error:', insertError);
        throw insertError;
      }
    }
  }
  console.log(`✅ Created ${allBlocks.length} schedule blocks for ${totalWeeks} weeks`);
  return { blocksCreated: allBlocks.length, warning };
}
/**
 * POST /api/schedule/generate-for-goal
 * Generate full schedule for a specific goal
 * 
 * Supports two modes:
 * 1. placed_sessions: User's exact session placements from visual scheduler
 * 2. Auto-scheduling: Uses preferred_days/preferred_time to find best slots
 */
router.post('/generate-for-goal', async (req: Request, res: Response) => {
  try {
    const { 
      user_id, 
      goal_id, 
      preferred_days, 
      preferred_time,
      placed_sessions,  // From visual scheduler: [{ day, hour, minute, duration_mins, name?, description?, tip? }]
      weekly_plan       // Full plan content for session details
    } = req.body;

    if (!user_id || !goal_id) {
      return res.status(400).json({ error: 'Missing user_id or goal_id' });
    }

    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goal_id)
      .single();

    if (goalError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // ============================================================
    // MODE 1: Handle placed_sessions from visual scheduler
    // ============================================================
    if (placed_sessions && placed_sessions.length > 0) {
      console.log(`\n📍 ========== USING PLACED SESSIONS ==========`);
      console.log(`📍 Goal: ${goal.name}`);
      console.log(`📍 Sessions per week: ${placed_sessions.length}`);
      
      const plan = goal.plan || {};
      const totalWeeks = plan.total_weeks || 12;
      const weeklyPlanWeeks = weekly_plan?.weeks || plan.weekly_plan?.weeks || [];
      
      console.log(`📍 Total weeks: ${totalWeeks}`);
      console.log(`📍 Weekly plan weeks available: ${weeklyPlanWeeks.length}`);

      // Delete existing scheduled blocks for this goal
      const { error: deleteError } = await supabase
        .from('schedule_blocks')
        .delete()
        .eq('goal_id', goal_id)
        .eq('status', 'scheduled');
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
      }

      const allBlocks: any[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const dayMap: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };

      // Get start of current week (Sunday)
      const currentWeekStart = new Date(todayDate);
      currentWeekStart.setDate(todayDate.getDate() - todayDate.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);

      for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() + (weekIndex * 7));
        
        // Get session content for this week (cycle through if beyond available weeks)
        const weekContent = weeklyPlanWeeks.length > 0 
          ? weeklyPlanWeeks[Math.min(weekIndex, weeklyPlanWeeks.length - 1)]
          : null;
        const weekSessions = weekContent?.sessions || [];
        
        placed_sessions.forEach((placement: any, sessionIndex: number) => {
          const dayOffset = dayMap[placement.day?.toLowerCase()];
          if (dayOffset === undefined) {
            console.log(`⚠️ Invalid day: ${placement.day}`);
            return;
          }
          
          const sessionDate = new Date(weekStart);
          sessionDate.setDate(weekStart.getDate() + dayOffset);
          sessionDate.setHours(placement.hour || 9, placement.minute || 0, 0, 0);
          
          // Skip if in the past
          if (sessionDate < new Date()) {
            return;
          }
          
          // Get session content - prefer enriched data from placement, else from weekly_plan
          const weekSession = weekSessions[sessionIndex % Math.max(1, weekSessions.length)];
          
          // Priority: placement data > week session data > fallback
          const sessionName = placement.name || weekSession?.name || `Week ${weekIndex + 1} - Session ${sessionIndex + 1}`;
          const sessionDesc = placement.description || weekSession?.description || '';
          const sessionTip = placement.tip || weekSession?.tip || weekSession?.notes || '';
          
          // Build notes in standard format: name|||description|||tip
          const notes = [sessionName, sessionDesc, sessionTip].join('|||');
          
          allBlocks.push({
            user_id,
            goal_id,
            type: goal.category === 'fitness' || goal.category === 'climbing' ? 'workout' : 'training',
            scheduled_start: sessionDate.toISOString(),
            duration_mins: placement.duration_mins || plan.session_length_mins || 60,
            status: 'scheduled',
            notes,
            created_by: 'user',  // Mark as user-placed
            flexibility: 'fixed', // User explicitly placed these
          });
        });
      }

      // Insert all blocks in batches
      if (allBlocks.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < allBlocks.length; i += BATCH_SIZE) {
          const batch = allBlocks.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await supabase
            .from('schedule_blocks')
            .insert(batch);

          if (insertError) {
            console.error('Insert batch error:', insertError);
            throw insertError;
          }
        }
      }

      console.log(`✅ Created ${allBlocks.length} schedule blocks from placed sessions`);

      return res.json({
        success: true,
        blocksCreated: allBlocks.length,
        warning: null,
        message: `Generated ${allBlocks.length} sessions for "${goal.name}" using your schedule`,
      });
    }

    // ============================================================
    // MODE 2: Auto-scheduling (existing logic)
    // ============================================================
    const resolvedPreferredDays: string[] =
      preferred_days ||
      goal.preferred_days ||
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const resolvedPreferredTime: PreferredTime =
      preferred_time ||
      goal.preferred_time ||
      'any';

    const result = await generateFullGoalSchedule(
      goal,
      user_id,
      resolvedPreferredDays,
      resolvedPreferredTime
    );

    return res.json({
      success: true,
      ...result,
      message: `Generated ${result.blocksCreated} sessions for "${goal.name}"`,
    });

  } catch (error: any) {
    console.error('❌ Generate for goal error:', error);
    return res.status(500).json({
      error: 'Failed to generate schedule',
      message: error.message,
    });
  }
});
/**
 * POST /api/schedule/auto-generate
 * Auto-generate weekly schedule based on goals and availability
 * 
 * ✅ FIX #1: Uses 'users' table instead of 'user_availability'
 */
router.post('/auto-generate', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }
    console.log(`\n🤖 ========== AUTO-GENERATE SCHEDULE ==========
🤖 User: ${user_id}`);
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active');
    if (goalsError) throw goalsError;
    const goalsWithPlans = (goals || []).filter(
      (g) => g.plan && g.plan.weekly_hours && g.plan.weekly_hours > 0
    );
    console.log(`📋 Active goals: ${goals?.length || 0}`);
    console.log(`📋 Goals with plans (weekly_hours > 0): ${goalsWithPlans.length}`);
    if (goalsWithPlans.length === 0) {
      return res.status(400).json({
        error: 'No active goals with training plans found',
        message: 'Please create goals and generate training plans with weekly_hours > 0',
      });
    }

    // ✅ FIX #1: Use 'users' table instead of 'user_availability'
    const { data: availability } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    const effectiveAvailability = availability || {
      wake_time: '07:00',
      sleep_time: '23:00',
      work_schedule: {},
      fixed_commitments: [],
      daily_commute_mins: 0,
      preferred_workout_time: 'morning',
    };
    console.log(`📅 Availability: ${availability ? 'Custom set' : 'Using defaults (7am-11pm)'}`);
    const todayDate = new Date();
    const startOfWeek = new Date(todayDate);
    startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const { data: existingUserBlocks } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('user_id', user_id)
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString())
      .or('created_by.eq.user,type.in.(work,commute,event,social)');
    console.log(`📦 Existing user blocks to schedule around: ${existingUserBlocks?.length || 0}`);
    await supabase
      .from('schedule_blocks')
      .delete()
      .eq('user_id', user_id)
      .eq('created_by', 'auto')
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString());
    const { blocks: schedule, warning } = generateSmartSchedule(
      goalsWithPlans, 
      effectiveAvailability, 
      startOfWeek,
      existingUserBlocks || []
    );
    if (schedule.length > 0) {
      const { error: insertError } = await supabase
        .from('schedule_blocks')
        .insert(schedule);
      if (insertError) throw insertError;
    }
    const totalHours = Math.round(schedule.reduce((sum, b) => sum + b.duration_mins, 0) / 60);
    console.log(`\n✅ SUCCESS: ${schedule.length} sessions, ${totalHours}h total`);
    return res.json({
      success: true,
      schedule,
      warning,
      stats: {
        sessions: schedule.length,
        totalHours,
        goalsScheduled: goalsWithPlans.length,
      },
      message: `Generated ${schedule.length} training sessions (${totalHours}h) for ${goalsWithPlans.length} goals`,
    });
  } catch (error: any) {
    console.error('❌ Auto-schedule generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate schedule',
      message: error.message,
    });
  }
});
// ============================================================
// SESSION MANAGEMENT ENDPOINTS - Start, Complete, Skip, Reschedule
// ============================================================
//DOMOTE
/**
 * PATCH /api/schedule/:id/start
 * Start a session - sets started_at timestamp for stopwatch functionality
 * Used by Today page when user clicks "Start" button
 */
router.patch('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log(`▶️ Starting session: ${id}`);
    
    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .update({
        started_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .eq('id', id)
      .select(`
        *,
        goals (name, category)
      `)
      .single();

    if (error) throw error;

    console.log(`✅ Session started: ${id}`);
    
    return res.json({
      success: true,
      block,
      started_at: block.started_at,
      message: 'Session started',
    });
  } catch (error: any) {
    console.error('❌ Start session error:', error);
    return res.status(500).json({
      error: 'Failed to start session',
      message: error.message,
    });
  }
});


// ============================================================
// 🆕 NEW ROUTES FOR ACTIVE SESSION VIEW
// Add these AFTER the /:id/complete-with-notes route
// Add these BEFORE the /:id/skip route
// ============================================================

/**
 * GET /api/schedule/session-stats/:goalId
 * Get comprehensive stats for active session view
 * Includes: progress, slippage, average time, session history
 */
router.get('/session-stats/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`📊 Fetching session stats for goal ${goalId}`);

    // Get goal details
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (goalError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Get all sessions for this goal
    const { data: allSessions, error: sessionsError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('goal_id', goalId)
      .order('scheduled_start', { ascending: true });

    if (sessionsError) throw sessionsError;

    const sessions = allSessions || [];
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate stats
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const missedSessions = sessions.filter(s => 
      s.status === 'scheduled' && new Date(s.scheduled_start) < today
    );
    const upcomingSessions = sessions.filter(s => 
      s.status === 'scheduled' && new Date(s.scheduled_start) >= today
    );
    const totalSessions = sessions.length;

    // Calculate average session time (from completed sessions)
    let averageSessionMins = goal.plan?.session_length_mins || 60;
    if (completedSessions.length > 0) {
      const totalMins = completedSessions.reduce((sum, s) => {
        // Use actual_duration_seconds if available, else duration_mins
        if (s.actual_duration_seconds) {
          return sum + (s.actual_duration_seconds / 60);
        }
        return sum + (s.duration_mins || 0);
      }, 0);
      averageSessionMins = Math.round(totalMins / completedSessions.length);
    }

    // Calculate total hours logged
    const totalHoursLogged = completedSessions.reduce((sum, s) => {
      if (s.actual_duration_seconds) {
        return sum + (s.actual_duration_seconds / 3600);
      }
      return sum + ((s.duration_mins || 0) / 60);
    }, 0);

    // Calculate slippage (compare original target to current)
    const originalTargetDate = goal.original_target_date || goal.target_date;
    const currentTargetDate = goal.target_date;
    let slippageDays = 0;
    let hasSlipped = false;

    if (originalTargetDate && currentTargetDate) {
      const original = new Date(originalTargetDate);
      const current = new Date(currentTargetDate);
      slippageDays = Math.round((current.getTime() - original.getTime()) / (1000 * 60 * 60 * 24));
      hasSlipped = slippageDays > 0;
    }

    // Calculate predicted finish date based on current pace
    let predictedFinishDate = currentTargetDate;
    if (missedSessions.length > 0 && goal.plan?.sessions_per_week) {
      // Each missed session pushes finish by (7 / sessions_per_week) days
      const daysPerSession = 7 / goal.plan.sessions_per_week;
      const additionalDays = Math.ceil(missedSessions.length * daysPerSession);
      const predicted = new Date(currentTargetDate);
      predicted.setDate(predicted.getDate() + additionalDays);
      predictedFinishDate = predicted.toISOString().split('T')[0];
    }

    // Get session history with notes (for logbook)
    const sessionHistory = completedSessions.map(s => {
      const notesParts = (s.notes || '').split('|||');
      const userNotes = notesParts[3] || ''; // User completion notes are 4th part
      
      return {
        id: s.id,
        session_name: notesParts[0] || 'Session',
        description: notesParts[1] || '',
        scheduled_date: s.scheduled_start,
        completed_at: s.completed_at,
        duration_mins: s.duration_mins,
        actual_duration_seconds: s.actual_duration_seconds,
        notes: userNotes,
        tracked_data: s.tracked_data,
      };
    }).sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

    // Progress calculation
    const progressPercent = totalSessions > 0 
      ? Math.round((completedSessions.length / totalSessions) * 100)
      : 0;

    // Get current session number
    const currentSessionNumber = completedSessions.length + 1;

    return res.json({
      goal: {
        id: goal.id,
        name: goal.name,
        category: goal.category,
        target_date: currentTargetDate,
        original_target_date: originalTargetDate,
        resource_link: goal.resource_link,
        resource_link_label: goal.resource_link_label,
      },
      progress: {
        completed_sessions: completedSessions.length,
        total_sessions: totalSessions,
        current_session_number: currentSessionNumber,
        percent_complete: progressPercent,
        total_hours_logged: Math.round(totalHoursLogged * 10) / 10,
        target_hours: goal.plan?.total_estimated_hours || 0,
      },
      timing: {
        average_session_mins: averageSessionMins,
        planned_session_mins: goal.plan?.session_length_mins || 60,
        sessions_per_week: goal.plan?.sessions_per_week || 3,
      },
      slippage: {
        has_slipped: hasSlipped,
        days_slipped: slippageDays,
        original_target_date: originalTargetDate,
        current_target_date: currentTargetDate,
        predicted_finish_date: predictedFinishDate,
      },
      backlog: {
        missed_sessions: missedSessions.length,
        missed_session_ids: missedSessions.map(s => s.id),
      },
      upcoming: {
        next_sessions: upcomingSessions.slice(0, 5).map(s => ({
          id: s.id,
          scheduled_start: s.scheduled_start,
          name: (s.notes || '').split('|||')[0] || 'Session',
        })),
        total_remaining: upcomingSessions.length,
      },
      session_history: sessionHistory,
    });

  } catch (error: any) {
    console.error('❌ Session stats error:', error);
    return res.status(500).json({
      error: 'Failed to fetch session stats',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/schedule/:id/complete-session
 * Complete a session with duration and diary notes
 * Used by the new Active Session View
 */
router.patch('/:id/complete-session', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { duration_seconds, diary_notes } = req.body;

    console.log(`✅ Completing session ${id} with diary notes`);

    // Get the current block
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (id, name, category, target_date, original_target_date, plan)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !block) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Build update object
    const updateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      started_at: block.started_at || new Date().toISOString(),
    };

    // Store actual duration if provided
    if (duration_seconds) {
      updateData.actual_duration_seconds = duration_seconds;
    }

    // Append diary notes to existing notes (preserve session name/description)
    if (diary_notes) {
      const parts = (block.notes || '|||').split('|||');
      // Ensure we have at least 4 parts: name, description, tip, diary
      while (parts.length < 4) parts.push('');
      parts[3] = diary_notes; // Diary notes as 4th part
      updateData.notes = parts.join('|||');
    }

    // Update the block
    const { data: updatedBlock, error: updateError } = await supabase
      .from('schedule_blocks')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        goals (id, name, category, target_date, plan)
      `)
      .single();

    if (updateError) throw updateError;

    // Calculate updated progress
    let progressMessage = '🎉 Session completed!';
    let updatedStats = null;

    if (block.goal_id) {
      // Get updated stats
      const { data: completedBlocks } = await supabase
        .from('schedule_blocks')
        .select('id')
        .eq('goal_id', block.goal_id)
        .eq('status', 'completed');

      const { data: totalBlocks } = await supabase
        .from('schedule_blocks')
        .select('id')
        .eq('goal_id', block.goal_id);

      const completed = completedBlocks?.length || 0;
      const total = totalBlocks?.length || 0;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      updatedStats = {
        completed_sessions: completed,
        total_sessions: total,
        percent_complete: percent,
      };

      if (percent === 100) {
        progressMessage = '🏆 Goal complete! Amazing work!';
      } else if (percent >= 75) {
        progressMessage = `🔥 ${percent}% done - almost there!`;
      } else if (percent >= 50) {
        progressMessage = `💪 ${percent}% complete - halfway!`;
      } else {
        progressMessage = `✅ Session logged - ${percent}% complete`;
      }
    }

    return res.json({
      success: true,
      block: updatedBlock,
      progress: updatedStats,
      message: progressMessage,
    });

  } catch (error: any) {
    console.error('❌ Complete session error:', error);
    return res.status(500).json({
      error: 'Failed to complete session',
      message: error.message,
    });
  }
});

// ============================================================
// END OF NEW ROUTES FOR ACTIVE SESSION VIEW
// The existing /:id/skip route should come AFTER this
// ============================================================
// ============================================================
// GET AHEAD FEATURE
// Add this route to schedule.ts (after the session-stats routes)
// ============================================================

/**
 * GET /api/schedule/get-ahead-options
 * Get next available session for each goal that user can complete early
 * Shows how many days earlier the goal would finish
 */
router.get('/get-ahead-options', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`\n🚀 ========== GET AHEAD OPTIONS ==========`);
    console.log(`👤 User: ${user_id}`);

    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Get all active goals for this user
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('id, name, category, target_date, plan, resource_link, resource_link_label')
      .eq('user_id', user_id)
      .eq('status', 'active');

    if (goalsError) throw goalsError;

    if (!goals || goals.length === 0) {
      return res.json({ options: [], message: 'No active goals' });
    }

    const options: Array<{
      goal_id: string;
      goal_name: string;
      category: string;
      next_session: {
        id: string;
        name: string;
        description: string;
        session_number: number;
        total_sessions: number;
        duration_mins: number;
        scheduled_start: string;
        days_until_scheduled: number;
      };
      time_saved_days: number;
      new_target_date: string;
      resource_link: string | null;
      resource_link_label: string | null;
    }> = [];

    for (const goal of goals) {
      // Get the next scheduled (incomplete) session for this goal that's AFTER today
      // (we don't want to show today's sessions as "get ahead" - those are regular tasks)
      const { data: nextSession, error: sessionError } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('goal_id', goal.id)
        .eq('status', 'scheduled')
        .gt('scheduled_start', todayEnd.toISOString())
        .order('scheduled_start', { ascending: true })
        .limit(1)
        .single();

      if (sessionError || !nextSession) {
        // No future sessions for this goal
        continue;
      }

      // Get total sessions count for this goal
      const { count: totalSessions } = await supabase
        .from('schedule_blocks')
        .select('id', { count: 'exact' })
        .eq('goal_id', goal.id);

      // Get completed sessions count
      const { count: completedSessions } = await supabase
        .from('schedule_blocks')
        .select('id', { count: 'exact' })
        .eq('goal_id', goal.id)
        .eq('status', 'completed');

      // Calculate session number
      const sessionNumber = (completedSessions || 0) + 1;

      // Parse session name from notes
      const notesParts = (nextSession.notes || '').split('|||');
      const sessionName = notesParts[0] || `Session ${sessionNumber}`;
      const sessionDescription = notesParts[1] || '';

      // Calculate days until this session is scheduled
      const scheduledDate = new Date(nextSession.scheduled_start);
      const daysUntilScheduled = Math.ceil(
        (scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate time saved (how much earlier goal would finish)
      // This is roughly: days until scheduled session
      const timeSavedDays = daysUntilScheduled;

      // Calculate new target date if completed early
      let newTargetDate = goal.target_date;
      if (goal.target_date) {
        const currentTarget = new Date(goal.target_date);
        currentTarget.setDate(currentTarget.getDate() - timeSavedDays);
        newTargetDate = currentTarget.toISOString().split('T')[0];
      }

      options.push({
        goal_id: goal.id,
        goal_name: goal.name,
        category: goal.category,
        next_session: {
          id: nextSession.id,
          name: sessionName,
          description: sessionDescription,
          session_number: sessionNumber,
          total_sessions: totalSessions || 0,
          duration_mins: nextSession.duration_mins,
          scheduled_start: nextSession.scheduled_start,
          days_until_scheduled: daysUntilScheduled,
        },
        time_saved_days: timeSavedDays,
        new_target_date: newTargetDate,
        resource_link: goal.resource_link,
        resource_link_label: goal.resource_link_label,
      });
    }

    // Sort by time saved (most impactful first)
    options.sort((a, b) => b.time_saved_days - a.time_saved_days);

    console.log(`✅ Found ${options.length} get-ahead options`);

    return res.json({
      options,
      count: options.length,
      message: options.length > 0 
        ? `${options.length} sessions available to get ahead`
        : 'All caught up! No sessions to get ahead on.',
    });

  } catch (error: any) {
    console.error('❌ Get ahead options error:', error);
    return res.status(500).json({
      error: 'Failed to fetch get-ahead options',
      message: error.message,
    });
  }
});

/**
 * POST /api/schedule/:id/do-ahead
 * Complete a future session early and pull the goal deadline forward
 */
router.post('/:id/do-ahead', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { duration_seconds, diary_notes } = req.body;

    console.log(`🚀 Doing session ${id} ahead of schedule`);

    // Get the block
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (id, name, category, target_date, original_target_date, plan)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !block) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Calculate how many days early this is
    const scheduledDate = new Date(block.scheduled_start);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysEarly = Math.max(0, Math.ceil(
      (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));

    // Build update data
    const updateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      started_at: block.started_at || new Date().toISOString(),
    };

    if (duration_seconds) {
      updateData.actual_duration_seconds = duration_seconds;
    }

    // Append diary notes
    if (diary_notes) {
      const parts = (block.notes || '|||').split('|||');
      while (parts.length < 4) parts.push('');
      parts[3] = diary_notes;
      updateData.notes = parts.join('|||');
    }

    // Update the block
    const { data: updatedBlock, error: updateError } = await supabase
      .from('schedule_blocks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Pull the goal deadline forward
    let deadlineUpdate = null;
    if (block.goal_id && block.goals?.target_date && daysEarly > 0) {
      // Store original target if not set
      if (!block.goals.original_target_date) {
        await supabase
          .from('goals')
          .update({ original_target_date: block.goals.target_date })
          .eq('id', block.goal_id);
      }

      // Pull target forward
      const currentTarget = new Date(block.goals.target_date);
      currentTarget.setDate(currentTarget.getDate() - daysEarly);
      const newTargetDate = currentTarget.toISOString().split('T')[0];

      await supabase
        .from('goals')
        .update({ target_date: newTargetDate })
        .eq('id', block.goal_id);

      deadlineUpdate = {
        days_saved: daysEarly,
        old_target: block.goals.target_date,
        new_target: newTargetDate,
      };

      console.log(`📅 Pulled deadline forward by ${daysEarly} days: ${block.goals.target_date} → ${newTargetDate}`);
    }

    // Calculate progress
    let progress = null;
    if (block.goal_id) {
      const { data: completedBlocks } = await supabase
        .from('schedule_blocks')
        .select('id')
        .eq('goal_id', block.goal_id)
        .eq('status', 'completed');

      const { data: totalBlocks } = await supabase
        .from('schedule_blocks')
        .select('id')
        .eq('goal_id', block.goal_id);

      const completed = completedBlocks?.length || 0;
      const total = totalBlocks?.length || 0;

      progress = {
        completed_sessions: completed,
        total_sessions: total,
        percent_complete: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    const message = daysEarly > 0
      ? `🚀 Amazing! Completed ${daysEarly} day${daysEarly > 1 ? 's' : ''} early! Goal deadline pulled forward.`
      : `✅ Session completed!`;

    return res.json({
      success: true,
      block: updatedBlock,
      deadline_update: deadlineUpdate,
      progress,
      days_early: daysEarly,
      message,
    });

  } catch (error: any) {
    console.error('❌ Do ahead error:', error);
    return res.status(500).json({
      error: 'Failed to complete session early',
      message: error.message,
    });
  }
});


/**
 * PATCH /api/schedule/:id/skip
 * Skip a block - marks as skipped, calculates deadline impact
 */
router.patch('/:id/skip', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`⏭️ Skipping block ${id}`);
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (id, name, target_date, plan)
      `)
      .eq('id', id)
      .single();
    if (fetchError || !block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    const { error: updateError } = await supabase
      .from('schedule_blocks')
      .update({
        status: 'skipped',
      })
      .eq('id', id);
    if (updateError) throw updateError;
    let deadlineImpact = null;
    if (block.goal_id && block.goals?.target_date) {
      const scheduledDate = new Date(block.scheduled_start);
      const todayDate = new Date();
      const daysDiff = Math.floor((scheduledDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        const sessionsPerWeek = block.goals.plan?.sessions_per_week || 3;
        const daysImpact = Math.ceil(7 / sessionsPerWeek);
        
        deadlineImpact = `Goal pushed back ~${daysImpact} days.`;
        
        const currentTarget = new Date(block.goals.target_date);
        currentTarget.setDate(currentTarget.getDate() + daysImpact);
        
        await supabase
          .from('goals')
          .update({ target_date: currentTarget.toISOString().split('T')[0] })
          .eq('id', block.goal_id);
      }
    }
    return res.json({
      success: true,
      deadline_impact: deadlineImpact,
      message: deadlineImpact || 'Session skipped',
    });
  } catch (error: any) {
    console.error('❌ Skip error:', error);
    return res.status(500).json({
      error: 'Failed to skip block',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/schedule/:id/reschedule-smart
 * Smart reschedule - later today, tomorrow, or custom time
 */
router.patch('/:id/reschedule-smart', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { option, custom_time } = req.body;
    console.log(`📅 Smart reschedule block ${id} to ${option}`);
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError || !block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    let newStart: Date;
    const now = new Date();
    if (option === 'later_today') {
      newStart = new Date(now);
      newStart.setHours(Math.max(now.getHours() + 2, 18), 0, 0, 0);
      
      if (newStart.getHours() >= 22) {
        newStart.setDate(newStart.getDate() + 1);
        newStart.setHours(8, 0, 0, 0);
      }
    } else if (option === 'tomorrow') {
      const originalTime = new Date(block.scheduled_start);
      newStart = new Date(now);
      newStart.setDate(newStart.getDate() + 1);
      newStart.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);
    } else if (option === 'custom' && custom_time) {
      newStart = new Date(custom_time);
    } else {
      return res.status(400).json({ error: 'Invalid reschedule option' });
    }
    const originalStart = block.original_scheduled_start || block.scheduled_start;
    const { data: updated, error: updateError } = await supabase
      .from('schedule_blocks')
      .update({
        scheduled_start: newStart.toISOString(),
        original_scheduled_start: originalStart,
        status: 'scheduled',
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;
    return res.json({
      success: true,
      block: updated,
      new_time: newStart.toISOString(),
      message: `Rescheduled to ${newStart.toLocaleString('en-GB', { 
        weekday: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`,
    });
  } catch (error: any) {
    console.error('❌ Smart reschedule error:', error);
    return res.status(500).json({
      error: 'Failed to reschedule block',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/schedule/:id/push-to-next-week
 * Push a session to next week - affects goal deadline
 */
router.patch('/:id/push-to-next-week', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`📅 Pushing block ${id} to next week`);
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (id, name, target_date, plan)
      `)
      .eq('id', id)
      .single();
    if (fetchError || !block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    // Calculate new date (same day next week)
    const currentDate = new Date(block.scheduled_start);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    // Store original start if not set
    const originalStart = block.original_scheduled_start || block.scheduled_start;
    // Update the block
    const { data: updated, error: updateError } = await supabase
      .from('schedule_blocks')
      .update({
        scheduled_start: newDate.toISOString(),
        original_scheduled_start: originalStart,
        status: 'scheduled',
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;
    // Calculate deadline impact
    let deadlineImpact: string | null = null;
    if (block.goal_id && block.goals?.target_date) {
      const sessionsPerWeek = block.goals.plan?.sessions_per_week || 3;
      const daysImpact = Math.ceil(7 / sessionsPerWeek);
      
      // Update goal target date
      const currentTarget = new Date(block.goals.target_date);
      currentTarget.setDate(currentTarget.getDate() + daysImpact);
      
      await supabase
        .from('goals')
        .update({ target_date: currentTarget.toISOString().split('T')[0] })
        .eq('id', block.goal_id);
      deadlineImpact = `Goal deadline pushed to ${currentTarget.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short' 
      })} (+${daysImpact} days)`;
    }
    return res.json({
      success: true,
      block: updated,
      new_date: newDate.toISOString(),
      deadline_impact: deadlineImpact,
      message: `Moved to ${newDate.toLocaleDateString('en-GB', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      })}`,
    });
  } catch (error: any) {
    console.error('❌ Push to next week error:', error);
    return res.status(500).json({
      error: 'Failed to push block',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/schedule/:id/complete-early
 * Complete a future session early - can pull deadline forward
 */
router.patch('/:id/complete-early', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    console.log(`✅ Completing block ${id} early`);
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select(`
        *,
        goals (id, name, target_date, plan)
      `)
      .eq('id', id)
      .single();
    if (fetchError || !block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    // Mark as completed
    const { data: updated, error: updateError } = await supabase
      .from('schedule_blocks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;
    // Check if completing early - session was scheduled for the future
    let deadlineImpact: string | null = null;
    const scheduledDate = new Date(block.scheduled_start);
    const now = new Date();
    
    if (scheduledDate > now && block.goal_id && block.goals?.target_date) {
      // Calculate days ahead
      const daysAhead = Math.floor((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysAhead >= 1) {
        // Pull deadline forward
        const currentTarget = new Date(block.goals.target_date);
        currentTarget.setDate(currentTarget.getDate() - daysAhead);
        
        await supabase
          .from('goals')
          .update({ target_date: currentTarget.toISOString().split('T')[0] })
          .eq('id', block.goal_id);
        deadlineImpact = `Completed ${daysAhead} day${daysAhead > 1 ? 's' : ''} early! Deadline pulled to ${currentTarget.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short' 
        })} 🔥`;
      }
    }
    // Calculate progress
    let progressMessage = 'Session logged!';
    if (block.goal_id) {
      const progress = await calculateGoalProgress(block.goal_id);
      if (progress) {
        progressMessage = progress.message;
      }
    }
    return res.json({
      success: true,
      block: updated,
      deadline_impact: deadlineImpact,
      message: deadlineImpact || progressMessage,
    });
  } catch (error: any) {
    console.error('❌ Complete early error:', error);
    return res.status(500).json({
      error: 'Failed to complete block',
      message: error.message,
    });
  }
});

// ============================================================
// EXISTING ENDPOINTS (unchanged)
// ============================================================

/**
 * PATCH /api/schedule/:id
 * Update a schedule block (for drag-and-drop)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduled_start, duration_mins, notes } = req.body;
    const updateData: any = {};
    if (scheduled_start) updateData.scheduled_start = scheduled_start;
    if (duration_mins) updateData.duration_mins = duration_mins;
    if (notes !== undefined) updateData.notes = notes;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No update data provided',
      });
    }
    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    console.log(`✅ Updated schedule block: ${id}`);
    return res.json({
      block,
      message: 'Schedule block updated',
    });
  } catch (error: any) {
    console.error('❌ Update error:', error);
    return res.status(500).json({
      error: 'Failed to update block',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/schedule/:id/with-future
 * Update a schedule block and optionally apply the same time change to all future matching sessions
 */
router.patch('/:id/with-future', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduled_start, apply_to_future } = req.body;
    if (!scheduled_start) {
      return res.status(400).json({ error: 'scheduled_start is required' });
    }
    const { data: originalBlock, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name, category)')
      .eq('id', id)
      .single();
    if (fetchError || !originalBlock) {
      return res.status(404).json({ error: 'Block not found' });
    }
    const { data: updatedBlock, error: updateError } = await supabase
      .from('schedule_blocks')
      .update({ scheduled_start })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;
    let updatedCount = 1;
    if (apply_to_future && originalBlock.goal_id && originalBlock.notes) {
      const originalDate = new Date(originalBlock.scheduled_start);
      const newDate = new Date(scheduled_start);
      
      const sessionName = originalBlock.notes.split('|||')[0];
      
      const newDayOfWeek = newDate.getDay();
      const newHour = newDate.getHours();
      const newMinute = newDate.getMinutes();
      
      console.log(
        `🔄 Applying to future sessions: "${sessionName}" -> ${
          ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][newDayOfWeek]
        } ${newHour}:${String(newMinute).padStart(2, '0')}`
      );
      
      const { data: futureBlocks, error: futureError } = await supabase
        .from('schedule_blocks')
        .select('id, scheduled_start, notes')
        .eq('goal_id', originalBlock.goal_id)
        .gt('scheduled_start', originalBlock.scheduled_start)
        .neq('id', id)
        .eq('status', 'scheduled');
      if (futureError) throw futureError;
      const matchingBlocks = (futureBlocks || []).filter(block => {
        const blockSessionName = (block.notes || '').split('|||')[0];
        return blockSessionName === sessionName;
      });
      console.log(`📦 Found ${matchingBlocks.length} future matching sessions`);
      for (const block of matchingBlocks) {
        const blockDate = new Date(block.scheduled_start);
        
        const currentDayOfWeek = blockDate.getDay();
        let daysDiff = newDayOfWeek - currentDayOfWeek;
        if (daysDiff < 0) daysDiff += 7;
        if (daysDiff === 0) daysDiff = 0;
        
        const newBlockDate = new Date(blockDate);
        newBlockDate.setDate(blockDate.getDate() + daysDiff);
        newBlockDate.setHours(newHour, newMinute, 0, 0);
        const { error: blockUpdateError } = await supabase
          .from('schedule_blocks')
          .update({ scheduled_start: newBlockDate.toISOString() })
          .eq('id', block.id);
        if (!blockUpdateError) {
          updatedCount++;
        }
      }
      console.log(`✅ Updated ${updatedCount} sessions total (1 current + ${matchingBlocks.length} future)`);
    }
    return res.json({
      block: updatedBlock,
      updatedCount,
      message: apply_to_future 
        ? `Updated ${updatedCount} sessions` 
        : 'Session moved',
    });
  } catch (error: any) {
    console.error('❌ Update with future error:', error);
    return res.status(500).json({
      error: 'Failed to update sessions',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/schedule/:id/reschedule
 * Reschedule a block (legacy endpoint)
 */
router.patch('/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_start_time } = req.body;
    if (!new_start_time) {
      return res.status(400).json({
        error: 'Missing new_start_time',
      });
    }
    const newDate = new Date(new_start_time);
    const block = await rescheduleBlock(id, newDate);
    return res.json({
      block,
      message: 'Block rescheduled successfully',
    });
  } catch (error: any) {
    console.error('❌ Reschedule error:', error);
    return res.status(500).json({
      error: 'Failed to reschedule block',
      message: error.message,
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
    const { error } = await supabase.from('schedule_blocks').delete().eq('id', id);
    if (error) throw error;
    console.log(`🗑️ Deleted schedule block: ${id}`);
    return res.json({
      message: 'Schedule block deleted',
    });
  } catch (error: any) {
    console.error('❌ Delete error:', error);
    return res.status(500).json({
      error: 'Failed to delete block',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/schedule/:id/complete
 * Mark a block as completed (legacy - no notes)
 */
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    console.log(`✅ Marked block complete: ${id}`);
    return res.json({
      block,
      message: 'Block marked as completed',
    });
  } catch (error: any) {
    console.error('❌ Complete error:', error);
    return res.status(500).json({
      error: 'Failed to mark block complete',
      message: error.message,
    });
  }
});

export default router;