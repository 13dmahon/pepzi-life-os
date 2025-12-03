import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { parseRelativeTime, parseTime, combineDateAndTime } from '../utils/timeParser';
import { rescheduleBlock } from '../services/planner';

const router = Router();

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
 * Now handles weekends properly (all day is free if no work)
 */
function getAvailableSlots(
  dayName: string,
  availability: any,
  userBlocksForDay: Array<{ start: number; end: number }> = []
): Array<{ start: number; end: number }> {
  const slots: Array<{ start: number; end: number }> = [];

  // Use availability settings or sensible defaults
  const wake = parseTimeHelper(availability?.wake_time || '06:00');
  const sleep = parseTimeHelper(availability?.sleep_time || '22:00');
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
 */
function findBestSlot(
  availableSlots: Array<{ start: number; end: number }>,
  scheduledSlots: Array<{ start: number; end: number; goalId: string }>,
  duration: number,
  preference: 'morning' | 'afternoon' | 'evening' | 'any',
  goalId: string,
  sessionIndex: number = 0
): { start: number; end: number } | null {
  const BUFFER = 15;
  
  const TIME_OFFSETS = [0, 45, 90, 30, 75, 15, 60, 105];
  const offset = TIME_OFFSETS[sessionIndex % TIME_OFFSETS.length];

  const timeRanges = {
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

    if (candidate.start < 7 * 60 && preference !== 'morning') {
      candidate.score -= 50;
    }

    const startMins = candidate.start % 60;
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
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
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

      let preferredTime: 'morning' | 'afternoon' | 'evening' | 'any' = 'any';
      if (goal.category === 'fitness' || goal.category === 'climbing') {
        preferredTime = availability.preferred_workout_time || 'morning';
      } else if (goal.category === 'business' || goal.category === 'career') {
        preferredTime = 'evening';
      } else if (goal.category === 'languages') {
        preferredTime = 'morning';
      }

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
            scheduled: false,
          });
        }
      }
    });

  plannedSessions.sort((a, b) => b.sessionDuration - a.sessionDuration);

  console.log(`\n📊 Sessions to schedule: ${plannedSessions.length} total`);
  plannedSessions.forEach((ps) => {
    console.log(`   ${ps.goalName}: "${ps.sessionName}" (${ps.sessionDuration}min) [${ps.preferredTime}]`);
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
    const hours = Math.round(totalMins / 60 * 10) / 10;
    console.log(`   ${day}: ${hours}h free`);
  });

  const totalNeededMins = plannedSessions.reduce((sum, ps) => sum + ps.sessionDuration, 0);
  if (totalNeededMins > totalAvailableMins * 0.8) {
    warning = `You need ${Math.round(totalNeededMins / 60)}h/week for all goals, but only have ~${Math.round(totalAvailableMins / 60)}h available. Some sessions may not fit.`;
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
        const details = unscheduled.slice(0, 3).map((ps) => 
          `"${ps.sessionName}" (${ps.sessionDuration}min)`
        ).join(', ');
        
        warning = `Couldn't fit ${unscheduled.length} sessions: ${details}${unscheduled.length > 3 ? '...' : ''}. Consider adjusting your schedule or reducing session count.`;
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
        goals (name, category)
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
        goals (name, category)
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

    console.log(`\n📅 ========== CREATING RECURRING BLOCKS ==========`);
    console.log(`👤 User: ${user_id}`);
    console.log(`📋 Type: ${type}`);
    console.log(`📆 Days: ${days.join(', ')}`);
    console.log(`⏰ Time: ${start_time} - ${end_time} (${durationMins} mins)`);

    const { data: goals } = await supabase
      .from('goals')
      .select('target_date')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .not('target_date', 'is', null)
      .order('target_date', { ascending: false })
      .limit(1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let scheduleEndDate: Date;
    if (goals && goals.length > 0 && goals[0].target_date) {
      scheduleEndDate = new Date(goals[0].target_date);
      scheduleEndDate.setDate(scheduleEndDate.getDate() + 7);
    } else {
      scheduleEndDate = new Date(today);
      scheduleEndDate.setDate(scheduleEndDate.getDate() + 12 * 7);
    }

    console.log(`📆 Scheduling from ${today.toDateString()} to ${scheduleEndDate.toDateString()}`);

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
    const currentDate = new Date(today);

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
 */
async function generateFullGoalSchedule(
  goal: any,
  userId: string,
  preferredDays: string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'any' = 'any'
): Promise<{ blocksCreated: number; warning: string | null }> {
  console.log(`\n🗓️ ========== GENERATING FULL SCHEDULE FOR GOAL ==========`);
  console.log(`📋 Goal: ${goal.name}`);
  console.log(`📅 Preferred days: ${preferredDays.join(', ')}`);
  console.log(`⏰ Preferred time: ${preferredTime}`);

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

  const { data: availability } = await supabase
    .from('user_availability')
    .select('*')
    .eq('user_id', userId)
    .single();

  const effectiveAvailability = availability || {
    wake_time: '06:00',
    sleep_time: '22:00',
    work_schedule: {},
    fixed_commitments: [],
    daily_commute_mins: 0,
    preferred_workout_time: preferredTime,
  };

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

  for (let weekNum = 0; weekNum < totalWeeks; weekNum++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + weekNum * 7);

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

      for (const dayName of preferredDays) {
        if (scheduled) break;
        
        const dayIndex = DAYS.indexOf(dayName.toLowerCase());
        if (dayIndex === -1) continue;

        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex);

        if (dayDate < new Date()) continue;

        const availSlots = getAvailableSlots(dayName, effectiveAvailability, userBlocksByDay[dayName]);

        for (const slot of availSlots) {
          if (scheduled) break;
          
          if (slot.end - slot.start < duration) continue;

          const todayScheduled = scheduledThisWeek.filter(s => s.day === dayName);
          let hasConflict = false;

          const candidateStart = slot.start;
          const candidateEnd = candidateStart + duration;

          for (const existing of todayScheduled) {
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
        for (const dayName of DAYS) {
          if (scheduled) break;
          if (preferredDays.map(d => d.toLowerCase()).includes(dayName)) continue;

          const dayIndex = DAYS.indexOf(dayName);
          const dayDate = new Date(weekStart);
          dayDate.setDate(weekStart.getDate() + dayIndex);

          if (dayDate < new Date()) continue;

          const availSlots = getAvailableSlots(dayName, effectiveAvailability, userBlocksByDay[dayName]);

          for (const slot of availSlots) {
            if (scheduled) break;
            if (slot.end - slot.start < duration) continue;

            const todayScheduled = scheduledThisWeek.filter(s => s.day === dayName);
            let hasConflict = false;
            const candidateStart = slot.start;
            const candidateEnd = candidateStart + duration;

            for (const existing of todayScheduled) {
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
 */
router.post('/generate-for-goal', async (req: Request, res: Response) => {
  try {
    const { user_id, goal_id, preferred_days, preferred_time } = req.body;

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

    const result = await generateFullGoalSchedule(
      goal,
      user_id,
      preferred_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      preferred_time || 'any'
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
 */
router.post('/auto-generate', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`\n🤖 ========== AUTO-GENERATE SCHEDULE ==========`);
    console.log(`🤖 User: ${user_id}`);

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

    const { data: availability } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user_id)
      .single();

    const effectiveAvailability = availability || {
      wake_time: '06:00',
      sleep_time: '22:00',
      work_schedule: {},
      fixed_commitments: [],
      daily_commute_mins: 0,
      preferred_workout_time: 'morning',
    };

    console.log(`📅 Availability: ${availability ? 'Custom set' : 'Using defaults (6am-10pm)'}`);

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
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
// NEW ENDPOINTS - Complete with notes, Skip, Smart Reschedule
// ============================================================

/**
 * PATCH /api/schedule/:id/complete-with-notes
 * Complete a block with just notes (simplified - no metrics)
 */
router.patch('/:id/complete-with-notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    console.log(`✅ Completing block ${id} with notes`);

    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', id)
      .select(`
        *,
        goals (id, name, category, plan, target_date)
      `)
      .single();

    if (error) throw error;

    let progressMessage = null;
    if (block.goal_id) {
      const progress = await calculateGoalProgress(block.goal_id);
      if (progress) {
        progressMessage = progress.message;
      }
    }

    return res.json({
      success: true,
      block,
      message: progressMessage || 'Session logged!',
    });

  } catch (error: any) {
    console.error('❌ Complete with notes error:', error);
    return res.status(500).json({
      error: 'Failed to complete block',
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
      const today = new Date();
      const daysDiff = Math.floor((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
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
      
      console.log(`🔄 Applying to future sessions: "${sessionName}" -> ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][newDayOfWeek]} ${newHour}:${String(newMinute).padStart(2, '0')}`);
      
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