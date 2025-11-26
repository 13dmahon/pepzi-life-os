import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { simpleCompletion } from '../services/openai';

const router = Router();

/**
 * POST /api/availability/extract
 * Extract availability from natural language
 */
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { user_id, text } = req.body;

    if (!user_id || !text) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'text']
      });
    }

    console.log(`📅 Extracting availability for user ${user_id}`);

    const prompt = `Extract weekly availability from this text and return as JSON.

Text: "${text}"

IMPORTANT: 
- wake_time is when they wake up (e.g., "07:00" for 7am)
- sleep_time is when they go to sleep at NIGHT (e.g., "23:00" for 11pm, NOT "12:00" for noon!)
- If they say "sleep at 11pm" that's "23:00"
- If they say "sleep at midnight" that's "00:00"

Return JSON in this exact format:
{
  "wake_time": "HH:MM",
  "sleep_time": "HH:MM",
  "work_schedule": {
    "monday": {"start": "HH:MM", "end": "HH:MM"} or null,
    "tuesday": {"start": "HH:MM", "end": "HH:MM"} or null,
    "wednesday": {"start": "HH:MM", "end": "HH:MM"} or null,
    "thursday": {"start": "HH:MM", "end": "HH:MM"} or null,
    "friday": {"start": "HH:MM", "end": "HH:MM"} or null,
    "saturday": {"start": "HH:MM", "end": "HH:MM"} or null,
    "sunday": {"start": "HH:MM", "end": "HH:MM"} or null
  },
  "daily_commute_mins": number,
  "fixed_commitments": [
    {"day": "thursday", "start": "HH:MM", "end": "HH:MM", "name": "Activity name"}
  ],
  "preferred_workout_time": "morning|afternoon|evening|flexible"
}

Only return valid JSON, no other text.`;

    const response = await simpleCompletion(prompt);
    
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const availability = JSON.parse(cleanResponse);

    // Calculate free hours
    const freeHours = calculateFreeHours(availability);
    availability.total_free_hours_per_week = freeHours.free;
    availability.total_busy_hours_per_week = freeHours.busy;

    console.log(`✅ Extracted availability: ${freeHours.free}h free per week`);

    return res.json({
      availability,
      summary: {
        free_hours: freeHours.free,
        busy_hours: freeHours.busy,
        is_feasible: freeHours.free > 10 // At least 10 hours free
      }
    });

  } catch (error: any) {
    console.error('❌ Availability extraction error:', error);
    return res.status(500).json({
      error: 'Failed to extract availability',
      message: error.message
    });
  }
});

/**
 * POST /api/availability
 * Save user availability
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, ...availabilityData } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    // Upsert (insert or update)
    const { data, error } = await supabase
      .from('user_availability')
      .upsert({
        user_id,
        ...availabilityData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Saved availability for user ${user_id}`);

    return res.json({
      availability: data,
      message: 'Availability saved successfully'
    });

  } catch (error: any) {
    console.error('❌ Save availability error:', error);
    return res.status(500).json({
      error: 'Failed to save availability',
      message: error.message
    });
  }
});

/**
 * GET /api/availability
 * Get user availability
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const { data, error } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user_id as string)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

    return res.json({
      availability: data || null,
      has_availability: !!data
    });

  } catch (error: any) {
    console.error('❌ Get availability error:', error);
    return res.status(500).json({
      error: 'Failed to get availability',
      message: error.message
    });
  }
});

/**
 * GET /api/availability/feasibility
 * Check if user's goals are feasible with their availability
 */
router.get('/feasibility', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    // Get user availability
    const { data: availability, error: availError } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user_id as string)
      .single();

    if (availError && availError.code !== 'PGRST116') throw availError;

    // Get active goals
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*, plan')
      .eq('user_id', user_id as string)
      .eq('status', 'active');

    if (goalsError) throw goalsError;

    // Calculate total hours needed
    let totalHoursNeeded = 0;
    const goalBreakdown = (goals || []).map((goal: any) => {
      const weeklyHours = goal.plan?.weekly_hours || 0;
      totalHoursNeeded += weeklyHours;
      return {
        goal_id: goal.id,
        goal_name: goal.name,
        weekly_hours: weeklyHours,
      };
    });

    const freeHours = availability?.total_free_hours_per_week || 0;
    const isFeasible = totalHoursNeeded <= freeHours;
    const buffer = freeHours - totalHoursNeeded;

    console.log(`✅ Feasibility check: ${totalHoursNeeded}h needed, ${freeHours}h available`);

    return res.json({
      has_availability: !!availability,
      free_hours: freeHours,
      hours_needed: totalHoursNeeded,
      buffer_hours: buffer,
      is_feasible: isFeasible,
      goal_breakdown: goalBreakdown,
      suggestion: !isFeasible 
        ? `You need ${Math.abs(buffer)} more hours per week. Consider extending deadlines or reducing goal scope.`
        : buffer > 20
        ? `You have ${buffer}h extra capacity. Consider adding more goals!`
        : `Perfect balance! You have ${buffer}h buffer for flexibility.`,
    });

  } catch (error: any) {
    console.error('❌ Feasibility check error:', error);
    return res.status(500).json({
      error: 'Failed to check feasibility',
      message: error.message
    });
  }
});

// Helper function to calculate free hours
function calculateFreeHours(availability: any): { free: number; busy: number } {
  const hoursPerDay = 24;
  const daysPerWeek = 7;
  const totalHours = hoursPerDay * daysPerWeek; // 168 hours

  // Calculate hours AWAKE per day (not sleep hours!)
  const sleepHours = parseTimeToHours(availability.sleep_time);
  const wakeHours = parseTimeToHours(availability.wake_time);
  
  let dailyAwakeHours;
  if (sleepHours > wakeHours) {
    // Normal case: wake at 7am (7), sleep at 11pm (23) = 23 - 7 = 16 hours awake
    dailyAwakeHours = sleepHours - wakeHours;
  } else {
    // Sleep crosses midnight: wake at 7am (7), sleep at 1am (1) = (24 - 7) + 1 = 18 hours awake
    dailyAwakeHours = (24 - wakeHours) + sleepHours;
  }
  
  // Calculate sleep hours from awake hours
  const dailySleepHours = 24 - dailyAwakeHours;
  const weeklySleepHours = dailySleepHours * 7;

  // Work hours
  let weeklyWorkHours = 0;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    const schedule = availability.work_schedule[day];
    if (schedule && schedule.start && schedule.end) {
      const start = parseTimeToHours(schedule.start);
      const end = parseTimeToHours(schedule.end);
      weeklyWorkHours += (end - start);
    }
  }

  // Commute hours
  const weeklyCommuteHours = (availability.daily_commute_mins || 0) / 60 * 5; // Assuming 5 work days

  // Fixed commitments
  let fixedCommitmentHours = 0;
  if (availability.fixed_commitments && Array.isArray(availability.fixed_commitments)) {
    for (const commitment of availability.fixed_commitments) {
      const start = parseTimeToHours(commitment.start);
      const end = parseTimeToHours(commitment.end);
      fixedCommitmentHours += (end - start);
    }
  }

  const busyHours = weeklySleepHours + weeklyWorkHours + weeklyCommuteHours + fixedCommitmentHours;
  const freeHours = totalHours - busyHours;

  console.log(`📊 Calculation breakdown:
    - Total hours: ${totalHours}
    - Sleep: ${weeklySleepHours}h (${dailySleepHours}h/day)
    - Awake: ${dailyAwakeHours * 7}h (${dailyAwakeHours}h/day)
    - Work: ${weeklyWorkHours}h
    - Commute: ${weeklyCommuteHours}h
    - Fixed: ${fixedCommitmentHours}h
    - Busy: ${busyHours}h
    - Free: ${freeHours}h`);

  return {
    free: Math.round(freeHours * 10) / 10,
    busy: Math.round(busyHours * 10) / 10
  };
}

function parseTimeToHours(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + (minutes / 60);
}

export default router;