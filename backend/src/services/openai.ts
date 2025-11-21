import OpenAI from 'openai';

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('Missing OPENAI_API_KEY in .env file');
}

export const openai = new OpenAI({ apiKey });

/**
 * Extract structured intents from user message
 * This is the core of Pepzi's natural language understanding
 */
export async function extractIntents(
  userMessage: string,
  context: any
): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Pepzi, an AI life operating system assistant.

Your job is to understand natural language requests and extract structured intents.

Available intent types:
- log_activity: User is logging something they did
- reschedule_block: User wants to move a scheduled activity
- create_block: User wants to add a new activity
- query_progress: User is asking about their progress
- general_chat: General conversation

Current context:
- Today: ${new Date().toISOString().split('T')[0]}
- User goals: ${JSON.stringify(context.goals || [])}
- Today's schedule: ${JSON.stringify(context.todaySchedule || [])}

Extract intents from the user's message and respond with JSON only.

Format:
{
  "intents": [
    {
      "type": "intent_type",
      "data": { ... relevant data ... }
    }
  ],
  "response": "Natural language response to user"
}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    // Try to parse JSON, stripping markdown if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

/**
 * Generate text embeddings for semantic memory
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding creation error:', error);
    throw error;
  }
}

/**
 * Simple chat completion (for general responses)
 */
export async function simpleCompletion(
  message: string,
  systemPrompt?: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: message }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    return response.choices[0]?.message?.content || 'No response generated.';
  } catch (error) {
    console.error('Simple completion error:', error);
    throw error;
  }
}
