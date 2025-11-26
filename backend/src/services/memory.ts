import { supabase } from './supabase';
import { createEmbedding, simpleCompletion } from './openai';
import { format, subDays } from 'date-fns';

/**
 * Memory Service - Pepzi's long-term memory system
 * 
 * This service enables Pepzi to:
 * - Remember behavioral patterns
 * - Recall past conversations and decisions
 * - Personalize coaching based on history
 * - Adapt plans based on what actually works for the user
 */

export interface Memory {
  id?: string;
  user_id: string;
  content: string;
  embedding?: number[];
  metadata?: {
    type?: 'behavioral_pattern' | 'decision' | 'achievement' | 'struggle' | 'preference';
    goal_id?: string;
    confidence?: number;
    date_range?: string;
  };
  created_at?: string;
}

/**
 * Store a memory with vector embedding
 * Use this to save important facts about the user that Pepzi should remember
 */
export async function storeMemory(memory: Memory): Promise<void> {
  try {
    console.log(`💾 Storing memory: "${memory.content.substring(0, 50)}..."`);

    // Create embedding for the memory content
    const embedding = await createEmbedding(memory.content);

    // Insert into database
    const { error } = await supabase
      .from('memory_vectors')
      .insert({
        user_id: memory.user_id,
        content: memory.content,
        embedding,
        metadata: memory.metadata || {}
      });

    if (error) throw error;

    console.log(`✅ Memory stored successfully`);
  } catch (error) {
    console.error('Error storing memory:', error);
    throw error;
  }
}

/**
 * Retrieve relevant memories for a given context
 * Uses vector similarity search to find the most relevant past memories
 */
export async function getRelevantMemories(
  userId: string,
  queryText: string,
  limit: number = 5
): Promise<Array<{ content: string; metadata: any; similarity: number }>> {
  try {
    console.log(`🔍 Searching memories for: "${queryText.substring(0, 50)}..."`);

    // Create embedding for the query
    const queryEmbedding = await createEmbedding(queryText);

    // Use Supabase RPC function for vector similarity search
    const { data, error } = await supabase.rpc('match_memories', {
      user_id_input: userId,
      query_embedding: queryEmbedding,
      match_count: limit
    });

    if (error) throw error;

    console.log(`📚 Found ${data?.length || 0} relevant memories`);
    
    return data || [];
  } catch (error) {
    console.error('Error retrieving memories:', error);
    // Return empty array on error - memory is optional
    return [];
  }
}

/**
 * Generate weekly summary and store as memories
 * This runs periodically (e.g., every Sunday night) to analyze the week
 */
export async function summarizeWeek(userId: string): Promise<void> {
  try {
    console.log(`📊 Generating weekly summary for user ${userId}`);

    // Get data from the last 7 days
    const weekAgo = subDays(new Date(), 7);
    const weekAgoISO = weekAgo.toISOString();

    // Fetch logs from the past week
    const { data: logs, error: logsError } = await supabase
      .from('log_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', weekAgoISO)
      .order('timestamp', { ascending: true });

    if (logsError) throw logsError;

    // Fetch schedule blocks from the past week
    const { data: blocks, error: blocksError } = await supabase
      .from('schedule_blocks')
      .select('*, goals(name, category)')
      .eq('user_id', userId)
      .gte('scheduled_start', weekAgoISO)
      .order('scheduled_start', { ascending: true });

    if (blocksError) throw blocksError;

    // Fetch messages from the past week
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', weekAgoISO)
      .order('timestamp', { ascending: true });

    if (messagesError) throw messagesError;

    // If no activity this week, skip summary
    if (!logs?.length && !blocks?.length && !messages?.length) {
      console.log('⏭️  No activity this week, skipping summary');
      return;
    }

    // Calculate basic stats
    const scheduledCount = blocks?.length || 0;
    const completedCount = blocks?.filter(b => b.status === 'completed').length || 0;
    const completionRate = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

    // Group logs by type
    const logsByType = (logs || []).reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Prepare context for LLM
    const weekContext = `
WEEK OF ${format(weekAgo, 'MMM dd, yyyy')} - ${format(new Date(), 'MMM dd, yyyy')}

SCHEDULE ADHERENCE:
- Scheduled blocks: ${scheduledCount}
- Completed: ${completedCount}
- Completion rate: ${completionRate}%

ACTIVITIES LOGGED:
${Object.entries(logsByType).map(([type, count]) => `- ${type}: ${count}x`).join('\n')}

SCHEDULE BLOCKS:
${(blocks || []).slice(0, 20).map(b => 
  `- ${format(new Date(b.scheduled_start), 'EEE HH:mm')}: ${b.type} (${b.status})`
).join('\n')}

USER MESSAGES (sample):
${(messages || []).slice(-10).map(m => 
  `- ${m.speaker === 'user' ? 'User' : 'Pepzi'}: ${m.message.substring(0, 100)}`
).join('\n')}
`.trim();

    // Ask LLM to analyze and extract behavioral insights
    const prompt = `Analyze this user's week and extract 3-5 concise behavioral insights that would help coach them better in the future.

${weekContext}

Return ONLY a JSON array of strings, each being a factual observation. Examples:
- "User consistently completes morning workouts but often skips evening sessions"
- "User tends to log activities 1-2 days late rather than same day"
- "User frequently reschedules Monday tasks to Tuesday"
- "User hits 80%+ completion rate when weekly load is under 15 hours"

Return format: ["insight 1", "insight 2", "insight 3"]

Only return the JSON array, nothing else.`;

    const response = await simpleCompletion(prompt);
    
    // Parse response
    let insights: string[];
    try {
      // Clean markdown if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '');
      }
      
      insights = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Failed to parse LLM response, using fallback');
      insights = [`Week of ${format(weekAgo, 'MMM dd')}: ${completionRate}% completion rate`];
    }

    // Store each insight as a memory
    const dateRange = `${format(weekAgo, 'yyyy-MM-dd')} to ${format(new Date(), 'yyyy-MM-dd')}`;
    
    for (const insight of insights) {
      await storeMemory({
        user_id: userId,
        content: insight,
        metadata: {
          type: 'behavioral_pattern',
          date_range: dateRange,
          confidence: 0.8
        }
      });
    }

    console.log(`✅ Stored ${insights.length} weekly insights as memories`);

  } catch (error) {
    console.error('Error generating weekly summary:', error);
    throw error;
  }
}

/**
 * Store an achievement memory
 * Call this when user hits a milestone or completes a goal
 */
export async function storeAchievement(
  userId: string,
  achievement: string,
  goalId?: string
): Promise<void> {
  await storeMemory({
    user_id: userId,
    content: achievement,
    metadata: {
      type: 'achievement',
      goal_id: goalId,
      confidence: 1.0
    }
  });
}

/**
 * Store a struggle/challenge memory
 * Call this when user repeatedly fails or expresses difficulty
 */
export async function storeStruggle(
  userId: string,
  struggle: string,
  goalId?: string
): Promise<void> {
  await storeMemory({
    user_id: userId,
    content: struggle,
    metadata: {
      type: 'struggle',
      goal_id: goalId,
      confidence: 0.7
    }
  });
}

/**
 * Store a user preference
 * Call this when user expresses a clear preference
 */
export async function storePreference(
  userId: string,
  preference: string
): Promise<void> {
  await storeMemory({
    user_id: userId,
    content: preference,
    metadata: {
      type: 'preference',
      confidence: 0.9
    }
  });
}

/**
 * Get all recent memories (for debugging/admin)
 */
export async function getRecentMemories(
  userId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('memory_vectors')
      .select('id, content, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching recent memories:', error);
    return [];
  }
}

/**
 * Build memory context for chat
 * This is what you call in /api/chat to enhance the LLM context
 */
export async function buildMemoryContext(
  userId: string,
  currentMessage: string
): Promise<string> {
  try {
    // Get relevant memories based on the current message
    const memories = await getRelevantMemories(userId, currentMessage, 5);

    if (memories.length === 0) {
      return '';
    }

    // Format memories into context string
    const memoryContext = `
RELEVANT PATTERNS & HISTORY:
${memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')}
`.trim();

    return memoryContext;
  } catch (error) {
    console.error('Error building memory context:', error);
    return '';
  }
}