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
 * NOW WITH MEMORY INTEGRATION! 🧠
 */
export async function extractIntents(
  userMessage: string,
  context: any
): Promise<any> {
  try {
    // Build system prompt with memory context
    let systemPrompt = `You are Pepzi, an AI life operating system assistant.

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
- Today's schedule: ${JSON.stringify(context.todaySchedule || [])}`;

    // 🧠 ADD MEMORY CONTEXT IF AVAILABLE
    if (context.memories && context.memories.trim().length > 0) {
      systemPrompt += `

IMPORTANT - KNOWN PATTERNS ABOUT THIS USER:
${context.memories}

You MUST use these patterns when giving advice. For example, if the user asks when to schedule something and you know they prefer mornings, recommend mornings and mention why (based on their past behavior).`;
    }

    systemPrompt += `

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
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
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

/**
 * JSON-only completion: forces the model to return valid JSON
 */
export async function jsonCompletion<T = any>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            systemPrompt ??
            'You are a helper that MUST respond with a single valid JSON object and nothing else.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';

    return JSON.parse(content) as T;
  } catch (error) {
    console.error('jsonCompletion error:', error);
    throw error;
  }
}

/**
 * Generate a realistic weekly training plan from goal + milestones
 * 🔥 NEW: Turns milestones into actual week-by-week training schedule
 */
export async function generateWeeklyTrainingPlan(params: {
  goalName: string;
  category: string;
  description?: string;
  currentLevel: string;
  timeline: string;
  weeklyHours: number;
  totalHours: number;
  milestones: Array<{ name: string; hours: number }>;
}): Promise<any> {
  const {
    goalName,
    category,
    description,
    currentLevel,
    timeline,
    weeklyHours,
    totalHours,
    milestones,
  } = params;

  const systemPrompt = `You are a training plan architect. You build realistic, progressive weekly plans.

CRITICAL: Output ONLY valid JSON in this exact format:

{
  "plan": {
    "summary": "High-level plan summary",
    "realism_notes": "Any safety/adjustment notes",
    "weekly_hours": 6,
    "estimated_total_hours": 150,
    "weeks": [
      {
        "week_number": 1,
        "focus": "Main focus this week",
        "sessions_per_week": 3,
        "sessions": [
          {
            "name": "Short session name",
            "description": "What to do in detail",
            "notes": "Optional tips"
          }
        ]
      }
    ],
    "milestones": [
      {
        "name": "Milestone name",
        "target_week": 4,
        "criteria": "How to verify completion"
      }
    ]
  }
}`;

  const userPrompt = `Goal: "${goalName}"
Category: ${category}
Description: ${description || 'N/A'}
Current level: ${currentLevel}
Timeline: ${timeline}
Weekly hours: ${weeklyHours}
Total hours: ${totalHours}

Milestones:
${milestones.map((m, i) => `${i + 1}. ${m.name} (${m.hours}h)`).join('\n')}

Create a progressive weekly plan with SPECIFIC session details.

Examples of GOOD session descriptions:
- Running: "3x800m at 5K pace, 2min rest between reps"
- Climbing: "Boulder V4-V5 problems, focus on footwork and balance"
- Business: "Customer interviews: reach out to 10 potential users, conduct 3 calls"
- Language: "30min conversation practice with native speaker on specific topics"

Examples of BAD (too vague):
- "Training session"
- "Work on project"
- "Practice skills"

Be SPECIFIC and actionable!`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Weekly plan generation error:', error);
    throw error;
  }
}