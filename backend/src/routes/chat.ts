import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { extractIntents } from '../services/openai';
import { buildUserContext } from '../services/contextBuilder';
import { createLog } from '../services/logger';
import { parseRelativeTime, parseTime, combineDateAndTime } from '../utils/timeParser';

const router = Router();

/**
 * POST /api/chat
 * Main conversational endpoint - processes intents and executes actions
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'message']
      });
    }

    console.log(`💬 Chat request from user ${user_id}: "${message}"`);

    // Build context
    const context = await buildUserContext(user_id);

    // Extract intents using AI
    const aiResponse = await extractIntents(message, context);
    console.log('🤖 AI response:', JSON.stringify(aiResponse, null, 2));

    // Save user message
    await supabase.from('messages').insert({
      user_id,
      speaker: 'user',
      message,
      timestamp: new Date().toISOString()
    });

    // Process intents and execute actions
    const actionsTaken: any[] = [];
    let scheduleRefresh = false;
    let goalsRefresh = false;

    if (aiResponse.intents && Array.isArray(aiResponse.intents)) {
      for (const intent of aiResponse.intents) {
        try {
          switch (intent.type) {
            
            case 'log_activity':
              // User is logging something they did
              const logResult = await handleLogActivity(user_id, intent.data, context);
              actionsTaken.push({ type: 'log_created', data: logResult });
              goalsRefresh = true;
              break;

            case 'reschedule_block':
              // User wants to move a scheduled activity
              const rescheduleResult = await handleReschedule(user_id, intent.data, context);
              actionsTaken.push({ type: 'schedule_updated', data: rescheduleResult });
              scheduleRefresh = true;
              break;

            case 'create_block':
              // User wants to add a new activity
              const createResult = await handleCreateBlock(user_id, intent.data);
              actionsTaken.push({ type: 'schedule_created', data: createResult });
              scheduleRefresh = true;
              break;

            case 'query_progress':
              // User is asking about progress (no action needed)
              break;

            case 'general_chat':
              // Just conversation (no action needed)
              break;

            default:
              console.log(`⚠️ Unknown intent type: ${intent.type}`);
          }
        } catch (intentError: any) {
          console.error(`❌ Error processing intent ${intent.type}:`, intentError);
          actionsTaken.push({
            type: 'error',
            intent: intent.type,
            error: intentError.message
          });
        }
      }
    }

    // Save assistant message
    await supabase.from('messages').insert({
      user_id,
      speaker: 'pepzi',
      message: aiResponse.response || 'I understand.',
      extracted_data: aiResponse.intents,
      timestamp: new Date().toISOString()
    });

    // Return response
    return res.json({
      response: aiResponse.response,
      intents: aiResponse.intents,
      actions_taken: actionsTaken,
      ui_updates: {
        schedule_refresh: scheduleRefresh,
        goals_refresh: goalsRefresh
      }
    });

  } catch (error: any) {
    console.error('❌ Chat endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Handle log_activity intent
 */
async function handleLogActivity(userId: string, data: any, context: any) {
  // Determine which goal this relates to (if any)
  let goalId = null;

  // Try to match activity to a goal
  if (data.activity_type === 'run' || data.activity_type === 'workout') {
    const fitnessGoal = context.goals.find((g: any) => g.category === 'fitness');
    goalId = fitnessGoal?.id || null;
  }

  // Create log entry
  const log = await createLog(
    userId,
    goalId,
    data.activity_type || 'general',
    data,
    'user_message'
  );

  return {
    log_id: log.id,
    goal_id: goalId,
    logged_at: log.timestamp
  };
}

/**
 * Handle reschedule_block intent
 */
async function handleReschedule(userId: string, data: any, context: any) {
  // Find the block to reschedule
  const targetDate = parseRelativeTime(data.new_time || data.day_reference || 'tomorrow');
  
  if (!targetDate) {
    throw new Error('Could not parse new time');
  }

  // Find blocks matching the description
  const { data: blocks, error } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .order('scheduled_start', { ascending: true })
    .limit(10);

  if (error) throw error;

  if (!blocks || blocks.length === 0) {
    throw new Error('No scheduled blocks found to reschedule');
  }

  // For now, reschedule the first matching block
  // (In Phase 4, we'll make this smarter)
  const blockToReschedule = blocks[0];

  // Parse time if provided
  let finalDateTime = targetDate;
  if (data.time) {
    const timeObj = parseTime(data.time);
    if (timeObj) {
      finalDateTime = combineDateAndTime(targetDate, timeObj);
    }
  }

  // Update the block
  const { data: updatedBlock, error: updateError } = await supabase
    .from('schedule_blocks')
    .update({
      scheduled_start: finalDateTime.toISOString(),
      status: 'rescheduled'
    })
    .eq('id', blockToReschedule.id)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    block_id: updatedBlock.id,
    old_time: blockToReschedule.scheduled_start,
    new_time: updatedBlock.scheduled_start
  };
}

/**
 * Handle create_block intent
 */
async function handleCreateBlock(userId: string, data: any) {
  // Parse when to schedule it
  const scheduledDate = parseRelativeTime(data.day_reference || data.when || 'today');
  
  if (!scheduledDate) {
    throw new Error('Could not parse schedule time');
  }

  // Parse time if provided
  let finalDateTime = scheduledDate;
  if (data.time) {
    const timeObj = parseTime(data.time);
    if (timeObj) {
      finalDateTime = combineDateAndTime(scheduledDate, timeObj);
    }
  }

  // Create the block
  const { data: block, error } = await supabase
    .from('schedule_blocks')
    .insert({
      user_id: userId,
      goal_id: data.goal_id || null,
      type: data.activity || 'activity',
      scheduled_start: finalDateTime.toISOString(),
      duration_mins: data.duration_minutes || 60,
      notes: data.description || null,
      flexibility: 'movable',
      created_by: 'user',
      status: 'scheduled'
    })
    .select()
    .single();

  if (error) throw error;

  return {
    block_id: block.id,
    scheduled_time: block.scheduled_start,
    duration: block.duration_mins
  };
}

export default router;
