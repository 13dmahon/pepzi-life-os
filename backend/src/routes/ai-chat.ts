import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai } from '../services/openai';

const router = Router();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getNextDayDate(dayName: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date();
  const todayIndex = today.getDay();
  const targetIndex = days.indexOf(dayName.toLowerCase());
  
  if (targetIndex === -1) return today.toISOString().split('T')[0];
  
  let daysUntil = targetIndex - todayIndex;
  if (daysUntil <= 0) daysUntil += 7;
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntil);
  return targetDate.toISOString().split('T')[0];
}

function parseTimeString(timeStr: string): string {
  if (!timeStr) return '00:00';
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr.padStart(5, '0');
  
  const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (match) {
    let hours = parseInt(match[1]);
    const mins = match[2] ? parseInt(match[2]) : 0;
    const period = match[3]?.toLowerCase();
    
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  return timeStr;
}

function formatTimeDisplay(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function parseDateInput(date: string): string {
  if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(date)) {
    return getNextDayDate(date);
  } else if (date === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  } else if (date === 'today') {
    return new Date().toISOString().split('T')[0];
  }
  return date;
}

// ============================================================
// TOOL DEFINITIONS
// ============================================================

const tools: any[] = [
  {
    type: 'function',
    function: {
      name: 'preview_booking',
      description: `Preview what will happen when booking an event. Shows conflicts and how they'll be resolved.
      
Use this FIRST when user wants to book something. It will show:
- The event details
- Any conflicts found
- How conflicts will be resolved (sessions moved)

After showing the preview, ASK the user to confirm before using confirm_booking.`,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Name of the event' },
          date: { type: 'string', description: 'Date - "friday", "tomorrow", or YYYY-MM-DD' },
          start_time: { type: 'string', description: 'Start time like "6pm", "18:00"' },
          end_time: { type: 'string', description: 'End time like "11pm". Defaults to 2 hours if not specified.' },
        },
        required: ['title', 'date', 'start_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirm_booking',
      description: `Execute a booking AFTER the user has confirmed. Only use this when user says "yes", "sure", "do it", "sounds good", etc.
      
This will:
1. Move any conflicting training sessions
2. Create the event
3. Return confirmation`,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Name of the event' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          start_time: { type: 'string', description: 'Start time in HH:MM format' },
          end_time: { type: 'string', description: 'End time in HH:MM format' },
          duration_mins: { type: 'number', description: 'Duration in minutes' },
        },
        required: ['title', 'date', 'start_time', 'duration_mins'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description: 'Get the schedule for a specific day.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date: "today", "tomorrow", "friday", or YYYY-MM-DD' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_session',
      description: 'Mark a training session as completed.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'The ID of the session to complete' },
          notes: { type: 'string', description: 'Optional notes about the session' },
        },
        required: ['session_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skip_session',
      description: 'Skip a training session (will affect goal deadline).',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'The ID of the session to skip' },
        },
        required: ['session_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_session',
      description: 'Move a specific training session to a new time.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'The ID of the session to reschedule' },
          new_date: { type: 'string', description: 'New date' },
          new_time: { type: 'string', description: 'New time like "7am", "09:00"' },
        },
        required: ['session_id', 'new_date', 'new_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_event',
      description: 'Delete an event or block from the calendar.',
      parameters: {
        type: 'object',
        properties: {
          block_id: { type: 'string', description: 'The ID of the block to delete' },
        },
        required: ['block_id'],
      },
    },
  },
];

// ============================================================
// TOOL IMPLEMENTATIONS
// ============================================================

async function findFreeSlot(
  userId: string,
  date: string,
  durationMins: number,
  excludeBlockIds: string[] = []
): Promise<{ start: string; end: string } | null> {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  
  const { data: blocks } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_start', dayStart.toISOString())
    .lte('scheduled_start', dayEnd.toISOString())
    .order('scheduled_start', { ascending: true });
  
  const busyPeriods: { start: number; end: number }[] = [];
  for (const block of blocks || []) {
    if (excludeBlockIds.includes(block.id)) continue;
    
    const blockDate = new Date(block.scheduled_start);
    const startMins = blockDate.getHours() * 60 + blockDate.getMinutes();
    busyPeriods.push({ start: startMins, end: startMins + block.duration_mins });
  }
  
  busyPeriods.sort((a, b) => a.start - b.start);
  
  const preferredWindows = [
    { start: 6 * 60, end: 9 * 60 },
    { start: 9 * 60, end: 12 * 60 },
    { start: 17 * 60, end: 20 * 60 },
    { start: 12 * 60, end: 17 * 60 },
  ];
  
  for (const window of preferredWindows) {
    let currentTime = window.start;
    
    for (const busy of busyPeriods) {
      if (busy.start >= window.end) break;
      if (busy.end <= currentTime) continue;
      
      if (busy.start > currentTime && busy.start - currentTime >= durationMins) {
        const slotStart = Math.max(currentTime, window.start);
        if (slotStart + durationMins <= busy.start) {
          return {
            start: formatTimeDisplay(slotStart),
            end: formatTimeDisplay(slotStart + durationMins),
          };
        }
      }
      currentTime = Math.max(currentTime, busy.end);
    }
    
    if (currentTime < window.end && window.end - currentTime >= durationMins) {
      return {
        start: formatTimeDisplay(currentTime),
        end: formatTimeDisplay(currentTime + durationMins),
      };
    }
  }
  
  return null;
}

async function executePreviewBooking(
  userId: string,
  params: { title: string; date: string; start_time: string; end_time?: string }
): Promise<string> {
  try {
    let { title, date, start_time, end_time } = params;
    
    // Parse date
    date = parseDateInput(date);
    
    // Parse times
    start_time = parseTimeString(start_time);
    const parsedEndTime = end_time ? parseTimeString(end_time) : undefined;
    
    // Calculate duration
    let durationMins = 120;
    if (parsedEndTime) {
      const [startH, startM] = start_time.split(':').map(Number);
      const [endH, endM] = parsedEndTime.split(':').map(Number);
      durationMins = (endH * 60 + endM) - (startH * 60 + startM);
      if (durationMins <= 0) durationMins = 120;
    }
    
    const [startH, startM] = start_time.split(':').map(Number);
    const eventStartMins = startH * 60 + startM;
    const eventEndMins = eventStartMins + durationMins;
    const displayEndTime = formatTimeDisplay(eventEndMins);
    
    // Get existing blocks
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    
    const { data: existingBlocks } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name)')
      .eq('user_id', userId)
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString());
    
    // Find conflicts
    const conflicts: Array<{
      id: string;
      name: string;
      type: string;
      startMins: number;
      endMins: number;
      durationMins: number;
      canMove: boolean;
      newTime?: string;
      newDay?: string;
    }> = [];
    
    const MOVEABLE_TYPES = ['workout', 'training'];
    
    for (const block of existingBlocks || []) {
      const blockDate = new Date(block.scheduled_start);
      const blockStartMins = blockDate.getHours() * 60 + blockDate.getMinutes();
      const blockEndMins = blockStartMins + block.duration_mins;
      
      if (eventStartMins < blockEndMins && eventEndMins > blockStartMins) {
        conflicts.push({
          id: block.id,
          name: block.notes?.split('|||')[0] || block.goals?.name || block.type,
          type: block.type,
          startMins: blockStartMins,
          endMins: blockEndMins,
          durationMins: block.duration_mins,
          canMove: MOVEABLE_TYPES.includes(block.type) && block.status !== 'completed',
        });
      }
    }
    
    // Check for fixed conflicts
    const fixedConflicts = conflicts.filter(c => !c.canMove);
    if (fixedConflicts.length > 0) {
      const conflictList = fixedConflicts.map(c => 
        `${c.name} (${formatTimeDisplay(c.startMins)}-${formatTimeDisplay(c.endMins)})`
      ).join(', ');
      
      return JSON.stringify({
        success: false,
        error: 'fixed_conflict',
        message: `Can't book that time - it overlaps with ${conflictList} which can't be moved. Try a different time?`,
      });
    }
    
    // Find new slots for moveable conflicts
    const moveableConflicts = conflicts.filter(c => c.canMove);
    const plannedMoves: Array<{ name: string; from: string; to: string }> = [];
    
    for (const conflict of moveableConflicts) {
      const excludeIds = moveableConflicts.map(c => c.id);
      const newSlot = await findFreeSlot(userId, date, conflict.durationMins, excludeIds);
      
      if (!newSlot) {
        const tomorrow = new Date(date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowSlot = await findFreeSlot(userId, tomorrowStr, conflict.durationMins, []);
        
        if (!tomorrowSlot) {
          return JSON.stringify({
            success: false,
            error: 'no_space',
            message: `Can't find space to move "${conflict.name}". Your schedule is quite full!`,
          });
        }
        
        const tomorrowDayName = tomorrow.toLocaleDateString('en-GB', { weekday: 'short' });
        conflict.newTime = tomorrowSlot.start;
        conflict.newDay = tomorrowStr;
        plannedMoves.push({
          name: conflict.name,
          from: formatTimeDisplay(conflict.startMins),
          to: `${tomorrowDayName} ${tomorrowSlot.start}`,
        });
      } else {
        conflict.newTime = newSlot.start;
        conflict.newDay = date;
        plannedMoves.push({
          name: conflict.name,
          from: formatTimeDisplay(conflict.startMins),
          to: newSlot.start,
        });
      }
    }
    
    // Build preview message
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    
    let previewMessage = `📅 **${title}**\n${dayName}, ${start_time} - ${displayEndTime}`;
    
    if (plannedMoves.length > 0) {
      previewMessage += '\n\n🔄 Sessions to reschedule:';
      for (const move of plannedMoves) {
        previewMessage += `\n• ${move.name}: ${move.from} → ${move.to}`;
      }
      previewMessage += '\n\nShall I go ahead?';
    } else {
      previewMessage += '\n\nNo conflicts! Shall I book it?';
    }
    
    return JSON.stringify({
      success: true,
      preview: true,
      message: previewMessage,
      booking_details: {
        title,
        date,
        start_time,
        end_time: displayEndTime,
        duration_mins: durationMins,
      },
      planned_moves: plannedMoves,
      conflicts: moveableConflicts,
    });
    
  } catch (error: any) {
    console.error('Preview booking error:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeConfirmBooking(
  userId: string,
  params: { title: string; date: string; start_time: string; end_time?: string; duration_mins: number }
): Promise<string> {
  try {
    const { title, date, start_time, duration_mins } = params;
    
    const [startH, startM] = start_time.split(':').map(Number);
    const eventStartMins = startH * 60 + startM;
    const eventEndMins = eventStartMins + duration_mins;
    const displayEndTime = formatTimeDisplay(eventEndMins);
    
    // Get existing blocks and find conflicts again
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    
    const { data: existingBlocks } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name)')
      .eq('user_id', userId)
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString());
    
    const MOVEABLE_TYPES = ['workout', 'training'];
    const movedSessions: Array<{ name: string; from: string; to: string }> = [];
    
    // Find and move conflicts
    for (const block of existingBlocks || []) {
      const blockDate = new Date(block.scheduled_start);
      const blockStartMins = blockDate.getHours() * 60 + blockDate.getMinutes();
      const blockEndMins = blockStartMins + block.duration_mins;
      
      const isConflict = eventStartMins < blockEndMins && eventEndMins > blockStartMins;
      const canMove = MOVEABLE_TYPES.includes(block.type) && block.status !== 'completed';
      
      if (isConflict && canMove) {
        const excludeIds = (existingBlocks || [])
          .filter(b => MOVEABLE_TYPES.includes(b.type))
          .map(b => b.id);
        
        let newSlot = await findFreeSlot(userId, date, block.duration_mins, excludeIds);
        let newDate = date;
        
        if (!newSlot) {
          const tomorrow = new Date(date);
          tomorrow.setDate(tomorrow.getDate() + 1);
          newDate = tomorrow.toISOString().split('T')[0];
          newSlot = await findFreeSlot(userId, newDate, block.duration_mins, []);
        }
        
        if (newSlot) {
          const newStart = new Date(`${newDate}T${newSlot.start}:00`);
          await supabase
            .from('schedule_blocks')
            .update({
              scheduled_start: newStart.toISOString(),
              original_scheduled_start: block.scheduled_start,
            })
            .eq('id', block.id);
          
          const blockName = block.notes?.split('|||')[0] || block.goals?.name || block.type;
          const newDateObj = new Date(newDate);
          const dayLabel = newDate === date ? '' : newDateObj.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ';
          
          movedSessions.push({
            name: blockName,
            from: formatTimeDisplay(blockStartMins),
            to: `${dayLabel}${newSlot.start}`,
          });
        }
      }
    }
    
    // Create the event
    const eventStart = new Date(`${date}T${start_time}:00`);
    
    const { data: newBlock, error: createError } = await supabase
      .from('schedule_blocks')
      .insert({
        user_id: userId,
        goal_id: null,
        type: 'event',
        scheduled_start: eventStart.toISOString(),
        duration_mins: duration_mins,
        notes: title,
        flexibility: 'fixed',
        created_by: 'user',
        status: 'scheduled',
      })
      .select()
      .single();
    
    if (createError) throw createError;
    
    // Build response
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    
    let message = `✅ Booked "${title}"!\n\n📅 ${dayName}\n⏰ ${start_time} - ${displayEndTime}`;
    
    if (movedSessions.length > 0) {
      message += '\n\n🔄 Rescheduled:';
      for (const moved of movedSessions) {
        message += `\n• ${moved.name}: ${moved.from} → ${moved.to}`;
      }
    }
    
    return JSON.stringify({
      success: true,
      message,
      event_created: newBlock,
      sessions_moved: movedSessions,
    });
    
  } catch (error: any) {
    console.error('Confirm booking error:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeGetSchedule(
  userId: string,
  params: { date: string }
): Promise<string> {
  try {
    let { date } = params;
    date = parseDateInput(date);
    
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    
    const { data: blocks, error } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name, category)')
      .eq('user_id', userId)
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString())
      .order('scheduled_start', { ascending: true });
    
    if (error) throw error;
    
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    
    if (!blocks || blocks.length === 0) {
      return JSON.stringify({
        success: true,
        date,
        day_name: dayName,
        blocks: [],
        message: `${dayName} is clear - no scheduled blocks.`,
      });
    }
    
    const schedule = blocks.map(b => {
      const time = new Date(b.scheduled_start);
      const endTime = new Date(time.getTime() + b.duration_mins * 60000);
      return {
        id: b.id,
        time: `${time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        name: b.notes?.split('|||')[0] || b.goals?.name || b.type,
        type: b.type,
        duration: b.duration_mins,
        status: b.status,
      };
    });
    
    const scheduleText = schedule.map(s => 
      `• ${s.time}: ${s.name}${s.status === 'completed' ? ' ✓' : ''}`
    ).join('\n');
    
    return JSON.stringify({
      success: true,
      date,
      day_name: dayName,
      blocks: schedule,
      message: `${dayName}:\n${scheduleText}`,
    });
    
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeCompleteSession(
  userId: string,
  params: { session_id: string; notes?: string }
): Promise<string> {
  try {
    const { session_id, notes } = params;
    
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name)')
      .eq('id', session_id)
      .single();
    
    if (fetchError || !block) {
      return JSON.stringify({ success: false, error: 'Session not found' });
    }
    
    await supabase
      .from('schedule_blocks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: notes || block.notes,
      })
      .eq('id', session_id);
    
    const sessionName = block.notes?.split('|||')[0] || block.goals?.name || 'Session';
    
    return JSON.stringify({
      success: true,
      message: `✅ "${sessionName}" completed! Great work! 🎉`,
    });
    
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeSkipSession(
  userId: string,
  params: { session_id: string }
): Promise<string> {
  try {
    const { session_id } = params;
    
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name, target_date, plan)')
      .eq('id', session_id)
      .single();
    
    if (fetchError || !block) {
      return JSON.stringify({ success: false, error: 'Session not found' });
    }
    
    await supabase
      .from('schedule_blocks')
      .update({ status: 'skipped' })
      .eq('id', session_id);
    
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
      message: `⏭️ Skipped "${sessionName}".${deadlineImpact ? ` ${deadlineImpact}` : ''}`,
    });
    
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeRescheduleSession(
  userId: string,
  params: { session_id: string; new_date: string; new_time: string }
): Promise<string> {
  try {
    let { session_id, new_date, new_time } = params;
    
    new_date = parseDateInput(new_date);
    new_time = parseTimeString(new_time);
    
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name)')
      .eq('id', session_id)
      .single();
    
    if (fetchError || !block) {
      return JSON.stringify({ success: false, error: 'Session not found' });
    }
    
    const newScheduledStart = new Date(`${new_date}T${new_time}:00`);
    
    await supabase
      .from('schedule_blocks')
      .update({
        scheduled_start: newScheduledStart.toISOString(),
        original_scheduled_start: block.original_scheduled_start || block.scheduled_start,
      })
      .eq('id', session_id);
    
    const sessionName = block.notes?.split('|||')[0] || block.goals?.name || 'Session';
    const dayName = newScheduledStart.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const [newH, newM] = new_time.split(':').map(Number);
    const endMins = newH * 60 + newM + block.duration_mins;
    const endTime = formatTimeDisplay(endMins);
    
    return JSON.stringify({
      success: true,
      message: `✅ Moved "${sessionName}" to ${dayName} at ${new_time}-${endTime}`,
    });
    
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function executeDeleteEvent(
  userId: string,
  params: { block_id: string }
): Promise<string> {
  try {
    const { block_id } = params;
    
    const { data: block, error: fetchError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('id', block_id)
      .single();
    
    if (fetchError || !block) {
      return JSON.stringify({ success: false, error: 'Block not found' });
    }
    
    const blockName = block.notes?.split('|||')[0] || block.type;
    
    await supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', block_id);
    
    return JSON.stringify({
      success: true,
      message: `🗑️ Deleted "${blockName}"`,
    });
    
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

// ============================================================
// TOOL ROUTER
// ============================================================

async function executeTool(userId: string, toolName: string, toolInput: any): Promise<string> {
  console.log(`🔧 Executing: ${toolName}`, JSON.stringify(toolInput));
  
  switch (toolName) {
    case 'preview_booking':
      return executePreviewBooking(userId, toolInput);
    case 'confirm_booking':
      return executeConfirmBooking(userId, toolInput);
    case 'get_schedule':
      return executeGetSchedule(userId, toolInput);
    case 'complete_session':
      return executeCompleteSession(userId, toolInput);
    case 'skip_session':
      return executeSkipSession(userId, toolInput);
    case 'reschedule_session':
      return executeRescheduleSession(userId, toolInput);
    case 'delete_event':
      return executeDeleteEvent(userId, toolInput);
    default:
      return JSON.stringify({ success: false, error: 'Unknown tool' });
  }
}

// ============================================================
// MAIN ENDPOINT
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, message, conversation_history = [], today_tasks = [] } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: 'Missing user_id or message' });
    }

    console.log(`\n🤖 AI Chat: "${message}"`);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dayName = now.toLocaleDateString('en-GB', { weekday: 'long' });

    // Build tasks context
    let tasksContext = '';
    if (today_tasks.length > 0) {
      tasksContext = `\n\nTODAY'S SESSIONS:\n`;
      for (const task of today_tasks) {
        const time = new Date(task.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const status = task.status === 'completed' ? '✓' : '○';
        tasksContext += `${status} ${time}: ${task.name} (${task.duration_mins}min) [ID: ${task.id}]\n`;
      }
    }

    // Check if this looks like a confirmation
    const confirmationPatterns = /^(yes|yep|yeah|yea|sure|ok|okay|confirm|do it|go ahead|please|sounds good|perfect|great|absolutely|definitely|y|go for it|book it|yes please)[\s!.]*$/i;
    const isConfirmation = confirmationPatterns.test(message.trim());

    const systemPrompt = `You are Pepzi, a friendly AI assistant for scheduling and productivity.

CURRENT CONTEXT:
- Today: ${dayName}, ${todayStr}
- Time: ${currentTime}
${tasksContext}

YOUR JOB: Help users book events and manage their schedule.

═══════════════════════════════════════════════════════════
BOOKING FLOW (2 steps):
═══════════════════════════════════════════════════════════

STEP 1: When user wants to book something → use preview_booking
- Shows what will happen
- Shows any conflicts and how they'll be resolved
- Asks for confirmation

STEP 2: When user confirms (says "yes", "sure", "do it", etc.) → use confirm_booking
- Pass the SAME details from the preview
- Actually creates the event and moves sessions

${isConfirmation ? '⚠️ USER IS CONFIRMING - Look at the previous preview and use confirm_booking with those details!' : ''}

═══════════════════════════════════════════════════════════
OTHER TOOLS:
═══════════════════════════════════════════════════════════
- get_schedule: View schedule for a day
- complete_session: Mark training done
- skip_session: Skip a training session
- reschedule_session: Move a specific session
- delete_event: Remove something from calendar

═══════════════════════════════════════════════════════════
EXAMPLES:
═══════════════════════════════════════════════════════════

User: "book curry friday 6pm to 11pm"
→ Use preview_booking(title="Curry", date="friday", start_time="6pm", end_time="11pm")
→ Show preview and ask "Shall I book it?"

User: "yes" (after seeing preview)
→ Use confirm_booking with the SAME details from preview

User: "what's on tomorrow?"
→ Use get_schedule(date="tomorrow")

PERSONALITY:
- Brief and helpful
- Use emojis sparingly
- Don't over-explain`;

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
      messages,
      tools,
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
        
        const result = await executeTool(user_id, toolName, toolInput);
        const parsedResult = JSON.parse(result);
        
        console.log(`✅ ${toolName}:`, parsedResult.success ? 'SUCCESS' : 'FAILED');
        
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
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1024,
      });
    }

    finalResponse = response.choices[0]?.message?.content || "Done! ✓";

    console.log(`📤 Response: "${finalResponse.substring(0, 100)}..."`);

    return res.json({
      success: true,
      response: finalResponse,
      actions,
    });

  } catch (error: any) {
    console.error('❌ AI Chat error:', error);
    return res.status(500).json({
      error: 'AI chat failed',
      message: error.message,
      response: "Sorry, something went wrong. Please try again!",
    });
  }
});

export default router;