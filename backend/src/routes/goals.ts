import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai, simpleCompletion } from '../services/openai';
import axios from 'axios';

const router = Router();

// ============================================================
// 🏆 ELITE COACH SYSTEM PROMPT V2 - COMMITMENT FOCUSED
// ============================================================

const ELITE_COACH_PROMPT = `You are an Elite Performance Coach in Pepzi, a life operating system.

## YOUR ROLE
Help users create training plans for ANY goal. Your job is:
1. Accept the goal (don't over-question - 1-2 exchanges MAX)
2. Quickly assess current level if unclear
3. Get a timeline (or suggest one)
4. Propose weekly hours
5. Move to plan generation

## CRITICAL RULE: ACCEPT ANY GOAL IMMEDIATELY

You can create a plan for LITERALLY ANY goal. Examples:
- "improve my social media presence" → Social media/personal brand plan
- "be more fun at dinner parties" → Social confidence plan  
- "communicate better at work" → Professional communication plan
- "learn backflips" → Gymnastics/tumbling plan
- "be happier" → Wellbeing/positive psychology plan
- "improve my fashion" → Style development plan
- "build a side project" → Business/product plan

### NEVER ASK "What specific aspect?"
When a user says their goal, ACCEPT IT and move forward:
- ❌ "What specific aspect of social media would you like to improve?"
- ❌ "What specific improvements are you hoping to achieve?"
- ✅ "Great! To build your social media presence, I recommend 4h/week. That's about 6 weeks. Does 4h/week work?"

### THE 2-MESSAGE RULE
You have a MAXIMUM of 2 questions before proposing hours:
1. First message: Accept goal, ask about current level OR timeline (not both)
2. Second message: Propose hours with timeline

If the user's goal is clear, you can propose hours in your FIRST response.

## SESSION LIMITS
- Maximum: 6 sessions per week
- If more hours needed, extend timeline instead of adding sessions

## WHEN TO PROPOSE HOURS IMMEDIATELY
Propose hours in your FIRST response if the goal is clear:
- "I want to improve my social media" → "To build your social media presence, I'd recommend 3-4h/week over 6-8 weeks..."
- "I want to learn Spanish" → "For conversational Spanish, you'd need about 5h/week..."
- "I want to be happier" → "For a wellbeing practice, 2-3h/week of positive psychology exercises..."

## HOUR ESTIMATES BY GOAL TYPE

**Social Media / Personal Brand:**
- Building presence: 3-5h/week over 6-10 weeks
- Session: 30-60 mins (content creation, engagement)

**Professional Communication:**
- Core skills: 2-4h/week over 4-8 weeks  
- Session: 20-45 mins (practice exercises)

**Social Confidence / Being Fun:**
- Building skills: 2-3h/week over 4-8 weeks
- Session: 15-30 mins (conversation practice, observation)

**Fashion / Style:**
- Wardrobe building: 3-5h/week over 4-6 weeks
- Session: 30-60 mins (shopping, outfit planning, photos)

**Mental Health / Mindfulness / Anxiety:**
- Building daily habit: 2-3h/week over 4-8 weeks
- Session: 15-30 mins (consistency > duration)

**Happiness / Wellbeing:**
- Positive psychology: 2-3h/week over 6-8 weeks
- Session: 20-30 mins

**Dog Training:**
- Basic commands: 1-2h/week over 4-8 weeks
- Session: 10-15 mins (dogs lose focus)

**Physical Skills (backflip, skateboard):**
- Learning: 4-6h/week over 8-12 weeks
- Session: 45-75 mins

**Running:**
- 5K training: 3-5h/week over 8-12 weeks
- Marathon: 5-8h/week over 16-20 weeks
- Session: 30-60 mins

**Languages:**
- Conversational: 5-7h/week over 20-30 weeks
- Session: 30-45 mins

**Strength/Gym:**
- Building: 4-6h/week over 12-16 weeks
- Session: 45-60 mins

**Business/Side Project:**
- MVP launch: 8-15h/week over 8-16 weeks
- Session: 60-120 mins

## CONVERSATION FLOW

### IDEAL: Propose hours in 1-2 messages

Message 1 (if goal is clear): Accept + Propose hours
"Great goal! To [achieve X], I recommend [Y]h/week over [Z] weeks. Does [Y]h/week work for you?"

Message 1 (if need timeline): Accept + Ask timeline  
"Love it! When do you want to achieve this by?"

Message 2: Propose hours based on timeline
"To hit that by [date], you'd need [X]h/week. That's [Z] weeks total. Does [X]h/week work?"

### NEVER DO:
- Ask "what specific aspect?" 
- Ask the same question twice
- Ask more than 2 questions total
- Over-clarify soft goals

## RESPONSE FORMAT
Keep responses SHORT (under 80 words). Be direct and action-oriented.
ONE question per message maximum.
ALWAYS include the timeline when proposing hours.`;

// ============================================================
// SAFETY CHECK FOR GOALS
// ============================================================

const BLOCKED_PATTERNS = [
  /\b(kill|murder|assault|attack|punch|hit|hurt|harm|stab|shoot|beat|fight|strangle|poison)\b/i,
  /\b(violence|violent|weapon|gun|knife|bomb)\b/i,
  /\b(drug|drugs|cocaine|heroin|meth|marijuana|weed|steal|theft|rob|hack|fraud)\b/i,
  /\b(illegal|crime|criminal|smuggle|traffic|launder)\b/i,
  /\b(suicide|self.?harm|cut myself|kill myself|end my life)\b/i,
  /\b(hate|racist|sexist|discriminat|supremacy|nazi)\b/i,
  /\b(porn|sex|nude|naked|nsfw|xxx)\b/i,
  /\b(stalk|harass|bully|threaten|intimidate|blackmail|revenge)\b/i,
  /\b(bomb|explosive|terrorist|terrorism|extremis)\b/i,
  /\b(scam|phishing|catfish|pyramid scheme|ponzi)\b/i,
];

function isGoalSafe(goalName: string): { safe: boolean; reason?: string } {
  const lower = goalName.toLowerCase().trim();
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(lower)) {
      return { safe: false, reason: 'This goal contains content that violates our guidelines.' };
    }
  }
  if (lower.length < 3) return { safe: false, reason: 'Please enter a more descriptive goal.' };
  if (lower.length > 200) return { safe: false, reason: 'Please enter a shorter goal description.' };
  return { safe: true };
}
// ============================================================
// HELPER: Parse time string
// ============================================================

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

// ============================================================
// OPENAI RETRY LOGIC
// ============================================================

async function callOpenAIWithRetry(
  messages: any[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    retries?: number;
    jsonResponse?: boolean;
  } = {}
): Promise<any> {
  const {
    model = 'gpt-4o-mini',
    maxTokens = 2000,
    temperature = 0.5,
    timeoutMs = 30000,
    retries = 2,
    jsonResponse = true,
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await Promise.race([
        openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonResponse && { response_format: { type: 'json_object' } }),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`OpenAI timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]) as any;
      
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');
      
      return jsonResponse ? JSON.parse(content) : content;
      
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ OpenAI attempt ${attempt + 1}/${retries + 1} failed: ${error.message}`);
      
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('OpenAI call failed after all retries');
}
// ============================================================
// SESSION LENGTH RECOMMENDATION ENGINE
// ============================================================

interface SessionLengthRecommendation {
  recommended_mins: number;
  min_mins: number;
  max_mins: number;
  reasoning: string;
  sessions_per_day_max: number;
  rest_between_sessions: boolean;
}

function getSessionLengthRecommendation(goalName: string, category: string): SessionLengthRecommendation {
  const lower = (goalName + ' ' + category).toLowerCase();
  
  if (/meditat|mindful|breath|zen|calm|present/.test(lower)) {
    return {
      recommended_mins: 15, min_mins: 5, max_mins: 30,
      reasoning: 'meditation is most effective in shorter, consistent sessions - quality over quantity',
      sessions_per_day_max: 2, rest_between_sessions: false,
    };
  }
  
  if (/habit|routine|daily|morning|evening|journal|gratitude|affirmation/.test(lower)) {
    return {
      recommended_mins: 10, min_mins: 5, max_mins: 20,
      reasoning: "habits stick best when they're short enough to do even on hard days",
      sessions_per_day_max: 3, rest_between_sessions: false,
    };
  }
  
  if (/dog|puppy|pet|canine|sit|stay|heel|fetch|train.*pet/.test(lower)) {
    return {
      recommended_mins: 12, min_mins: 5, max_mins: 20,
      reasoning: 'dogs learn best in short bursts - their attention span is limited',
      sessions_per_day_max: 4, rest_between_sessions: false,
    };
  }
  
  if (/happy|happiness|wellbeing|well-being|mood|joy|positiv|therapy|mental health/.test(lower)) {
    return {
      recommended_mins: 15, min_mins: 10, max_mins: 30,
      reasoning: 'emotional practices are most effective when not overwhelming',
      sessions_per_day_max: 2, rest_between_sessions: false,
    };
  }
  
  if (/social|confident|conversation|network|charisma|funny|humor|funnier|jokes/.test(lower)) {
    return {
      recommended_mins: 20, min_mins: 10, max_mins: 45,
      reasoning: 'social practice works best in focused bursts with reflection time',
      sessions_per_day_max: 2, rest_between_sessions: false,
    };
  }
  
  if (/spanish|french|german|japanese|mandarin|chinese|language|speak|vocab/.test(lower)) {
    return {
      recommended_mins: 30, min_mins: 15, max_mins: 60,
      reasoning: 'language learning has diminishing returns after ~45min due to cognitive load',
      sessions_per_day_max: 2, rest_between_sessions: true,
    };
  }
  
  if (/read|book|novel|literature/.test(lower)) {
    return {
      recommended_mins: 45, min_mins: 20, max_mins: 90,
      reasoning: 'reading needs enough time to get into flow, but not so long you lose focus',
      sessions_per_day_max: 2, rest_between_sessions: false,
    };
  }
  
  if (/guitar|piano|music|instrument|song|chord|scale/.test(lower)) {
    return {
      recommended_mins: 35, min_mins: 20, max_mins: 60,
      reasoning: 'music practice is limited by focus and finger/arm fatigue',
      sessions_per_day_max: 2, rest_between_sessions: true,
    };
  }
  
  if (/cook|recipe|kitchen|chef|bake|meal|cuisine/.test(lower)) {
    return {
      recommended_mins: 60, min_mins: 30, max_mins: 120,
      reasoning: 'cooking sessions need to be long enough to complete a dish',
      sessions_per_day_max: 1, rest_between_sessions: false,
    };
  }
  
  if (/writ|story|novel|blog|content|creative|author|poem|script/.test(lower)) {
    return {
      recommended_mins: 60, min_mins: 30, max_mins: 120,
      reasoning: 'writing needs warmup time to get into flow state',
      sessions_per_day_max: 2, rest_between_sessions: true,
    };
  }
  
  if (/speak|present|pitch|toastmaster|speech|public/.test(lower)) {
    return {
      recommended_mins: 45, min_mins: 20, max_mins: 75,
      reasoning: 'speaking practice needs enough time for run-throughs plus analysis',
      sessions_per_day_max: 1, rest_between_sessions: false,
    };
  }
  
  if (/skate|kickflip|ollie|board|surf|yoga/.test(lower)) {
    return {
      recommended_mins: 60, min_mins: 30, max_mins: 120,
      reasoning: 'skill practice needs enough time for repetitions, but fatigue affects quality',
      sessions_per_day_max: 2, rest_between_sessions: true,
    };
  }
  
  if (/backflip|flip|gymnast|acrobat|tumbl|parkour/.test(lower)) {
    return {
      recommended_mins: 50, min_mins: 30, max_mins: 75,
      reasoning: 'high-intensity practice is limited by safety - fatigue increases injury risk',
      sessions_per_day_max: 1, rest_between_sessions: true,
    };
  }
  
  if (/run|5k|10k|marathon|jog|cardio|sprint/.test(lower)) {
    return {
      recommended_mins: 40, min_mins: 20, max_mins: 90,
      reasoning: 'running sessions include warmup, workout, and cooldown',
      sessions_per_day_max: 1, rest_between_sessions: true,
    };
  }
  
  if (/gym|lift|bench|squat|deadlift|strength|muscle|weight|fitness/.test(lower)) {
    return {
      recommended_mins: 55, min_mins: 30, max_mins: 90,
      reasoning: 'strength training needs rest between sets - quality over speed',
      sessions_per_day_max: 1, rest_between_sessions: true,
    };
  }
  
  if (/climb|boulder|v\d/.test(lower)) {
    return {
      recommended_mins: 75, min_mins: 45, max_mins: 120,
      reasoning: 'climbing sessions include warmup, attempts with rest, and cooldown',
      sessions_per_day_max: 1, rest_between_sessions: true,
    };
  }
  
  if (/business|startup|revenue|code|program|app|project|saas|side project/.test(lower)) {
    return {
      recommended_mins: 90, min_mins: 45, max_mins: 180,
      reasoning: 'deep work requires enough time to get into flow - context switching is costly',
      sessions_per_day_max: 2, rest_between_sessions: true,
    };
  }
  
  if (/art|draw|paint|design|sketch|illustrat/.test(lower)) {
    return {
      recommended_mins: 60, min_mins: 30, max_mins: 120,
      reasoning: 'art needs warmup time and flow state to produce quality work',
      sessions_per_day_max: 2, rest_between_sessions: false,
    };
  }
  
  return {
    recommended_mins: 45, min_mins: 20, max_mins: 90,
    reasoning: 'a good balance for most activities',
    sessions_per_day_max: 1, rest_between_sessions: true,
  };
}

// ============================================================
// HOUR ESTIMATE ENGINE
// ============================================================

interface HourEstimate {
  min_hours: number;
  max_hours: number;
  typical_weeks: number;
  weekly_hours_recommended: number;
  notes: string;
}

function getHourEstimate(goalName: string, category: string, currentLevel: string): HourEstimate {
  const lower = (goalName + ' ' + category).toLowerCase();
  const levelLower = (currentLevel || '').toLowerCase();
  const isBeginner = !currentLevel || /beginner|never|no experience|none|zero|first time|new/.test(levelLower);
  
  if (/meditat|mindful/.test(lower)) {
    return isBeginner
      ? { min_hours: 8, max_hours: 15, typical_weeks: 8, weekly_hours_recommended: 1.5, notes: 'Start with 10min daily' }
      : { min_hours: 15, max_hours: 40, typical_weeks: 12, weekly_hours_recommended: 2.5, notes: 'Deepen with longer sits' };
  }
  
  if (/happy|happiness|wellbeing|joy|positiv/.test(lower)) {
    return { min_hours: 8, max_hours: 20, typical_weeks: 8, weekly_hours_recommended: 1.5, notes: 'Daily gratitude + weekly reflection' };
  }
  
  if (/read.*book|book.*read/.test(lower)) {
    const booksMatch = lower.match(/(\d+)\s*book/);
    const bookCount = booksMatch ? parseInt(booksMatch[1]) : 12;
    const hoursPerBook = 6;
    const totalHours = bookCount * hoursPerBook;
    return { min_hours: totalHours * 0.8, max_hours: totalHours * 1.2, typical_weeks: Math.min(52, bookCount * 2), weekly_hours_recommended: Math.ceil(totalHours / 52), notes: '~6h per book' };
  }
  
  if (/funny|funnier|humor|joke|comedy|social|confident|charisma/.test(lower)) {
    return isBeginner
      ? { min_hours: 15, max_hours: 30, typical_weeks: 8, weekly_hours_recommended: 2.5, notes: 'Practice + reflection + exposure' }
      : { min_hours: 25, max_hours: 50, typical_weeks: 12, weekly_hours_recommended: 3, notes: 'Advanced practice + performance' };
  }
  
  if (/cook|recipe|kitchen|chef|bake/.test(lower)) {
    return isBeginner
      ? { min_hours: 30, max_hours: 50, typical_weeks: 10, weekly_hours_recommended: 4, notes: '2-3 cooking sessions/week' }
      : { min_hours: 60, max_hours: 100, typical_weeks: 16, weekly_hours_recommended: 5, notes: 'Complex techniques' };
  }
  
  if (/writ|story|novel|blog|author/.test(lower)) {
    if (/novel/.test(lower)) {
      return { min_hours: 100, max_hours: 200, typical_weeks: 20, weekly_hours_recommended: 7, notes: 'Daily writing required' };
    }
    return { min_hours: 25, max_hours: 50, typical_weeks: 8, weekly_hours_recommended: 4, notes: 'Regular writing builds muscle' };
  }
  
  if (/speak|present|pitch|toastmaster|speech/.test(lower)) {
    return isBeginner
      ? { min_hours: 20, max_hours: 40, typical_weeks: 10, weekly_hours_recommended: 3, notes: 'Practice + opportunities' }
      : { min_hours: 40, max_hours: 80, typical_weeks: 16, weekly_hours_recommended: 4, notes: 'Refinement' };
  }
  
  if (/productiv|habit|routine|focus|procrastinat/.test(lower)) {
    return { min_hours: 10, max_hours: 25, typical_weeks: 8, weekly_hours_recommended: 2, notes: 'Systems + practice' };
  }
  
  if (/dog|puppy|pet|sit|stay|heel/.test(lower)) {
    return isBeginner
      ? { min_hours: 10, max_hours: 20, typical_weeks: 6, weekly_hours_recommended: 2, notes: 'Multiple short sessions daily' }
      : { min_hours: 5, max_hours: 12, typical_weeks: 4, weekly_hours_recommended: 2, notes: 'Refinement and proofing' };
  }
  
  if (/skate|kickflip|ollie/.test(lower)) {
    if (/kickflip/.test(lower)) {
      return /ollie|can ride/.test(levelLower)
        ? { min_hours: 20, max_hours: 35, typical_weeks: 8, weekly_hours_recommended: 3.5, notes: 'Focused practice' }
        : { min_hours: 45, max_hours: 70, typical_weeks: 14, weekly_hours_recommended: 4, notes: 'Learn ollie first' };
    }
    return { min_hours: 30, max_hours: 60, typical_weeks: 12, weekly_hours_recommended: 4, notes: 'Consistent practice' };
  }
  
  if (/backflip|flip|gymnast|acrobat/.test(lower)) {
    return isBeginner
      ? { min_hours: 30, max_hours: 50, typical_weeks: 10, weekly_hours_recommended: 4, notes: 'Start on trampoline' }
      : { min_hours: 15, max_hours: 30, typical_weeks: 6, weekly_hours_recommended: 4, notes: 'Refinement' };
  }
  
  if (/run|5k|10k|marathon|jog/.test(lower)) {
    if (/marathon/.test(lower)) return { min_hours: 80, max_hours: 120, typical_weeks: 18, weekly_hours_recommended: 6, notes: '16-20 week plan' };
    if (/sub.?20|under 20/.test(lower)) return { min_hours: 80, max_hours: 120, typical_weeks: 16, weekly_hours_recommended: 6, notes: 'Solid base + speed' };
    if (isBeginner) return { min_hours: 25, max_hours: 40, typical_weeks: 10, weekly_hours_recommended: 3, notes: 'Run/walk progression' };
    return { min_hours: 40, max_hours: 70, typical_weeks: 12, weekly_hours_recommended: 4.5, notes: 'Structured training' };
  }
  
  if (/gym|lift|bench|squat|deadlift|strength|muscle/.test(lower)) {
    return isBeginner
      ? { min_hours: 50, max_hours: 80, typical_weeks: 14, weekly_hours_recommended: 4.5, notes: '3-4 sessions/week' }
      : { min_hours: 80, max_hours: 120, typical_weeks: 20, weekly_hours_recommended: 5, notes: 'Progressive overload' };
  }
  
  if (/spanish|french|italian|portuguese/.test(lower)) {
    return isBeginner
      ? { min_hours: 150, max_hours: 200, typical_weeks: 26, weekly_hours_recommended: 6, notes: 'Tier 1 - 6 months' }
      : { min_hours: 100, max_hours: 150, typical_weeks: 20, weekly_hours_recommended: 6, notes: 'Build on foundation' };
  }
  if (/german|dutch/.test(lower)) {
    return { min_hours: 200, max_hours: 280, typical_weeks: 34, weekly_hours_recommended: 6, notes: 'Tier 2 - more grammar' };
  }
  if (/japanese|mandarin|chinese|korean/.test(lower)) {
    return { min_hours: 400, max_hours: 600, typical_weeks: 52, weekly_hours_recommended: 8, notes: 'Tier 4 - characters + tones' };
  }
  
  if (/guitar|piano|music|instrument/.test(lower)) {
    return isBeginner
      ? { min_hours: 35, max_hours: 55, typical_weeks: 12, weekly_hours_recommended: 3.5, notes: 'Daily practice essential' }
      : { min_hours: 60, max_hours: 100, typical_weeks: 20, weekly_hours_recommended: 4, notes: 'Complex pieces' };
  }
  
  if (/business|startup|revenue|saas|side project/.test(lower)) {
    if (/first.*revenue|revenue|£|€|\$/.test(lower)) {
      return { min_hours: 150, max_hours: 300, typical_weeks: 20, weekly_hours_recommended: 10, notes: 'MVP + customers + iteration' };
    }
    return { min_hours: 80, max_hours: 180, typical_weeks: 16, weekly_hours_recommended: 8, notes: 'Focused execution' };
  }
  
  return { min_hours: 40, max_hours: 80, typical_weeks: 12, weekly_hours_recommended: 5, notes: 'Adjust based on schedule' };
}
// ============================================================
// RULE-BASED EXTRACTION HELPERS
// ============================================================

function extractTargetDate(message: string): string | null {
  const lower = message.toLowerCase();
  const today = new Date();
  
  const relativeMatch = lower.match(/(\d+)\s*(month|week|year)s?/);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const target = new Date(today);
    if (unit === 'month') target.setMonth(target.getMonth() + num);
    else if (unit === 'week') target.setDate(target.getDate() + num * 7);
    else if (unit === 'year') target.setFullYear(target.getFullYear() + num);
    return target.toISOString().split('T')[0];
  }
  
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                      'july', 'august', 'september', 'october', 'november', 'december'];
  const monthMatch = lower.match(/by\s+(january|february|march|april|may|june|july|august|september|october|november|december)/);
  if (monthMatch) {
    const monthIndex = monthNames.indexOf(monthMatch[1]);
    let year = today.getFullYear();
    if (monthIndex <= today.getMonth()) year++;
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-28`;
  }
  
  if (/end of year|by december|by christmas|year end/.test(lower)) {
    return `${today.getFullYear()}-12-31`;
  }
  
  if (/no rush|whenever|no deadline|flexible/.test(lower)) {
    const target = new Date(today);
    target.setMonth(target.getMonth() + 6);
    return target.toISOString().split('T')[0];
  }
  
  return null;
}

function extractTimeline(message: string): string | null {
  const lower = message.toLowerCase();
  
  const durationMatch = lower.match(/(\d+)\s*(month|week|year)s?/);
  if (durationMatch) {
    return `${durationMatch[1]} ${durationMatch[2]}${parseInt(durationMatch[1]) > 1 ? 's' : ''}`;
  }
  
  const monthMatch = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
  if (monthMatch) return `by ${monthMatch[1]}`;
  
  if (/\bspring\b/.test(lower)) return 'by spring';
  if (/\bsummer\b/.test(lower)) return 'by summer';
  if (/\bfall|autumn\b/.test(lower)) return 'by fall';
  if (/\bwinter\b/.test(lower)) return 'by winter';
  if (/\bend of year|year end|december\b/.test(lower)) return 'by end of year';
  
  return null;
}

function extractWeeklyHours(message: string): number | null {
  const lower = message.toLowerCase();
  
  const match = lower.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:per|a|\/)\s*week/);
  if (match) return parseFloat(match[1]);
  
  const simpleMatch = lower.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s|$)/);
  if (simpleMatch) return parseFloat(simpleMatch[1]);
  
  return null;
}

function extractSessionLength(message: string): number | null {
  const lower = message.toLowerCase();
  
  const minMatch = lower.match(/(\d+)\s*min(?:ute)?s?/);
  if (minMatch) return parseInt(minMatch[1]);
  
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?(?:\s+session)?/);
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);
  
  if (/shorter|less time|quick/.test(lower)) return -1;
  if (/longer|more time/.test(lower)) return -2;
  
  return null;
}

function extractSessionCount(message: string): number | null {
  const lower = message.toLowerCase();
  
  // Match patterns like "3 sessions", "3 times", "3x", "3 per week"
  const sessionMatch = lower.match(/(\d+)\s*(?:sessions?|times?|x)\s*(?:per\s*week|\/\s*week|a\s*week)?/);
  if (sessionMatch) {
    const count = parseInt(sessionMatch[1]);
    if (count >= 1 && count <= 7) return count;
  }
  
  // Match "X times a week" or "X sessions a week"
  const perWeekMatch = lower.match(/(\d+)\s*(?:times?|sessions?)\s*(?:a|per)\s*week/);
  if (perWeekMatch) {
    const count = parseInt(perWeekMatch[1]);
    if (count >= 1 && count <= 7) return count;
  }
  
  return null;
}

function extractConfirmation(message: string): 'yes' | 'no' | 'reduce' | 'increase' | null {
  const lower = message.toLowerCase().trim();
  
  if (lower.length < 20) {
    if (/^(y|ye|yes|yep|yeah|yea|ya|yah|ok|okay|k|sure|yup|fine|good|great|perfect)\.?!?$/i.test(lower)) {
      return 'yes';
    }
  }
  
  if (/\b(thats?\s*(fine|good|great|ok|okay|perfect)|that\s*works|works\s*for\s*me)\b/i.test(lower)) {
    return 'yes';
  }
  
  if (/\b(yes|yeah|yep|yea|ya|sure|ok|okay|sounds good|spunds good|sound good|that works|works for me|perfect|let's do it|lets do it|good|fine|great|awesome|love it|done|ready|let's go|lets go|i'm in|im in|absolutely|definitely|for sure|looks good|lgtm)\b/.test(lower)) {
    return 'yes';
  }
  if (/^(yes|yeah|yep|sure|ok|okay|great|perfect|good)\b/.test(lower)) {
    return 'yes';
  }
  
  if (/\b(too much|too many|less|fewer|drop|reduce|lower|can't do that much|that's a lot|thats a lot)\b/.test(lower)) {
    return 'reduce';
  }
  if (/\b(more|increase|higher|i can do more|bump up|push harder)\b/.test(lower)) {
    return 'increase';
  }
  if (/\b(no|nope|not really|don't think so|cant|can't)\b/.test(lower)) {
    return 'no';
  }
  
  return null;
}

function extractCurrentLevel(message: string): string | null {
  const lower = message.toLowerCase();
  
  const timeMatch = lower.match(/(\d+):(\d+)\s*(5k|10k|half|marathon)?/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3] || ''}`.trim();
  }
  
  const minsMatch = lower.match(/(\d+)\s*(?:minutes?|mins?)\s*(5k|10k|half|marathon)?/i);
  if (minsMatch) {
    const mins = parseInt(minsMatch[1]);
    if (mins >= 10 && mins <= 120) {
      return `${mins} minutes ${minsMatch[2] || ''}`.trim();
    }
  }
  
  const currentlyMatch = message.match(/(?:currently|right now|at the moment)[^.]*[.!?]/i);
  if (currentlyMatch) {
    return currentlyMatch[0].replace(/^(currently|right now|at the moment)\s*/i, '').trim();
  }
  
  if (/\b(sit|sits|sitting|lie|lies|lying|stay|stays|come|comes)\b/.test(lower) && lower.length < 30) {
    return lower.trim();
  }
  
  if (/\b(not sure|don't know|no idea|unsure|unclear)\b/.test(lower)) return 'beginner';
  if (/\b(never|first time|complete beginner|starting from zero|don't know how|brand new|total noob)\b/.test(lower)) return 'beginner';
  if (/\b(no experience|no prior|haven't done|haven't tried|never done|never tried|new to)\b/.test(lower)) return 'beginner';
  if (/\b(can't do|cannot do|don't have any|zero experience)\b/.test(lower)) return 'beginner';
  
  if (/\b(can do a|know how to|i can|able to)\b/.test(lower)) {
    const canDoMatch = lower.match(/(?:can do a?|know how to|i can|able to)\s+([^,.!?]+)/);
    if (canDoMatch) {
      return `beginner - can ${canDoMatch[1].trim()}`;
    }
    return 'beginner with foundation';
  }
  
  if (/^(no|nope|not really|nah)\.?$/i.test(lower.trim())) return 'beginner';
  
  if (/\b(some experience|done it before|intermediate|know the basics|a few times|occasionally)\b/.test(lower)) return 'intermediate';
  if (/\b(practiced|been practicing|have done|tried a few)\b/.test(lower)) return 'intermediate';
  
  if (/\b(experienced|advanced|already can|been doing|years of|pretty good|proficient)\b/.test(lower)) return 'advanced';
  
  const gradeMatch = lower.match(/\bv(\d+)\b/);
  if (gradeMatch) return `V${gradeMatch[1]}`;
  
  const freqMatch = lower.match(/(\d+)\s*times?\s*(a|per)\s*week/);
  if (freqMatch) return `${freqMatch[1]} times per week`;
  
  if (lower.length < 20 && /\b(no|none|nothing|zero)\b/.test(lower)) return 'beginner';
  
  if (lower.length < 40 && !lower.includes('?')) {
    const cleaned = lower.replace(/[^\w\s]/g, '').trim();
    if (cleaned.length > 2 && cleaned.length < 50) {
      return message.trim();
    }
  }
  
  return null;
}

function extractCategory(message: string): string | null {
  const lower = message.toLowerCase();
  
  if (/\bdog|puppy|pet|canine|sit|stay|down|come|heel|fetch|roll over\b/.test(lower) && 
      /\btrain|teach|learn|command\b/.test(lower)) return 'skill';
  
  if (/\blose\s*\d*\s*kg|\blose\s*weight|\bweight\s*loss|\bdiet|nutrition|body fat|cut|bulk|slim|lean\b/.test(lower)) return 'health';
  if (/\bskate|kickflip|ollie|skateboard/.test(lower)) return 'skill';
  if (/\bbackflip|frontflip|flip|gymnastics|acrobat|tumbl|parkour|freerun/.test(lower)) return 'skill';
  if (/\brun|5k|10k|marathon|jog|sprint|pace\b/.test(lower)) return 'fitness';
  if (/\bgym|lift|bench|squat|deadlift|muscle|strength|weight training|get fit|fitness\b/.test(lower)) return 'fitness';
  if (/\bclimb|boulder|v\d|lead climbing\b/.test(lower)) return 'climbing';
  if (/\blanguage|spanish|french|german|japanese|mandarin|chinese|learn.*speak\b/.test(lower)) return 'languages';
  if (/\bbusiness|startup|revenue|mrr|customers|launch|side project|saas\b/.test(lower)) return 'business';
  if (/\bguitar|piano|music|instrument|song\b/.test(lower)) return 'creative';
  if (/\bmeditat|mindful|mental|anxiety|stress|therapy\b/.test(lower)) return 'mental_health';
  if (/\bcode|programming|developer|software|app\b/.test(lower)) return 'skill';
  if (/\btravel|visit|trip|vacation|country|countries|pyramid|egypt|tour\b/.test(lower)) return 'travel';
  if (/\bhappy|happiness|wellbeing|joy|positiv|gratitude/.test(lower)) return 'mental_health';
  if (/\bfunny|funnier|humor|social|confident|charisma/.test(lower)) return 'skill';
  if (/\bread|book|novel/.test(lower)) return 'education';
  if (/\bcook|recipe|kitchen|bake/.test(lower)) return 'skill';
  if (/\bwrit|story|blog|author/.test(lower)) return 'creative';
  if (/\bspeak|present|pitch|speech/.test(lower)) return 'skill';
  if (/\bproductiv|habit|routine|focus/.test(lower)) return 'skill';
  
  return null;
}
// ============================================================
// STRUCTURED STATE MANAGEMENT
// ============================================================

interface CollectedInfo {
  goal_name: string | null;
  goal_description: string | null;
  category: string | null;
  current_level: string | null;
  target_date: string | null;
  timeline: string | null;
  weekly_hours: number | null;
  session_length_mins: number | null;
  sessions_per_week: number | null;
  total_hours: number | null;
  total_weeks: number | null;
  success_condition: string | null;
}

interface ConversationState {
  collected: CollectedInfo;
  question_count: number;
  phase: 'collecting' | 'commitment_review' | 'plan_preview' | 'done';
  history: Array<{ role: string; content: string }>;
  goal?: any;
  milestones?: any[];
  weekly_hours?: number;
  sessions_per_week?: number;
  session_length_mins?: number;
  total_hours?: number;
  total_weeks?: number;
  preview?: any;
  fit_check?: any;
  plan_edits?: any;
}

function mergeCollectedInfo(
  existing: CollectedInfo,
  message: string
): { updated: CollectedInfo; newlyCollected: string[] } {
  const updated = { ...existing };
  const newlyCollected: string[] = [];
  
  if (!updated.target_date) {
    const date = extractTargetDate(message);
    if (date) {
      updated.target_date = date;
      newlyCollected.push('target_date');
    }
  }
  
  if (!updated.timeline) {
    const timeline = extractTimeline(message);
    if (timeline) {
      updated.timeline = timeline;
      newlyCollected.push('timeline');
    }
  }
  
  const hours = extractWeeklyHours(message);
  if (hours && hours > 0) {
    updated.weekly_hours = hours;
    newlyCollected.push('weekly_hours');
  }
  
  const sessionLen = extractSessionLength(message);
  if (sessionLen && sessionLen > 0) {
    updated.session_length_mins = sessionLen;
    newlyCollected.push('session_length');
  }
  
  if (!updated.current_level) {
    const level = extractCurrentLevel(message);
    if (level) {
      updated.current_level = level;
      newlyCollected.push('current_level');
    }
  }
  
  if (!updated.category) {
    const category = extractCategory(message);
    if (category) {
      updated.category = category;
      newlyCollected.push('category');
    }
  }
  
  return { updated, newlyCollected };
}

function getNextRequiredField(collected: CollectedInfo): string | null {
  // Only goal_name is truly required - everything else can be inferred or defaulted
  if (!collected.goal_name) return 'goal_name';
  // Skip straight to hours proposal if we have the goal
  if (!collected.weekly_hours) return 'hours_proposal';
  if (!collected.session_length_mins) return 'session_length';
  return null;
}

function hasEnoughForHoursProposal(collected: CollectedInfo): boolean {
  // We can propose hours as soon as we have the goal name!
  // Current level and target date can be inferred/defaulted
  return !!collected.goal_name;
}

function autoFillCurrentLevelIfNeeded(
  collected: CollectedInfo,
  message: string,
  history: any[],
  questionCount: number
): CollectedInfo {
  if (collected.current_level) return collected;
  
  const currentLevelQuestions = history.filter((h: any) => 
    h.role === 'assistant' && (
      h.content.toLowerCase().includes('current') ||
      h.content.toLowerCase().includes('level') ||
      h.content.toLowerCase().includes('experience') ||
      h.content.toLowerCase().includes('right now') ||
      h.content.toLowerCase().includes('at the moment') ||
      h.content.toLowerCase().includes('how much') ||
      h.content.toLowerCase().includes("what's your")
    )
  ).length;
  
  if (currentLevelQuestions >= 2 && message.length > 0 && message.length < 100) {
    console.log(`⚠️ Auto-filling current_level after ${currentLevelQuestions} questions: "${message}"`);
    return {
      ...collected,
      current_level: message.trim() || 'beginner',
    };
  }
  
  if (questionCount >= 2 && !collected.current_level) {
    console.log(`⚠️ Auto-filling current_level as 'beginner' due to question limit`);
    return {
      ...collected,
      current_level: 'beginner',
    };
  }
  
  return collected;
}

function calculateWeeks(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

async function buildScheduleContext(userId: string): Promise<string> {
  try {
    const { data: availability } = await supabase
      .from('users')
      .select('wake_time, sleep_time, work_schedule')
      .eq('id', userId)
      .single();

    const { data: goals } = await supabase
      .from('goals')
      .select('name, plan')
      .eq('user_id', userId)
      .eq('status', 'active');

    const wake = availability?.wake_time || '07:00';
    const sleep = availability?.sleep_time || '23:00';
    const wakeH = parseInt(wake.split(':')[0]);
    const sleepH = parseInt(sleep.split(':')[0]);
    const awakeHours = (sleepH - wakeH) * 7;

    let committedHours = 0;
    const goalBreakdown: string[] = [];

    (goals || []).forEach((g: any) => {
      const hours = g.plan?.weekly_hours || 0;
      committedHours += hours;
      if (hours > 0) {
        goalBreakdown.push(`- ${g.name}: ${hours}h/week`);
      }
    });

    if (availability?.work_schedule) {
      const workDays = Object.values(availability.work_schedule).filter((d: any) => d?.start && d?.end);
      committedHours += workDays.length * 8;
    }

    const remainingCapacity = Math.max(0, awakeHours - committedHours);

    let context = `USER SCHEDULE:
- Wakes: ${wake}, Sleeps: ${sleep}
- Weekly capacity: ~${awakeHours}h awake
- Currently committed: ${committedHours}h
- Available for new goals: ${remainingCapacity}h/week`;

    if (goalBreakdown.length > 0) {
      context += `\n\nCurrent commitments:\n${goalBreakdown.join('\n')}`;
    }

    if (remainingCapacity < 3) {
      context += `\n\n⚠️ Very limited capacity - may need to adjust existing goals.`;
    }

    return context;
  } catch (error) {
    console.error('Error building schedule context:', error);
    return 'USER SCHEDULE: Unable to fetch - assume standard availability.';
  }
}

async function generateFitCheck(
  userId: string,
  weeklyHours: number,
  sessionsPerWeek: number
): Promise<{
  fits: boolean;
  available_hours: number;
  needed_hours: number;
  existing_goal_hours: number;
  message: string;
  availability: {
    wake_time: string;
    sleep_time: string;
    work_schedule?: Record<string, { start: string; end: string }>;
    daily_commute_mins?: number;
  };
  existing_blocks: Array<{
    id: string;
    goal_id?: string;
    goal_name?: string;
    type: string;
    scheduled_start: string;
    duration_mins: number;
  }>;
} | null> {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('wake_time, sleep_time, work_schedule, daily_commute_mins')
      .eq('id', userId)
      .single();

    const availability = {
      wake_time: userData?.wake_time || '07:00',
      sleep_time: userData?.sleep_time || '23:00',
      work_schedule: userData?.work_schedule || null,
      daily_commute_mins: userData?.daily_commute_mins || 0,
    };

    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const { data: existingBlocks } = await supabase
      .from('schedule_blocks')
      .select('id, goal_id, type, scheduled_start, duration_mins, notes, goals (name)')
      .eq('user_id', userId)
      .gte('scheduled_start', monday.toISOString())
      .lte('scheduled_start', sunday.toISOString())
      .in('status', ['scheduled', 'in_progress']);

    const wake = parseTime(availability.wake_time);
    const sleep = parseTime(availability.sleep_time);
    let totalAvailable = (sleep.hour - wake.hour) * 7;

    if (availability.work_schedule) {
      Object.values(availability.work_schedule).forEach((day: any) => {
        if (day?.start && day?.end) {
          const ws = parseTime(day.start);
          const we = parseTime(day.end);
          totalAvailable -= (we.hour - ws.hour);
        }
      });
    }

    const workDays = Object.keys(availability.work_schedule || {}).length;
    totalAvailable -= ((availability.daily_commute_mins || 0) / 60) * 2 * workDays;

    const existingGoalHours = (existingBlocks || [])
      .filter(b => b.goal_id)
      .reduce((sum, b) => sum + (b.duration_mins || 0), 0) / 60;

    const netAvailable = totalAvailable - existingGoalHours;
    const fits = weeklyHours <= netAvailable * 0.8;

    return {
      fits,
      available_hours: Math.round(netAvailable * 10) / 10,
      needed_hours: weeklyHours,
      existing_goal_hours: Math.round(existingGoalHours * 10) / 10,
      message: fits
        ? `This fits well in your schedule. You have ~${Math.round(netAvailable)}h available.`
        : `This might be tight - you have ~${Math.round(netAvailable)}h available after work and existing goals.`,
      availability,
      existing_blocks: (existingBlocks || []).map(b => ({
        id: b.id,
        goal_id: b.goal_id,
        goal_name: (b.goals as any)?.name || b.notes?.split('|||')[0] || 'Scheduled',
        type: b.type || 'goal',
        scheduled_start: b.scheduled_start,
        duration_mins: b.duration_mins,
      })),
    };
  } catch (error) {
    console.error('Error generating fit check:', error);
    return null;
  }
}
// ============================================================
// NEW SESSION GENERATORS - MEDITATION, HAPPINESS, SOCIAL, ETC
// ============================================================

function generateMeditationSessions(phase: string, count: number, duration: number): any[] {
  // Meditation sessions should be SHORT - quality over quantity
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Breath Awareness: Counting', description: 'Sit comfortably. Count breaths 1-10, restart. When mind wanders, return to 1.', notes: 'Wandering is normal - noticing is the practice', duration_mins: 10 },
      { name: 'Body Scan Meditation', description: 'Start at feet, move attention up through body. Notice without changing.', notes: 'Tension you notice releases', duration_mins: 12 },
      { name: 'Anchor Practice: Breath Focus', description: 'Focus on breath sensation - nostrils, chest, or belly. Return when distracted.', notes: 'Pick one anchor and stick with it', duration_mins: 10 },
      { name: 'Loving-Kindness: Self', description: 'Repeat: "May I be happy, healthy, at peace." Feel the words.', notes: 'Self-compassion first', duration_mins: 8 },
      { name: 'Open Awareness Practice', description: 'No focus point. Let sounds, sensations, thoughts arise and pass.', notes: 'Like watching clouds', duration_mins: 10 },
    ],
    development: [
      { name: 'Extended Breath Meditation', description: 'Aim for 15-20 cycles without losing count.', notes: 'Longer streaks = stronger focus', duration_mins: 15 },
      { name: 'Thought Labeling Practice', description: 'Label thoughts: "thinking", "planning", "remembering". Return to breath.', notes: 'Labeling creates distance', duration_mins: 12 },
      { name: 'Loving-Kindness: Others', description: 'Extend to: loved one, neutral person, difficult person, all beings.', notes: 'Start easy, work up', duration_mins: 15 },
      { name: 'Walking Meditation', description: 'Walk slowly, feeling each step: lift, move, place.', notes: 'Great for restless days', duration_mins: 15 },
      { name: 'Noting Meditation', description: 'Note everything: "hearing", "itching", "wanting". One word.', notes: 'Builds daily awareness', duration_mins: 12 },
    ],
    peak: [
      { name: 'Insight Practice', description: 'Observe impermanence, unsatisfactoriness, non-self in experiences.', notes: 'Let insights arise naturally', duration_mins: 20 },
      { name: 'Do Nothing Meditation', description: 'Let go of all effort. No technique, no goal.', notes: 'Hardest technique is none', duration_mins: 15 },
      { name: 'Longer Sit: Build Duration', description: 'Extend usual time by 50%. Work with discomfort.', notes: 'Discomfort is your teacher', duration_mins: 25 },
      { name: 'Mini-Retreat: 3 Sessions', description: 'Three sessions in one day with mindful activities between.', notes: 'Intensity accelerates', duration_mins: 45 },
      { name: 'Integration Practice', description: 'Full attention to: one meal, one conversation, one task.', notes: 'Off-cushion is the real goal', duration_mins: 20 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateHappinessSessions(phase: string, count: number, duration: number): any[] {
  // Happiness/wellbeing exercises - journaling and reflection activities
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Gratitude Journaling: 3 Things', description: 'Write 3 specific grateful things. Be detailed.', notes: 'Specificity is key', duration_mins: 10 },
      { name: 'Savoring Exercise', description: 'Recall positive moment. Relive in detail: sights, sounds, feelings.', notes: 'Balance negative bias', duration_mins: 10 },
      { name: 'Strength Spotting', description: 'Find a moment you used a strength today. Plan to use it again.', notes: 'Strengths increase wellbeing', duration_mins: 12 },
      { name: 'Acts of Kindness Reflection', description: 'Do one kind act. Journal how it felt.', notes: 'Giving > receiving for happiness', duration_mins: 15 },
      { name: 'Best Possible Self', description: 'Write your life 5 years from now if everything goes well.', notes: 'Visualization drives behavior', duration_mins: 20 },
    ],
    development: [
      { name: 'Gratitude Letter', description: 'Write to someone who helped you. Be specific.', notes: 'Even undelivered letters work', duration_mins: 25 },
      { name: 'Value Clarification', description: 'Rank what matters. One action aligned with top value.', notes: 'Value-aligned = satisfied', duration_mins: 20 },
      { name: 'Negative Thought Reframe', description: 'Write recurring thought. Challenge it. Write balanced version.', notes: 'Thoughts are opinions', duration_mins: 15 },
      { name: 'Social Connection Audit', description: 'Map relationships. Strengthen one this week.', notes: 'Relationships = #1 predictor', duration_mins: 20 },
      { name: 'Flow Activity Identification', description: 'List absorbing activities. Schedule one.', notes: 'Flow builds wellbeing', duration_mins: 15 },
    ],
    peak: [
      { name: 'Meaning Reflection', description: 'What gives life meaning? How to do more?', notes: 'Purpose outlasts pleasure', duration_mins: 20 },
      { name: 'Self-Compassion Practice', description: 'Recent failure? What would you tell a friend?', notes: 'Compassion motivates better', duration_mins: 15 },
      { name: 'Habit Integration', description: 'Which practices stuck? Adjust and recommit.', notes: 'What gets scheduled gets done', duration_mins: 15 },
      { name: 'Adversity Growth Review', description: 'Past difficulty? How did you grow?', notes: 'Post-traumatic growth is real', duration_mins: 20 },
      { name: 'Weekly Wellbeing Review', description: 'Score: emotions, engagement, relationships, meaning, accomplishment.', notes: 'PERMA model', duration_mins: 15 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateSocialSessions(phase: string, count: number, duration: number): any[] {
  // Social skills - short practice exercises
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Observation Practice', description: 'Watch comedian or funny friend. Note what works: timing, surprise.', notes: 'Humor is learnable', duration_mins: 20 },
      { name: 'Self-Deprecation Workshop', description: 'Write 3 mild self-deprecating observations. Test one.', notes: 'Safe topic: yourself', duration_mins: 15 },
      { name: 'Daily Conversation Goal', description: 'Start 2 conversations with new people. 2 minutes each.', notes: 'Confidence from reps', duration_mins: 10 },
      { name: 'Question Mastery', description: 'Ask more questions. Follow up answers.', notes: 'Great conversationalists listen', duration_mins: 15 },
      { name: 'Body Language Awareness', description: 'Open posture, eye contact, smiling.', notes: '55% of communication', duration_mins: 10 },
    ],
    development: [
      { name: 'Callback Practice', description: 'Reference something from earlier in conversation.', notes: 'Callbacks are gold', duration_mins: 15 },
      { name: 'Story Structure Workshop', description: 'Setup, tension, unexpected twist. Practice telling.', notes: 'Structure makes stories land', duration_mins: 25 },
      { name: 'Exaggeration Technique', description: 'Take mundane observation, exaggerate it.', notes: 'Exaggeration + truth = funny', duration_mins: 15 },
      { name: 'Group Dynamics Practice', description: 'Validate others, connect speakers, include quiet people.', notes: 'Social glue is valuable', duration_mins: 20 },
      { name: 'Rejection Therapy', description: 'Make request you expect rejected. Notice: survivable.', notes: 'Fear limits charisma', duration_mins: 10 },
    ],
    peak: [
      { name: 'Impromptu Speaking', description: 'Random topic, 60 seconds. Record and review.', notes: 'Thinking on feet is trainable', duration_mins: 15 },
      { name: 'Networking Challenge', description: 'Event goal: meet 5, get 2 follow-ups.', notes: 'Events are practice', duration_mins: 60 },
      { name: 'Comedy Set Writing', description: '5 minutes of material about your life.', notes: 'Everyone has a set in them', duration_mins: 30 },
      { name: 'Feedback Session', description: 'Ask friend for honest feedback on social presence.', notes: 'Blind spots need outside eyes', duration_mins: 20 },
      { name: 'Charisma Synthesis', description: 'Combine: warmth, presence, power. Practice all three.', notes: 'Charisma = W + P + P', duration_mins: 20 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateReadingSessions(phase: string, count: number, duration: number): any[] {
  // Reading sessions - can vary widely, these are focused reading blocks
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Distraction-Free Block', description: 'Phone away. Timer. Read until it rings.', notes: 'Environment > willpower', duration_mins: 30 },
      { name: 'Active Reading Practice', description: 'Underline, notes, star passages. Engage actively.', notes: 'Active = 3x retention', duration_mins: 30 },
      { name: 'Reading Habit Anchor', description: 'Same time daily: after coffee, before bed.', notes: 'Habits stack better', duration_mins: 20 },
      { name: 'Chapter Summary Exercise', description: 'After chapter, 3 bullet points from memory.', notes: 'Recall > re-reading', duration_mins: 10 },
      { name: 'Genre Exploration', description: 'Try genre you skip. Give 50 pages.', notes: 'Comfort zone gets stale', duration_mins: 45 },
    ],
    development: [
      { name: 'Speed Reading Practice', description: 'Finger guides eyes. Slightly faster than comfortable.', notes: 'You can go faster', duration_mins: 20 },
      { name: 'Book Discussion Prep', description: 'Read to discuss: themes, questions, quotes.', notes: 'Social accountability', duration_mins: 40 },
      { name: 'Audiobook + Physical Combo', description: '1.5x audio while following text.', notes: 'Dual input helps', duration_mins: 30 },
      { name: 'Author Deep Dive', description: 'Second book by author you loved.', notes: 'Depth beats width sometimes', duration_mins: 45 },
      { name: 'Challenging Read', description: 'Above usual level. Look up unfamiliar words.', notes: 'Challenging books grow you', duration_mins: 40 },
    ],
    peak: [
      { name: 'Reading Sprint: Full Book', description: 'Block time. Finish entire book. Full immersion.', notes: 'Immersion creates impact', duration_mins: 120 },
      { name: 'Teaching Session', description: 'Explain book in 5 minutes. Questions reveal gaps.', notes: 'Teaching = deepest learning', duration_mins: 15 },
      { name: 'Cross-Reference Reading', description: 'Two books on same topic. Compare.', notes: 'Triangulation builds understanding', duration_mins: 60 },
      { name: 'Book Review Writing', description: 'Who should read? Key takeaways? Rating?', notes: 'Writing solidifies thinking', duration_mins: 25 },
      { name: 'Reading Goal Review', description: 'Count completed. Review learnings. Plan next.', notes: 'Tracking motivates', duration_mins: 15 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateCookingSessions(phase: string, count: number, duration: number): any[] {
  // Cooking sessions - actual cooking time varies by dish
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Knife Skills: Dicing', description: 'Dice onions, carrots, celery. Even cuts.', notes: 'Consistent = even cooking', duration_mins: 20 },
      { name: 'Mise en Place', description: 'Prep ALL ingredients before cooking.', notes: 'This is why chefs seem calm', duration_mins: 15 },
      { name: 'Perfect Eggs', description: 'Scrambled, fried, poached. Master one.', notes: 'Eggs teach heat control', duration_mins: 20 },
      { name: 'Pan Sauce Fundamentals', description: 'Sear, remove, deglaze, reduce, butter.', notes: 'Pan sauces elevate anything', duration_mins: 25 },
      { name: 'Vinaigrette Mastery', description: '3:1 oil:acid. Taste. Adjust.', notes: 'From scratch changes salads', duration_mins: 10 },
    ],
    development: [
      { name: 'Multi-Component Meal', description: 'Protein, starch, vegetable - timed together.', notes: 'Timing is the real skill', duration_mins: 60 },
      { name: 'Recipe Variation', description: 'Known recipe, change one element.', notes: 'Variations build understanding', duration_mins: 45 },
      { name: 'Cuisine Deep Dive', description: 'One cuisine, 2-3 authentic dishes.', notes: 'Depth transfers', duration_mins: 75 },
      { name: 'Batch Cooking', description: 'Prep 4-5 meals. Efficiency focus.', notes: 'Its own skill', duration_mins: 90 },
      { name: 'No Recipe Challenge', description: 'Cook without recipe. Trust palate.', notes: 'Cooking > following', duration_mins: 45 },
    ],
    peak: [
      { name: 'Dinner Party Execution', description: '3-course meal for guests. Manage stress.', notes: 'The real test', duration_mins: 120 },
      { name: 'Advanced Technique: Braising', description: 'Brown, deglaze, low-slow cook.', notes: 'Turns tough cuts magical', duration_mins: 90 },
      { name: 'Baking Challenge', description: 'Bread or pastry from scratch.', notes: 'Demands accuracy', duration_mins: 90 },
      { name: 'Fridge Challenge', description: 'Meal from what you have. No shopping.', notes: 'Real skill = making do', duration_mins: 45 },
      { name: 'Signature Dish Development', description: 'YOUR version. Make 3 times, improve each.', notes: 'Impresses forever', duration_mins: 60 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateWritingSessions(phase: string, count: number, duration: number): any[] {
  // Writing sessions - focused creative blocks
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Morning Pages', description: '3 pages by hand. No editing, no stopping.', notes: 'Bypasses inner critic', duration_mins: 25 },
      { name: 'Object Story', description: 'Write about object within reach. Its history, meaning.', notes: 'Constraints spark creativity', duration_mins: 20 },
      { name: 'Dialogue Practice', description: 'Conversation between two characters. No tags.', notes: 'Good dialogue does multiple things', duration_mins: 20 },
      { name: 'Scene Setting', description: 'Describe place using all five senses.', notes: 'Setting is character', duration_mins: 20 },
      { name: 'Micro Fiction: 100 Words', description: 'Complete story in exactly 100 words.', notes: 'Constraints force precision', duration_mins: 15 },
    ],
    development: [
      { name: 'Character Development', description: 'Backstory, wants, fears, quirks. Scene showing essence.', notes: 'Characters drive stories', duration_mins: 30 },
      { name: 'Editing Practice', description: 'Cut 20% of words. Improve by subtraction.', notes: 'Editing is writing', duration_mins: 25 },
      { name: 'POV Experiment', description: 'Same scene, 3 perspectives.', notes: 'POV is everything', duration_mins: 30 },
      { name: 'Tension Building', description: 'Something bad about to happen. Build dread.', notes: 'Tension = anticipation', duration_mins: 25 },
      { name: 'Read-and-Write', description: 'Read 30min, write 30min. Let style influence.', notes: 'Writers are readers', duration_mins: 60 },
    ],
    peak: [
      { name: 'Story Draft: Beginning', description: 'Hook reader. Establish voice. 500-1000 words.', notes: 'Start late', duration_mins: 45 },
      { name: 'Story Draft: Middle', description: 'Complication. What goes wrong?', notes: 'Conflict is story', duration_mins: 45 },
      { name: 'Story Draft: Resolution', description: 'How character changed?', notes: 'Endings echo beginnings', duration_mins: 45 },
      { name: 'Full Revision Pass', description: 'Read complete draft. Note problems. Plan revision.', notes: 'Big picture first', duration_mins: 60 },
      { name: 'Final Polish', description: 'Line-by-line. Read aloud. Cut weak words.', notes: 'Aloud catches what eyes miss', duration_mins: 45 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateProductivitySessions(phase: string, count: number, duration: number): any[] {
  // Productivity/habit sessions - reflection and planning exercises
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Habit Audit', description: 'Track all habits today. No judgment, just data.', notes: 'Awareness precedes change', duration_mins: 15 },
      { name: 'Trigger Identification', description: '"After I [X], I will [habit]."', notes: 'Implementation intentions 2x', duration_mins: 10 },
      { name: 'Environment Design', description: 'Good habits obvious/easy. Bad invisible/hard.', notes: 'Environment > motivation', duration_mins: 20 },
      { name: '2-Minute Version', description: 'Scale habit to 2 minutes. Do that.', notes: 'Establish before improving', duration_mins: 5 },
      { name: 'Streak Starter', description: 'Begin tracking. Mark done today.', notes: 'Visual tracking motivates', duration_mins: 5 },
    ],
    development: [
      { name: 'Habit Stacking', description: '2-3 habits in sequence.', notes: 'Reduce decision points', duration_mins: 15 },
      { name: 'Temptation Bundling', description: 'Pair need-to with want-to.', notes: 'Make attractive', duration_mins: 10 },
      { name: 'Accountability Setup', description: 'Tell someone. Check-in system.', notes: 'Social pressure works', duration_mins: 15 },
      { name: 'Obstacle Pre-mortem', description: 'What could derail? If-then for each.', notes: 'Plan for failure', duration_mins: 20 },
      { name: 'Habit Upgrade', description: 'Increase by 10%. Still maintainable.', notes: 'Gradual beats dramatic', duration_mins: 10 },
    ],
    peak: [
      { name: 'Identity Statement', description: '"I am the type of person who..." Be that.', notes: 'Identity change lasts', duration_mins: 15 },
      { name: 'System Review', description: 'Working? Broken? Adjust and recommit.', notes: 'Systems need maintenance', duration_mins: 20 },
      { name: 'Keystone Identification', description: 'Which habit triggers others? Protect it.', notes: 'Keystone habits cascade', duration_mins: 15 },
      { name: 'Tracking Review', description: 'Patterns? When slip? When succeed?', notes: 'Data reveals truth', duration_mins: 15 },
      { name: 'Maintenance Mode', description: 'Minimum to maintain? Remove friction.', notes: 'Good habits = automatic', duration_mins: 10 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generatePublicSpeakingSessions(phase: string, count: number, duration: number): any[] {
  // Public speaking - practice sessions vary by exercise
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Mirror Practice', description: 'Speak to yourself. Maintain eye contact.', notes: 'Eye contact = 50% presence', duration_mins: 10 },
      { name: 'Record and Review', description: '2 minutes any topic. Watch. Note pace, fillers.', notes: 'Video is brutal but essential', duration_mins: 15 },
      { name: 'Filler Elimination', description: 'Have someone count ums. Aim for silence.', notes: 'Silence is power', duration_mins: 10 },
      { name: 'Breathing Control', description: 'Diaphragmatic. One sentence per breath.', notes: 'Breath = nerves control', duration_mins: 10 },
      { name: 'Impromptu: Table Topics', description: 'Random topic, 1-2 minutes, no prep.', notes: 'Toastmasters format', duration_mins: 10 },
    ],
    development: [
      { name: 'Story Structure', description: '5-minute story: setup, conflict, resolution, lesson.', notes: 'Stories beat points', duration_mins: 20 },
      { name: 'Opening Hook Development', description: '5 different openings for same talk.', notes: '30 seconds to hook', duration_mins: 25 },
      { name: 'Gesture Practice', description: 'Purposeful gestures. Mark in script.', notes: 'Emphasize, dont distract', duration_mins: 15 },
      { name: 'Vocal Variety Drills', description: 'Same sentence, different speeds/volumes/pitches.', notes: 'Monotone kills', duration_mins: 15 },
      { name: 'Q&A Practice', description: 'Anticipate 5 questions. Prepare pivots.', notes: 'Q&A makes or breaks', duration_mins: 20 },
    ],
    peak: [
      { name: 'Full Run-Through', description: 'Start to finish. No stopping. Simulate real.', notes: 'Practice makes permanent', duration_mins: 30 },
      { name: 'Live Practice', description: 'Present to friends/family. Get feedback.', notes: 'Real audience reveals truth', duration_mins: 30 },
      { name: 'Stress Inoculation', description: 'Practice with distractions: TV, interruptions.', notes: 'Handle chaos, calm is easy', duration_mins: 20 },
      { name: 'Visualization', description: 'Mental rehearsal. See success.', notes: 'Brain doesnt distinguish', duration_mins: 10 },
      { name: 'Pre-Talk Ritual', description: 'Your routine: breathing, power pose, affirmation.', notes: 'Rituals manage nerves', duration_mins: 10 },
    ],
  };
  return sessions[phase].slice(0, count);
}
// ============================================================
// ORIGINAL SESSION GENERATORS
// ============================================================

function generateRunningSessions(phase: string, count: number, duration: number, is5k: boolean, isMarathon: boolean): any[] {
  // Running sessions - actual running time varies significantly by workout type
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Easy Aerobic Run', description: 'Run at conversational pace - you should be able to talk in full sentences. Focus on relaxed form and consistent breathing.', notes: "If you can't talk, slow down!", duration_mins: 30 },
      { name: 'Run/Walk Intervals', description: 'Alternate 3 minutes running with 1 minute walking. Repeat for the full duration. Great for building endurance safely.', notes: 'The walk breaks are productive, not cheating', duration_mins: 25 },
      { name: 'Form Focus Run', description: 'Easy pace with attention to: landing midfoot, relaxed shoulders, 180 cadence. Stop and reset form when it degrades.', notes: 'Good form prevents injuries', duration_mins: 20 },
      { name: 'Fartlek Play', description: 'Easy run with 6-8 short pickups (20-30 seconds faster) whenever you feel like it. No structure, just play.', notes: 'Keep pickups fun and spontaneous', duration_mins: 25 },
      { name: 'Recovery Jog', description: 'Very easy effort - slower than you think. Focus on blood flow and loosening up. Can include dynamic stretches.', notes: 'This should feel almost too easy', duration_mins: 20 },
    ],
    development: [
      { name: 'Tempo Run: 20min at Threshold', description: 'After warmup, run 20 minutes at "comfortably hard" pace - you can speak in short phrases only. Cool down easy.', notes: 'Threshold pace feels like 7/10 effort', duration_mins: 35 },
      { name: 'Interval Session: 6x400m', description: 'Warmup 10min, then 6x400m at 5K pace with 90sec recovery jog between. Cool down 10min.', notes: 'First rep should feel controlled, not all-out', duration_mins: 40 },
      { name: 'Progressive Long Run', description: 'Start easy, finish moderate. Each third of the run gets slightly faster. Last 10min should feel like tempo effort.', notes: 'Negative splitting builds race fitness', duration_mins: isMarathon ? 90 : 50 },
      { name: 'Hill Repeats: 8x60sec', description: 'Find a moderate hill. After warmup, run hard uphill for 60sec, jog down to recover. Repeat 8 times.', notes: 'Drive knees up, pump arms, stay tall', duration_mins: 35 },
      { name: 'Race Pace Practice', description: `Run ${is5k ? '2 miles' : '4 miles'} at your goal race pace. Focus on how this pace feels in your body.`, notes: 'Get comfortable being uncomfortable', duration_mins: is5k ? 25 : 40 },
    ],
    peak: [
      { name: 'Race Simulation', description: `Full dress rehearsal: wear race kit, eat race breakfast, warmup like race day, run ${is5k ? '3K' : '8K'} at goal pace.`, notes: "Practice everything you'll do on race day", duration_mins: is5k ? 30 : 50 },
      { name: 'Sharpener: 4x200m Fast', description: 'After good warmup, run 4x200m at slightly faster than race pace. Full recovery between. Legs should feel snappy.', notes: 'Short, sharp, and fast - wake up those legs!', duration_mins: 25 },
      { name: 'Easy Shakeout + Strides', description: '20min very easy, then 4x100m strides (fast but controlled). Keeps legs fresh while maintaining turnover.', notes: "Taper doesn't mean stop completely", duration_mins: 25 },
      { name: 'Pre-Race Visualization Run', description: 'Easy 20min jog while mentally rehearsing your race. Picture the start, middle, tough patches, and finish.', notes: 'See yourself succeeding', duration_mins: 20 },
      { name: 'Final Tune-Up', description: 'Easy 15-20min with 2-3 race pace surges of 30sec each. Confirm your legs are ready. Rest tomorrow!', notes: "Trust your training - you're ready!", duration_mins: 20 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateBusinessSessions(phase: string, count: number, duration: number): any[] {
  // Business sessions - these are typically longer, focused work blocks
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Customer Problem Interviews (3 calls)', description: "Reach out to 3 potential customers. Ask about their biggest pain points. Don't pitch - just listen and take notes.", notes: "The best products solve real problems you've heard directly", duration_mins: 60 },
      { name: 'Competitor Deep Dive', description: "Sign up for 3 competitor products. Document: pricing, features, onboarding flow, what's missing. Find your angle.", notes: "Don't copy - find the gap they're missing", duration_mins: 90 },
      { name: 'Value Proposition Canvas', description: 'Map customer jobs, pains, and gains. Match with your product features, pain relievers, and gain creators.', notes: "If you can't articulate the value, neither can customers", duration_mins: 45 },
      { name: 'MVP Feature Scoping', description: 'List every possible feature. Ruthlessly cut to the minimum needed to test your core hypothesis. Max 3 features.', notes: 'If everything is important, nothing is', duration_mins: 60 },
      { name: 'Landing Page Draft', description: 'Write headline, subhead, 3 benefits, and CTA. Use customer language from your interviews. No code yet - just copy.', notes: 'Headlines should pass the "so what?" test', duration_mins: 45 },
      { name: 'Pricing Research', description: 'Research 5 competitor prices. Survey 5 potential customers on willingness to pay. Draft your pricing tiers.', notes: 'Price based on value, not time/cost', duration_mins: 60 },
    ],
    development: [
      { name: 'Build Core Feature #1', description: 'Focus on the ONE feature that delivers the main value. Get to functional (not perfect). Test with real data.', notes: 'Shipping beats perfecting', duration_mins: 120 },
      { name: 'Launch Landing Page', description: 'Deploy your landing page with email capture. Set up analytics. Share in 3 relevant communities for initial traffic.', notes: 'A launched page beats a perfect mockup', duration_mins: 90 },
      { name: 'First User Onboarding', description: 'Get your first real user. Watch them use the product (screenshare). Document every confusion point.', notes: 'Watch what they do, not what they say', duration_mins: 45 },
      { name: 'Iteration Sprint', description: 'Fix the top 3 issues from user feedback. Improve onboarding based on drop-off points. Ship updates same day.', notes: 'Fast iteration beats careful planning', duration_mins: 120 },
      { name: 'Content Marketing Start', description: 'Write 1 valuable blog post or Twitter thread about a problem your product solves. Include soft CTA to landing page.', notes: "Teach, don't pitch", duration_mins: 60 },
      { name: 'Email Sequence Setup', description: 'Create 3-email welcome sequence: 1) Quick win tutorial 2) Case study/social proof 3) Soft upgrade nudge', notes: 'Deliver value before asking for money', duration_mins: 60 },
    ],
    peak: [
      { name: 'Payment Integration', description: 'Add Stripe/payment flow. Test the complete purchase journey yourself. Set up basic invoicing and receipts.', notes: 'Make it embarrassingly easy to pay you', duration_mins: 120 },
      { name: 'Launch Campaign Prep', description: 'Draft Product Hunt post, prepare social content, line up 5 people to share on launch day. Create urgency (limited offer?)', notes: 'Coordinate for maximum day-1 impact', duration_mins: 90 },
      { name: 'First Paying Customer Push', description: 'Direct outreach to your warmest leads. Offer early-bird pricing. Personal onboarding call for first 5 customers.', notes: 'Your first customers are worth extra effort', duration_mins: 60 },
      { name: 'Testimonial Collection', description: 'Ask happy users for quotes and permission to use their name/photo. Create case study from best success story.', notes: 'Social proof converts skeptics', duration_mins: 45 },
      { name: 'Metrics Dashboard Setup', description: 'Track: signups, activation rate, conversion to paid, churn, MRR. Review weekly. Set targets for each.', notes: 'What gets measured gets improved', duration_mins: 60 },
      { name: 'Growth Experiment #1', description: 'Pick ONE acquisition channel. Run a focused 1-week experiment. Measure CAC. Double down or move on.', notes: 'Focus beats scattered efforts', duration_mins: 90 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateLanguageSessions(phase: string, count: number, duration: number, language: string): any[] {
  // Language sessions - shorter focused blocks work better than long sessions
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Core 100 Words: Anki Session', description: `Study the 100 most common ${language} words using flashcards. Aim for 20 new words + review. Use spaced repetition.`, notes: 'Frequency trumps complexity - learn common words first', duration_mins: 20 },
      { name: 'Pronunciation Drilling', description: `Listen to native ${language} audio. Repeat sentences out loud, focusing on rhythm and sounds. Record yourself and compare.`, notes: 'Your mouth needs training just like your brain', duration_mins: 15 },
      { name: 'Basic Phrases: Greetings & Essentials', description: "Learn to say: hello, goodbye, please, thank you, excuse me, I don't understand, do you speak English. Practice until automatic.", notes: 'These phrases unlock every conversation', duration_mins: 20 },
      { name: 'Numbers & Time', description: `Master numbers 1-100, days of week, months, telling time. Practice by looking at clocks and saying the time in ${language}.`, notes: 'Numbers come up constantly - drill them hard', duration_mins: 25 },
      { name: 'Listening Practice: Easy Podcast', description: `Listen to beginner ${language} podcast (slow, clear speech). Don't worry about understanding everything - train your ear.`, notes: 'Passive listening builds comprehension over time', duration_mins: 20 },
    ],
    development: [
      { name: 'Grammar Pattern: Present Tense', description: 'Learn the present tense conjugation pattern. Write 10 sentences about your daily routine using new verbs.', notes: 'Patterns are more useful than rules', duration_mins: 30 },
      { name: 'Conversation Exchange: 30min with Native', description: 'Book a session on iTalki or Tandem. Prepare 5 questions to ask. Focus on speaking, not perfection.', notes: 'Real conversation is where the magic happens', duration_mins: 30 },
      { name: 'Restaurant & Food Vocabulary', description: 'Learn 30 food-related words. Practice ordering meals, asking for the bill, making reservations. Role-play scenarios.', notes: 'Food vocab gets used every single day', duration_mins: 25 },
      { name: "Reading: Children's Book or News", description: `Read a simple ${language} text. Look up max 10 unknown words. Try to get the gist without translating everything.`, notes: 'Extensive reading beats word-by-word translation', duration_mins: 30 },
      { name: 'Past Tense Introduction', description: 'Learn the past tense pattern. Write about what you did yesterday using at least 5 new past tense verbs.', notes: 'Past tense unlocks storytelling', duration_mins: 30 },
    ],
    peak: [
      { name: 'Full Immersion Hour', description: `Set everything to ${language}: phone, social media, music. Think in ${language}. No English for the full session.`, notes: 'Total immersion accelerates fluency', duration_mins: 60 },
      { name: 'Debate/Discussion Practice', description: 'Have a conversation about a complex topic (politics, philosophy, current events). Express opinions, agree, disagree.', notes: 'Fluency means expressing complex thoughts', duration_mins: 45 },
      { name: 'Native Content: Movie/Show No Subtitles', description: `Watch ${language} media without subtitles. Accept not understanding everything. Focus on catching what you can.`, notes: 'Real-world content is the ultimate test', duration_mins: 45 },
      { name: 'Spontaneous Speaking Drill', description: 'Set a timer. Talk about random topics for 2 minutes each without stopping. Topics: your job, a memory, future plans, an opinion.', notes: 'Fluency is speaking without mental translation', duration_mins: 20 },
      { name: 'Proficiency Test Practice', description: 'Take a practice test for your target level (A2, B1, etc). Identify weak areas. This measures real progress.', notes: 'Tests show where to focus next', duration_mins: 45 },
    ],
  };
  return sessions[phase].slice(0, count);
}
function generateStrengthSessions(phase: string, count: number, duration: number): any[] {
  // Strength training - actual gym time including warmup and rest
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Push Day: Bench & Shoulders', description: 'Bench Press 3x8, Overhead Press 3x8, Incline DB Press 3x10, Lateral Raises 3x12, Tricep Pushdowns 3x12. Focus on form.', notes: "Control the weight - don't let it control you", duration_mins: 55 },
      { name: 'Pull Day: Rows & Pulldowns', description: 'Barbell Row 3x8, Lat Pulldown 3x10, Face Pulls 3x15, DB Curls 3x10, Hammer Curls 3x10. Squeeze at contraction.', notes: 'Feel your back working, not just your arms', duration_mins: 50 },
      { name: 'Leg Day: Squat Focus', description: 'Back Squat 4x6, Romanian Deadlift 3x8, Leg Press 3x10, Walking Lunges 3x12 each, Calf Raises 4x15.', notes: 'Depth matters - full range of motion', duration_mins: 60 },
      { name: 'Full Body: Movement Patterns', description: 'Goblet Squat 3x10, Push-ups 3x15, DB Rows 3x10 each, Glute Bridges 3x15, Plank 3x30sec.', notes: 'Master bodyweight before loading heavy', duration_mins: 45 },
      { name: 'Core & Accessory Work', description: 'Hanging Leg Raises 3x10, Ab Wheel 3x8, Pallof Press 3x10 each side, Farmer Carries 3x40m, Face Pulls 3x15.', notes: 'Core strength prevents injuries', duration_mins: 35 },
    ],
    development: [
      { name: 'Heavy Bench Day', description: 'Bench Press: Work up to heavy 3x5, then 3x8 at -15%. Close-grip Bench 3x8. Dips 3x max. Tricep work.', notes: 'Heavy triples build strength, backoffs build muscle', duration_mins: 65 },
      { name: 'Heavy Squat Day', description: 'Back Squat: Work up to heavy 3x5, then 3x8 at -15%. Front Squat 3x6. Leg Press 3x12. Leg Curls 3x12.', notes: 'Brace hard before every rep', duration_mins: 70 },
      { name: 'Heavy Deadlift Day', description: 'Deadlift: Work up to heavy 3x3, then 3x5 at -20%. RDL 3x8. Barbell Rows 4x6. Back extensions 3x12.', notes: 'Reset between deadlift reps - no touch and go', duration_mins: 70 },
      { name: 'Push Hypertrophy', description: 'DB Bench 4x10, Arnold Press 3x12, Cable Flyes 3x15, Lateral Raise dropset, Tricep Overhead Extension 3x12.', notes: 'Time under tension builds muscle', duration_mins: 55 },
      { name: 'Pull Hypertrophy', description: 'Weighted Pull-ups 4x6, Cable Rows 4x12, DB Pullovers 3x12, Bicep 21s x3, Rear Delt Flyes 3x15.', notes: 'Slow eccentrics increase growth', duration_mins: 55 },
    ],
    peak: [
      { name: 'Max Test: Bench Press', description: 'Full warmup. Work up in singles to find your true 1RM. Rest 3-5min between heavy attempts. Record your lift!', notes: 'Attempt what you know you can hit, then one more', duration_mins: 45 },
      { name: 'Max Test: Squat', description: 'Full warmup with mobility. Singles working up to 1RM. Have a spotter. Depth counts - get video to confirm.', notes: 'Bury the squat - better too deep than too shallow', duration_mins: 50 },
      { name: 'Max Test: Deadlift', description: 'Warmup thoroughly. Singles to 1RM. Mixed or hook grip. Reset between attempts. Pull with intent!', notes: "The bar doesn't know you're nervous", duration_mins: 50 },
      { name: 'Deload: Light Pump Work', description: 'All exercises at 50% normal weight, higher reps (15-20). Focus on blood flow and recovery. Leave feeling better.', notes: 'Strategic deloads enable future gains', duration_mins: 40 },
      { name: 'Peak Assessment Day', description: 'Test all three lifts at ~95% effort. Calculate total. Compare to when you started. Plan next training phase.', notes: 'Celebrate progress, then set new targets', duration_mins: 75 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateClimbingSessions(phase: string, count: number, duration: number): any[] {
  // Climbing sessions - varies from quick drills to full sessions
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Footwork Drills: Silent Feet', description: 'Climb easy routes focusing on placing feet silently. No sound = precise placement. Do 10+ easy problems this way.', notes: 'Sloppy feet = wasted energy', duration_mins: 30 },
      { name: 'Straight-Arm Climbing', description: 'Climb with arms as straight as possible. Engage legs and hips. Only bend arms to make moves. Builds efficiency.', notes: 'Bent arms burn out, straight arms rest', duration_mins: 30 },
      { name: 'Volume Session: 20 Easy Problems', description: 'Climb 20+ problems well below your limit. Focus on flow and movement. Rest minimally. Build base fitness.', notes: 'Easy climbing builds endurance and technique', duration_mins: 60 },
      { name: 'Hip Positioning Practice', description: 'On every move, consciously turn hips into the wall. Practice flagging and drop-knees on easy terrain.', notes: 'Hips to the wall saves arm strength', duration_mins: 30 },
      { name: 'Grip Type Exploration', description: 'Practice different grip types: crimps, slopers, pinches, pockets. Identify weaknesses. Note what feels hard.', notes: 'Know your weaknesses to train them', duration_mins: 25 },
    ],
    development: [
      { name: 'Project Work: Redpoint Burns', description: 'Work your current project. 4-5 solid attempts with full rest (5-8min) between. Refine beta each attempt.', notes: 'Every attempt should teach you something', duration_mins: 60 },
      { name: '4x4 Endurance Circuits', description: '4 problems, 4 times through, no rest between problems, 4min rest between sets. Choose problems you can do tired.', notes: 'This builds the pump tolerance you need', duration_mins: 45 },
      { name: 'Limit Bouldering: Max Moves', description: 'Attempt moves/problems at your limit. Focus on single hard moves. Full rest between attempts. Quality over quantity.', notes: 'Limit sessions build max strength', duration_mins: 50 },
      { name: 'Hangboard: Repeaters Protocol', description: '7sec hang / 3sec rest, 6 reps per set. 3 sets on each grip (half crimp, open hand, 3-finger drag). 3min between sets.', notes: 'Consistency beats intensity - same time every week', duration_mins: 30 },
      { name: 'Movement Masterclass: Watch & Learn', description: 'Watch 3 climbers better than you. Note their techniques. Try to replicate one thing from each on easy problems.', notes: 'Stealing beta is how you level up', duration_mins: 40 },
    ],
    peak: [
      { name: 'Peak Send Day: Goal Route/Problem', description: 'Full warmup. 3 quality attempts on your goal with 10min+ rest. If you send, rest and try something harder!', notes: 'Today is the day - trust your training', duration_mins: 75 },
      { name: 'Competition Simulation', description: 'Flash attempts only on 5 new problems. 5min per problem, score yourself. Practice performing under pressure.', notes: 'Reading problems quickly is a skill', duration_mins: 45 },
      { name: 'Easy Volume: Confidence Builder', description: 'Climb 15-20 problems you can flash. Feel strong. Remember how good you are. Positive vibes only.', notes: 'Confidence matters - feed it', duration_mins: 50 },
      { name: 'Active Recovery: Mobility & Easy Climbing', description: 'Light stretching, foam rolling, then 30min of very easy climbing. Focus on enjoying movement.', notes: 'Recovery is part of training', duration_mins: 45 },
      { name: 'Send Session: Top 3 Projects', description: "Bring your redpoint list. Give solid burns on each. Rest fully. This is what you've trained for.", notes: 'Deep breaths, calm mind, send hard', duration_mins: 75 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateSkillSessions(phase: string, count: number, duration: number, goalName: string): any[] {
  const lower = goalName.toLowerCase();
  
  if (/kickflip|skate/.test(lower)) {
    return generateSkateboardingSessions(phase, count, duration);
  }
  if (/guitar|piano|music|instrument/.test(lower)) {
    return generateMusicSessions(phase, count, duration, goalName);
  }
  if (/backflip|flip|gymnastics/.test(lower)) {
    return generateGymnasticsSessions(phase, count, duration);
  }
  
  // Generic skill sessions with realistic individual durations
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Fundamentals Breakdown', description: `Break ${goalName} into component parts. Practice each part in isolation for 10min each. Don't combine yet.`, notes: 'Master the parts before the whole', duration_mins: 30 },
      { name: 'Slow Motion Practice', description: 'Practice at 50% speed. Focus on perfect form and technique. Speed comes later - accuracy comes first.', notes: 'Slow is smooth, smooth is fast', duration_mins: 25 },
      { name: 'Video Analysis Session', description: 'Record yourself practicing. Compare to experts. Note 3 specific differences. Work on the biggest gap.', notes: "Video doesn't lie - use it", duration_mins: 30 },
      { name: 'Drill Repetitions: 100 Reps', description: 'Pick ONE fundamental movement. Do 100 quality repetitions. Track your success rate.', notes: 'Repetition is the mother of skill', duration_mins: 35 },
      { name: 'Knowledge Study', description: 'Watch tutorials, read guides, study theory for 30min. Then practice applying ONE new concept you learned.', notes: 'Understanding accelerates learning', duration_mins: 45 },
    ],
    development: [
      { name: 'Combination Practice', description: 'Link fundamentals together. Practice transitions between components. Build the full movement sequence.', notes: 'The connections are where skills break down', duration_mins: 35 },
      { name: 'Difficulty Progression', description: 'Slightly increase difficulty/challenge. If you were at level 5, try level 6. Struggle is good - it means growth.', notes: 'Comfort zone = no growth zone', duration_mins: 30 },
      { name: 'Timed Attempts', description: 'Give yourself 10 attempts to succeed. Track success rate. Rest between attempts. Pressure reveals weaknesses.', notes: 'Constraints create focus', duration_mins: 25 },
      { name: 'Weak Point Focus', description: 'Spend full session on your worst component. Uncomfortable but necessary. Turn weakness into strength.', notes: 'What you avoid is what you need most', duration_mins: 40 },
      { name: 'Endurance Building', description: 'Practice until quality degrades, rest, repeat. Build stamina for the skill. Note when fatigue affects performance.', notes: 'Fatigue-resistant skills are reliable skills', duration_mins: 45 },
    ],
    peak: [
      { name: 'Full Performance Practice', description: 'Execute the complete skill as if performing. No do-overs. Practice the mental aspect as much as physical.', notes: 'Practice how you want to perform', duration_mins: 30 },
      { name: 'Success Stacking', description: 'Only count clean executions. Stack up wins. Build confidence. End on a good one.', notes: 'Success breeds success', duration_mins: 35 },
      { name: 'Random Conditions', description: 'Practice with variations: different surface, weather, equipment, time of day. Build adaptability.', notes: 'Adaptable skills are robust skills', duration_mins: 35 },
      { name: 'Demonstration Day', description: 'Show your skill to someone. Film it. The pressure of "it counts" is training you need.', notes: 'Stakes sharpen performance', duration_mins: 25 },
      { name: 'Mastery Assessment', description: "Attempt the skill 10 times. Count successes. Compare to when you started. Celebrate progress!", notes: "Measure to see how far you've come", duration_mins: 20 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateSkateboardingSessions(phase: string, count: number, duration: number): any[] {
  // Skateboarding - varies from quick drills to full sessions
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Balance & Comfort: Rolling Practice', description: 'Push around for 20min. Practice carving, stopping, riding switch. Get completely comfortable on the board.', notes: 'Comfort on the board is the foundation of everything', duration_mins: 25 },
      { name: 'Ollie Fundamentals: Stationary', description: "Practice ollie motion while stationary/holding wall. Pop, slide, level out. 50+ attempts. Don't roll yet.", notes: 'The pop comes from ankle, not whole leg', duration_mins: 20 },
      { name: 'Ollie Rolling: Small & Consistent', description: "Roll slowly, ollie over a crack or line. Height doesn't matter - focus on landing bolts. 30+ attempts.", notes: 'Level the board with your front foot slide', duration_mins: 25 },
      { name: 'Front Foot Technique', description: 'Focus only on front foot position and slide. Slide to nose, not just up. Try flicking off different directions.', notes: 'The front foot controls where the board goes', duration_mins: 20 },
      { name: 'Manual & Board Control', description: 'Practice manuals (back wheels only, then front). Build balance and board feel. Time yourself.', notes: 'Manuals teach you weight distribution', duration_mins: 20 },
    ],
    development: [
      { name: 'Kickflip Position: Stationary Flips', description: 'Practice flipping the board without landing on it. Focus on flick direction (off the corner). Catch with back foot.', notes: 'Flick out at 45 degrees, not straight down', duration_mins: 25 },
      { name: 'Jump Commitment Drills', description: 'Do ollies but jump higher and land later. Build the commitment muscle. Land on moving board every time.', notes: 'Commitment is a skill you can train', duration_mins: 20 },
      { name: 'One-Foot Land Practice', description: "Flip the board, land with back foot only, then add front foot. Build confidence with partial success.", notes: "Back foot on first proves you're committing", duration_mins: 25 },
      { name: 'Full Attempts: Just Go For It', description: "20 full kickflip attempts. Jump with the board. Don't bail. Land on it even if ugly. Count any lands.", notes: 'Stop overthinking - your body knows more than you think', duration_mins: 30 },
      { name: 'Video Review Session', description: "Film 10 attempts. Watch in slow motion. Note: flick timing, shoulder position, front foot slide, commitment.", notes: "You can't fix what you can't see", duration_mins: 25 },
    ],
    peak: [
      { name: 'Clean Kickflip Stacking', description: 'Only count clean landings (bolts, rolling away). Stack 5 in a row. Reset count if you miss.', notes: 'Clean landings build real confidence', duration_mins: 35 },
      { name: 'Moving Faster: Speed Kickflips', description: 'Push to comfortable speed, then kickflip. Speed makes it easier once you commit. 15+ attempts.', notes: 'Speed actually helps - trust it', duration_mins: 25 },
      { name: 'Obstacle Kickflips', description: 'Kickflip over something small (stick, crack, curb). The target focuses your mind and improves timing.', notes: 'Having a target improves execution', duration_mins: 30 },
      { name: 'First Try Game', description: 'Give yourself 1 attempt at kickflip, then 1 attempt at something else, rotate. Simulates "first try" pressure.', notes: 'Learn to land on demand', duration_mins: 25 },
      { name: 'Send Session: Get The Clip', description: "Film until you get a clean kickflip you're proud of. This is what you've trained for!", notes: 'This is the moment - make it count!', duration_mins: 30 },
    ],
  };
  return sessions[phase].slice(0, count);
}
function generateMusicSessions(phase: string, count: number, duration: number, goalName: string): any[] {
  // Music practice - varies from quick drills to longer practice sessions
  const instrument = /piano/.test(goalName.toLowerCase()) ? 'piano' : 'guitar';
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: `Basic ${instrument === 'guitar' ? 'Chord' : 'Scale'} Practice`, description: `Practice the fundamental ${instrument === 'guitar' ? 'open chords (G, C, D, Em, Am)' : 'C major scale, both hands'}. Clean transitions. Use metronome at 60 BPM.`, notes: 'Slow and clean beats fast and sloppy', duration_mins: 20 },
      { name: 'Finger Exercise Routine', description: `10min finger exercises for strength and independence. ${instrument === 'guitar' ? 'Spider walk, chromatic runs' : 'Hanon exercises #1-3'}. Build dexterity.`, notes: 'Your fingers need conditioning like athletes', duration_mins: 15 },
      { name: 'Song Section #1: Intro/Verse', description: 'Learn just the first section of your target song. Hands separately if needed. Get it clean before adding speed.', notes: 'Learn songs in chunks, not all at once', duration_mins: 25 },
      { name: 'Rhythm Training', description: 'Practice with a metronome. Start at 60 BPM. Play simple patterns perfectly in time. Speed is the last thing to add.', notes: 'Rhythm mistakes are harder to fix than note mistakes', duration_mins: 15 },
      { name: 'Ear Training: Simple Melodies', description: 'Listen to a simple melody. Try to play it by ear. Start with nursery rhymes or simple songs. Train your ear-hand connection.', notes: 'Playing by ear is a skill you can develop', duration_mins: 20 },
    ],
    development: [
      { name: 'Song Section #2: Chorus/Bridge', description: 'Learn the next section of your target song. Then practice transitioning from section 1 to section 2.', notes: 'Transitions are where songs fall apart', duration_mins: 30 },
      { name: 'Tempo Push: 10 BPM Increase', description: 'Take a passage you know and increase tempo by 10 BPM. Practice until clean. Repeat next session.', notes: 'Gradual speed increases stick better', duration_mins: 20 },
      { name: 'Dynamics Practice', description: 'Play your song with deliberate loud and soft sections. Express emotion through volume. Music is more than notes.', notes: 'Dynamics are what separate players from musicians', duration_mins: 25 },
      { name: 'Difficult Section Isolation', description: 'Find the hardest 4 bars. Loop them 50 times. Hands separately if needed. This is where growth happens.', notes: 'Avoiding hard parts keeps you stuck', duration_mins: 30 },
      { name: 'Play-Along Session', description: 'Play along with the original recording. Match timing, feel, and energy. Note where you lose sync.', notes: 'Playing with others (even recordings) builds timing', duration_mins: 25 },
    ],
    peak: [
      { name: 'Full Song Run-Through', description: 'Play the complete song start to finish. No stopping. If you make a mistake, keep going. Build performance stamina.', notes: "In performance, you can't restart", duration_mins: 20 },
      { name: 'Performance Practice: Record Yourself', description: 'Set up camera/phone. Announce the song. Play it like performing for an audience. Watch back and critique.', notes: 'Recording reveals what you really sound like', duration_mins: 25 },
      { name: 'Memory Practice: No Sheet Music', description: "Play the song from memory. If you forget, try to figure it out. Build independence from written music.", notes: 'Memory frees you to focus on expression', duration_mins: 20 },
      { name: 'Polish & Expression', description: "You know the notes. Now add: dynamics, phrasing, emotion. Make it YOUR version. What are you trying to say?", notes: 'Notes are just the beginning', duration_mins: 25 },
      { name: 'Final Performance: Play For Someone', description: 'Perform your song for a friend, family member, or even record and share online. This is what it was all for!', notes: 'Music is meant to be shared', duration_mins: 15 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateGymnasticsSessions(phase: string, count: number, duration: number): any[] {
  // Realistic durations for gymnastics drills - these are intense, focused activities
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: 'Backward Roll Perfection', description: 'Practice backward rolls on soft surface. Chin to chest, hands by ears, push through. 20 clean reps.', notes: 'The backward roll is the first step to a backflip', duration_mins: 15 },
      { name: 'Jump & Tuck Drill', description: 'Standing jumps with tight tuck position (knees to chest). Hold tuck at peak. Land softly. 30 jumps.', notes: 'Tuck timing is everything in a backflip', duration_mins: 12 },
      { name: 'Back Extension Roll', description: 'From backward roll, extend legs up and push to standing. Builds the hip extension pattern you need.', notes: 'This teaches your body the backflip shape', duration_mins: 15 },
      { name: 'Wall Handstand Holds', description: 'Handstand against wall for time. Work up to 60sec. Builds arm strength and body awareness.', notes: 'Handstands build the spatial awareness for flips', duration_mins: 10 },
      { name: 'Trampoline: Back Bounce to Back', description: 'On trampoline, bounce and land on your back. Practice the falling-back sensation safely.', notes: 'Your body needs to learn that falling back is okay', duration_mins: 20 },
    ],
    development: [
      { name: 'Trampoline Back Tuck', description: 'Full backflips on trampoline. Focus on: jump UP first, then tuck, spot your landing. 20+ attempts.', notes: 'Jump UP, not back - height gives you time', duration_mins: 25 },
      { name: 'Macaco/Back Walkover Practice', description: 'Work on back walkover or macaco to build backward momentum comfort. Spot if needed.', notes: 'These build comfort with going backwards', duration_mins: 20 },
      { name: 'High Tuck Jumps', description: 'Jump as high as possible, tuck as tight as possible at the peak. Land softly. Focus on quick tuck.', notes: 'Fast tuck = faster rotation', duration_mins: 10 },
      { name: 'Foam Pit or Soft Surface Attempts', description: 'With spotter or into soft surface, attempt back tucks. Focus on set (jump) and tuck timing.', notes: 'Use soft surfaces while building confidence', duration_mins: 30 },
      { name: 'Mental Rehearsal', description: "Visualize the perfect backflip 20 times. Feel the jump, tuck, spot, land. Your brain doesn't distinguish imagination from reality.", notes: 'Mental reps count as real practice', duration_mins: 10 },
    ],
    peak: [
      { name: 'Grass/Mat Attempts with Spot', description: 'Attempt on grass or mat with a spotter for safety. Focus on committing to the jump and tuck.', notes: 'A spotter lets you commit fully', duration_mins: 30 },
      { name: 'Standing Back Tuck: Full Send', description: 'When ready: full standing back tuck attempt. Jump UP, tuck FAST, spot your landing, land on feet.', notes: 'Commit 100% - hesitation causes crashes', duration_mins: 25 },
      { name: 'Landing Consistency', description: 'Work on landing cleanly. Feet together, knees bent, stick it. 10 clean landings in a row.', notes: 'A landed flip beats a crashed flip every time', duration_mins: 20 },
      { name: 'Different Surfaces', description: 'Try your backflip on different surfaces: gym floor, grass, beach (if applicable). Build confidence anywhere.', notes: 'Surface confidence builds real confidence', duration_mins: 25 },
      { name: 'Film Your Success!', description: "Get video of your clean backflip. You've earned this! Share it, be proud.", notes: 'Document your achievement - you did it!', duration_mins: 15 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateDogTrainingSessions(phase: string, count: number, duration: number, command: string): any[] {
  // Dog training sessions should be SHORT - dogs lose focus after 10-15 mins
  const sessions: Record<string, any[]> = {
    foundation: [
      { name: `Lure Training: Introducing "${command.toUpperCase()}"`, description: `Use a treat to lure your dog into the ${command} position. The instant they do it, say "${command.toUpperCase()}", give treat. 20 reps.`, notes: 'The treat leads the nose, the body follows', duration_mins: 10 },
      { name: 'Marker Word Conditioning', description: 'Say "YES!" and immediately give a treat, 30 times. Your dog needs to know that "YES" means treat is coming.', notes: 'The marker word becomes more precise than a treat', duration_mins: 8 },
      { name: `${command.toUpperCase()} Without Lure: Hand Signal Only`, description: `Same motion without treat in hand. Mark with "YES" when they ${command}, treat from other hand. 20 reps.`, notes: 'Fading the lure is key to real learning', duration_mins: 10 },
      { name: 'Short Sessions, Multiple Times', description: `3 sets of 5min ${command} practice with breaks. Dogs learn better in short bursts. End each session on success.`, notes: 'Multiple short sessions beat one long session', duration_mins: 15 },
      { name: 'Adding the Verbal Cue', description: `Say "${command.toUpperCase()}" THEN do hand signal. Repeat until dog responds to voice alone. 25+ reps.`, notes: 'Voice comes before signal until they connect them', duration_mins: 12 },
    ],
    development: [
      { name: 'Duration Building', description: `Ask for ${command}, wait 2 seconds before marking and treating. Gradually increase to 10 seconds.`, notes: 'Add duration before adding distractions', duration_mins: 10 },
      { name: 'Mild Distractions', description: `Practice ${command} with TV on, family member walking by, or in a different room. Mark and treat fast for success.`, notes: 'Distractions should be added gradually', duration_mins: 12 },
      { name: 'Distance: One Step Back', description: `Ask for ${command}, take one step away, return and reward. Gradually increase distance to 10 feet.`, notes: 'Distance is hard for dogs - go slowly', duration_mins: 10 },
      { name: 'Different Locations', description: `Practice ${command} in backyard, kitchen, hallway, front door. New places = new learning.`, notes: "Dogs don't generalize well - train in many spots", duration_mins: 15 },
      { name: 'Random Reward Schedule', description: `Don't treat every ${command}. Treat 70% of the time, then 50%. This makes the behavior stronger.`, notes: 'Unpredictable rewards create persistent behavior', duration_mins: 10 },
    ],
    peak: [
      { name: 'High Distraction Proofing', description: `${command.toUpperCase()} practice at the park, with other dogs nearby, or with toys out. High-value treats for success!`, notes: 'Outdoor distractions are the real test', duration_mins: 15 },
      { name: 'Real World Application', description: `Use ${command} in real situations: before meals, at the door, before crossing street. Make it functional.`, notes: 'Commands should improve daily life', duration_mins: 10 },
      { name: 'Reliability Test', description: `Ask for ${command} 10 times in various situations. Count successes. Goal: 8/10 or better.`, notes: 'Testing shows where you need more work', duration_mins: 10 },
      { name: `Off-Leash ${command.toUpperCase()}`, description: `If safe, practice ${command} without leash. Build trust and reliability. Only in safe, enclosed areas!`, notes: 'Off-leash reliability is the ultimate goal', duration_mins: 12 },
      { name: 'Party Day: Celebrate Success!', description: `Show off your dog's ${command} to friends/family. Lots of praise and treats. You both did it!`, notes: 'Celebrate your training partnership!', duration_mins: 10 },
    ],
  };
  return sessions[phase].slice(0, count);
}

function generateGenericSessions(goalName: string, sessionsPerWeek: number, sessionDuration: number, totalWeeks: number, midWeekNum: number): { week1: any; midWeek: any; finalWeek: any } {
  // Improved fallback that uses the goal name to create more specific sessions
  const goalWords = goalName.toLowerCase();
  const actionVerb = /learn|master|improve|build|develop|create|start/.test(goalWords) ? 'Practice' : 'Work on';
  
  return {
    week1: {
      week_number: 1,
      focus: `Foundation: ${goalName} fundamentals`,
      sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
        name: `${actionVerb} ${goalName} Basics ${i > 0 ? `(Part ${i + 1})` : ''}`,
        description: `Focused practice session on ${goalName}. Start with fundamentals and build understanding before adding complexity.`,
        duration_mins: sessionDuration,
        notes: 'Quality practice beats quantity - focus on form and understanding',
      })),
    },
    midWeek: {
      week_number: midWeekNum,
      focus: `Development: Advancing ${goalName} skills`,
      sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
        name: `Advanced ${goalName} Practice ${i > 0 ? `(Part ${i + 1})` : ''}`,
        description: `Build on foundations with more challenging work. Push beyond basics into intermediate territory.`,
        duration_mins: sessionDuration,
        notes: 'Growth happens at the edge of your comfort zone',
      })),
    },
    finalWeek: {
      week_number: totalWeeks,
      focus: `Peak: ${goalName} mastery demonstration`,
      sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
        name: `${goalName} Performance ${i > 0 ? `(Session ${i + 1})` : 'Test'}`,
        description: `Apply everything learned. Test yourself under realistic conditions. Demonstrate your progress.`,
        duration_mins: sessionDuration,
        notes: 'Trust your training - you have prepared for this',
      })),
    },
  };
}
// ============================================================
// SMART FALLBACK SESSION GENERATORS
// ============================================================

async function generateAIPreview(
  goalName: string,
  category: string,
  sessionsPerWeek: number,
  sessionDuration: number,
  totalWeeks: number,
  midWeekNum: number
): Promise<{ week1: any; midWeek: any; finalWeek: any }> {
  
  console.log(`🤖 Generating AI preview for: "${goalName}"`);
  
  const prompt = `Create a training plan preview for this goal.

GOAL: "${goalName}"
TOTAL WEEKS: ${totalWeeks}
SESSIONS PER WEEK: ${sessionsPerWeek}
AVERAGE SESSION: ~${sessionDuration} minutes (but vary based on what makes sense)

Generate sessions for 3 key weeks:
1. Week 1 (Foundation) - Getting started, basics, setup
2. Week ${midWeekNum} (Development) - Building momentum, intermediate work
3. Week ${totalWeeks} (Peak) - Advanced work, achieving the goal

CRITICAL RULES:
- Sessions must be SPECIFIC and ACTIONABLE for this exact goal
- Vary durations based on what the task actually requires (10-90 mins)
- Each session should have a clear, specific task name (not "Training" or "Practice")
- Include practical tips in the notes

Return valid JSON only:
{
  "week1": {
    "week_number": 1,
    "focus": "Foundation phase focus",
    "sessions": [
      { "name": "Specific task", "description": "What to do", "duration_mins": 30, "notes": "Pro tip" }
    ]
  },
  "midWeek": {
    "week_number": ${midWeekNum},
    "focus": "Development phase focus", 
    "sessions": [...]
  },
  "finalWeek": {
    "week_number": ${totalWeeks},
    "focus": "Peak phase focus",
    "sessions": [...]
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an elite coach creating specific, actionable training plans. Never use generic session names. Always create tasks specific to the exact goal.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (parsed.week1?.sessions?.length > 0) {
      console.log(`✅ AI preview generated successfully`);
      return {
        week1: {
          week_number: 1,
          focus: parsed.week1.focus || 'Foundation',
          sessions: parsed.week1.sessions.slice(0, sessionsPerWeek)
        },
        midWeek: {
          week_number: midWeekNum,
          focus: parsed.midWeek?.focus || 'Development',
          sessions: (parsed.midWeek?.sessions || parsed.week1.sessions).slice(0, sessionsPerWeek)
        },
        finalWeek: {
          week_number: totalWeeks,
          focus: parsed.finalWeek?.focus || 'Peak Performance',
          sessions: (parsed.finalWeek?.sessions || parsed.week1.sessions).slice(0, sessionsPerWeek)
        }
      };
    }
    
    throw new Error('Invalid preview structure');
    
  } catch (error: any) {
    console.error('❌ AI preview failed:', error.message);
    return generateSimpleFallback(goalName, sessionsPerWeek, sessionDuration, totalWeeks, midWeekNum);
  }
}

function generateSimpleFallback(
  goalName: string,
  sessionsPerWeek: number,
  sessionDuration: number,
  totalWeeks: number,
  midWeekNum: number
): { week1: any; midWeek: any; finalWeek: any } {
  
  const createSessions = (phase: string) => {
    return Array.from({ length: sessionsPerWeek }, (_, i) => ({
      name: `${goalName} - ${phase} Session ${i + 1}`,
      description: `Work on ${goalName} with focus on ${phase.toLowerCase()} elements.`,
      duration_mins: sessionDuration,
      notes: 'Track your progress'
    }));
  };
  
  return {
    week1: { week_number: 1, focus: 'Foundation', sessions: createSessions('Foundation') },
    midWeek: { week_number: midWeekNum, focus: 'Development', sessions: createSessions('Development') },
    finalWeek: { week_number: totalWeeks, focus: 'Peak Performance', sessions: createSessions('Peak') }
  };
}

// Keep old name as alias for compatibility
function generateSmartFallback(
  goalName: string,
  category: string,
  sessionsPerWeek: number,
  sessionDuration: number,
  totalWeeks: number,
  midWeekNum: number
): { week1: any; midWeek: any; finalWeek: any } {
  return generateSimpleFallback(goalName, sessionsPerWeek, sessionDuration, totalWeeks, midWeekNum);
}

function extractLanguage(goalName: string): string | null {
  const lower = goalName.toLowerCase();
  if (/spanish/.test(lower)) return 'Spanish';
  if (/french/.test(lower)) return 'French';
  if (/german/.test(lower)) return 'German';
  if (/japanese/.test(lower)) return 'Japanese';
  if (/mandarin|chinese/.test(lower)) return 'Mandarin';
  if (/korean/.test(lower)) return 'Korean';
  if (/italian/.test(lower)) return 'Italian';
  if (/portuguese/.test(lower)) return 'Portuguese';
  if (/russian/.test(lower)) return 'Russian';
  if (/arabic/.test(lower)) return 'Arabic';
  return null;
}

function extractDogCommand(goalName: string): string {
  const lower = goalName.toLowerCase();
  if (/sit/.test(lower)) return 'sit';
  if (/down|lie/.test(lower)) return 'down';
  if (/stay/.test(lower)) return 'stay';
  if (/come|recall/.test(lower)) return 'come';
  if (/heel/.test(lower)) return 'heel';
  if (/roll/.test(lower)) return 'roll over';
  if (/shake|paw/.test(lower)) return 'shake';
  return 'sit';
}
// ============================================================
// PREVIEW GENERATION
// ============================================================

async function generatePreviewWeeks(
  goalName: string,
  category: string,
  sessionsPerWeek: number,
  weeklyHours: number,
  totalWeeks: number,
  milestones: any[]
): Promise<{ week1: any; midWeek: any; finalWeek: any }> {
  const midWeekNum = Math.ceil(totalWeeks / 2);
  const sessionDuration = Math.round((weeklyHours * 60) / sessionsPerWeek);
  
  // Use the AI preview generator
  return generateAIPreview(goalName, category, sessionsPerWeek, sessionDuration, totalWeeks, midWeekNum);
}

async function generateMilestones(
  goalName: string,
  category: string,
  totalWeeks: number,
  totalHours: number
): Promise<any[]> {
  const prompt = `Create 4-6 milestones for this goal:

GOAL: ${goalName}
CATEGORY: ${category}
DURATION: ${totalWeeks} weeks
TOTAL HOURS: ${totalHours}

Each milestone should be a clear checkpoint with specific criteria.
Return JSON:
{
  "milestones": [
    { "name": "Milestone name", "week": 2, "hours": 10, "criteria": "What defines completion" }
  ]
}`;

  try {
    const parsed = await callOpenAIWithRetry(
      [
        { role: 'system', content: 'Create clear, achievable milestones with specific criteria.' },
        { role: 'user', content: prompt },
      ],
      { timeoutMs: 15000, retries: 1, maxTokens: 1000, temperature: 0.5 }
    );
    return parsed.milestones || [];
  } catch (err: any) {
    console.error('Milestone generation failed:', err.message);
  }
  
  const interval = Math.max(1, Math.floor(totalWeeks / 4));
  return [
    { name: 'Foundation Complete', week: interval, hours: Math.round(totalHours * 0.25), criteria: 'Basic skills established' },
    { name: 'Basic Skills Acquired', week: interval * 2, hours: Math.round(totalHours * 0.5), criteria: 'Core competency demonstrated' },
    { name: 'Intermediate Progress', week: interval * 3, hours: Math.round(totalHours * 0.75), criteria: 'Consistent performance' },
    { name: 'Goal Achieved', week: totalWeeks, hours: totalHours, criteria: 'Target reached' },
  ];
}

function formatWeekPreview(week: any): string {
  if (!week) {
    return '\n📅 **Week** - Training sessions\n└── Sessions being generated...\n';
  }
  
  const weekNum = week.week_number || '?';
  const focus = week.focus || 'Training';
  const sessions = week.sessions || [];
  
  let output = `\n📅 **Week ${weekNum}** - ${focus}\n`;
  
  if (sessions.length === 0) {
    output += '└── Sessions being generated...\n';
    return output;
  }
  
  sessions.forEach((session: any, i: number) => {
    const isLast = i === sessions.length - 1;
    const name = session?.name || 'Training Session';
    const dur = session?.duration_mins || 60;
    const description = session?.description || 'Focus on form and consistency';
    
    output += `${isLast ? '└──' : '├──'} **${name}** (${dur}min)\n`;
    output += `${isLast ? '    ' : '│   '} ${description}\n`;
    if (session?.notes) {
      output += `${isLast ? '    ' : '│   '} 💡 ${session.notes}\n`;
    }
  });
  return output;
}

async function applyPlanEdits(
  currentPreview: { week1: any; midWeek: any; finalWeek: any },
  editRequest: string,
  goalName: string,
  category: string
): Promise<{ updatedPreview: { week1: any; midWeek: any; finalWeek: any }; editSummary: string }> {
  const prompt = `Edit this training plan based on user feedback.

CURRENT PLAN:
${JSON.stringify(currentPreview, null, 2)}

USER'S REQUEST: "${editRequest}"

Apply changes to ALL weeks consistently.
Return JSON:
{
  "updatedPreview": {
    "week1": { ... },
    "midWeek": { ... },
    "finalWeek": { ... }
  },
  "editSummary": "Brief description of what was changed"
}`;

  try {
    const result = await callOpenAIWithRetry(
      [
        {
          role: 'system',
          content: `You are an expert ${category} coach customizing a training plan for ${goalName}.`,
        },
        { role: 'user', content: prompt },
      ],
      { timeoutMs: 25000, retries: 1, maxTokens: 3000, temperature: 0.3 }
    );
    return result;
  } catch (error: any) {
    console.error('⚠️ Edit application failed:', error.message);
    return {
      updatedPreview: currentPreview,
      editSummary: 'Could not apply edit - please try rephrasing',
    };
  }
}

async function generateWeekBatch(
  goalName: string,
  category: string,
  sessionsPerWeek: number,
  weeklyHours: number,
  startWeek: number,
  endWeek: number,
  totalWeeks: number,
  milestones: any[],
  previousWeekFocus?: string,
  planEdits?: any
): Promise<any[]> {
  const editInstructions = planEdits?.editInstructions || '';

  const prompt = `Create detailed weekly training sessions for weeks ${startWeek}-${endWeek} of a ${totalWeeks}-week plan.

GOAL: ${goalName}
CATEGORY: ${category}
SESSIONS PER WEEK: ${sessionsPerWeek}
HOURS PER WEEK: ${weeklyHours}
${previousWeekFocus ? `PREVIOUS WEEK FOCUS: ${previousWeekFocus}` : ''}
${editInstructions ? `USER CUSTOMIZATIONS: ${editInstructions}` : ''}

PHASE CONTEXT:
${startWeek <= Math.ceil(totalWeeks * 0.3) ? 'FOUNDATION: Focus on basics, form, building habits' : ''}
${startWeek > Math.ceil(totalWeeks * 0.3) && startWeek <= Math.ceil(totalWeeks * 0.7) ? 'DEVELOPMENT: Increase intensity, add complexity' : ''}
${startWeek > Math.ceil(totalWeeks * 0.7) ? 'PEAK: High intensity, specific preparation, then taper' : ''}

CRITICAL: Create SPECIFIC session names. Never use generic names like "Session 1" or "Training".

Return JSON:
{
  "weeks": [
    {
      "week_number": ${startWeek},
      "focus": "What this week focuses on",
      "sessions": [
        {
          "name": "Specific session name",
          "description": "What to do",
          "duration_mins": 60,
          "notes": "Coaching tip"
        }
      ]
    }
  ]
}`;

  try {
    const parsed = await callOpenAIWithRetry(
      [
        {
          role: 'system',
          content: `You are an expert ${category} coach creating progressive, detailed training plans. Be specific and practical.`,
        },
        { role: 'user', content: prompt },
      ],
      { timeoutMs: 30000, retries: 1, maxTokens: 4000, temperature: 0.4 }
    );
    return parsed.weeks || [];
  } catch (error: any) {
    console.error(`⚠️ Failed to generate weeks ${startWeek}-${endWeek}:`, error.message);
    return [];
  }
}

async function generateFullWeeklyPlan(
  goalName: string,
  category: string,
  sessionsPerWeek: number,
  weeklyHours: number,
  totalWeeks: number,
  milestones: any[],
  planEdits?: any
): Promise<{
  weeks: any[];
  summary: string;
  realism_notes: string;
  milestones: any[];
}> {
  console.log(`📅 Generating ${totalWeeks}-week plan for: "${goalName}" using AI...`);

  const sessionDuration = Math.round((weeklyHours * 60) / sessionsPerWeek);
  const editInstructions = planEdits?.editInstructions || '';

  const prompt = `You are an expert coach creating a personalized training plan.

GOAL: "${goalName}"
DURATION: ${totalWeeks} weeks
SESSIONS PER WEEK: ${sessionsPerWeek}
HOURS PER WEEK: ${weeklyHours}
AVERAGE SESSION LENGTH: ~${sessionDuration} minutes (but vary based on what makes sense for each task)
${editInstructions ? `USER REQUESTED CHANGES: ${editInstructions}` : ''}

Create a comprehensive, progressive plan that actually achieves this goal. Think like a world-class coach or consultant who specializes in this area.

IMPORTANT RULES:
1. Each session must be SPECIFIC and ACTIONABLE - not generic "practice" or "training"
2. Sessions should build on each other progressively
3. Vary session durations based on what the task actually requires (10-90 mins)
4. Each week should have a clear focus/theme
5. Later weeks should be more advanced than early weeks
6. Include specific exercises, tasks, or activities - not vague instructions
7. Make it feel like a real expert designed this specifically for this goal

PHASE STRUCTURE:
- Weeks 1-${Math.ceil(totalWeeks * 0.3)}: Foundation (basics, setup, fundamentals)
- Weeks ${Math.ceil(totalWeeks * 0.3) + 1}-${Math.ceil(totalWeeks * 0.7)}: Development (building skills, creating, practicing)
- Weeks ${Math.ceil(totalWeeks * 0.7) + 1}-${totalWeeks}: Peak (refinement, optimization, achieving the goal)

Return valid JSON only:
{
  "weeks": [
    {
      "week_number": 1,
      "focus": "Theme for this week",
      "sessions": [
        {
          "name": "Specific task name",
          "description": "Exactly what to do, step by step",
          "duration_mins": 30,
          "notes": "Pro tip or key insight"
        }
      ]
    }
  ],
  "milestones": [
    {
      "name": "Milestone name",
      "target_week": 2,
      "criteria": "How to know you've achieved this"
    }
  ],
  "summary": "One sentence describing this plan",
  "realism_notes": "Brief note on expectations and adjustments"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an elite performance coach and expert planner. You create highly specific, actionable training plans tailored to each person's unique goal. Your plans are detailed, progressive, and feel like they were designed by a world-class expert in that specific field. Never use generic session names. Always think: "What would a top expert actually have someone do this week to progress toward this goal?"`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Validate and ensure we have proper structure
    if (!parsed.weeks || !Array.isArray(parsed.weeks) || parsed.weeks.length === 0) {
      throw new Error('Invalid response structure - no weeks');
    }

    // Ensure each week has proper sessions
    const validatedWeeks = parsed.weeks.map((week: any, idx: number) => ({
      week_number: week.week_number || idx + 1,
      focus: week.focus || `Week ${idx + 1}`,
      sessions: (week.sessions || []).map((s: any) => ({
        name: s.name || 'Training Session',
        description: s.description || 'Complete this session',
        duration_mins: s.duration_mins || sessionDuration,
        notes: s.notes || ''
      }))
    }));

    // Use AI-generated milestones or create from provided ones
    const finalMilestones = parsed.milestones?.length > 0 
      ? parsed.milestones.map((m: any) => ({
          name: m.name,
          target_week: m.target_week || m.week || 1,
          criteria: m.criteria || 'Complete this milestone'
        }))
      : milestones.map((m: any, i: number) => ({
          name: m.name,
          target_week: m.week || m.target_week || Math.round(((i + 1) * totalWeeks) / Math.max(milestones.length, 1)),
          criteria: m.criteria || 'Complete this milestone'
        }));

    console.log(`✅ AI generated ${validatedWeeks.length} weeks with varied, specific sessions`);

    return {
      weeks: validatedWeeks,
      summary: parsed.summary || `${totalWeeks}-week plan for ${goalName}`,
      realism_notes: parsed.realism_notes || 'Adjust intensity based on your progress and energy levels.',
      milestones: finalMilestones
    };

  } catch (error: any) {
    console.error('❌ AI plan generation failed:', error.message);
    
    // Fallback to a simple but honest structure
    const fallbackWeeks = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const sessions = [];
      for (let s = 0; s < sessionsPerWeek; s++) {
        sessions.push({
          name: `${goalName} - Session ${s + 1}`,
          description: `Work on ${goalName}. Focus on making progress.`,
          duration_mins: sessionDuration,
          notes: 'Track your progress'
        });
      }
      fallbackWeeks.push({
        week_number: w,
        focus: w <= totalWeeks * 0.3 ? 'Foundation' : w <= totalWeeks * 0.7 ? 'Development' : 'Peak Performance',
        sessions
      });
    }

    return {
      weeks: fallbackWeeks,
      summary: `${totalWeeks}-week plan for ${goalName}`,
      realism_notes: 'This is a basic plan. Consider regenerating for more specific sessions.',
      milestones: milestones.map((m: any, i: number) => ({
        name: m.name,
        target_week: m.week || Math.round(((i + 1) * totalWeeks) / Math.max(milestones.length, 1)),
        criteria: m.criteria || 'Complete this milestone'
      }))
    };
  }
}
// ============================================================
// ROUTES
// ============================================================
// ============================================================
// PUBLIC PREVIEW ENDPOINT (NO AUTH REQUIRED)
// ============================================================


router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { goal_name } = req.body;

    if (!goal_name || goal_name.trim().length < 2) {
      return res.status(400).json({
        error: 'Please enter a goal',
      });
    }

    // SAFETY CHECK
    const safetyCheck = isGoalSafe(goal_name);
    if (!safetyCheck.safe) {
      console.log(`🚫 Blocked unsafe goal: "${goal_name}"`);
      return res.status(400).json({
        error: safetyCheck.reason || 'This goal cannot be processed.',
        blocked: true,
      });
    }

    console.log(`🎯 Generating preview for: "${goal_name}"`);

    const category = extractCategory(goal_name) || 'skill';
    const hourEstimate = getHourEstimate(goal_name, category, 'beginner');
    const sessionRec = getSessionLengthRecommendation(goal_name, category);
    
    const weeklyHours = hourEstimate.weekly_hours_recommended;
    const sessionLength = sessionRec.recommended_mins;
    const sessionsPerWeek = Math.min(6, Math.ceil((weeklyHours * 60) / sessionLength));
    const totalWeeks = hourEstimate.typical_weeks;
    const totalHours = Math.round(weeklyHours * totalWeeks);

    const prompt = `Create Week 1 training sessions for this goal.

GOAL: "${goal_name}"
SESSIONS THIS WEEK: ${sessionsPerWeek}
SESSION LENGTH: ~${sessionLength} minutes each

This is the FOUNDATION week - focus on basics, setup, and getting started.

CRITICAL: Create SPECIFIC, ACTIONABLE sessions for this exact goal. Not generic.

Return valid JSON only:
{
  "week1": {
    "week_number": 1,
    "focus": "Foundation phase focus description",
    "sessions": [
      {
        "name": "Specific session name",
        "description": "What exactly to do in this session",
        "duration_mins": ${sessionLength},
        "notes": "Pro tip for this session"
      }
    ]
  }
}`;

    let week1Preview;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an elite coach creating specific, actionable training sessions. Never use generic names like "Session 1". Create tasks specific to the exact goal.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      
      if (parsed.week1?.sessions?.length > 0) {
        week1Preview = parsed.week1;
      }
    } catch (aiError: any) {
      console.error('AI preview generation failed:', aiError.message);
    }

    if (!week1Preview) {
      week1Preview = {
        week_number: 1,
        focus: 'Foundation & Getting Started',
        sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
          name: `${goal_name} - Foundation Session ${i + 1}`,
          description: `Start building your foundation for ${goal_name}`,
          duration_mins: sessionLength,
          notes: 'Focus on form and consistency',
        })),
      };
    }

    return res.json({
      goal: {
        name: goal_name,
        category,
      },
      plan: {
        weekly_hours: weeklyHours,
        sessions_per_week: sessionsPerWeek,
        session_length_mins: sessionLength,
        total_weeks: totalWeeks,
        total_hours: totalHours,
      },
      preview: {
        week1: week1Preview,
        locked_weeks: totalWeeks - 1,
      },
      reasoning: {
        session_length_reason: sessionRec.reasoning,
        hour_estimate_notes: hourEstimate.notes,
      },
    });

  } catch (error: any) {
    console.error('❌ Preview generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate preview',
      message: error.message,
    });
  }
});

router.post('/from-dreams', async (req: Request, res: Response) => {
  try {
    const { user_id, text } = req.body;

    if (!user_id || !text) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'text'],
      });
    }

    console.log(`🎯 Extracting goals from dreams for user ${user_id}`);

    const prompt = `Extract goals from this text and return as JSON array.

Text: "${text}"

Return JSON:
{
  "goals": [
    {
      "name": "Specific measurable goal",
      "category": "fitness|business|skill|languages|career|travel|education|financial|creative|social|health|mental_health|climbing",
      "description": "Brief description",
      "target_date": "YYYY-MM-DD or null",
      "priority": "high|medium|low"
    }
  ]
}`;

    const response = await simpleCompletion(prompt);
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(cleanResponse);
    const goals = parsed.goals || [];

    console.log(`✅ Extracted ${goals.length} goals`);

    return res.json({
      goals,
      message: `Found ${goals.length} goals. Review and confirm to save.`,
    });
  } catch (error: any) {
    console.error('❌ Goal extraction error:', error);
    return res.status(500).json({
      error: 'Failed to extract goals',
      message: error.message,
    });
  }
});

router.post('/check-fit', async (req: Request, res: Response) => {
  try {
    const { user_id, weekly_hours, sessions_per_week } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const neededHours = weekly_hours || 5;
    const sessions = sessions_per_week || 3;

    console.log(`📊 Checking fit: ${neededHours}h/week for user ${user_id}`);

    const fitCheck = await generateFitCheck(user_id, neededHours, sessions);

    if (!fitCheck) {
      return res.json({ fits: true, message: 'Unable to check fit - assuming it works' });
    }

    return res.json(fitCheck);

  } catch (error: any) {
    console.error('❌ Check fit error:', error);
    return res.status(500).json({
      error: 'Failed to check fit',
      message: error.message,
    });
  }
});

router.post('/conversation', async (req: Request, res: Response) => {
  try {
    const { user_id, message, conversation_state } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'message'],
      });
    }

    console.log(`💬 Goal conversation: "${message.substring(0, 50)}..."`);

    const history = conversation_state?.history || [];
    history.push({ role: 'user', content: message });

    let collected: CollectedInfo = conversation_state?.collected || {
      goal_name: null,
      goal_description: null,
      category: null,
      current_level: null,
      target_date: null,
      timeline: null,
      weekly_hours: null,
      session_length_mins: null,
      sessions_per_week: null,
      total_hours: null,
      total_weeks: null,
      success_condition: null,
    };

    let questionCount = conversation_state?.question_count || 0;
    const phase = conversation_state?.phase || 'collecting';

    const { updated: updatedCollected, newlyCollected } = mergeCollectedInfo(collected, message);
    collected = updatedCollected;
    
    if (newlyCollected.length > 0) {
      console.log(`📊 Extracted from message: ${newlyCollected.join(', ')}`);
    }
    
    collected = autoFillCurrentLevelIfNeeded(collected, message, history, questionCount);

    // PHASE: PLAN_PREVIEW
    if (phase === 'plan_preview' && conversation_state?.goal && conversation_state?.preview) {
      const confirmation = extractConfirmation(message);

      if (confirmation === 'yes') {
        console.log('✅ User accepted plan preview – creating goal');

        return res.json({
          complete: true,
          goal: conversation_state.goal,
          milestones: conversation_state.milestones,
          weekly_hours: conversation_state.weekly_hours,
          sessions_per_week: conversation_state.sessions_per_week,
          session_length_mins: conversation_state.session_length_mins,
          total_hours: conversation_state.total_hours,
          total_weeks: conversation_state.total_weeks,
          plan_edits: conversation_state.plan_edits,
          preview: conversation_state.preview,
          fit_check: conversation_state.fit_check,
          message: `🎉 Let's go! Creating your "${conversation_state.goal.name}" plan now...\n\nYou'll now pick which days and times work best for your sessions.`,
          state: {
            ...conversation_state,
            collected,
            phase: 'done',
            history,
          },
        });
      }

      console.log('✏️ User requesting plan edit');

      const { updatedPreview, editSummary } = await applyPlanEdits(
        conversation_state.preview,
        message,
        conversation_state.goal.name,
        conversation_state.goal.category
      );

      const planEdits = conversation_state.plan_edits || { editInstructions: '' };
      planEdits.editInstructions += `\n- ${message}`;

      let previewMessage = `✏️ ${editSummary}\n\nHere's your updated plan:\n`;
      previewMessage += formatWeekPreview(updatedPreview.week1);
      previewMessage += `\n...\n`;
      previewMessage += formatWeekPreview(updatedPreview.midWeek);
      previewMessage += `\n...\n`;
      previewMessage += formatWeekPreview(updatedPreview.finalWeek);
      previewMessage += `\n\nWant to make any other changes, or does this look good?`;

      return res.json({
        complete: false,
        message: previewMessage,
        preview: updatedPreview,
        goal: conversation_state.goal,
        milestones: conversation_state.milestones,
        weekly_hours: conversation_state.weekly_hours,
        sessions_per_week: conversation_state.sessions_per_week,
        session_length_mins: conversation_state.session_length_mins,
        total_hours: conversation_state.total_hours,
        total_weeks: conversation_state.total_weeks,
        fit_check: conversation_state.fit_check,
        show_schedule_picker: true,
        state: {
          ...conversation_state,
          collected,
          preview: updatedPreview,
          plan_edits: planEdits,
          phase: 'plan_preview',
          history,
        },
      });
    }

    // PHASE: COMMITMENT_REVIEW
    if (phase === 'commitment_review') {
      const confirmation = extractConfirmation(message);
      const sessionLen = extractSessionLength(message);
      const subPhase = conversation_state?.sub_phase || 'hours';
      
      if (subPhase === 'hours') {
        if (confirmation === 'reduce' && collected.weekly_hours) {
          collected.weekly_hours = Math.max(1, collected.weekly_hours - 1);
          if (collected.total_hours) {
            collected.total_weeks = Math.ceil(collected.total_hours / collected.weekly_hours);
            const newTarget = new Date();
            newTarget.setDate(newTarget.getDate() + collected.total_weeks * 7);
            collected.target_date = newTarget.toISOString().split('T')[0];
          }
          
          return res.json({
            complete: false,
            message: `Got it! At ${collected.weekly_hours}h/week, you're looking at ${collected.total_weeks} weeks instead. Does ${collected.weekly_hours}h/week work better?`,
            state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'hours', history },
          });
        }
        
        if (confirmation === 'increase' && collected.weekly_hours) {
          collected.weekly_hours = collected.weekly_hours + 1;
          if (collected.total_hours) {
            collected.total_weeks = Math.ceil(collected.total_hours / collected.weekly_hours);
            const newTarget = new Date();
            newTarget.setDate(newTarget.getDate() + collected.total_weeks * 7);
            collected.target_date = newTarget.toISOString().split('T')[0];
          }
          
          return res.json({
            complete: false,
            message: `Nice! At ${collected.weekly_hours}h/week, you could hit this in ${collected.total_weeks} weeks. Sound good?`,
            state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'hours', history },
          });
        }
        
        if (confirmation === 'yes' && collected.weekly_hours) {
          // Use the new session length recommendation engine
          const sessionRec = getSessionLengthRecommendation(collected.goal_name || '', collected.category || '');
          const recommendedMins = sessionRec.recommended_mins;
          const reasoning = sessionRec.reasoning;
          let sessionsPerWeek = Math.ceil((collected.weekly_hours * 60) / recommendedMins);
          
          // CAP AT 6 SESSIONS MAX - extend timeline instead
          const MAX_SESSIONS = 6;
          if (sessionsPerWeek > MAX_SESSIONS) {
            // Recalculate with max sessions, longer session duration
            const adjustedSessionLength = Math.ceil((collected.weekly_hours * 60) / MAX_SESSIONS);
            sessionsPerWeek = MAX_SESSIONS;
            collected.session_length_mins = adjustedSessionLength;
            collected.sessions_per_week = sessionsPerWeek;
            
            return res.json({
              complete: false,
              message: `For ${collected.weekly_hours}h/week, I'd recommend ${MAX_SESSIONS} sessions of ${adjustedSessionLength} minutes each rather than cramming in too many sessions.\n\nGood with ${adjustedSessionLength}-min sessions, or would you prefer shorter sessions spread over more weeks?`,
              state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
            });
          }
          
          collected.session_length_mins = recommendedMins;
          collected.sessions_per_week = sessionsPerWeek;
          
          return res.json({
            complete: false,
            message: `Perfect! For this type of training, I recommend ${recommendedMins}-minute sessions - ${reasoning}.\n\nAt ${collected.weekly_hours}h/week, that's ${sessionsPerWeek} session${sessionsPerWeek > 1 ? 's' : ''} per week.\n\nGood with ${recommendedMins}-min sessions, or would you prefer shorter/longer?`,
            state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
          });
        }
      }
      
      if (subPhase === 'session_length') {
        const MAX_SESSIONS = 6;
        const sessionCount = extractSessionCount(message);
        
        // NEW: Handle when user specifies session COUNT (e.g., "3 sessions please", "3 sessions per week 60 mins")
        if (sessionCount && sessionCount > 0) {
          collected.sessions_per_week = Math.min(sessionCount, MAX_SESSIONS);
          
          // If they also specified duration, use it
          if (sessionLen && sessionLen > 0) {
            collected.session_length_mins = sessionLen;
          }
          
          // Recalculate weekly hours based on sessions × duration
          const newWeeklyHours = (collected.sessions_per_week * collected.session_length_mins!) / 60;
          collected.weekly_hours = Math.round(newWeeklyHours * 10) / 10;
          
          // Recalculate total weeks if needed
          if (collected.total_hours) {
            collected.total_weeks = Math.ceil(collected.total_hours / collected.weekly_hours);
          }
          
          return res.json({
            complete: false,
            message: `Perfect! ${collected.sessions_per_week} sessions of ${collected.session_length_mins} minutes = ${collected.weekly_hours}h/week.\n\n📅 That's ${collected.total_weeks || 'a few'} weeks total.\n\nReady to see your plan?`,
            state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
          });
        }
        
        if (sessionLen === -1 || /shorter|less time|quick/.test(message.toLowerCase())) {
          collected.session_length_mins = Math.max(10, (collected.session_length_mins || 60) - 15);
          let newSessions = Math.ceil((collected.weekly_hours! * 60) / collected.session_length_mins);
          
          // Cap at 6 - warn if too many
          if (newSessions > MAX_SESSIONS) {
            return res.json({
              complete: false,
              message: `Shorter sessions would mean ${newSessions} sessions per week, which is a lot! I'd recommend either keeping ${collected.session_length_mins + 15}-min sessions, or reducing your weekly hours. What would you prefer?`,
              state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
            });
          }
          
          collected.sessions_per_week = newSessions;
          
          return res.json({
            complete: false,
            message: `Sure! With ${collected.session_length_mins}-minute sessions, that's ${collected.sessions_per_week} sessions per week. Sound good?`,
            state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
          });
        }
        
        if (sessionLen === -2 || /longer|more time/.test(message.toLowerCase())) {
          collected.session_length_mins = Math.min(120, (collected.session_length_mins || 60) + 15);
          collected.sessions_per_week = Math.min(MAX_SESSIONS, Math.ceil((collected.weekly_hours! * 60) / collected.session_length_mins));
          
          return res.json({
            complete: false,
            message: `Got it! With ${collected.session_length_mins}-minute sessions, that's ${collected.sessions_per_week} sessions per week. Sound good?`,
            state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
          });
        }
        
        if (sessionLen && sessionLen > 0) {
          collected.session_length_mins = sessionLen;
          let newSessions = Math.ceil((collected.weekly_hours! * 60) / sessionLen);
          
          // Cap at 6 - adjust session length if needed
          if (newSessions > MAX_SESSIONS) {
            const adjustedLength = Math.ceil((collected.weekly_hours! * 60) / MAX_SESSIONS);
            collected.session_length_mins = adjustedLength;
            collected.sessions_per_week = MAX_SESSIONS;
            
            return res.json({
              complete: false,
              message: `${sessionLen}-min sessions would mean ${newSessions} sessions/week which is too many. I've adjusted to ${adjustedLength}-min sessions for ${MAX_SESSIONS} sessions/week. Sound good?`,
              state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
            });
          }
          
          collected.sessions_per_week = newSessions;
          
          return res.json({
            complete: false,
            message: `${sessionLen}-minute sessions it is! That's ${collected.sessions_per_week} sessions per week at ${collected.weekly_hours}h/week. Ready to see your plan?`,
            state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
          });
        }
        
        if (confirmation === 'yes' && collected.weekly_hours && collected.session_length_mins) {
          console.log('✅ Full commitment confirmed, generating preview');
          
          const totalWeeks = collected.total_weeks || calculateWeeks(collected.target_date!);
          const sessionsPerWeek = Math.min(MAX_SESSIONS, collected.sessions_per_week || 
            Math.ceil((collected.weekly_hours * 60) / collected.session_length_mins));
          const totalHours = Math.round(collected.weekly_hours * totalWeeks);
          
          collected.sessions_per_week = sessionsPerWeek;
          collected.total_hours = totalHours;
          collected.total_weeks = totalWeeks;
          
          const [preview, milestones, fitCheck] = await Promise.all([
            generatePreviewWeeks(
              collected.goal_name!,
              collected.category || 'skill',
              sessionsPerWeek,
              collected.weekly_hours,
              totalWeeks,
              []
            ),
            generateMilestones(
              collected.goal_name!,
              collected.category || 'skill',
              totalWeeks,
              totalHours
            ),
            generateFitCheck(user_id, collected.weekly_hours, sessionsPerWeek),
          ]);
          
          const goal = {
            name: collected.goal_name,
            category: collected.category || 'skill',
            target_date: collected.target_date,
            description: collected.goal_description || '',
            current_level: collected.current_level,
            success_condition: collected.success_condition,
          };

          let previewMessage = `Great! Here's your commitment:\n\n`;
          previewMessage += `📅 **Target:** ${collected.target_date}\n`;
          previewMessage += `⏱️ **${collected.weekly_hours}h/week** (${sessionsPerWeek} × ${collected.session_length_mins}min sessions)\n`;
          previewMessage += `📊 **${totalHours}h total** over ${totalWeeks} weeks\n\n`;
          previewMessage += `Here's what your training will look like:\n`;
          previewMessage += formatWeekPreview(preview.week1);
          previewMessage += `\n...\n`;
          previewMessage += formatWeekPreview(preview.midWeek);
          previewMessage += `\n...\n`;
          previewMessage += formatWeekPreview(preview.finalWeek);
          previewMessage += `\n\nSay "looks good" to create your plan, or tell me what to change!`;

          return res.json({
            complete: false,
            message: previewMessage,
            goal,
            milestones,
            preview,
            fit_check: fitCheck,
            weekly_hours: collected.weekly_hours,
            sessions_per_week: sessionsPerWeek,
            session_length_mins: collected.session_length_mins,
            total_hours: totalHours,
            total_weeks: totalWeeks,
            show_schedule_picker: true,
            state: {
              collected,
              question_count: questionCount,
              phase: 'plan_preview',
              history,
              goal,
              milestones,
              preview,
              fit_check: fitCheck,
              weekly_hours: collected.weekly_hours,
              sessions_per_week: sessionsPerWeek,
              session_length_mins: collected.session_length_mins,
              total_hours: totalHours,
              total_weeks: totalWeeks,
            },
          });
        }
      }
      
      if (subPhase === 'hours') {
        return res.json({
          complete: false,
          message: `Does ${collected.weekly_hours}h/week work for you? You can say "yes", "less" if that's too much, or "more" if you want to push harder.`,
          state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'hours', history },
        });
      } else {
        return res.json({
          complete: false,
          message: `Are you good with ${collected.session_length_mins}-minute sessions (${collected.sessions_per_week} per week)? Say "yes" to continue, or "shorter"/"longer" to adjust.`,
          state: { collected, question_count: questionCount, phase: 'commitment_review', sub_phase: 'session_length', history },
        });
      }
    }

    // Build schedule context for the AI
    const scheduleContext = await buildScheduleContext(user_id);

    const recentHistory = history.slice(-6);
    const conversationContext = recentHistory
      .map((h: any) => `${h.role === 'user' ? 'User' : 'Coach'}: ${h.content}`)
      .join('\n');

    const today = new Date();
    const currentDateStr = today.toISOString().split('T')[0];

    // Determine if we have enough info to propose hours
    const hasEnoughForHours = hasEnoughForHoursProposal(collected);
    const forceProposal = questionCount >= 2;
    const shouldProposeHours = hasEnoughForHours || forceProposal;
    const nextField = getNextRequiredField(collected);

    // Get domain knowledge for hour estimates
    let hourEstimate: HourEstimate | null = null;
    if (collected.goal_name && collected.category) {
      hourEstimate = getHourEstimate(collected.goal_name, collected.category, collected.current_level || '');
    }

    const systemPrompt = ELITE_COACH_PROMPT + '\n\n' + scheduleContext;

    const userPrompt = `TODAY'S DATE: ${currentDateStr}

CONVERSATION HISTORY:
${conversationContext}

=== COLLECTED INFO (DO NOT ASK FOR THESE AGAIN) ===
- Goal: ${collected.goal_name || 'Not yet identified'}
- Category: ${collected.category || 'Not determined'}
- Current level: ${collected.current_level || 'Not yet known'}
- Target date: ${collected.target_date || 'Not specified'}
- Timeline: ${collected.timeline || 'Not specified'}
- Weekly hours: ${collected.weekly_hours || 'Not proposed yet'}
- Session length: ${collected.session_length_mins ? collected.session_length_mins + 'min' : 'Not recommended yet'}

${hourEstimate ? `DOMAIN KNOWLEDGE: Recommend ${hourEstimate.weekly_hours_recommended}h/week, ${hourEstimate.notes}. Total: ${hourEstimate.min_hours}-${hourEstimate.max_hours}h over ${hourEstimate.typical_weeks} weeks.` : ''}

QUESTIONS ASKED SO FAR: ${questionCount}
${forceProposal ? '⚠️ MAXIMUM QUESTIONS (2) REACHED - PROPOSE HOURS NOW' : ''}

${shouldProposeHours ? `
=== PROPOSE HOURS NOW ===
You have goal, current level, and timeline. Calculate realistic weekly hours and propose:

Based on domain knowledge, calculate:
- total_hours: Total hours needed to achieve goal
- weekly_hours: Hours per week needed to hit timeline
- session_length_mins: Recommended session length for this activity type
- sessions_per_week: Calculated from weekly_hours / session_length

Present the proposal conversationally:
"To [goal] by [date], you'd need about [X] hours per week. That's [total]h total over [weeks] weeks. Does [X]h/week work for you?"

Return mode: "propose_hours"
` : `
=== ASK ONE QUESTION ===
Missing info: ${nextField || 'none'}
Ask ONE specific question about: ${nextField}

Remember: NEVER ask about which days or what time - user picks that visually.

Return mode: "question"
`}

RESPOND WITH JSON:
{
  "mode": "question" | "propose_hours",
  "message": "Your conversational response",
  "extracted": {
    "goal_name": "if newly identified",
    "category": "if identified",
    "current_level": "if mentioned",
    "success_condition": "the specific achievement"
  },
  "proposal": {
    "weekly_hours": number,
    "session_length_mins": number,
    "sessions_per_week": number,
    "total_hours": number,
    "total_weeks": number
  }
}`;

    console.log('🤖 Calling OpenAI...');
    const startTime = Date.now();
    
    let parsed;
    try {
      parsed = await callOpenAIWithRetry(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { timeoutMs: 25000, retries: 1, maxTokens: 2000, temperature: 0.5 }
      );
      console.log(`✅ OpenAI responded in ${Date.now() - startTime}ms`);
    } catch (openaiErr: any) {
      console.error(`❌ OpenAI error after ${Date.now() - startTime}ms:`, openaiErr.message);
      
      return res.json({
        complete: false,
        message: "I'm thinking slowly today - could you try that again? 🤔",
        state: { collected, question_count: questionCount, phase: 'collecting', history },
      });
    }

    if (parsed.extracted) {
      if (parsed.extracted.goal_name && !collected.goal_name) {
        collected.goal_name = parsed.extracted.goal_name;
      }
      if (parsed.extracted.category && !collected.category) {
        collected.category = parsed.extracted.category;
      }
      if (parsed.extracted.current_level && !collected.current_level) {
        collected.current_level = parsed.extracted.current_level;
      }
      if (parsed.extracted.success_condition && !collected.success_condition) {
        collected.success_condition = parsed.extracted.success_condition;
      }
    }

    if (parsed.mode === 'question' || !parsed.proposal) {
      console.log(`❓ Coach asking question #${questionCount + 1}`);
      return res.json({
        complete: false,
        message: parsed.message,
        state: { collected, question_count: questionCount + 1, phase: 'collecting', history },
      });
    }

    if (parsed.mode === 'propose_hours' && parsed.proposal) {
      console.log('📊 Coach proposed hours commitment');
      
      collected.weekly_hours = parsed.proposal.weekly_hours;
      collected.session_length_mins = parsed.proposal.session_length_mins;
      collected.sessions_per_week = parsed.proposal.sessions_per_week;
      collected.total_hours = parsed.proposal.total_hours;
      collected.total_weeks = parsed.proposal.total_weeks;
      
      return res.json({
        complete: false,
        message: parsed.message,
        state: { collected, question_count: questionCount + 1, phase: 'commitment_review', sub_phase: 'hours', history },
      });
    }

    return res.json({
      complete: false,
      message: parsed.message || "I'd love to help with that goal. Can you tell me more about what you want to achieve?",
      state: { collected, question_count: questionCount + 1, phase: 'collecting', history },
    });

  } catch (error: any) {
    console.error('❌ Goal conversation error:', error);
    return res.status(500).json({
      error: 'Failed to process conversation',
      message: 'Sorry, something went wrong. Can you try rephrasing?',
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      user_id, 
      name, 
      category, 
      target_date, 
      description, 
      success_condition,
      client_request_id  // IdempotentWrite_v1
    } = req.body;

    if (!user_id || !name || !category) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'name', 'category'],
      });
    }

    // IdempotentWrite_v1: If client_request_id provided, use upsert to handle retries
    if (client_request_id) {
      console.log(`🔐 IdempotentWrite_v1: Creating goal with request_id ${client_request_id}`);
      
      // First check if goal already exists with this request_id
      const { data: existingGoal } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user_id)
        .eq('client_request_id', client_request_id)
        .single();
      
      if (existingGoal) {
        console.log(`✅ IdempotentWrite_v1: Returning existing goal ${existingGoal.id} (retry detected)`);
        return res.json({ goal: existingGoal, message: 'Goal already exists (retry)', idempotent_hit: true });
      }
      
      // Create new goal with client_request_id
      const { data: goal, error } = await supabase
        .from('goals')
        .insert({
          user_id,
          name,
          category,
          target_date: target_date || null,
          status: 'active',
          client_request_id,  // IdempotentWrite_v1
          plan: {
            description: description || '',
            success_condition: success_condition || '',
            created_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation gracefully
        if (error.code === '23505') {
          console.log(`⚠️ IdempotentWrite_v1: Unique constraint hit, fetching existing goal`);
          const { data: existingGoal } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', user_id)
            .eq('client_request_id', client_request_id)
            .single();
          
          if (existingGoal) {
            return res.json({ goal: existingGoal, message: 'Goal already exists (constraint)', idempotent_hit: true });
          }
        }
        throw error;
      }

      console.log(`✅ Created goal: ${name} (with idempotency key)`);
      return res.json({ goal, message: 'Goal created successfully' });
    }

    // Fallback: Original behavior without idempotency (for backward compatibility)
    const { data: goal, error } = await supabase
      .from('goals')
      .insert({
        user_id,
        name,
        category,
        target_date: target_date || null,
        status: 'active',
        plan: {
          description: description || '',
          success_condition: success_condition || '',
          created_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Created goal: ${name}`);
    return res.json({ goal, message: 'Goal created successfully' });
    
  } catch (error: any) {
    console.error('❌ Goal creation error:', error);
    return res.status(500).json({ error: 'Failed to create goal', message: error.message });
  }
});

// ============================================================
// UPDATED: /:goalId/create-plan-with-milestones endpoint
// Replace your existing endpoint with this one
// ============================================================

router.post('/:goalId/create-plan-with-milestones', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { 
      milestones, 
      weekly_hours, 
      sessions_per_week, 
      session_length_mins, 
      total_hours, 
      plan_edits, 
      placed_sessions, 
      preview,
      // NEW: Simple sessions mode
      simple_sessions,
      total_sessions,
      preferred_days,
      preferred_time,
    } = req.body;

    console.log(`📋 Creating plan for goal ${goalId}: ${weekly_hours}h/week, ${sessions_per_week} sessions`);
    console.log(`📋 Simple sessions mode: ${simple_sessions}, Total sessions: ${total_sessions}`);

    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (goalError) throw goalError;
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const baseWeekly = Number(weekly_hours) || 5;
    const baseTotal = Number(total_hours) || 50;
    const baseSessions = Math.min(Number(sessions_per_week) || 3, 7);
    const baseSessionLength = Number(session_length_mins) || 60;
    const safeMilestones: any[] = Array.isArray(milestones) ? milestones : [];

    // ============================================================
    // SIMPLE SESSIONS MODE - Skip AI, create generic sessions
    // ============================================================
    if (simple_sessions === true && total_sessions) {
      console.log(`⚡ SIMPLE SESSIONS MODE: Creating ${total_sessions} generic sessions`);
      
      const totalSessionCount = Number(total_sessions);
      const totalWeeks = Math.max(1, Math.ceil(totalSessionCount / baseSessions));
      
      // Create simple plan structure
      const plan: any = {
        weekly_hours: baseWeekly,
        sessions_per_week: baseSessions,
        session_length_mins: baseSessionLength,
        total_estimated_hours: Math.round((totalSessionCount * baseSessionLength) / 60),
        total_weeks: totalWeeks,
        total_sessions: totalSessionCount,
        micro_goals: safeMilestones,
        created_at: new Date().toISOString(),
        custom: true,
        simple_sessions: true,
      };

      // Generate simple weekly plan with "Session 1", "Session 2", etc.
      const simpleWeeks: any[] = [];
      let sessionCounter = 1;
      
      for (let week = 1; week <= totalWeeks && sessionCounter <= totalSessionCount; week++) {
        const weekSessions: any[] = [];
        
        for (let s = 0; s < baseSessions && sessionCounter <= totalSessionCount; s++) {
          weekSessions.push({
            name: `Session ${sessionCounter}`,
            description: 'Follow your training plan',
            duration_mins: baseSessionLength,
            notes: sessionCounter === 1 
              ? 'First session - focus on getting started!' 
              : sessionCounter === totalSessionCount 
                ? 'Final session - you made it!' 
                : 'Keep up the great work!',
            tip: '',
          });
          sessionCounter++;
        }
        
        // Determine phase focus
        const progressPercent = week / totalWeeks;
        let focus = 'Training';
        let phase = 'development';
        if (progressPercent <= 0.25) {
          focus = 'Foundation Building';
          phase = 'foundation';
        } else if (progressPercent <= 0.5) {
          focus = 'Development Phase';
          phase = 'development';
        } else if (progressPercent <= 0.75) {
          focus = 'Advanced Training';
          phase = 'development';
        } else {
          focus = 'Peak Performance';
          phase = 'peak';
        }
        
        simpleWeeks.push({
          week,
          week_number: week,
          focus,
          phase,
          sessions: weekSessions,
        });
      }
      
      plan.weekly_plan = {
        summary: `${totalSessionCount}-session plan for ${goal.name}`,
        realism_notes: 'Simple sessions - follow your external training plan',
        weeks: simpleWeeks,
        milestones: safeMilestones.map((m: any, i: number) => ({
          name: m.name,
          target_week: m.week || m.target_week || Math.round(((i + 1) * totalWeeks) / Math.max(safeMilestones.length, 1)),
          criteria: m.criteria || 'Complete this milestone',
        })),
      };

      console.log(`✅ Simple plan created: ${totalSessionCount} sessions over ${totalWeeks} weeks`);

      // Save plan to goal
      const goalUpdates: any = { 
        plan,
        updated_at: new Date().toISOString(),
      };
      
      // Also save preferred days/time if provided
      if (preferred_days) goalUpdates.preferred_days = preferred_days;
      if (preferred_time) goalUpdates.preferred_time = preferred_time;

      const { error: updateError } = await supabase
        .from('goals')
        .update(goalUpdates)
        .eq('id', goalId);

      if (updateError) {
        console.error('❌ Failed to save simple plan:', updateError);
        throw updateError;
      }

      // Insert milestones if any
      if (safeMilestones.length > 0) {
        const microGoalsToInsert = safeMilestones.map((mg: any, index: number) => ({
          goal_id: goalId,
          name: mg.name || `Milestone ${index + 1}`,
          order_index: index + 1,
          completion_criteria: {
            type: 'performance',
            description: mg.criteria || 'Complete milestone',
            target_week: mg.week || mg.target_week || null,
          },
        }));
        
        await supabase.from('micro_goals').delete().eq('goal_id', goalId);
        await supabase.from('micro_goals').insert(microGoalsToInsert);
      }

// ============================================================
// PASTE THIS CODE in backend/routes/goals.ts
// Inside the "if (simple_sessions === true)" block
// REPLACE the line: if (placed_sessions && placed_sessions.length > 0) {
// WITH all of this code:
// ============================================================
// ============================================================
     // ============================================================
// GOALS.TS - COPY AND PASTE THIS
// ============================================================
// 
// FIND THIS LINE (around line 850):
//     let effectivePlacedSessions = placed_sessions;
//
// SELECT FROM THAT LINE DOWN TO (but not including):
//     // Return success
//     return res.json({
//
// REPLACE WITH EVERYTHING BELOW:
// ============================================================

      let effectivePlacedSessions = placed_sessions;
      
      if (!effectivePlacedSessions || effectivePlacedSessions.length === 0) {
        console.log('⚡ No placed_sessions provided, auto-generating schedule...');
        
        const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const daysToUse = preferred_days?.length > 0 
          ? preferred_days.map((d: string) => d.toLowerCase())
          : allDays.slice(0, Math.min(baseSessions, 5));
        
        const hourMap: Record<string, number> = {
          morning: 8,
          afternoon: 14,
          evening: 18,
          any: 9,
        };
        const baseHour = hourMap[preferred_time || 'any'] || 9;
        
        // Sort days by day-of-week for consistent ordering
        const dayOrder: Record<string, number> = {
          'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
          'thursday': 4, 'friday': 5, 'saturday': 6
        };
        const sortedDays = [...daysToUse].sort((a, b) => dayOrder[a] - dayOrder[b]);
        
        // Generate ONE placement per session per week
        effectivePlacedSessions = [];
        for (let i = 0; i < baseSessions; i++) {
          const dayIndex = i % sortedDays.length;
          const sessionsOnThisDay = effectivePlacedSessions.filter(
            (p: any) => p.day === sortedDays[dayIndex]
          ).length;
          
          effectivePlacedSessions.push({
            day: sortedDays[dayIndex],
            hour: baseHour + (sessionsOnThisDay * 3), // 3 hour gap if multiple on same day
            minute: 0,
            duration_mins: baseSessionLength,
          });
        }
        
        console.log(`✅ Auto-generated ${effectivePlacedSessions.length} weekly placements across ${sortedDays.length} days`);
      }

      // Generate schedule blocks - properly distributed across weeks
      if (effectivePlacedSessions && effectivePlacedSessions.length > 0) {
        console.log(`📅 Generating ${totalSessionCount} schedule blocks`);
        
        const dayMap: Record<string, number> = {
          'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
          'thursday': 4, 'friday': 5, 'saturday': 6
        };
        
        // Sort placements by day order for consistent week-by-week scheduling
        const sortedPlacements = [...effectivePlacedSessions].sort((a: any, b: any) => 
          dayMap[a.day.toLowerCase()] - dayMap[b.day.toLowerCase()]
        );
        
        const blocks: any[] = [];
        let sessionNum = 1;
        let weekOffset = 0;
        
        // Get start of current week (Sunday)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        // Generate sessions week by week
        while (sessionNum <= totalSessionCount && weekOffset < 200) {
          for (const placement of sortedPlacements) {
            if (sessionNum > totalSessionCount) break;
            
            const targetDay = dayMap[placement.day.toLowerCase()];
            
            // Calculate the date for this session
            const sessionDate = new Date(startOfWeek);
            sessionDate.setDate(startOfWeek.getDate() + (weekOffset * 7) + targetDay);
            sessionDate.setHours(placement.hour || 9, placement.minute || 0, 0, 0);
            
            // Only schedule if in the future
            if (sessionDate > new Date()) {
              blocks.push({
                goal_id: goalId,
                user_id: goal.user_id,
                type: 'training',
                scheduled_start: sessionDate.toISOString(),
                duration_mins: placement.duration_mins || baseSessionLength,
                status: 'scheduled',
                notes: `Session ${sessionNum}|||Follow your training plan|||`,
              });
              
              sessionNum++;
            }
          }
          weekOffset++;
        }
        
        if (blocks.length > 0) {
          console.log(`📅 Inserting ${blocks.length} schedule blocks...`);
          
          // Delete any existing blocks for this goal
          await supabase.from('schedule_blocks').delete().eq('goal_id', goalId);
          
          // Insert in batches
          const batchSize = 100;
          for (let i = 0; i < blocks.length; i += batchSize) {
            const batch = blocks.slice(i, i + batchSize);
            const { error: blockError } = await supabase.from('schedule_blocks').insert(batch);
            if (blockError) {
              console.error(`❌ Batch ${i / batchSize + 1} failed:`, blockError);
            }
          }
          
          console.log(`✅ Created ${blocks.length} schedule blocks across ${weekOffset} weeks`);
        }
      }  

      // Return success
      return res.json({
        success: true,
        plan,
        schedule: {
          blocksCreated: total_sessions,
          message: `Created ${total_sessions} simple sessions`,
        },
        message: `Created ${totalSessionCount}-session training plan over ${totalWeeks} weeks`,
      });
    }

    // ============================================================
    // NORMAL AI-GENERATED PLAN (existing code)
    // ============================================================
    
    const totalWeeks = Math.max(1, Math.ceil(baseTotal / baseWeekly));

    console.log(`📊 AI Plan: ${totalWeeks} weeks, ${baseSessions} sessions/week @ ${baseSessionLength}min`);

    const plan: any = {
      weekly_hours: baseWeekly,
      sessions_per_week: baseSessions,
      session_length_mins: baseSessionLength,
      total_estimated_hours: baseTotal,
      total_weeks: totalWeeks,
      micro_goals: safeMilestones,
      created_at: new Date().toISOString(),
      custom: true,
    };

    // ALWAYS use AI to generate unique sessions for EVERY week
// ============================================================
    // CHECK FOR APPROVED PREVIEW FIRST
    // ============================================================
    const hasValidDetailedPreview = preview?.week1?.sessions?.length > 0 &&
      !String(preview.week1.sessions?.[0]?.name || '').match(/^(Session \d+|Training Session|[^-]+ - Session \d+)$/i);

    if (hasValidDetailedPreview) {
      // ✅ USE APPROVED PREVIEW - User already approved these sessions!
      console.log('✅ Using approved preview sessions from frontend');
      console.log('   Week 1 first session:', preview.week1.sessions[0]?.name);
      
      const midWeekNum = Math.ceil(totalWeeks / 2);
      
      // Helper to normalize preview week format
      const normalizePreviewWeek = (w: any, weekNumber: number, defaultFocus: string) => ({
        week: weekNumber,
        week_number: weekNumber,
        focus: w?.focus || defaultFocus,
        phase: weekNumber <= Math.ceil(totalWeeks * 0.3) ? 'foundation' 
             : weekNumber <= Math.ceil(totalWeeks * 0.7) ? 'development' 
             : 'peak',
        sessions: (w?.sessions || []).map((s: any) => ({
          name: s.name,
          description: s.description || '',
          duration_mins: s.duration_mins || baseSessionLength,
          notes: s.notes || s.tip || '',
          tip: s.notes || s.tip || '',
        })),
      });

      // Build all weeks
      const allWeeks: any[] = [];
      
      for (let w = 1; w <= totalWeeks; w++) {
        if (w === 1 && preview.week1?.sessions?.length) {
          allWeeks.push(normalizePreviewWeek(preview.week1, 1, 'Foundation'));
        } else if (w === midWeekNum && preview.midWeek?.sessions?.length) {
          allWeeks.push(normalizePreviewWeek(preview.midWeek, midWeekNum, 'Development'));
        } else if (w === totalWeeks && preview.finalWeek?.sessions?.length) {
          allWeeks.push(normalizePreviewWeek(preview.finalWeek, totalWeeks, 'Peak Performance'));
        } else {
          // Other weeks - interpolate from nearest preview week
          const phase = w <= Math.ceil(totalWeeks * 0.3) ? 'foundation' 
                      : w <= Math.ceil(totalWeeks * 0.7) ? 'development' 
                      : 'peak';
          
          let templateWeek = preview.week1;
          if (w > midWeekNum) {
            templateWeek = preview.finalWeek || preview.midWeek || preview.week1;
          } else if (w > Math.ceil(totalWeeks * 0.3)) {
            templateWeek = preview.midWeek || preview.week1;
          }
          
          allWeeks.push({
            week: w,
            week_number: w,
            focus: templateWeek?.focus || `Week ${w} - ${phase.charAt(0).toUpperCase() + phase.slice(1)}`,
            phase,
            sessions: (templateWeek?.sessions || []).map((s: any) => ({
              name: s.name,
              description: s.description || 'Continue building on your progress',
              duration_mins: s.duration_mins || baseSessionLength,
              notes: s.notes || '',
              tip: s.tip || s.notes || '',
            })),
          });
        }
      }
      
      plan.weekly_plan = {
        summary: `${totalWeeks}-week plan for ${goal.name}`,
        realism_notes: 'Plan uses your approved session structure.',
        weeks: allWeeks,
        milestones: safeMilestones.map((m: any, i: number) => ({
          name: m.name,
          target_week: m.week || m.target_week || Math.round(((i + 1) * totalWeeks) / Math.max(safeMilestones.length, 1)),
          criteria: m.criteria || 'Complete this milestone',
        })),
      };
      
      console.log(`✅ Built plan from approved preview: ${allWeeks.length} weeks`);
      
    } else {
      // 🤖 NO VALID PREVIEW - Generate with AI
      console.log('🤖 No approved preview, generating full AI plan...');
      
      try {
        const fullPlan = await generateFullWeeklyPlan(
          goal.name,
          goal.category || 'skill',
          baseSessions,
          baseWeekly,
          totalWeeks,
          safeMilestones,
          plan_edits
        );
        
        const allWeeks = fullPlan.weeks.map((week: any) => ({
          week: week.week_number,
          week_number: week.week_number,
          focus: week.focus,
          phase: week.week_number <= Math.ceil(totalWeeks * 0.3) ? 'foundation' 
               : week.week_number <= Math.ceil(totalWeeks * 0.7) ? 'development' 
               : 'peak',
          sessions: (week.sessions || []).map((s: any) => ({
            name: s.name,
            description: s.description,
            duration_mins: s.duration_mins || baseSessionLength,
            notes: s.notes || '',
            tip: s.notes || '',
          })),
        }));
        
        plan.weekly_plan = {
          summary: fullPlan.summary,
          realism_notes: fullPlan.realism_notes,
          weeks: allWeeks,
          milestones: fullPlan.milestones || safeMilestones,
        };
        
        console.log(`✅ AI generated ${allWeeks.length} unique weeks`);
        
      } catch (aiError: any) {
        console.error('⚠️ AI plan generation failed, using fallback:', aiError.message);
        
        const midWeekNum = Math.ceil(totalWeeks / 2);
        const fallbackWeeks: any[] = [];
        
        for (let w = 1; w <= totalWeeks; w++) {
          const sessions = Array.from({ length: baseSessions }, (_, i) => ({
            name: `${goal.name} - Week ${w} Session ${i + 1}`,
            description: `Training session for week ${w}`,
            duration_mins: baseSessionLength,
            notes: 'Focus on progress',
          }));
          
          fallbackWeeks.push({
            week: w,
            week_number: w,
            focus: w <= Math.ceil(totalWeeks * 0.3) ? 'Foundation' : w <= Math.ceil(totalWeeks * 0.7) ? 'Development' : 'Peak Performance',
            phase: w <= Math.ceil(totalWeeks * 0.3) ? 'foundation' : w <= Math.ceil(totalWeeks * 0.7) ? 'development' : 'peak',
            sessions,
          });
        }
        
        plan.weekly_plan = {
          summary: `${totalWeeks}-week plan for ${goal.name}`,
          weeks: fallbackWeeks,
          milestones: safeMilestones,
        };
      }
    }





































    console.log('🤖 Generating full AI plan with unique sessions for each week...');
    
    try {
      const fullPlan = await generateFullWeeklyPlan(
        goal.name,
        goal.category || 'skill',
        baseSessions,
        baseWeekly,
        totalWeeks,
        safeMilestones,
        plan_edits
      );
      
      // Convert to expected format
      const allWeeks = fullPlan.weeks.map((week: any) => ({
        week: week.week_number,
        week_number: week.week_number,
        focus: week.focus,
        phase: week.week_number <= Math.ceil(totalWeeks * 0.3) ? 'foundation' 
             : week.week_number <= Math.ceil(totalWeeks * 0.7) ? 'development' 
             : 'peak',
        sessions: (week.sessions || []).map((s: any) => ({
          name: s.name,
          description: s.description,
          duration_mins: s.duration_mins || baseSessionLength,
          notes: s.notes || '',
          tip: s.notes || '',
        })),
      }));
      
      plan.weekly_plan = {
        summary: fullPlan.summary,
        realism_notes: fullPlan.realism_notes,
        weeks: allWeeks,
        milestones: fullPlan.milestones || safeMilestones,
      };
      
      console.log(`✅ AI generated ${allWeeks.length} unique weeks`);
      
    } catch (aiError: any) {
      console.error('⚠️ AI plan generation failed, using fallback:', aiError.message);
      
      // Fallback: use preview if available, otherwise simple fallback
      const midWeekNum = Math.ceil(totalWeeks / 2);
      const hasValidPreview = preview?.week1?.sessions?.length > 0;
      
      const fallbackWeeks: any[] = [];
      for (let w = 1; w <= totalWeeks; w++) {
        let sessions: any[];
        let focus: string;
        
        if (hasValidPreview) {
          // Use preview but try to vary it
          const baseWeek = w <= midWeekNum ? preview.week1 : preview.midWeek;
          if (w === totalWeeks && preview.finalWeek) {
            sessions = preview.finalWeek.sessions;
            focus = preview.finalWeek.focus;
          } else {
            sessions = baseWeek?.sessions || [];
            focus = baseWeek?.focus || `Week ${w}`;
          }
        } else {
          sessions = Array.from({ length: baseSessions }, (_, i) => ({
            name: `${goal.name} - Week ${w} Session ${i + 1}`,
            description: `Training session for week ${w}`,
            duration_mins: baseSessionLength,
            notes: 'Focus on progress',
          }));
          focus = `Week ${w} Training`;
        }
        
        fallbackWeeks.push({
          week: w,
          week_number: w,
          focus,
          phase: w <= Math.ceil(totalWeeks * 0.3) ? 'foundation' : w <= Math.ceil(totalWeeks * 0.7) ? 'development' : 'peak',
          sessions: sessions.map((s: any) => ({
            name: s.name,
            description: s.description,
            duration_mins: s.duration_mins || baseSessionLength,
            notes: s.notes || s.tip || '',
            tip: s.notes || s.tip || '',
          })),
        });
      }
      
      plan.weekly_plan = {
        summary: `${totalWeeks}-week plan for ${goal.name}`,
        weeks: fallbackWeeks,
        milestones: safeMilestones,
      };
      
      console.log(`⚠️ Fallback generated ${fallbackWeeks.length} weeks`);
    }

    const { error: updateError } = await supabase
      .from('goals')
      .update({ plan })
      .eq('id', goalId);

    if (updateError) throw updateError;

    const microGoalsToInsert = safeMilestones.map((mg: any, index: number) => ({
      goal_id: goalId,
      name: mg.name || `Milestone ${index + 1}`,
      order_index: index + 1,
      completion_criteria: {
        type: 'performance',
        description: mg.criteria || 'Complete milestone',
        hours_required: Number(mg.hours) || 0,
        target_week: mg.week || mg.target_week || null,
      },
    }));

    if (microGoalsToInsert.length > 0) {
      await supabase.from('micro_goals').insert(microGoalsToInsert);
    }

    const progress = {
      percent_complete: 0,
      completed_micro_goals: 0,
      total_micro_goals: microGoalsToInsert.length,
      last_updated: new Date().toISOString(),
    };

    await supabase.from('goals').update({ progress }).eq('id', goalId);

    console.log(`✅ Created AI plan: ${baseWeekly}h/week, ${baseSessions} sessions, ${totalWeeks} weeks`);

    const { data: updatedGoal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (updatedGoal) {
      try {
        const apiUrl = process.env.API_URL || 'http://localhost:8080';
        
        let enrichedPlacedSessions = placed_sessions;
        if (placed_sessions && placed_sessions.length > 0 && plan.weekly_plan?.weeks?.length > 0) {
          const firstWeekSessions = plan.weekly_plan.weeks[0]?.sessions || [];
          enrichedPlacedSessions = placed_sessions.map((placement: any, index: number) => {
            const sessionContent = firstWeekSessions[index % firstWeekSessions.length];
            return {
              ...placement,
              name: sessionContent?.name || `${goal.name} Session ${index + 1}`,
              description: sessionContent?.description || 'Training session',
              tip: sessionContent?.tip || sessionContent?.notes || '',
            };
          });
        }
        
        const scheduleResponse = await axios.post(
          `${apiUrl}/api/schedule/generate-for-goal`,
          {
            user_id: goal.user_id,
            goal_id: goalId,
            placed_sessions: enrichedPlacedSessions,
            weekly_plan: plan.weekly_plan,
          }
        );

        const scheduleResult = scheduleResponse.data;
        console.log(`📅 Generated schedule: ${scheduleResult.blocksCreated || 0} blocks`);
        
        return res.json({
          success: true,
          plan,
          schedule: scheduleResult,
          message: `Plan created with ${scheduleResult.blocksCreated || 0} sessions scheduled!`,
        });
      } catch (scheduleErr: any) {
        console.error('⚠️ Schedule generation failed:', scheduleErr.message);
      }
    }

    return res.json({
      success: true,
      plan,
      message: `Plan created: ${baseWeekly}h/week for ${totalWeeks} weeks`,
    });
  } catch (error: any) {
    console.error('❌ Plan creation error:', error);
    return res.status(500).json({ error: 'Failed to create plan', message: error.message });
  }
});



router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, status } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id query parameter' });
    }

    let query = supabase
      .from('goals')
      .select('*, micro_goals (*)')
      .eq('user_id', user_id as string);

    if (status) {
      query = query.eq('status', status as string);
    }

    const { data: goals, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ goals: goals || [], count: goals?.length || 0 });
  } catch (error: any) {
    console.error('❌ Goals fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch goals', message: error.message });
  }
});

router.get('/all-progress', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const { data: sessions, error } = await supabase
      .from('schedule_blocks')
      .select('goal_id, duration_mins, tracked_data')
      .eq('user_id', user_id)
      .eq('status', 'completed')
      .not('goal_id', 'is', null);

    if (error) throw error;

    const progressByGoal: Record<string, { total_sessions: number; total_minutes: number; total_hours: number }> = {};

    (sessions || []).forEach(s => {
      if (!s.goal_id) return;
      
      if (!progressByGoal[s.goal_id]) {
        progressByGoal[s.goal_id] = { total_sessions: 0, total_minutes: 0, total_hours: 0 };
      }
      
      progressByGoal[s.goal_id].total_sessions += 1;
      progressByGoal[s.goal_id].total_minutes += s.duration_mins || 0;
    });

    Object.keys(progressByGoal).forEach(goalId => {
      progressByGoal[goalId].total_hours = Math.round(progressByGoal[goalId].total_minutes / 60 * 10) / 10;
    });

    return res.json({ progress: progressByGoal });
  } catch (error: any) {
    console.error('❌ All progress fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch progress', message: error.message });
  }
});

router.get('/time-budget', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const { data: availability } = await supabase
      .from('users')
      .select('wake_time, sleep_time')
      .eq('id', user_id)
      .single();

    let awakeHoursPerWeek = 112;
    if (availability?.wake_time && availability?.sleep_time) {
      const [wakeH, wakeM] = availability.wake_time.split(':').map(Number);
      const [sleepH, sleepM] = availability.sleep_time.split(':').map(Number);
      const awakeMinutesPerDay = (sleepH * 60 + sleepM) - (wakeH * 60 + wakeM);
      awakeHoursPerWeek = Math.round((awakeMinutesPerDay / 60) * 7 * 10) / 10;
    }

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const { data: blocks } = await supabase
      .from('schedule_blocks')
      .select('type, duration_mins, goal_id')
      .eq('user_id', user_id)
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString());

    let workMins = 0, commuteMins = 0, eventMins = 0, trainingMins = 0;

    (blocks || []).forEach(block => {
      const mins = block.duration_mins || 0;
      switch (block.type) {
        case 'work': workMins += mins; break;
        case 'commute': commuteMins += mins; break;
        case 'event':
        case 'social': eventMins += mins; break;
        default: if (block.goal_id) trainingMins += mins;
      }
    });

    const { data: goals } = await supabase
      .from('goals')
      .select('plan')
      .eq('user_id', user_id)
      .eq('status', 'active');

    const plannedTrainingHours = (goals || []).reduce((sum, g) => sum + (g.plan?.weekly_hours || 0), 0);
    const trainingHours = Math.max(Math.round(trainingMins / 60 * 10) / 10, plannedTrainingHours);

    const workHours = Math.round(workMins / 60 * 10) / 10;
    const commuteHours = Math.round(commuteMins / 60 * 10) / 10;
    const eventHours = Math.round(eventMins / 60 * 10) / 10;
    const committedHours = workHours + commuteHours + eventHours + trainingHours;
    const freeHours = Math.max(0, Math.round((awakeHoursPerWeek - committedHours) * 10) / 10);

    return res.json({
      work_hours: workHours,
      commute_hours: commuteHours,
      event_hours: eventHours,
      training_hours: trainingHours,
      committed_hours: committedHours,
      awake_hours: awakeHoursPerWeek,
      free_hours: freeHours,
    });
  } catch (error: any) {
    console.error('❌ Time budget error:', error);
    return res.status(500).json({ error: 'Failed to calculate time budget', message: error.message });
  }
});

router.patch('/:goalId/intensity', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { intensity } = req.body;

    if (!intensity || !['light', 'standard', 'intense', 'extreme'].includes(intensity)) {
      return res.status(400).json({ error: 'Invalid intensity' });
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .update({ intensity })
      .eq('id', goalId)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, goal, message: `Intensity set to ${intensity}` });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update intensity', message: error.message });
  }
});

router.patch('/:goalId/preferences', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { weekly_hours, sessions_per_week, session_length_mins } = req.body;

    const { data: goal, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (fetchError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const updates: any = {};

    if (weekly_hours !== undefined || sessions_per_week !== undefined || session_length_mins !== undefined) {
      const plan = goal.plan || {};
      if (weekly_hours !== undefined) {
        plan.weekly_hours = weekly_hours;
        if (plan.total_estimated_hours) {
          plan.total_weeks = Math.ceil(plan.total_estimated_hours / weekly_hours);
        }
      }
      if (sessions_per_week !== undefined) {
        plan.sessions_per_week = sessions_per_week;
      }
      if (session_length_mins !== undefined) {
        plan.session_length_mins = session_length_mins;
      }
      updates.plan = plan;
    }

    const { data: updatedGoal, error: updateError } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', goalId)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.json({ success: true, goal: updatedGoal, message: 'Preferences updated' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update preferences', message: error.message });
  }
});

/**
 * PATCH /api/goals/:goalId/resource-link
 * Update resource link for a goal (video, course URL, etc.)
 */
router.patch('/:goalId/resource-link', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { resource_link, resource_link_label } = req.body;

    const { data: goal, error } = await supabase
      .from('goals')
      .update({
        resource_link: resource_link || null,
        resource_link_label: resource_link_label || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .select()
      .single();

    if (error) {
      console.error('Error updating resource link:', error);
      return res.status(500).json({ error: 'Failed to update resource link' });
    }

    console.log(`✅ Updated resource link for goal ${goalId}: ${resource_link || 'removed'}`);
    res.json({ success: true, goal });
  } catch (error: any) {
    console.error('Resource link update error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

router.get('/:goalId/sessions', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { limit = '50' } = req.query;

    const { data: sessions, error } = await supabase
      .from('schedule_blocks')
      .select('id, scheduled_start, duration_mins, status, completed_at, notes, tracked_data')
      .eq('goal_id', goalId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    const totalSessions = sessions?.length || 0;
    const totalMinutes = sessions?.reduce((sum, s) => sum + (s.duration_mins || 0), 0) || 0;
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

    const formattedSessions = sessions?.map(s => {
      const sessionName = s.notes?.split('|||')[0] || 'Training Session';
      return {
        id: s.id,
        name: sessionName,
        scheduled_start: s.scheduled_start,
        completed_at: s.completed_at,
        duration_mins: s.duration_mins,
        tracked_data: s.tracked_data || {},
      };
    }) || [];

    return res.json({
      sessions: formattedSessions,
      aggregates: { total_sessions: totalSessions, total_hours: totalHours, total_minutes: totalMinutes },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch sessions', message: error.message });
  }
});

router.get('/:goalId/schedule', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    const { data: sessions, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('goal_id', goalId)
      .order('scheduled_start', { ascending: true });

    if (error) throw error;

    const sessionsByWeek: Record<number, any[]> = {};
    const today = new Date();

    const { data: goal } = await supabase
      .from('goals')
      .select('created_at')
      .eq('id', goalId)
      .single();

    const goalStart = goal ? new Date(goal.created_at) : today;
    goalStart.setHours(0, 0, 0, 0);

    (sessions || []).forEach(session => {
      const sessionDate = new Date(session.scheduled_start);
      const weekNum = Math.floor((sessionDate.getTime() - goalStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      
      if (!sessionsByWeek[weekNum]) sessionsByWeek[weekNum] = [];
      
      const [name, description, tip] = (session.notes || '|||').split('|||');
      
      sessionsByWeek[weekNum].push({
        ...session,
        parsed_name: name || 'Training Session',
        parsed_description: description || '',
        parsed_tip: tip || '',
        week_number: weekNum,
        is_past: sessionDate < today,
        is_today: sessionDate.toDateString() === today.toDateString(),
      });
    });

    return res.json({
      sessions: sessions || [],
      sessions_by_week: sessionsByWeek,
      total_sessions: sessions?.length || 0,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch schedule', message: error.message });
  }
});

router.delete('/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    await supabase.from('micro_goals').delete().eq('goal_id', goalId);
    await supabase.from('schedule_blocks').delete().eq('goal_id', goalId);

    const { error: deleteError } = await supabase.from('goals').delete().eq('id', goalId);

    if (deleteError) throw deleteError;

    return res.json({ success: true, message: 'Goal deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete goal', message: error.message });
  }
});

router.delete('/:goalId/plan', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    await supabase.from('micro_goals').delete().eq('goal_id', goalId);

    const { error: updateError } = await supabase
      .from('goals')
      .update({ plan: null, progress: null, updated_at: new Date().toISOString() })
      .eq('id', goalId);

    if (updateError) throw updateError;

    return res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete plan', message: error.message });
  }
});

router.post('/:goalId/intensify-preview', async (req: Request, res: Response) => {
  return res.json({ success: false, message: 'Not implemented in this version' });
});

router.post('/:goalId/intensify-apply', async (req: Request, res: Response) => {
  return res.json({ success: false, message: 'Not implemented in this version' });
});

export default router;