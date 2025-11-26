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
 * Get available time slots for a day
 * Now handles weekends properly (all day is free if no work)
 */
function getAvailableSlots(
  dayName: string,
  availability: any,
  userBlocksForDay: Array<{ start: number; end: number }> = [] // 🆕 Blocks from calendar
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

  // 3. 🆕 User-created blocks from calendar (work, commute, events added via UI)
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
 * 🆕 IMPROVED: Find best available slot with VARIED start times
 * - Spreads sessions across the day (not all at same time)
 * - Considers user preference (morning/afternoon/evening)
 * - Uses offset to vary start times
 */
function findBestSlot(
  availableSlots: Array<{ start: number; end: number }>,
  scheduledSlots: Array<{ start: number; end: number; goalId: string }>,
  duration: number,
  preference: 'morning' | 'afternoon' | 'evening' | 'any',
  goalId: string,
  sessionIndex: number = 0 // 🆕 Used to vary start times
): { start: number; end: number } | null {
  const BUFFER = 15; // 15 min buffer between sessions
  
  // 🆕 Offset based on session index - spreads sessions across different times
  const TIME_OFFSETS = [0, 45, 90, 30, 75, 15, 60, 105]; // minutes
  const offset = TIME_OFFSETS[sessionIndex % TIME_OFFSETS.length];

  // Define time ranges
  const timeRanges = {
    morning: { start: 5 * 60, end: 12 * 60 }, // 5am - 12pm
    afternoon: { start: 12 * 60, end: 17 * 60 }, // 12pm - 5pm
    evening: { start: 17 * 60, end: 23 * 60 }, // 5pm - 11pm
  };

  // For each available slot, find sub-slots that aren't already scheduled
  const candidateSlots: Array<{ start: number; end: number; score: number }> = [];

  for (const availSlot of availableSlots) {
    // Get scheduled items within this available slot
    const scheduledInSlot = scheduledSlots
      .filter((s) => s.start < availSlot.end && s.end > availSlot.start)
      .sort((a, b) => a.start - b.start);

    // Find gaps
    let searchStart = availSlot.start;

    for (const scheduled of scheduledInSlot) {
      // Gap before this scheduled item
      const gapEnd = scheduled.start - BUFFER;
      if (gapEnd - searchStart >= duration) {
        // 🆕 Apply offset to vary start times
        const adjustedStart = Math.min(searchStart + offset, gapEnd - duration);
        candidateSlots.push({
          start: Math.max(searchStart, adjustedStart),
          end: Math.max(searchStart, adjustedStart) + duration,
          score: 0,
        });
      }
      searchStart = Math.max(searchStart, scheduled.end + BUFFER);
    }

    // Gap after all scheduled items
    if (availSlot.end - searchStart >= duration) {
      // 🆕 Apply offset to vary start times
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

  // Score candidates based on preference
  for (const candidate of candidateSlots) {
    // Preference score
    if (preference !== 'any') {
      const range = timeRanges[preference];
      if (candidate.start >= range.start && candidate.start < range.end) {
        candidate.score += 100;
      }
    }

    // 🆕 Penalize very early morning times (before 7am) unless preferred
    if (candidate.start < 7 * 60 && preference !== 'morning') {
      candidate.score -= 50;
    }

    // 🆕 Slight preference for round start times (on the hour or half hour)
    const startMins = candidate.start % 60;
    if (startMins === 0 || startMins === 30) {
      candidate.score += 10;
    } else if (startMins === 15 || startMins === 45) {
      candidate.score += 5;
    }
  }

  // Sort by score (highest first)
  candidateSlots.sort((a, b) => b.score - a.score);

  return { start: candidateSlots[0].start, end: candidateSlots[0].end };
}

/**
 * 🆕 IMPROVED: Smart scheduling with better spreading and user block support
 * Now reads actual training plan sessions with their specific durations and names!
 * Also reads user blocks from calendar (work, commute, events) instead of requiring availability modal
 */
function generateSmartSchedule(
  goals: any[],
  availability: any, // Can be null - will use defaults
  startOfWeek: Date,
  existingUserBlocks: any[] = []
): { blocks: any[]; warning: string | null } {
  const blocks: any[] = [];
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let warning: string | null = null;

  // Track scheduled slots per day (training sessions we're creating)
  const scheduledByDay: Record<string, Array<{ start: number; end: number; goalId: string }>> = {};
  DAYS.forEach((day) => {
    scheduledByDay[day] = [];
  });

  // 🆕 Group user blocks by day (work, commute, events from calendar UI)
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
    
    // Also add to scheduledByDay so training doesn't overlap
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

  // 🆕 Calculate current week number (weeks since goal creation)
  const getGoalWeekNumber = (goal: any): number => {
    const createdAt = new Date(goal.created_at || new Date());
    const weeksSinceCreation = Math.floor(
      (startOfWeek.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, weeksSinceCreation + 1); // Week 1 is first week
  };

  // 🆕 Extract specific sessions from training plan for current week
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
      
      // 🔧 FIX: Check multiple possible locations for weekly sessions
      // Structure can be: weekly_plan.weeks[] OR weekly_plans[]
      const weeklyPlans = goal.plan?.weekly_plan?.weeks || goal.plan?.weekly_plans || [];
      
      // Find the plan for current week (or fallback to week 1, or last available week)
      let weekPlan = weeklyPlans.find((wp: any) => wp.week === currentWeek);
      if (!weekPlan && weeklyPlans.length > 0) {
        // If current week doesn't exist, use modulo to cycle through available weeks
        const weekIndex = (currentWeek - 1) % weeklyPlans.length;
        weekPlan = weeklyPlans[weekIndex];
      }

      // Determine preferred time based on category
      let preferredTime: 'morning' | 'afternoon' | 'evening' | 'any' = 'any';
      if (goal.category === 'fitness' || goal.category === 'climbing') {
        preferredTime = availability.preferred_workout_time || 'morning';
      } else if (goal.category === 'business' || goal.category === 'career') {
        preferredTime = 'evening';
      } else if (goal.category === 'languages') {
        preferredTime = 'morning';
      }

      if (weekPlan && weekPlan.sessions && weekPlan.sessions.length > 0) {
        // 🎯 Use specific sessions from the training plan!
        console.log(`   📋 ${goal.name} Week ${currentWeek}: ${weekPlan.sessions.length} specific sessions`);
        
        weekPlan.sessions.forEach((session: any) => {
          plannedSessions.push({
            goalId: goal.id,
            oderId: goal.user_id,
            goalName: goal.name,
            category: goal.category,
            sessionName: session.name || session.title || 'Training Session',
            sessionDuration: session.duration_mins || session.duration || 60,
            sessionDescription: session.description || session.focus || '', // Full description
            sessionTip: session.notes || session.tip || session.coach_tip || '', // Coach tip
            preferredTime,
            scheduled: false,
          });
        });
      } else {
        // Fallback: No specific sessions, create generic ones based on weekly_hours
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
            sessionDuration: Math.min(Math.max(sessionDuration, 15), 120), // 15-120 min
            preferredTime,
            scheduled: false,
          });
        }
      }
    });

  // Sort by duration (longer sessions first - easier to fit)
  plannedSessions.sort((a, b) => b.sessionDuration - a.sessionDuration);

  console.log(`\n📊 Sessions to schedule: ${plannedSessions.length} total`);
  plannedSessions.forEach((ps) => {
    console.log(`   ${ps.goalName}: "${ps.sessionName}" (${ps.sessionDuration}min) [${ps.preferredTime}]`);
  });

  // Get available slots for each day (now includes user blocks from calendar!)
  const availableByDay: Record<string, Array<{ start: number; end: number }>> = {};
  DAYS.forEach((day) => {
    availableByDay[day] = getAvailableSlots(day, availability, userBlocksByDay[day]);
  });

  // Debug: Show available time per day
  console.log(`\n📅 Available time per day:`);
  let totalAvailableMins = 0;
  DAYS.forEach((day) => {
    const totalMins = availableByDay[day].reduce((sum, slot) => sum + (slot.end - slot.start), 0);
    totalAvailableMins += totalMins;
    const hours = Math.round(totalMins / 60 * 10) / 10;
    console.log(`   ${day}: ${hours}h free`);
  });

  // Calculate total needed vs available
  const totalNeededMins = plannedSessions.reduce((sum, ps) => sum + ps.sessionDuration, 0);
  if (totalNeededMins > totalAvailableMins * 0.8) {
    warning = `You need ${Math.round(totalNeededMins / 60)}h/week for all goals, but only have ~${Math.round(totalAvailableMins / 60)}h available. Some sessions may not fit.`;
    console.log(`\n⚠️ ${warning}`);
  }

  // 🆕 Schedule each specific session
  let globalSessionIndex = 0;
  
  // Distribute sessions across days more evenly
  // Group by goal first, then round-robin across days
  const sessionsByGoal: Record<string, PlannedSession[]> = {};
  plannedSessions.forEach((ps) => {
    if (!sessionsByGoal[ps.goalId]) sessionsByGoal[ps.goalId] = [];
    sessionsByGoal[ps.goalId].push(ps);
  });

  let round = 0;
  const MAX_ROUNDS = 50;

  while (round < MAX_ROUNDS) {
    let anyScheduledThisRound = false;

    // Shuffle day order each round to avoid always starting with Sunday
    const dayOrder = [...DAYS];
    if (round > 0) {
      const rotateBy = round % 7;
      for (let i = 0; i < rotateBy; i++) {
        dayOrder.push(dayOrder.shift()!);
      }
    }

    // Go through each day
    for (const dayName of dayOrder) {
      const dayIndex = DAYS.indexOf(dayName);
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + dayIndex);

      // Try to schedule one session per goal per day (round-robin)
      for (const goalId of Object.keys(sessionsByGoal)) {
        const goalSessions = sessionsByGoal[goalId];
        const nextSession = goalSessions.find((s) => !s.scheduled);
        
        if (!nextSession) continue; // All sessions for this goal scheduled

        // Limit sessions per day per goal
        const sessionsThisDayForGoal = scheduledByDay[dayName].filter(
          (s) => s.goalId === goalId
        ).length;
        
        const maxPerDay = Math.max(Math.ceil(goalSessions.length / 5), 2);
        if (sessionsThisDayForGoal >= maxPerDay) continue;

        // Find a slot for this specific session
        const slot = findBestSlot(
          availableByDay[dayName],
          scheduledByDay[dayName],
          nextSession.sessionDuration,
          nextSession.preferredTime,
          nextSession.goalId,
          globalSessionIndex
        );

        if (slot) {
          // Create the scheduled time
          const scheduledTime = new Date(currentDay);
          const { hours, minutes } = fromMinutes(slot.start);
          scheduledTime.setHours(hours, minutes, 0, 0);

          // Add the block with the SPECIFIC session name, description, and tip!
          // Format: name|||description|||tip (can be parsed by frontend)
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
            duration_mins: nextSession.sessionDuration, // 🎯 Actual duration from plan!
            status: 'scheduled',
            notes: notesData, // 🎯 Contains name, description, and tip!
            created_by: 'auto',
            flexibility: 'movable',
          });

          // Mark slot as used
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

    // Check if all sessions are scheduled
    const allDone = plannedSessions.every((ps) => ps.scheduled);

    if (allDone) {
      console.log(`\n✅ All ${plannedSessions.length} sessions scheduled after ${round} rounds`);
      break;
    }

    if (!anyScheduledThisRound) {
      console.log(`\n⚠️ No more slots available after ${round} rounds`);
      
      // Generate specific warning about which sessions couldn't fit
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

  // Log results
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
 * POST /api/schedule/auto-generate
 * Auto-generate weekly schedule based on goals and availability
 * 🆕 Now returns warnings if sessions don't fit
 */
router.post('/auto-generate', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`\n🤖 ========== AUTO-GENERATE SCHEDULE ==========`);
    console.log(`🤖 User: ${user_id}`);

    // 1. Get user's active goals with plans
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active');

    if (goalsError) throw goalsError;

    // Filter to goals with weekly_hours > 0
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

    // 2. Get user availability (optional - will use defaults if not set)
    const { data: availability } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user_id)
      .single();

    // If no availability set, use sensible defaults
    const effectiveAvailability = availability || {
      wake_time: '06:00',
      sleep_time: '22:00',
      work_schedule: {}, // No work blocked = all day free
      fixed_commitments: [],
      daily_commute_mins: 0,
      preferred_workout_time: 'morning',
    };

    console.log(`📅 Availability: ${availability ? 'Custom set' : 'Using defaults (6am-10pm)'}`);

    // 3. Calculate week boundaries
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // 4. 🆕 Get existing USER-CREATED blocks (work, commute, events from calendar)
    // These are blocks the user added via "Add Block" or are type work/commute/event
    const { data: existingUserBlocks } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('user_id', user_id)
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString())
      .or('created_by.eq.user,type.in.(work,commute,event,social)');

    console.log(`📦 Existing user blocks to schedule around: ${existingUserBlocks?.length || 0}`);

    // 5. Clear only AUTO-GENERATED schedule for this week
    await supabase
      .from('schedule_blocks')
      .delete()
      .eq('user_id', user_id)
      .eq('created_by', 'auto')
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString());

    // 6. Generate schedule (passing user blocks to avoid conflicts)
    const { blocks: schedule, warning } = generateSmartSchedule(
      goalsWithPlans, 
      effectiveAvailability, 
      startOfWeek,
      existingUserBlocks || []
    );

    // 7. Insert generated blocks
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
      warning, // 🆕 Include warning in response
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
 * Mark a block as completed
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