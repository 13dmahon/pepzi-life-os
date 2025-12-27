import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai } from '../services/openai';

const router = Router();

// ============================================================
// TRACKING METRICS DEFINITIONS
// ============================================================

const TRACKING_METRICS: Record<string, { 
  label: string; 
  type: 'number' | 'boolean' | 'text' | 'scale';
  unit?: string;
  min?: number;
  max?: number;
}> = {
  duration_mins: { label: 'Duration', type: 'number', unit: 'minutes' },
  effort_level: { label: 'Effort level', type: 'scale', min: 1, max: 10 },
  distance_km: { label: 'Distance', type: 'number', unit: 'km' },
  time_mins: { label: 'Time', type: 'number', unit: 'minutes' },
  pace_min_km: { label: 'Pace', type: 'number', unit: 'min/km' },
  heart_rate: { label: 'Average heart rate', type: 'number', unit: 'bpm' },
  calories: { label: 'Calories burned', type: 'number' },
  weight_kg: { label: 'Weight used', type: 'number', unit: 'kg' },
  reps: { label: 'Reps completed', type: 'number' },
  sets: { label: 'Sets completed', type: 'number' },
  completed: { label: 'Completed', type: 'boolean' },
  pain_notes: { label: 'Pain or discomfort', type: 'text' },
  new_vocabulary_count: { label: 'New words learned', type: 'number' },
  conversation_mins: { label: 'Conversation practice', type: 'number', unit: 'minutes' },
  lessons_completed: { label: 'Lessons completed', type: 'number' },
  tasks_completed: { label: 'Tasks completed', type: 'number' },
  revenue: { label: 'Revenue', type: 'number', unit: '£' },
  highest_grade: { label: 'Highest grade', type: 'text' },
  problems_sent: { label: 'Problems sent', type: 'number' },
  words_written: { label: 'Words written', type: 'number' },
  notes: { label: 'Notes', type: 'text' },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get today's schedule blocks for a user
 */
async function getTodayBlocks(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: blocks, error } = await supabase
    .from('schedule_blocks')
    .select(`
      *,
      goals (id, name, category, plan)
    `)
    .eq('user_id', userId)
    .gte('scheduled_start', `${today}T00:00:00`)
    .lt('scheduled_start', `${today}T23:59:59`)
    .order('scheduled_start', { ascending: true });

  if (error) throw error;
  return blocks || [];
}

/**
 * Get goal progress stats
 */
async function getGoalProgress(goalId: string) {
  // Get all completed blocks for this goal
  const { data: completedBlocks } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('goal_id', goalId)
    .eq('status', 'completed');

  // Get goal details
  const { data: goal } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (!goal) return null;

  const totalCompleted = completedBlocks?.length || 0;
  const totalHoursLogged = (completedBlocks || []).reduce((sum, b) => sum + (b.duration_mins || 0), 0) / 60;
  const targetHours = goal.plan?.total_estimated_hours || 50;
  const weeklyTarget = goal.plan?.sessions_per_week || 3;
  
  // Calculate this week's progress
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeekCompleted = (completedBlocks || []).filter(b => 
    new Date(b.completed_at || b.scheduled_start) >= startOfWeek
  ).length;

  const percentComplete = Math.round((totalHoursLogged / targetHours) * 100);
  const onTrack = thisWeekCompleted >= Math.floor(weeklyTarget * (new Date().getDay() / 7));

  return {
    totalSessions: totalCompleted,
    totalHours: Math.round(totalHoursLogged * 10) / 10,
    targetHours,
    percentComplete: Math.min(100, percentComplete),
    thisWeekCompleted,
    weeklyTarget,
    onTrack,
    status: onTrack ? 'on_track' : (thisWeekCompleted > 0 ? 'slightly_behind' : 'behind'),
  };
}

/**
 * Parse session notes to extract name, description, tip
 */
function parseSessionNotes(notes: string): { name: string; description: string; tip: string } {
  const parts = (notes || '').split('|||');
  return {
    name: parts[0] || 'Session',
    description: parts[1] || '',
    tip: parts[2] || '',
  };
}

/**
 * Get tracking requirements for a block
 */
function getTrackingRequirements(block: any): string[] {
  // First check if goal has specific tracking_criteria
  const goalTracking = block.goals?.plan?.tracking_criteria;
  if (Array.isArray(goalTracking) && goalTracking.length > 0) {
    return goalTracking;
  }

  // Fall back to category defaults
  const category = block.goals?.category || 'default';
  const goalName = (block.goals?.name || '').toLowerCase();
  
  // Check for specific goal types
  if (goalName.includes('run') || goalName.includes('5k') || goalName.includes('marathon')) {
    return ['duration_mins', 'distance_km', 'effort_level'];
  }
  
  const categoryDefaults: Record<string, string[]> = {
    fitness: ['duration_mins', 'effort_level'],
    climbing: ['duration_mins', 'effort_level', 'problems_sent'],
    languages: ['duration_mins', 'effort_level'],
    business: ['duration_mins', 'tasks_completed'],
    creative: ['duration_mins', 'effort_level'],
    mental_health: ['duration_mins', 'effort_level'],
    default: ['duration_mins', 'effort_level'],
  };

  return categoryDefaults[category] || categoryDefaults.default;
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/chat/message
 * Smart chat for logging activities
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { user_id, message, conversation_state } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: 'Missing user_id or message' });
    }

    console.log(`💬 Chat message: "${message.substring(0, 50)}..."`);

    // Get today's schedule
    const todayBlocks = await getTodayBlocks(user_id);
    const pendingBlocks = todayBlocks.filter(b => b.status !== 'completed');
    const completedBlocks = todayBlocks.filter(b => b.status === 'completed');

    // Build context for AI - make IDs very prominent
    const blocksContext = todayBlocks.map((b, i) => {
      const { name, description } = parseSessionNotes(b.notes);
      const tracking = getTrackingRequirements(b);
      const trackingLabels = tracking.map(t => TRACKING_METRICS[t]?.label || t).join(', ');
      
      return `SESSION ${i + 1}:
  - ID: "${b.id}"
  - Name: "${name}"
  - Goal: ${b.goals?.name || 'General'}
  - Time: ${new Date(b.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
  - Duration: ${b.duration_mins}min
  - Status: ${b.status}
  - Track: ${trackingLabels}`;
    }).join('\n\n');

    // Check if we're in the middle of logging a specific block
    const loggingState = conversation_state?.logging;

    const systemPrompt = `You are Pepzi, a friendly AI life coach helping users log their daily activities.

TODAY'S SESSIONS:
${blocksContext || 'No sessions scheduled for today.'}

${loggingState ? `
CURRENTLY LOGGING:
Block ID: "${loggingState.blockId}"
Session: "${loggingState.sessionName}"
Goal: ${loggingState.goalName}
Required tracking: ${loggingState.requiredMetrics.join(', ')}
Already collected: ${JSON.stringify(loggingState.collectedData || {})}
Still need: ${loggingState.missingMetrics?.join(', ') || 'Nothing - ready to confirm!'}
` : ''}

YOUR TASK:
1. If user mentions completing a task, identify which session they mean
2. Ask for the required tracking metrics (one at a time or naturally)
3. Once all data is collected, summarize and ask for confirmation
4. Be encouraging and conversational!

CRITICAL: When identifying a session, you MUST use the exact "ID" field (UUID format like "abc123-def456-...") from the session list above, NOT the session name!

RESPOND WITH JSON:
{
  "message": "Your conversational response",
  "action": null | "identify_session" | "collect_data" | "confirm_log" | "log_complete",
  "session_id": "THE UUID FROM THE ID FIELD - NOT THE NAME!",
  "collected_data": { "metric": value },
  "ready_to_log": true/false,
  "logging_state": {
    "blockId": "MUST BE THE UUID FROM ID FIELD - e.g. '550e8400-e29b-41d4-a716-446655440000'",
    "sessionName": "The human-readable name",
    "goalName": "...",
    "goalId": "...",
    "requiredMetrics": ["..."],
    "collectedData": {},
    "missingMetrics": ["..."]
  }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...(conversation_state?.history || []).slice(-10).map((h: any) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: message },
      ],
      temperature: 0.4,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Update conversation history
    const history = [...(conversation_state?.history || [])];
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: parsed.message });

    // Handle ready to log
    if (parsed.ready_to_log && parsed.logging_state?.blockId) {
      return res.json({
        response: parsed.message,
        show_confirmation: true,
        confirmation_data: {
          block_id: parsed.logging_state.blockId,
          session_name: parsed.logging_state.sessionName,
          goal_name: parsed.logging_state.goalName,
          tracked_data: parsed.logging_state.collectedData,
        },
        state: {
          history,
          logging: parsed.logging_state,
        },
        ui_updates: {},
      });
    }

    return res.json({
      response: parsed.message,
      show_confirmation: false,
      state: {
        history,
        logging: parsed.logging_state || loggingState,
      },
      ui_updates: {},
    });

  } catch (error: any) {
    console.error('❌ Chat error:', error);
    return res.status(500).json({
      error: 'Failed to process message',
      response: "Sorry, I had trouble understanding that. Could you try again?",
    });
  }
});

/**
 * POST /api/chat/confirm-log
 * Confirm and save the logged activity
 */
router.post('/confirm-log', async (req: Request, res: Response) => {
  try {
    const { user_id, block_id, tracked_data } = req.body;

    if (!user_id || !block_id) {
      return res.status(400).json({ error: 'Missing user_id or block_id' });
    }

    console.log(`✅ Confirming log for block ${block_id}`);

    // Check if block_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let actualBlockId = block_id;

    if (!uuidRegex.test(block_id)) {
      // AI returned session name instead of ID - try to find the block
      console.log(`⚠️ Invalid UUID format, searching for block by name: "${block_id}"`);
      
      const today = new Date().toISOString().split('T')[0];
      const { data: blocks } = await supabase
        .from('schedule_blocks')
        .select('id, notes')
        .eq('user_id', user_id)
        .gte('scheduled_start', `${today}T00:00:00`)
        .lt('scheduled_start', `${today}T23:59:59`)
        .eq('status', 'scheduled');

      // Find block where notes starts with the session name
      const matchingBlock = blocks?.find(b => {
        const sessionName = (b.notes || '').split('|||')[0];
        return sessionName.toLowerCase().includes(block_id.toLowerCase()) ||
               block_id.toLowerCase().includes(sessionName.toLowerCase());
      });

      if (matchingBlock) {
        actualBlockId = matchingBlock.id;
        console.log(`✅ Found matching block: ${actualBlockId}`);
      } else {
        return res.status(400).json({ 
          error: 'Could not find matching session',
          message: 'Please try again - I couldn\'t identify which session to log.'
        });
      }
    }

    // Update the block
    const { data: block, error } = await supabase
      .from('schedule_blocks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        tracked_data: tracked_data || {},
      })
      .eq('id', actualBlockId)
      .select(`
        *,
        goals (id, name, category, plan)
      `)
      .single();

    if (error) throw error;

    // Get progress stats
    const progress = block.goal_id ? await getGoalProgress(block.goal_id) : null;

    // Generate encouraging response
    const { name } = parseSessionNotes(block.notes);
    let progressMessage = `🎉 Logged "${name}" successfully!`;

    if (progress) {
      progressMessage += `\n\n📊 **${block.goals?.name} Progress:**`;
      progressMessage += `\n• Sessions this week: ${progress.thisWeekCompleted}/${progress.weeklyTarget}`;
      progressMessage += `\n• Total hours logged: ${progress.totalHours}h / ${progress.targetHours}h`;
      progressMessage += `\n• Overall: ${progress.percentComplete}% complete`;
      
      if (progress.status === 'on_track') {
        progressMessage += `\n\n✅ You're on track! Keep it up! 💪`;
      } else if (progress.status === 'slightly_behind') {
        progressMessage += `\n\n📈 You're slightly behind this week - try to fit in another session!`;
      } else {
        progressMessage += `\n\n⚠️ You're behind schedule - don't worry, every session counts!`;
      }
    }

    // Check if there are more pending tasks
    const todayBlocks = await getTodayBlocks(user_id);
    const remaining = todayBlocks.filter(b => b.status !== 'completed' && b.id !== block_id);

    if (remaining.length > 0) {
      progressMessage += `\n\n📋 You have ${remaining.length} more session${remaining.length > 1 ? 's' : ''} today. What's next?`;
    } else {
      progressMessage += `\n\n🌟 That's all for today - great work!`;
    }

    return res.json({
      success: true,
      block,
      progress,
      message: progressMessage,
      remaining_today: remaining.length,
    });

  } catch (error: any) {
    console.error('❌ Confirm log error:', error);
    return res.status(500).json({
      error: 'Failed to log activity',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/today-summary
 * Get summary of today's tasks with tracking requirements
 */
router.get('/today-summary', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const blocks = await getTodayBlocks(user_id as string);

    const tasks = blocks.map(block => {
      const { name, description, tip } = parseSessionNotes(block.notes);
      const tracking = getTrackingRequirements(block);
      
      return {
        id: block.id,
        name,
        description,
        tip,
        goal_name: block.goals?.name || 'General',
        goal_id: block.goal_id,
        category: block.goals?.category,
        scheduled_time: block.scheduled_start,
        duration_mins: block.duration_mins,
        status: block.status,
        completed_at: block.completed_at,
        tracked_data: block.tracked_data,
        tracking_requirements: tracking.map(metric => {
          const metricDef = TRACKING_METRICS[metric];
          if (metricDef) {
            return { key: metric, ...metricDef };
          }
          // Fallback for unknown metrics - create a readable label
          return {
            key: metric,
            label: metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            type: 'number' as const,
          };
        }),
      };
    });

    const pending = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed');

    return res.json({
      date: new Date().toISOString().split('T')[0],
      tasks,
      summary: {
        total: tasks.length,
        pending: pending.length,
        completed: completed.length,
      },
    });

  } catch (error: any) {
    console.error('❌ Today summary error:', error);
    return res.status(500).json({
      error: 'Failed to get today summary',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/goal-progress/:goalId
 * Get detailed progress for a goal
 */
router.get('/goal-progress/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    const progress = await getGoalProgress(goalId);

    if (!progress) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    return res.json(progress);

  } catch (error: any) {
    console.error('❌ Goal progress error:', error);
    return res.status(500).json({
      error: 'Failed to get progress',
      message: error.message,
    });
  }
});

export default router;