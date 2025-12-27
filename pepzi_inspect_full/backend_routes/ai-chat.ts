import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai } from '../services/openai';

const router = Router();

// Tool definitions for OpenAI function calling
const tools: any[] = [
  {
    type: 'function',
    function: {
      name: 'propose_action',
      description: 'Propose an action to the user and ask for confirmation. ALWAYS use this before making any changes. Never execute actions directly - always propose first.',
      parameters: {
        type: 'object',
        properties: {
          action_type: { 
            type: 'string', 
            enum: ['create_event', 'delete_block', 'reschedule_session', 'complete_session', 'skip_session'],
            description: 'The type of action being proposed' 
          },
          description: { type: 'string', description: 'Human-readable description of what will happen' },
          details: { type: 'object', description: 'The parameters that will be used for the action' },
          conflicts: { 
            type: 'array', 
            items: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                time: { type: 'string' }
              }
            },
            description: 'Any conflicting blocks that would need to be deleted' 
          },
        },
        required: ['action_type', 'description', 'details'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_confirmed_action',
      description: 'Execute an action that the user has EXPLICITLY confirmed. Only use after user says "yes", "confirm", "do it", "go ahead", etc.',
      parameters: {
        type: 'object',
        properties: {
          action_type: { 
            type: 'string', 
            enum: ['create_event', 'delete_block', 'reschedule_session', 'complete_session', 'skip_session'],
            description: 'The type of action to execute' 
          },
          params: { type: 'object', description: 'The parameters for the action' },
        },
        required: ['action_type', 'params'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_tasks',
      description: 'Get upcoming tasks from the next few days that the user could do NOW to get ahead. Use this when user asks "what can I do now?", "anything I can work on?", "want to be productive", etc.',
      parameters: {
        type: 'object',
        properties: {
          days_ahead: { type: 'number', description: 'How many days ahead to look (default 3)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_best_reschedule_time',
      description: 'Find the best available time slot to reschedule a session. Use this to check availability before proposing a reschedule.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'The ID of the session to reschedule' },
          target_date: { type: 'string', description: 'The date to check for availability in YYYY-MM-DD format' },
        },
        required: ['session_id', 'target_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description: 'Get the user\'s schedule for a specific date.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format, or "today", "tomorrow", "this_week"' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_conflicts',
      description: 'Check if a time slot has any conflicts and return details of conflicting blocks.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          start_time: { type: 'string', description: 'Start time in HH:MM format' },
          end_time: { type: 'string', description: 'End time in HH:MM format' },
        },
        required: ['date', 'start_time', 'end_time'],
      },
    },
  },
];

// ============================================================
// TOOL EXECUTION FUNCTIONS
// ============================================================

async function executeGetUpcomingTasks(
  userId: string,
  params: { days_ahead?: number }
): Promise<string> {
  try {
    const daysAhead = params.days_ahead || 3;
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const futureEnd = new Date(now);
    futureEnd.setDate(futureEnd.getDate() + daysAhead);
    futureEnd.setHours(23, 59, 59, 999);
    
    const { data: blocks, error } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name, category)')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gt('scheduled_start', now.toISOString())
      .lte('scheduled_start', futureEnd.toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(10);
    
    if (error) throw error;
    
    if (!blocks || blocks.length === 0) {
      return JSON.stringify({
        success: true,
        message: "No upcoming tasks in the next few days. You're all caught up!",
        tasks: [],
      });
    }
    
    const tasks = blocks.map(b => {
      const scheduledDate = new Date(b.scheduled_start);
      const isToday = scheduledDate.toDateString() === now.toDateString();
      const isTomorrow = scheduledDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
      
      let dayLabel = scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      if (isToday) dayLabel = 'Today';
      if (isTomorrow) dayLabel = 'Tomorrow';
      
      return {
        id: b.id,
        name: b.notes?.split('|||')[0] || b.goals?.name || b.type,
        goal: b.goals?.name,
        category: b.goals?.category,
        day: dayLabel,
        time: scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        duration_mins: b.duration_mins,
        type: b.type,
        can_do_now: true,
      };
    });
    
    const tomorrowTasks = tasks.filter(t => t.day === 'Tomorrow');
    const bestSuggestion = tomorrowTasks.length > 0 ? tomorrowTasks[0] : tasks[0];
    
    return JSON.stringify({
      success: true,
      best_suggestion: bestSuggestion,
      all_upcoming: tasks,
      message: `You could get ahead by doing "${bestSuggestion.name}" (${bestSuggestion.duration_mins} mins) - it's scheduled for ${bestSuggestion.day} at ${bestSuggestion.time}. Want to knock it out now?`,
    });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeCheckConflicts(
  userId: string,
  params: { date: string; start_time: string; end_time: string }
): Promise<string> {
  try {
    const { date, start_time, end_time } = params;
    
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    
    const { data: blocks, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString());
    
    if (error) throw error;
    
    const [startHours, startMins] = start_time.split(':').map(Number);
    const [endHours, endMins] = end_time.split(':').map(Number);
    const checkStart = startHours * 60 + startMins;
    const checkEnd = endHours * 60 + endMins;
    
    const conflicts: Array<{ id: string; name: string; type: string; time: string; duration: number }> = [];
    
    for (const block of blocks || []) {
      const blockDate = new Date(block.scheduled_start);
      const blockStart = blockDate.getHours() * 60 + blockDate.getMinutes();
      const blockEnd = blockStart + block.duration_mins;
      
      if (checkStart < blockEnd && checkEnd > blockStart) {
        const blockStartTime = `${Math.floor(blockStart/60).toString().padStart(2,'0')}:${(blockStart%60).toString().padStart(2,'0')}`;
        const blockEndTime = `${Math.floor(blockEnd/60).toString().padStart(2,'0')}:${(blockEnd%60).toString().padStart(2,'0')}`;
        
        conflicts.push({
          id: block.id,
          name: block.notes?.split('|||')[0] || block.type,
          type: block.type,
          time: `${blockStartTime}-${blockEndTime}`,
          duration: block.duration_mins,
        });
      }
    }
    
    if (conflicts.length === 0) {
      return JSON.stringify({ 
        success: true, 
        available: true,
        conflicts: [],
        message: `${start_time} to ${end_time} on ${date} is free!`
      });
    } else {
      return JSON.stringify({ 
        success: true, 
        available: false,
        conflicts: conflicts,
        message: `That time conflicts with: ${conflicts.map(c => `${c.name} (${c.time})`).join(', ')}`
      });
    }
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeFindBestRescheduleTime(
  userId: string,
  params: { session_id: string; target_date: string }
): Promise<string> {
  try {
    const { session_id, target_date } = params;
    
    const { data: session, error: sessionError } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name)')
      .eq('id', session_id)
      .single();
    
    if (sessionError || !session) {
      return JSON.stringify({ success: false, error: 'Session not found' });
    }
    
    const sessionName = session.notes?.split('|||')[0] || session.goals?.name || 'Session';
    const sessionDuration = session.duration_mins;
    
    const dayStart = new Date(`${target_date}T00:00:00`);
    const dayEnd = new Date(`${target_date}T23:59:59`);
    
    const { data: existingBlocks, error: blocksError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString())
      .neq('id', session_id)
      .order('scheduled_start', { ascending: true });
    
    if (blocksError) throw blocksError;
    
    const busyPeriods: { start: number; end: number; name: string }[] = [];
    for (const block of existingBlocks || []) {
      const blockDate = new Date(block.scheduled_start);
      const blockStart = blockDate.getHours() * 60 + blockDate.getMinutes();
      const blockEnd = blockStart + block.duration_mins;
      busyPeriods.push({ start: blockStart, end: blockEnd, name: block.notes?.split('|||')[0] || block.type });
    }
    
    busyPeriods.sort((a, b) => a.start - b.start);
    
    const dayStartMins = 7 * 60;
    const dayEndMins = 22 * 60;
    
    const availableSlots: { start: string; end: string; duration: number }[] = [];
    let currentTime = dayStartMins;
    
    for (const busy of busyPeriods) {
      if (busy.start > currentTime && busy.start - currentTime >= sessionDuration) {
        const slotEnd = Math.min(busy.start, currentTime + 180);
        availableSlots.push({
          start: `${Math.floor(currentTime/60).toString().padStart(2,'0')}:${(currentTime%60).toString().padStart(2,'0')}`,
          end: `${Math.floor(slotEnd/60).toString().padStart(2,'0')}:${(slotEnd%60).toString().padStart(2,'0')}`,
          duration: slotEnd - currentTime
        });
      }
      currentTime = Math.max(currentTime, busy.end);
    }
    
    if (dayEndMins > currentTime && dayEndMins - currentTime >= sessionDuration) {
      const slotEnd = Math.min(dayEndMins, currentTime + 180);
      availableSlots.push({
        start: `${Math.floor(currentTime/60).toString().padStart(2,'0')}:${(currentTime%60).toString().padStart(2,'0')}`,
        end: `${Math.floor(slotEnd/60).toString().padStart(2,'0')}:${(slotEnd%60).toString().padStart(2,'0')}`,
        duration: slotEnd - currentTime
      });
    }
    
    let bestSlot: { start: string; end: string } | null = null;
    const preferredTimes = [
      { start: 9 * 60, end: 12 * 60 },
      { start: 14 * 60, end: 17 * 60 },
      { start: 17 * 60, end: 20 * 60 },
      { start: 7 * 60, end: 9 * 60 },
    ];
    
    for (const pref of preferredTimes) {
      for (const slot of availableSlots) {
        const slotStartMins = parseInt(slot.start.split(':')[0]) * 60 + parseInt(slot.start.split(':')[1]);
        if (slotStartMins >= pref.start && slotStartMins < pref.end) {
          bestSlot = slot;
          break;
        }
      }
      if (bestSlot) break;
    }
    
    if (!bestSlot && availableSlots.length > 0) {
      bestSlot = availableSlots[0];
    }
    
    const scheduleDisplay = busyPeriods.map(b => 
      `${Math.floor(b.start/60).toString().padStart(2,'0')}:${(b.start%60).toString().padStart(2,'0')}-${Math.floor(b.end/60).toString().padStart(2,'0')}:${(b.end%60).toString().padStart(2,'0')}: ${b.name}`
    );
    
    const targetDateObj = new Date(target_date);
    const dayName = targetDateObj.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateDisplay = targetDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    
    if (bestSlot) {
      const [startH, startM] = bestSlot.start.split(':').map(Number);
      const endMins = startH * 60 + startM + sessionDuration;
      const suggestedEndTime = `${Math.floor(endMins/60).toString().padStart(2,'0')}:${(endMins%60).toString().padStart(2,'0')}`;
      
      return JSON.stringify({
        success: true,
        session_id: session_id,
        session_name: sessionName,
        session_duration: sessionDuration,
        target_day: `${dayName}, ${dateDisplay}`,
        target_date: target_date,
        existing_schedule: scheduleDisplay.length > 0 ? scheduleDisplay : ['No existing commitments'],
        suggested_time: bestSlot.start,
        suggested_end_time: suggestedEndTime,
        all_available_slots: availableSlots.slice(0, 5),
        message: `Best time for "${sessionName}" (${sessionDuration} mins) on ${dayName} would be ${bestSlot.start}-${suggestedEndTime}. Want me to move it there, or would you prefer a different time?`
      });
    } else {
      return JSON.stringify({
        success: true,
        session_id: session_id,
        session_name: sessionName,
        session_duration: sessionDuration,
        target_day: `${dayName}, ${dateDisplay}`,
        target_date: target_date,
        existing_schedule: scheduleDisplay,
        suggested_time: null,
        all_available_slots: [],
        message: `${dayName} looks quite full! Here's what's scheduled: ${scheduleDisplay.join(', ')}. Would you like to try a different day?`
      });
    }
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeGetSchedule(
  userId: string,
  params: { date: string }
): Promise<string> {
  try {
    const { date } = params;
    
    let startDate: Date;
    let endDate: Date;
    const now = new Date();
    
    if (date === 'today') {
      startDate = new Date(now.toISOString().split('T')[0]);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else if (date === 'tomorrow') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else if (date === 'this_week') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    } else {
      startDate = new Date(date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }
    
    const { data: blocks, error } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name, category)')
      .eq('user_id', userId)
      .gte('scheduled_start', startDate.toISOString())
      .lt('scheduled_start', endDate.toISOString())
      .order('scheduled_start', { ascending: true });
    
    if (error) throw error;
    
    const schedule = (blocks || []).map(b => {
      const time = new Date(b.scheduled_start);
      return {
        id: b.id,
        time: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        name: b.notes?.split('|||')[0] || b.goals?.name || b.type,
        type: b.type,
        duration: b.duration_mins,
        status: b.status,
        goal: b.goals?.name,
      };
    });
    
    return JSON.stringify({ 
      success: true, 
      date: date,
      schedule: schedule,
      count: schedule.length
    });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

// Propose action - just returns what would happen
async function executeProposeAction(
  userId: string,
  params: { action_type: string; description: string; details: any; conflicts?: any[] }
): Promise<string> {
  // This doesn't execute anything - it just formats the proposal
  return JSON.stringify({
    success: true,
    proposed: true,
    action_type: params.action_type,
    description: params.description,
    details: params.details,
    conflicts: params.conflicts || [],
    message: `Proposed: ${params.description}. Awaiting user confirmation.`,
  });
}

// Execute confirmed action - only called after user confirms
async function executeConfirmedAction(
  userId: string,
  params: { action_type: string; params: any }
): Promise<string> {
  const { action_type, params: actionParams } = params;
  
  try {
    switch (action_type) {
      case 'create_event': {
        const { date, start_time, end_time, title, type = 'event' } = actionParams;
        
        const [startHours, startMins] = start_time.split(':').map(Number);
        const [endHours, endMins] = end_time.split(':').map(Number);
        const durationMins = (endHours * 60 + endMins) - (startHours * 60 + startMins);
        
        if (durationMins <= 0) {
          return JSON.stringify({ success: false, error: 'End time must be after start time' });
        }
        
        const scheduledStart = new Date(`${date}T${start_time}:00`);
        
        const { data: newBlock, error } = await supabase
          .from('schedule_blocks')
          .insert({
            user_id: userId,
            goal_id: null,
            type: type,
            scheduled_start: scheduledStart.toISOString(),
            duration_mins: durationMins,
            notes: title,
            flexibility: 'fixed',
            created_by: 'user',
            status: 'scheduled',
          })
          .select()
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({ 
          success: true, 
          message: `✅ Created "${title}" on ${date} from ${start_time} to ${end_time}`,
          block: newBlock
        });
      }
      
      case 'delete_block': {
        const { block_id, reason } = actionParams;
        
        // First get the block to confirm it exists and get its name
        const { data: block, error: fetchError } = await supabase
          .from('schedule_blocks')
          .select('*')
          .eq('id', block_id)
          .single();
        
        if (fetchError || !block) {
          return JSON.stringify({ success: false, error: 'Block not found' });
        }
        
        const blockName = block.notes?.split('|||')[0] || block.type;
        
        const { error: deleteError } = await supabase
          .from('schedule_blocks')
          .delete()
          .eq('id', block_id);
        
        if (deleteError) throw deleteError;
        
        return JSON.stringify({ 
          success: true, 
          message: `✅ Deleted "${blockName}"${reason ? ` (${reason})` : ''}`,
        });
      }
      
      case 'reschedule_session': {
        const { session_id, new_date, new_time } = actionParams;
        
        const { data: block, error: fetchError } = await supabase
          .from('schedule_blocks')
          .select('*, goals(name)')
          .eq('id', session_id)
          .single();
        
        if (fetchError || !block) {
          return JSON.stringify({ success: false, error: 'Session not found' });
        }
        
        const newScheduledStart = new Date(`${new_date}T${new_time}:00`);
        
        const { error: updateError } = await supabase
          .from('schedule_blocks')
          .update({
            scheduled_start: newScheduledStart.toISOString(),
            original_scheduled_start: block.original_scheduled_start || block.scheduled_start,
          })
          .eq('id', session_id);
        
        if (updateError) throw updateError;
        
        const sessionName = block.notes?.split('|||')[0] || block.goals?.name || 'Session';
        const [newHours, newMins] = new_time.split(':').map(Number);
        const endMins = newHours * 60 + newMins + block.duration_mins;
        const endTime = `${Math.floor(endMins/60).toString().padStart(2,'0')}:${(endMins%60).toString().padStart(2,'0')}`;
        const dayName = newScheduledStart.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
        
        return JSON.stringify({ 
          success: true, 
          message: `✅ Moved "${sessionName}" to ${dayName} at ${new_time}-${endTime}`,
        });
      }
      
      case 'complete_session': {
        const { session_id, notes } = actionParams;
        
        const { data: block, error: fetchError } = await supabase
          .from('schedule_blocks')
          .select('*, goals(name)')
          .eq('id', session_id)
          .single();
        
        if (fetchError || !block) {
          return JSON.stringify({ success: false, error: 'Session not found' });
        }
        
        const { error: updateError } = await supabase
          .from('schedule_blocks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            notes: notes || block.notes,
          })
          .eq('id', session_id);
        
        if (updateError) throw updateError;
        
        const sessionName = block.notes?.split('|||')[0] || block.goals?.name || 'Session';
        
        return JSON.stringify({ 
          success: true, 
          message: `✅ Completed "${sessionName}"! Great work! 🎉`
        });
      }
      
      case 'skip_session': {
        const { session_id, reason } = actionParams;
        
        const { data: block, error: fetchError } = await supabase
          .from('schedule_blocks')
          .select('*, goals(name, target_date, plan)')
          .eq('id', session_id)
          .single();
        
        if (fetchError || !block) {
          return JSON.stringify({ success: false, error: 'Session not found' });
        }
        
        const { error: updateError } = await supabase
          .from('schedule_blocks')
          .update({ status: 'skipped' })
          .eq('id', session_id);
        
        if (updateError) throw updateError;
        
        let deadlineImpact = null;
        if (block.goal_id && block.goals?.target_date) {
          const sessionsPerWeek = block.goals.plan?.sessions_per_week || 3;
          const daysImpact = Math.ceil(7 / sessionsPerWeek);
          
          const currentTarget = new Date(block.goals.target_date);
          currentTarget.setDate(currentTarget.getDate() + daysImpact);
          
          await supabase
            .from('goals')
            .update({ target_date: currentTarget.toISOString().split('T')[0] })
            .eq('id', block.goal_id);
          
          deadlineImpact = `Goal deadline pushed to ${currentTarget.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
        }
        
        const sessionName = block.notes?.split('|||')[0] || block.goals?.name || 'Session';
        
        return JSON.stringify({ 
          success: true, 
          message: `✅ Skipped "${sessionName}".${deadlineImpact ? ` ${deadlineImpact}` : ''}`,
          deadline_impact: deadlineImpact
        });
      }
      
      default:
        return JSON.stringify({ success: false, error: `Unknown action type: ${action_type}` });
    }
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

// Execute a tool call
async function executeTool(userId: string, toolName: string, toolInput: any): Promise<string> {
  switch (toolName) {
    case 'propose_action':
      return executeProposeAction(userId, toolInput);
    case 'execute_confirmed_action':
      return executeConfirmedAction(userId, toolInput);
    case 'get_upcoming_tasks':
      return executeGetUpcomingTasks(userId, toolInput);
    case 'find_best_reschedule_time':
      return executeFindBestRescheduleTime(userId, toolInput);
    case 'get_schedule':
      return executeGetSchedule(userId, toolInput);
    case 'check_conflicts':
      return executeCheckConflicts(userId, toolInput);
    default:
      return JSON.stringify({ success: false, error: 'Unknown tool' });
  }
}

/**
 * POST /api/ai-chat
 * AI-powered chat endpoint using OpenAI
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, message, conversation_history = [], today_tasks = [] } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: 'Missing user_id or message' });
    }

    console.log(`\n🤖 AI Chat: "${message.substring(0, 50)}..."`);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dayName = now.toLocaleDateString('en-GB', { weekday: 'long' });

    const pendingTasks = today_tasks.filter((t: any) => t.status !== 'completed');
    const completedTasks = today_tasks.filter((t: any) => t.status === 'completed');
    
    let tasksContext = '';
    if (today_tasks.length > 0) {
      tasksContext = `\n\nTODAY'S SCHEDULE:\n`;
      for (const task of today_tasks) {
        const time = new Date(task.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const status = task.status === 'completed' ? '✓ DONE' : 'pending';
        tasksContext += `- [${status}] ${task.name} at ${time} (${task.duration_mins}min) - ID: ${task.id}\n`;
        if (task.goal_name) tasksContext += `  Goal: ${task.goal_name}\n`;
      }
      tasksContext += `\nSummary: ${pendingTasks.length} pending, ${completedTasks.length} completed`;
    }

    const systemPrompt = `You are Pepzi, a friendly and helpful AI personal assistant for productivity and goal tracking.

CURRENT CONTEXT:
- Date: ${dayName}, ${todayStr}
- Time: ${currentTime}
- User ID: ${user_id}
${tasksContext}

═══════════════════════════════════════════════════════════════════════════════
⚠️  CRITICAL RULE: ALWAYS ASK FOR CONFIRMATION BEFORE EXECUTING ANY ACTION ⚠️
═══════════════════════════════════════════════════════════════════════════════

You must NEVER execute actions without explicit user confirmation. Follow this pattern:

1. USER REQUESTS SOMETHING → You PROPOSE the action and ASK for confirmation
2. USER CONFIRMS (says "yes", "do it", "go ahead", "confirm", "ok", etc.) → THEN you execute

WORKFLOW FOR ALL ACTIONS:

Step 1: When user wants to do something, use check_conflicts or get_schedule to understand the situation
Step 2: Use propose_action to describe what you WILL do and ask "Should I go ahead?"
Step 3: WAIT for user to confirm
Step 4: ONLY after confirmation, use execute_confirmed_action

EXAMPLE - Creating an event:
User: "Book Christmas day off from 12 to 3pm"
You: [check_conflicts for that time]
You: [If conflicts found] "I can book December 25th from 12:00-15:00 as time off. 
     However, this conflicts with your commute block from 13:00-18:00. 
     Would you like me to:
     1. Delete the commute and book your time off
     2. Adjust the time to avoid the conflict
     Which would you prefer?"
User: "Delete the commute and book it"
You: [execute_confirmed_action to delete commute]
You: [execute_confirmed_action to create event]
You: "Done! I've removed the commute and booked your time off from 12:00-15:00 ✓"

EXAMPLE - Rescheduling:
User: "Move my gym session to tomorrow"
You: [find_best_reschedule_time]
You: "I can move your gym session to tomorrow at 10:00-11:00. Should I go ahead?"
User: "Yes"
You: [execute_confirmed_action]
You: "Done! Moved to tomorrow at 10:00 ✓"

═══════════════════════════════════════════════════════════════════════════════
🚫  THINGS YOU MUST NEVER DO:
═══════════════════════════════════════════════════════════════════════════════

- NEVER skip sessions unless user explicitly asks to skip that specific session
- NEVER complete sessions unless user explicitly asks to complete that specific session
- NEVER delete blocks unless user explicitly asks or confirms deletion
- NEVER assume what the user wants - always ask if unclear
- NEVER execute multiple unrelated actions - focus on what user asked

YOUR CAPABILITIES:
1. CREATE EVENTS: Book time blocks (propose first, execute after confirmation)
2. DELETE BLOCKS: Remove existing blocks (always ask first)
3. RESCHEDULE: Move sessions (find time, propose, execute after confirmation)
4. COMPLETE: Mark done (only when user specifically asks)
5. SKIP: Skip sessions (only when user specifically asks)
6. CHECK SCHEDULE: Look up plans
7. GET UPCOMING TASKS: Find tasks user could do early

DATE PARSING (today is ${todayStr}):
- "Christmas" or "Christmas day" = 2024-12-25
- "Saturday" = find next Saturday
- "tomorrow" = add 1 day
- Always convert to YYYY-MM-DD format

PERSONALITY:
- Be conversational and friendly
- Use emojis sparingly
- Be proactive about asking clarifying questions
- Keep responses concise
- Always confirm before acting`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-10).map((msg: any) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    let response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1024,
    });

    let finalResponse = '';
    let actions: any[] = [];
    let iterations = 0;
    const maxIterations = 5;

    while (response.choices[0]?.message?.tool_calls && iterations < maxIterations) {
      iterations++;
      
      const toolCalls = response.choices[0].message.tool_calls;
      messages.push(response.choices[0].message);
      
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);
        
        console.log(`🔧 Tool: ${toolName}`, toolInput);
        
        const result = await executeTool(user_id, toolName, toolInput);
        const parsedResult = JSON.parse(result);
        
        actions.push({
          tool: toolName,
          input: toolInput,
          result: parsedResult,
        });
        
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      
      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1024,
      });
    }

    finalResponse = response.choices[0]?.message?.content || "I've completed that for you!";

    console.log(`✅ AI Response: "${finalResponse.substring(0, 100)}..."`);

    return res.json({
      success: true,
      response: finalResponse,
      actions: actions,
    });

  } catch (error: any) {
    console.error('❌ AI Chat error:', error);
    return res.status(500).json({
      error: 'AI chat failed',
      message: error.message,
      response: "Sorry, I'm having trouble right now. Please try again!",
    });
  }
});

export default router;