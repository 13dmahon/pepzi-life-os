import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai, simpleCompletion } from '../services/openai';
import axios from 'axios';

const router = Router();

// ============================================================
// 🏆 ELITE COACH SYSTEM PROMPT
// ============================================================

const ELITE_COACH_PROMPT = `You are an elite performance coach integrated into Pepzi, a life operating system.

## YOUR PERSONALITY
- Direct but supportive - like a coach who genuinely wants the user to succeed
- Evidence-based - you cite real training principles, not generic advice
- Honest about challenges - you don't sugarcoat unrealistic goals
- Collaborative - you work WITH the user, not lecture them

## CONVERSATION PHASES

### PHASE 1: ACKNOWLEDGE & UNDERSTAND
When user states a goal:
1. Acknowledge their ambition genuinely (1 sentence)
2. Show you understand what this goal REALLY means (the difficulty, what it entails)
3. Identify the BINARY SUCCESS CONDITION (the "unlock" - either achieved or not)
4. Ask 1-2 specific questions about their CURRENT LEVEL

Example response style:
"A sub-20 5K is a serious milestone - that's holding 4:00/km pace for the full distance, which puts you in the top 10% of recreational runners. Let me help you build a plan to get there.

Where are you starting from? What's your current 5K time, and how many times per week are you running right now?"

### PHASE 2: REALITY CHECK
Once you know current level + goal + timeline:
1. Calculate the GAP (where they are vs where they want to be)
2. Assess timeline as REALISTIC, AGGRESSIVE, or UNREALISTIC
3. Be honest but constructive

- REALISTIC: "This is achievable with consistent effort"
- AGGRESSIVE: "This is ambitious - here's what it'll take..."
- UNREALISTIC: "I want to be straight with you - this needs adjustment"

Always explain WHY with specifics, not vague statements.

### PHASE 3: SCHEDULE REALITY CHECK
You'll receive the user's availability context. Use it:
- If capacity exists: "This fits within your available time"
- If tight: "This will use most of your remaining free hours"
- If won't fit: "We have a scheduling challenge - you'd need X hours but only have Y available"

### PHASE 4: BUILD THE PLAN
Propose a SPECIFIC plan with:
1. **Final Milestone**: The binary unlock condition
2. **Total Hours**: CALCULATED based on goal type and gap (NOT a default)
3. **Weekly Hours**: Based on timeline and total (NOT a default 6h)
4. **Sessions Per Week**: Based on what the goal requires (NOT a default 3)
5. **Training Structure**: What types of sessions/activities are needed
6. **Key Milestones**: 3-6 checkpoints with specific criteria

Then ask: "Does this commitment level work for you?"

### PHASE 5: NEGOTIATE
If user wants changes:
- Fewer hours → Timeline extends (explain tradeoff)
- Shorter timeline → More hours needed (check capacity)
- Can't do required sessions → Suggest alternatives or adjust goal

### PHASE 6: CONFIRM
Final summary with exact numbers:
- Goal (binary success condition)
- X hours/week for Y weeks
- Z sessions per week
- Total: N hours
- Fits within their W remaining hours of capacity

## GOAL-SPECIFIC KNOWLEDGE

### RUNNING
- Beginner to completing 5K: 8-12 weeks, 3-4 runs/week, 3-4h/week, ~30-40h total
- 5K time improvement (10%): 6-8 weeks, 4 runs/week, 4-5h/week, ~35-45h total
- 5K time improvement (20%+): 12-16 weeks, 4-5 runs/week, 5-6h/week, ~70-90h total
- Sub-20 5K: Requires 40-45km/week base, 5-6 runs/week, serious commitment
- Marathon: 16-20 weeks, 4-5 runs/week, 6-10h/week, ~100-150h total

### STRENGTH & PHYSIQUE
- Beginner strength foundations: 12 weeks, 3 sessions/week, 3-4h/week, ~40-50h total
- Muscle building (noticeable): 16-24 weeks, 4 sessions/week, 5-6h/week, ~80-120h total
- Specific lift goals (e.g., 100kg bench): Highly dependent on current level, typically 12-24 weeks
- Bodybuilder physique: 6-12+ months, 5-6 sessions/week, 8-10h/week

### SKILL ACQUISITION (General)
- Basic proficiency: 20-50 hours
- Intermediate competence: 100-300 hours
- Advanced level: 500-1000 hours
- Expert/Professional: 1000-5000+ hours
- Key: Frequency beats duration (daily practice > weekly cramming)

### LANGUAGES
Difficulty tiers (for English speakers):
- Tier 1 (Spanish, French, Italian): 400-600 hours to conversational (B1/B2)
- Tier 2 (German, Indonesian): 600-750 hours
- Tier 3 (Russian, Hindi, Vietnamese): 900-1100 hours
- Tier 4 (Japanese, Mandarin, Korean, Arabic): 1500-2200 hours

Structure: Daily practice essential. 30-60min/day, 5-7 days/week is optimal.
Mix: Vocabulary (apps) + Grammar (study) + Listening (media) + Speaking (tutors)

### BUSINESS & SIDE PROJECTS
- MVP launch: 50-200 hours depending on complexity
- First paying customer: 100-300 hours (includes learning + building + marketing)
- £500 MRR: 6-12 months, 10-20h/week, highly variable
- £5K MRR: 12-24 months typically for first-timers
- Key: Consistency and iteration matter more than hours

### CLIMBING
- Beginner to V3: 3-6 months, 2-3 sessions/week, focus on technique
- V3 to V5: 6-12 months, 3 sessions/week, add fingerboard
- V5 to V7: 12-24 months, 3-4 sessions/week, structured training blocks

## RESPONSE STYLE RULES
1. Be conversational, not bullet points (unless showing a plan)
2. One main question or topic per response
3. Keep responses focused and under 200 words unless presenting a full plan
4. Be warm but professional
5. Use specific numbers, not vague ranges

## CRITICAL RULES
1. NEVER use generic defaults - always calculate based on the specific goal
2. ALWAYS factor in their schedule capacity when proposing hours
3. ALWAYS identify the binary "unlock" condition
4. Be HONEST about unrealistic timelines - it's kinder long-term
5. Ask about CURRENT LEVEL before proposing any plan
`;

// ============================================================
// 🆕 TRACKING METRICS BY CATEGORY
// ============================================================

const TRACKING_METRICS: Record<string, { default: string[]; optional: string[] }> = {
  fitness: {
    default: ['duration_mins', 'effort_level'],
    optional: ['distance_km', 'time_mins', 'heart_rate', 'pain_notes', 'weight_kg', 'reps', 'sets'],
  },
  languages: {
    default: ['duration_mins', 'effort_level'],
    optional: ['new_vocabulary_count', 'conversation_mins', 'lessons_completed'],
  },
  business: {
    default: ['duration_mins', 'tasks_completed'],
    optional: ['revenue', 'users', 'meetings_held', 'blockers'],
  },
  climbing: {
    default: ['duration_mins', 'effort_level'],
    optional: ['highest_grade', 'problems_sent', 'attempts', 'pain_notes'],
  },
  creative: {
    default: ['duration_mins', 'output_count'],
    optional: ['words_written', 'pieces_created', 'practice_quality'],
  },
  skill: {
    default: ['duration_mins', 'effort_level'],
    optional: ['exercises_completed', 'new_concepts_learned'],
  },
  default: {
    default: ['duration_mins', 'effort_level'],
    optional: ['notes'],
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build schedule context from user's availability and existing goals
 */
async function buildScheduleContext(userId: string): Promise<string> {
  try {
    const { data: availability } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: goals } = await supabase
      .from('goals')
      .select('name, plan, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!availability) {
      return `
USER SCHEDULE: Not yet configured.
Ask if they'd like to set up their weekly availability first, or proceed with goal planning.`;
    }

    const freeHours = availability.total_free_hours_per_week || 0;
    let committedHours = 0;
    const goalBreakdown: string[] = [];

    if (goals && goals.length > 0) {
      goals.forEach((g: any) => {
        const weeklyHours = g.plan?.weekly_hours || 0;
        committedHours += weeklyHours;
        if (weeklyHours > 0) {
          goalBreakdown.push(`  - ${g.name}: ${weeklyHours}h/week`);
        }
      });
    }

    const remainingCapacity = freeHours - committedHours;

    let context = `
USER'S WEEKLY SCHEDULE:
- Total free hours available: ${freeHours}h/week
- Already committed to goals: ${committedHours}h/week
- REMAINING CAPACITY: ${remainingCapacity}h/week`;

    if (goalBreakdown.length > 0) {
      context += `

Current goal commitments:
${goalBreakdown.join('\n')}`;
    }

    if (remainingCapacity < 3) {
      context += `

⚠️ WARNING: User has very limited capacity (${remainingCapacity}h). New goals may require reducing existing commitments or extending timelines significantly.`;
    } else if (remainingCapacity < 10) {
      context += `

⚠️ CAUTION: User has limited remaining capacity. Be mindful when proposing weekly hours.`;
    } else if (remainingCapacity > 30) {
      context += `

✅ User has good capacity available for new goals.`;
    }

    return context;
  } catch (error) {
    console.error('Error building schedule context:', error);
    return 'USER SCHEDULE: Unable to fetch - proceed with goal planning.';
  }
}

/**
 * Generate preview weeks for plan review
 */
async function generatePreviewWeeks(
  goalName: string,
  category: string,
  sessionsPerWeek: number,
  weeklyHours: number,
  totalWeeks: number,
  milestones: any[]
): Promise<{ week1: any; midWeek: any; finalWeek: any }> {
  const midWeekNum = Math.ceil(totalWeeks / 2);
  
  const prompt = `Create detailed training sessions for 3 specific weeks of a ${totalWeeks}-week plan.

GOAL: ${goalName}
CATEGORY: ${category}
SESSIONS PER WEEK: ${sessionsPerWeek}
HOURS PER WEEK: ${weeklyHours}
TOTAL WEEKS: ${totalWeeks}

MILESTONES:
${milestones.map((m: any) => `- Week ${m.week || m.target_week}: ${m.name}`).join('\n')}

Generate sessions for:
1. WEEK 1 (Foundation) - Building basics, establishing habits
2. WEEK ${midWeekNum} (Development) - Increased intensity, building on foundations
3. WEEK ${totalWeeks} (Peak/Taper) - Final preparation for the goal

For each week, create ${sessionsPerWeek} sessions with:
- Specific activity names (not "Session 1")
- Clear descriptions
- Duration in minutes
- Helpful coaching tips

Return JSON:
{
  "week1": {
    "week_number": 1,
    "focus": "Foundation phase focus (5-10 words)",
    "sessions": [
      {
        "name": "Specific session name",
        "description": "What to do",
        "duration_mins": 60,
        "notes": "Coaching tip"
      }
    ]
  },
  "midWeek": {
    "week_number": ${midWeekNum},
    "focus": "Development phase focus",
    "sessions": [...]
  },
  "finalWeek": {
    "week_number": ${totalWeeks},
    "focus": "Peak/taper phase focus",
    "sessions": [...]
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert ${category} coach creating detailed, progressive training plans. Be specific and practical.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content returned');

    return JSON.parse(content);
  } catch (error: any) {
    console.error('⚠️ Preview generation failed:', error.message);
    const placeholder = (weekNum: number, focus: string) => ({
      week_number: weekNum,
      focus,
      sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
        name: `Session ${i + 1}`,
        description: 'Training session',
        duration_mins: Math.round((weeklyHours * 60) / sessionsPerWeek),
        notes: 'Focus on consistency',
      })),
    });
    return {
      week1: placeholder(1, 'Building foundations'),
      midWeek: placeholder(midWeekNum, 'Development phase'),
      finalWeek: placeholder(totalWeeks, 'Peak preparation'),
    };
  }
}

/**
 * Format week preview for chat display
 */
function formatWeekPreview(week: any): string {
  let output = `\n📅 **Week ${week.week_number}** - ${week.focus}\n`;
  week.sessions.forEach((session: any, i: number) => {
    const isLast = i === week.sessions.length - 1;
    output += `${isLast ? '└──' : '├──'} **${session.name}** (${session.duration_mins}min)\n`;
    output += `${isLast ? '    ' : '│   '} ${session.description}\n`;
    if (session.notes) {
      output += `${isLast ? '    ' : '│   '} 💡 ${session.notes}\n`;
    }
  });
  return output;
}

/**
 * Apply edits to preview weeks based on user request
 */
async function applyPlanEdits(
  currentPreview: { week1: any; midWeek: any; finalWeek: any },
  editRequest: string,
  goalName: string,
  category: string
): Promise<{ updatedPreview: { week1: any; midWeek: any; finalWeek: any }; editSummary: string }> {
  const prompt = `You are editing a training plan based on user feedback.

CURRENT PLAN:
${JSON.stringify(currentPreview, null, 2)}

USER'S EDIT REQUEST: "${editRequest}"

Apply the user's requested changes to ALL weeks (not just one).
Common requests:
- "Change X to Y" → Replace that session type across all weeks
- "Make it push/pull/legs" → Restructure sessions to follow that split
- "Add more rest" → Add rest days or reduce intensity
- "Shorter sessions" → Reduce duration

Return JSON:
{
  "updatedPreview": {
    "week1": { ... updated week with changes ... },
    "midWeek": { ... updated week with changes ... },
    "finalWeek": { ... updated week with changes ... }
  },
  "editSummary": "Brief description of what was changed (1 sentence)"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert ${category} coach helping customize a training plan for ${goalName}. Apply edits consistently across all weeks.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content returned');

    return JSON.parse(content);
  } catch (error: any) {
    console.error('⚠️ Edit application failed:', error.message);
    return {
      updatedPreview: currentPreview,
      editSummary: 'Could not apply edit - please try rephrasing',
    };
  }
}

/**
 * Generate a batch of weeks for the training plan
 */
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
  const milestonesInRange = milestones.filter((m: any) => {
    const targetWeek = m.week || m.target_week;
    return targetWeek && targetWeek >= startWeek && targetWeek <= endWeek;
  });

  const editInstructions = planEdits?.editInstructions || '';

  const prompt = `Create detailed weekly training sessions for weeks ${startWeek}-${endWeek} of a ${totalWeeks}-week plan.

GOAL: ${goalName}
CATEGORY: ${category}
SESSIONS PER WEEK: ${sessionsPerWeek}
HOURS PER WEEK: ${weeklyHours}
${previousWeekFocus ? `PREVIOUS WEEK FOCUS: ${previousWeekFocus} (build on this)` : 'This is the start of the program.'}
${editInstructions ? `\nUSER CUSTOMIZATIONS TO APPLY:\n${editInstructions}` : ''}

MILESTONES IN THIS RANGE:
${milestonesInRange.length > 0 ? milestonesInRange.map((m: any) => `- Week ${m.week || m.target_week}: ${m.name}`).join('\n') : 'None in this range'}

PHASE CONTEXT:
${startWeek <= Math.ceil(totalWeeks * 0.25) ? '- FOUNDATION PHASE: Focus on basics, form, fundamentals' : ''}
${startWeek > Math.ceil(totalWeeks * 0.25) && startWeek <= Math.ceil(totalWeeks * 0.6) ? '- DEVELOPMENT PHASE: Build intensity, add complexity' : ''}
${startWeek > Math.ceil(totalWeeks * 0.6) && startWeek <= Math.ceil(totalWeeks * 0.85) ? '- PEAK PHASE: High intensity, specific preparation' : ''}
${startWeek > Math.ceil(totalWeeks * 0.85) ? '- TAPER/FINAL PHASE: Reduce volume, maintain intensity, prepare for goal' : ''}

Create DETAILED sessions with:
- Specific activity names (not generic like "Session 1")
- Clear descriptions (1-2 sentences)
- Duration in minutes
- Helpful tips or notes

Return JSON:
{
  "weeks": [
    {
      "week_number": ${startWeek},
      "focus": "What this week focuses on (5-10 words)",
      "sessions": [
        {
          "name": "Specific session name",
          "description": "1-2 sentence description of what to do",
          "duration_mins": 60,
          "notes": "Helpful tip or thing to watch for"
        }
      ]
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert ${category} coach creating detailed, progressive training plans. 
Be specific and practical. Each session should feel like real coaching advice.
Include helpful tips that show expertise.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.weeks || [];
  } catch (error: any) {
    console.error(`⚠️ Failed to generate weeks ${startWeek}-${endWeek}:`, error.message);
    return [];
  }
}

/**
 * Generate complete weekly training plan using batched requests
 */
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
  console.log(`📅 Generating ${totalWeeks}-week training plan in batches...`);
  if (planEdits?.editInstructions) {
    console.log(`  📝 Applying user customizations: ${planEdits.editInstructions}`);
  }

  const BATCH_SIZE = 4;
  const RETRY_BATCH_SIZE = 2;
  const allWeeks: any[] = [];
  let previousWeekFocus: string | undefined;

  for (let startWeek = 1; startWeek <= totalWeeks; startWeek += BATCH_SIZE) {
    const endWeek = Math.min(startWeek + BATCH_SIZE - 1, totalWeeks);
    console.log(`  🔄 Generating weeks ${startWeek}-${endWeek}...`);

    let batchWeeks = await generateWeekBatch(
      goalName,
      category,
      sessionsPerWeek,
      weeklyHours,
      startWeek,
      endWeek,
      totalWeeks,
      milestones,
      previousWeekFocus,
      planEdits
    );

    if (batchWeeks.length === 0 && endWeek - startWeek + 1 > RETRY_BATCH_SIZE) {
      console.log(`  🔁 Retrying with smaller batches (${RETRY_BATCH_SIZE} weeks at a time)...`);
      
      for (let retryStart = startWeek; retryStart <= endWeek; retryStart += RETRY_BATCH_SIZE) {
        const retryEnd = Math.min(retryStart + RETRY_BATCH_SIZE - 1, endWeek);
        console.log(`    🔄 Retry: weeks ${retryStart}-${retryEnd}...`);
        
        const retryWeeks = await generateWeekBatch(
          goalName,
          category,
          sessionsPerWeek,
          weeklyHours,
          retryStart,
          retryEnd,
          totalWeeks,
          milestones,
          previousWeekFocus,
          planEdits
        );
        
        if (retryWeeks.length > 0) {
          batchWeeks.push(...retryWeeks);
          const lastWeek = retryWeeks[retryWeeks.length - 1];
          previousWeekFocus = lastWeek?.focus;
          console.log(`    ✅ Retry succeeded: ${retryWeeks.length} weeks`);
        } else {
          console.log(`    ⚠️ Retry failed, creating placeholders for weeks ${retryStart}-${retryEnd}`);
          for (let w = retryStart; w <= retryEnd; w++) {
            batchWeeks.push({
              week_number: w,
              focus: `Week ${w} training`,
              sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
                name: `Session ${i + 1}`,
                description: 'Training session - details to be added',
                duration_mins: Math.round((weeklyHours * 60) / sessionsPerWeek),
                notes: 'Focus on consistency',
              })),
            });
          }
        }
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (batchWeeks.length > 0) {
      allWeeks.push(...batchWeeks);
      const lastWeek = batchWeeks[batchWeeks.length - 1];
      previousWeekFocus = lastWeek?.focus;
      console.log(`  ✅ Generated ${batchWeeks.length} weeks`);
    } else {
      console.log(`  ⚠️ Batch returned empty, creating placeholder weeks`);
      for (let w = startWeek; w <= endWeek; w++) {
        allWeeks.push({
          week_number: w,
          focus: `Week ${w} training`,
          sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
            name: `Session ${i + 1}`,
            description: 'Training session - details to be added',
            duration_mins: Math.round((weeklyHours * 60) / sessionsPerWeek),
            notes: 'Focus on consistency',
          })),
        });
      }
    }

    if (endWeek < totalWeeks) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const summary = `Progressive ${totalWeeks}-week training plan for ${goalName}. 
${sessionsPerWeek} sessions per week, ${weeklyHours} hours total weekly commitment.
${milestones.length} key milestones to track progress.`;

  const mappedMilestones = milestones.map((m: any, i: number) => ({
    name: m.name,
    target_week: m.week || m.target_week || Math.round(((i + 1) * totalWeeks) / milestones.length),
    criteria: m.criteria || 'Complete this milestone',
  }));

  console.log(`✅ Generated complete plan: ${allWeeks.length} weeks`);

  return {
    weeks: allWeeks,
    summary,
    realism_notes: `This ${totalWeeks}-week plan is designed for progressive development. Adjust intensity based on how you feel. Rest is important - don't skip recovery.`,
    milestones: mappedMilestones,
  };
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/goals/from-dreams
 * Extract goals from free-form text
 */
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

Return JSON in this exact format:
{
  "goals": [
    {
      "name": "Goal name (specific and measurable)",
      "category": "fitness|business|skill|languages|career|travel|education|financial|creative|social|health|mental_health|climbing",
      "description": "Brief description",
      "target_date": "YYYY-MM-DD or null",
      "priority": "high|medium|low"
    }
  ]
}

Only return valid JSON, no other text.`;

    const response = await simpleCompletion(prompt);

    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '');
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

/**
 * POST /api/goals/conversation
 * Elite Coach conversational goal creation
 */
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

    const phase = conversation_state?.phase || 'collecting';

    const scheduleContext = await buildScheduleContext(user_id);

    // PHASE: TRACKING_CONTRACT
    if (phase === 'tracking_contract' && conversation_state?.goal) {
      const lower = message.toLowerCase();
      
      const userAccepts = /\b(yes|yeah|yep|ok|okay|looks good|sounds good|perfect|fine|happy|that's fine|works|good|confirm|ready|let's go|create|do it|thanks|thank you|cheers|great|awesome|brilliant|that's great|love it|done)\b/.test(lower);

      if (userAccepts) {
        console.log('✅ User accepted tracking contract – ready to create goal');
        
        return res.json({
          complete: true,
          goal: conversation_state.goal,
          milestones: conversation_state.milestones,
          tracking_criteria: conversation_state.tracking_metrics || [],
          weekly_hours: conversation_state.weekly_hours,
          total_hours: conversation_state.total_hours,
          sessions_per_week: conversation_state.sessions_per_week,
          plan_edits: conversation_state.plan_edits,
          message: `🎉 Excellent! Creating your "${conversation_state.goal.name}" plan now with your customizations...\n\nI'll track: ${(conversation_state.tracking_metrics || []).join(', ')}\n\nLet's make it happen!`,
          state: {
            ...conversation_state,
            phase: 'done',
            history,
          },
        });
      }

      const category = conversation_state.goal.category || 'default';
      const metrics = TRACKING_METRICS[category] || TRACKING_METRICS.default;
      const allAvailableMetrics = [...metrics.default, ...metrics.optional];

      const modifyPrompt = `User wants to modify what metrics to track for their ${category} goal.
      
Current proposed metrics: ${JSON.stringify(conversation_state.tracking_metrics)}
ALL VALID METRICS (you MUST only use keys from this list): ${JSON.stringify(allAvailableMetrics)}

User said: "${message}"

Update the tracking metrics based on their request. IMPORTANT: Only use metric keys from the "ALL VALID METRICS" list above.
If they want to add something, find the closest matching key from the list. If they want to remove something, remove it.

Return JSON:
{
  "message": "Your response confirming the changes and listing the final metrics",
  "tracking_metrics": ["duration_mins", "effort_level"]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are an elite coach helping set up progress tracking. Be helpful and concise.' },
          { role: 'user', content: modifyPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return res.json({
        complete: false,
        message: parsed.message,
        state: {
          ...conversation_state,
          tracking_metrics: parsed.tracking_metrics,
          phase: 'tracking_contract',
          history,
        },
      });
    }

    // PHASE: PLAN_PREVIEW
    if (phase === 'plan_preview' && conversation_state?.goal && conversation_state?.preview) {
      const lower = message.toLowerCase();
      
      const userAccepts = /\b(yes|yeah|yep|ok|okay|looks good|sounds good|perfect|fine|happy|that's good|that works|good to go|ready|let's go|thanks|thank you|cheers|great|awesome|brilliant|that's great|love it|done)\b/.test(lower);

      if (userAccepts) {
        console.log('✅ User accepted plan preview – moving to tracking contract');

        const category = conversation_state.goal.category || 'default';
        const metrics = TRACKING_METRICS[category] || TRACKING_METRICS.default;
        const defaultMetrics = [...metrics.default];

        let trackingQuestion = `Perfect! Your training plan is locked in. 🔒\n\n`;
        trackingQuestion += `**One last thing** - let's set up progress tracking.\n\n`;
        trackingQuestion += `For ${category} goals, I'd typically ask after each session:\n`;
        defaultMetrics.forEach(m => {
          const label = m.replace(/_/g, ' ').replace(/mins?$/i, '(minutes)').replace(/km$/i, '(km)');
          trackingQuestion += `• ${label}\n`;
        });
        trackingQuestion += `\nOptional extras I could track: ${metrics.optional.map(m => m.replace(/_/g, ' ')).join(', ')}\n\n`;
        trackingQuestion += `Is this good, or would you like to add/remove anything?`;

        return res.json({
          complete: false,
          message: trackingQuestion,
          state: {
            ...conversation_state,
            tracking_metrics: defaultMetrics,
            phase: 'tracking_contract',
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
        state: {
          ...conversation_state,
          preview: updatedPreview,
          plan_edits: planEdits,
          phase: 'plan_preview',
          history,
        },
      });
    }

    // PHASE: REVIEW
    if (
      phase === 'review' &&
      conversation_state?.goal &&
      conversation_state?.milestones
    ) {
      const lower = message.toLowerCase();

      const userAccepts =
        /\b(yes|yeah|yep|ok|okay|looks good|sounds good|perfect|fine|happy|love it|works for me|that's good|that works|agree|let's do it|go ahead|confirm|proceed|thanks|thank you|cheers|great|awesome|brilliant|that's great|done)\b/.test(
          lower
        );

      if (userAccepts) {
        console.log('✅ User accepted commitment – generating plan preview');

        const totalWeeks = conversation_state.total_weeks || Math.ceil((conversation_state.total_hours || 50) / (conversation_state.weekly_hours || 5));
        
        const preview = await generatePreviewWeeks(
          conversation_state.goal.name,
          conversation_state.goal.category,
          conversation_state.sessions_per_week || 3,
          conversation_state.weekly_hours || 5,
          totalWeeks,
          conversation_state.milestones || []
        );

        let previewMessage = `Great! Let me show you what your training will look like:\n`;
        previewMessage += formatWeekPreview(preview.week1);
        previewMessage += `\n...\n`;
        previewMessage += formatWeekPreview(preview.midWeek);
        previewMessage += `\n...\n`;
        previewMessage += formatWeekPreview(preview.finalWeek);
        previewMessage += `\n\n📝 **Want to customize anything?** You can say things like:\n`;
        previewMessage += `• "Change intervals to hill sprints"\n`;
        previewMessage += `• "Make it push/pull/legs"\n`;
        previewMessage += `• "Shorter sessions"\n`;
        previewMessage += `• "Add more rest days"\n\n`;
        previewMessage += `Or if this looks good, just say "looks good" to continue!`;

        return res.json({
          complete: false,
          message: previewMessage,
          preview,
          state: {
            ...conversation_state,
            preview,
            total_weeks: totalWeeks,
            phase: 'plan_preview',
            history,
          },
        });
      }

      console.log('♻️ User requested changes to plan');

      const updatePrompt = `You are an elite performance coach. The user wants to modify their plan.

CURRENT PLAN:
${JSON.stringify(conversation_state, null, 2)}

${scheduleContext}

USER'S FEEDBACK: "${message}"

Update the plan based on their feedback. Remember:
- If they want FEWER hours/week → extend the timeline (more weeks)
- If they want SHORTER timeline → increase hours/week (check capacity)
- If they want MORE or FEWER sessions per week → adjust accordingly
- If they want different milestones → adjust accordingly
- Always recalculate total_hours based on weekly_hours × weeks

Respond with JSON only:
{
  "message": "Your conversational response explaining the updated plan and asking if they're happy with it",
  "state": {
    "goal": {
      "name": "Goal name",
      "category": "category",
      "target_date": "YYYY-MM-DD",
      "description": "Description",
      "current_level": "Their starting point",
      "success_condition": "The binary unlock condition"
    },
    "milestones": [
      { "name": "Specific milestone", "hours": 20, "week": 4 }
    ],
    "tracking_criteria": ["duration_mins", "effort_level"],
    "weekly_hours": number,
    "sessions_per_week": number,
    "total_hours": number,
    "total_weeks": number
  }
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are an elite coach helping refine a training plan. Respond with JSON only.',
          },
          { role: 'user', content: updatePrompt },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return res.json({
        complete: false,
        message: parsed.message,
        goal: parsed.state?.goal,
        milestones: parsed.state?.milestones || [],
        tracking_criteria: parsed.state?.tracking_criteria || [],
        weekly_hours: parsed.state?.weekly_hours,
        sessions_per_week: parsed.state?.sessions_per_week,
        total_hours: parsed.state?.total_hours,
        state: {
          ...(parsed.state || {}),
          phase: 'review',
          history,
        },
      });
    }

    // PHASE: COLLECTING
    const knownInfo = {
      goal_name: conversation_state?.goal_name || null,
      current_level: conversation_state?.current_level || null,
      timeline: conversation_state?.timeline || null,
      category: conversation_state?.category || null,
      success_condition: conversation_state?.success_condition || null,
    };

    console.log('📊 Known info:', knownInfo);

    const conversationContext = history
      .map((h: any) => `${h.role === 'user' ? 'User' : 'Coach'}: ${h.content}`)
      .join('\n');

    const systemPrompt = ELITE_COACH_PROMPT + '\n\n' + scheduleContext;

    const today = new Date();
    const currentDateStr = today.toISOString().split('T')[0];
    const currentDateReadable = today.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const userPrompt = `TODAY'S DATE: ${currentDateReadable} (${currentDateStr})
Use this date to calculate accurate target_date values. For example, if user says "3 months", add 3 months to today's date.

CONVERSATION SO FAR:
${conversationContext}

INFORMATION GATHERED:
- Goal: ${knownInfo.goal_name || 'Not yet identified'}
- Current level: ${knownInfo.current_level || 'Not yet asked'}
- Timeline: ${knownInfo.timeline || 'Not yet specified'}
- Category: ${knownInfo.category || 'Not yet determined'}
- Success condition: ${knownInfo.success_condition || 'Not yet defined'}

YOUR TASK:
Based on the conversation, decide what to do next:

1. If you DON'T have enough info yet (missing goal clarity, current level, or timeline):
   → Ask a specific question to fill the most important gap
   → Return mode: "question"

2. If you HAVE enough info to propose a plan:
   → Create a complete, calculated plan (NOT generic defaults)
   → Present it conversationally and ask if it works for them
   → Return mode: "plan"

RESPOND WITH JSON:
{
  "mode": "question" or "plan",
  "message": "Your conversational response (as the elite coach)",
  "state": {
    "goal_name": "if identified",
    "current_level": "if known",
    "timeline": "if specified",
    "category": "fitness|business|skill|languages|career|travel|education|financial|creative|social|health|mental_health|climbing",
    "success_condition": "the binary unlock condition",
    
    // ONLY include these if mode is "plan":
    "goal": {
      "name": "Specific goal name",
      "category": "category",
      "target_date": "YYYY-MM-DD",
      "description": "What this goal means",
      "current_level": "Starting point",
      "success_condition": "Binary unlock condition"
    },
    "milestones": [
      { "name": "Specific measurable milestone", "hours": calculated_hours, "week": target_week }
    ],
    "tracking_criteria": ["duration_mins", "effort_level"],
    "weekly_hours": calculated_number,
    "sessions_per_week": calculated_number,
    "total_hours": calculated_number,
    "total_weeks": calculated_number
  }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (parsed.mode === 'question' || !parsed.state?.goal) {
      const state = {
        goal_name: parsed.state?.goal_name ?? knownInfo.goal_name,
        current_level: parsed.state?.current_level ?? knownInfo.current_level,
        timeline: parsed.state?.timeline ?? knownInfo.timeline,
        category: parsed.state?.category ?? knownInfo.category,
        success_condition:
          parsed.state?.success_condition ?? knownInfo.success_condition,
        phase: 'collecting',
        history,
      };

      console.log('❓ Coach asking follow-up question');
      return res.json({
        complete: false,
        message: parsed.message,
        state,
      });
    }

    if (parsed.state?.goal && parsed.state?.milestones) {
      console.log('📋 Coach proposed plan for review');

      return res.json({
        complete: false,
        message: parsed.message,
        goal: parsed.state.goal,
        milestones: parsed.state.milestones,
        tracking_criteria: parsed.state.tracking_criteria || [],
        weekly_hours: parsed.state.weekly_hours,
        sessions_per_week: parsed.state.sessions_per_week,
        total_hours: parsed.state.total_hours,
        state: {
          ...parsed.state,
          phase: 'review',
          history,
        },
      });
    }

    return res.json({
      complete: false,
      message:
        parsed.message ||
        "I'd love to help you with that goal. Could you tell me more about what you want to achieve?",
      state: {
        phase: 'collecting',
        history,
      },
    });
  } catch (error: any) {
    console.error('❌ Goal conversation error:', error);
    return res.status(500).json({
      error: 'Failed to process conversation',
      message: 'Sorry, something went wrong. Can you try rephrasing?',
    });
  }
});

/**
 * POST /api/goals
 * Create a new goal
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      name,
      category,
      target_date,
      description,
      success_condition,
      preferred_days,
      preferred_time,
    } = req.body;

    if (!user_id || !name || !category) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'name', 'category'],
      });
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .insert({
        user_id,
        name,
        category,
        target_date: target_date || null,
        status: 'active',
        preferred_days: preferred_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        preferred_time: preferred_time || 'any',
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

    return res.json({
      goal,
      message: 'Goal created successfully',
    });
  } catch (error: any) {
    console.error('❌ Goal creation error:', error);
    return res.status(500).json({
      error: 'Failed to create goal',
      message: error.message,
    });
  }
});

/**
 * POST /api/goals/:goalId/create-plan-with-milestones
 * Create training plan with BATCHED weekly plan generation
 */
router.post(
  '/:goalId/create-plan-with-milestones',
  async (req: Request, res: Response) => {
    try {
      const { goalId } = req.params;
      const {
        milestones,
        weekly_hours,
        sessions_per_week,
        total_hours,
        tracking_criteria,
        plan_edits,
      } = req.body;

      console.log(
        `📋 Creating plan for goal ${goalId}: ${weekly_hours}h/week, ${sessions_per_week} sessions`
      );
      if (plan_edits?.editInstructions) {
        console.log(`  📝 With customizations: ${plan_edits.editInstructions}`);
      }

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
      const baseSessions = Number(sessions_per_week) || 3;
      const totalWeeks = Math.max(1, Math.ceil(baseTotal / baseWeekly));
      const safeMilestones: any[] = Array.isArray(milestones) ? milestones : [];

      console.log(`📊 Plan: ${totalWeeks} weeks, ${baseSessions} sessions/week, ${baseWeekly}h/week`);

      const plan: any = {
        weekly_hours: baseWeekly,
        sessions_per_week: baseSessions,
        total_estimated_hours: baseTotal,
        total_weeks: totalWeeks,
        micro_goals: safeMilestones,
        tracking_criteria: Array.isArray(tracking_criteria) ? tracking_criteria : [],
        created_at: new Date().toISOString(),
        custom: true,
      };

      try {
        const weeklyPlan = await generateFullWeeklyPlan(
          goal.name,
          goal.category,
          baseSessions,
          baseWeekly,
          totalWeeks,
          safeMilestones,
          plan_edits
        );

        plan.weekly_plan = weeklyPlan;
        console.log(`✅ Generated ${weeklyPlan.weeks.length} weeks of detailed training`);
      } catch (weeklyErr: any) {
        console.error('⚠️ Weekly plan generation failed:', weeklyErr.message);
        
        plan.weekly_plan = {
          summary: `Progressive ${totalWeeks}-week training plan for ${goal.name}`,
          realism_notes: 'Detailed weekly breakdown could not be generated. Follow your milestones as a guide.',
          weeks: [],
          milestones: safeMilestones.map((m: any, i: number) => ({
            name: m.name,
            target_week: m.week || m.target_week || Math.round(((i + 1) * totalWeeks) / (safeMilestones.length || 1)),
            criteria: m.criteria || 'Complete this milestone',
          })),
        };
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
        const { error: microError } = await supabase
          .from('micro_goals')
          .insert(microGoalsToInsert);

        if (microError) {
          console.error('⚠️ Micro-goals insert error (non-fatal):', microError);
        }
      }

      const progress = {
        percent_complete: 0,
        completed_micro_goals: 0,
        total_micro_goals: microGoalsToInsert.length,
        last_updated: new Date().toISOString(),
      };

      await supabase.from('goals').update({ progress }).eq('id', goalId);

      console.log(
        `✅ Created plan: ${baseWeekly}h/week, ${baseSessions} sessions, ${totalWeeks} weeks, ${safeMilestones.length} milestones`
      );

      const { data: updatedGoal } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .single();

      if (updatedGoal) {
        try {
          const apiUrl = process.env.API_URL || 'http://localhost:8080';
          const scheduleResponse = await axios.post(
            `${apiUrl}/api/schedule/generate-for-goal`,
            {
              user_id: goal.user_id,
              goal_id: goalId,
              preferred_days: updatedGoal.preferred_days,
              preferred_time: updatedGoal.preferred_time,
            }
          );

          const scheduleResult = scheduleResponse.data;
          console.log(`📅 Auto-generated schedule: ${scheduleResult.blocksCreated || 0} blocks`);
          
          return res.json({
            success: true,
            plan,
            schedule: scheduleResult,
            message: `Training plan created and ${scheduleResult.blocksCreated || 0} sessions scheduled!`,
          });
        } catch (scheduleErr: any) {
          console.error('⚠️ Schedule generation failed (non-fatal):', scheduleErr.message);
        }
      }

      return res.json({
        success: true,
        plan,
        message: `Training plan created: ${baseWeekly}h/week for ${totalWeeks} weeks`,
      });
    } catch (error: any) {
      console.error('❌ Plan creation error:', error);
      return res.status(500).json({
        error: 'Failed to create plan',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/goals
 * Get user's goals
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, status } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id query parameter',
      });
    }

    let query = supabase
      .from('goals')
      .select(
        `
        *,
        micro_goals (*)
      `
      )
      .eq('user_id', user_id as string);

    if (status) {
      query = query.eq('status', status as string);
    }

    const { data: goals, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;

    return res.json({
      goals: goals || [],
      count: goals?.length || 0,
    });
  } catch (error: any) {
    console.error('❌ Goals fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch goals',
      message: error.message,
    });
  }
});

/**
 * GET /api/goals/all-progress
 * Get session aggregates for all user's goals
 */
router.get('/all-progress', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`📊 Fetching progress for all goals of user ${user_id}`);

    const { data: sessions, error } = await supabase
      .from('schedule_blocks')
      .select('goal_id, duration_mins, tracked_data')
      .eq('user_id', user_id)
      .eq('status', 'completed')
      .not('goal_id', 'is', null);

    if (error) throw error;

    const progressByGoal: Record<string, {
      total_sessions: number;
      total_minutes: number;
      total_hours: number;
    }> = {};

    (sessions || []).forEach(s => {
      if (!s.goal_id) return;
      
      if (!progressByGoal[s.goal_id]) {
        progressByGoal[s.goal_id] = {
          total_sessions: 0,
          total_minutes: 0,
          total_hours: 0,
        };
      }
      
      progressByGoal[s.goal_id].total_sessions += 1;
      progressByGoal[s.goal_id].total_minutes += s.duration_mins || 0;
    });

    Object.keys(progressByGoal).forEach(goalId => {
      progressByGoal[goalId].total_hours = 
        Math.round(progressByGoal[goalId].total_minutes / 60 * 10) / 10;
    });

    console.log(`✅ Calculated progress for ${Object.keys(progressByGoal).length} goals`);

    return res.json({ progress: progressByGoal });
  } catch (error: any) {
    console.error('❌ All progress fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch progress',
      message: error.message,
    });
  }
});

// ============================================================
// 🆕 PHASE 2: TIME BUDGET ENDPOINT
// ============================================================

/**
 * GET /api/goals/time-budget
 * Get weekly time breakdown: work, commute, events, training, free
 */
router.get('/time-budget', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`📊 Calculating time budget for user ${user_id}`);

    // Get user availability for awake hours
    const { data: availability } = await supabase
      .from('user_availability')
      .select('wake_time, sleep_time')
      .eq('user_id', user_id)
      .single();

    // Calculate awake hours per week
    let awakeHoursPerWeek = 112; // Default: 16h * 7 days
    if (availability?.wake_time && availability?.sleep_time) {
      const [wakeH, wakeM] = availability.wake_time.split(':').map(Number);
      const [sleepH, sleepM] = availability.sleep_time.split(':').map(Number);
      const awakeMinutesPerDay = (sleepH * 60 + sleepM) - (wakeH * 60 + wakeM);
      awakeHoursPerWeek = Math.round((awakeMinutesPerDay / 60) * 7 * 10) / 10;
    }

    // Get this week's date range
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get schedule blocks for this week
    const { data: blocks } = await supabase
      .from('schedule_blocks')
      .select('type, duration_mins, goal_id')
      .eq('user_id', user_id)
      .gte('scheduled_start', startOfWeek.toISOString())
      .lt('scheduled_start', endOfWeek.toISOString());

    // Calculate hours by type
    let workMins = 0;
    let commuteMins = 0;
    let eventMins = 0;
    let trainingMins = 0;

    (blocks || []).forEach(block => {
      const mins = block.duration_mins || 0;
      switch (block.type) {
        case 'work':
          workMins += mins;
          break;
        case 'commute':
          commuteMins += mins;
          break;
        case 'event':
        case 'social':
          eventMins += mins;
          break;
        default:
          if (block.goal_id) {
            trainingMins += mins;
          }
      }
    });

    // Also get training hours from goals (in case schedule hasn't been generated)
    const { data: goals } = await supabase
      .from('goals')
      .select('plan')
      .eq('user_id', user_id)
      .eq('status', 'active');

    const plannedTrainingHours = (goals || []).reduce((sum, g) => sum + (g.plan?.weekly_hours || 0), 0);

    // Use the higher of scheduled or planned training
    const trainingHours = Math.max(
      Math.round(trainingMins / 60 * 10) / 10,
      plannedTrainingHours
    );

    const workHours = Math.round(workMins / 60 * 10) / 10;
    const commuteHours = Math.round(commuteMins / 60 * 10) / 10;
    const eventHours = Math.round(eventMins / 60 * 10) / 10;
    const committedHours = workHours + commuteHours + eventHours + trainingHours;
    const freeHours = Math.max(0, Math.round((awakeHoursPerWeek - committedHours) * 10) / 10);

    console.log(`✅ Time budget: ${workHours}h work, ${commuteHours}h commute, ${eventHours}h events, ${trainingHours}h training, ${freeHours}h free`);

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
    return res.status(500).json({
      error: 'Failed to calculate time budget',
      message: error.message,
    });
  }
});

// ============================================================
// 🆕 PHASE 2: GOAL INTENSITY & PREFERENCES
// ============================================================

/**
 * PATCH /api/goals/:goalId/intensity
 * Update goal intensity level
 */
router.patch('/:goalId/intensity', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { intensity } = req.body;

    if (!intensity || !['light', 'standard', 'intense', 'extreme'].includes(intensity)) {
      return res.status(400).json({
        error: 'Invalid intensity. Must be: light, standard, intense, or extreme',
      });
    }

    console.log(`🔥 Updating intensity for goal ${goalId} to ${intensity}`);

    const { data: goal, error } = await supabase
      .from('goals')
      .update({ intensity })
      .eq('id', goalId)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      goal,
      message: `Intensity set to ${intensity}`,
    });
  } catch (error: any) {
    console.error('❌ Intensity update error:', error);
    return res.status(500).json({
      error: 'Failed to update intensity',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/goals/:goalId/preferences
 * Update goal scheduling preferences (days, hours, sessions)
 */
router.patch('/:goalId/preferences', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { preferred_days, weekly_hours, sessions_per_week, preferred_time } = req.body;

    console.log(`⚙️ Updating preferences for goal ${goalId}`);

    // Get current goal
    const { data: goal, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (fetchError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Build updates
    const updates: any = {};
    
    if (preferred_days) {
      updates.preferred_days = preferred_days;
    }
    
    if (preferred_time) {
      updates.preferred_time = preferred_time;
    }

    // Update plan if hours/sessions changed
    if (weekly_hours !== undefined || sessions_per_week !== undefined) {
      const plan = goal.plan || {};
      if (weekly_hours !== undefined) {
        plan.weekly_hours = weekly_hours;
        // Recalculate total weeks
        if (plan.total_estimated_hours) {
          plan.total_weeks = Math.ceil(plan.total_estimated_hours / weekly_hours);
        }
      }
      if (sessions_per_week !== undefined) {
        plan.sessions_per_week = sessions_per_week;
      }
      updates.plan = plan;
    }

    // Update goal
    const { data: updatedGoal, error: updateError } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', goalId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Calculate new target date if weekly hours changed
    let newTargetDate = goal.target_date;
    if (weekly_hours !== undefined && updatedGoal.plan?.total_estimated_hours) {
      const totalWeeks = Math.ceil(updatedGoal.plan.total_estimated_hours / weekly_hours);
      const startDate = new Date(goal.created_at);
      newTargetDate = new Date(startDate);
      newTargetDate.setDate(startDate.getDate() + totalWeeks * 7);
      
      await supabase
        .from('goals')
        .update({ target_date: newTargetDate.toISOString().split('T')[0] })
        .eq('id', goalId);
    }

    return res.json({
      success: true,
      goal: updatedGoal,
      new_target_date: newTargetDate,
      message: 'Preferences updated',
    });
  } catch (error: any) {
    console.error('❌ Preferences update error:', error);
    return res.status(500).json({
      error: 'Failed to update preferences',
      message: error.message,
    });
  }
});

/**
 * POST /api/goals/:goalId/intensify-preview
 * Generate a preview of intensified sessions (doesn't save)
 */
router.post('/:goalId/intensify-preview', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    console.log(`🔥 Generating intensify preview for goal ${goalId}`);

    // Get goal
    const { data: goal, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (fetchError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Get future scheduled sessions (limit to 6 for preview)
    const today = new Date();
    const { data: futureSessions, error: sessionsError } = await supabase
      .from('schedule_blocks')
      .select('id, duration_mins, notes, scheduled_start')
      .eq('goal_id', goalId)
      .eq('status', 'scheduled')
      .gt('scheduled_start', today.toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(6);

    if (sessionsError) throw sessionsError;

    if (!futureSessions || futureSessions.length === 0) {
      return res.json({
        success: false,
        message: 'No future sessions to intensify',
        preview: [],
      });
    }

    // Parse current sessions
    const currentSessions = futureSessions.map(s => {
      const [name, description, tip] = (s.notes || '|||').split('|||');
      return {
        id: s.id,
        name: name || 'Training Session',
        description: description || '',
        tip: tip || '',
        duration_mins: s.duration_mins,
        scheduled_start: s.scheduled_start,
      };
    });

    // Use AI to generate intensified versions
    const prompt = `You are an elite ${goal.category} coach. Intensify these training sessions to be 20% more challenging.

GOAL: ${goal.name}
CATEGORY: ${goal.category}

CURRENT SESSIONS:
${currentSessions.map((s, i) => `${i + 1}. "${s.name}" (${s.duration_mins} min)
   Description: ${s.description}
   Tip: ${s.tip}`).join('\n\n')}

For each session, create an INTENSIFIED version that:
- Has a more challenging name (e.g., "Easy Run" → "Tempo Run with Hills")
- Has harder description (more reps, heavier weight, faster pace, longer holds, etc.)
- Has a motivating tip that pushes them
- Is 10-20% longer in duration

Return JSON:
{
  "intensified": [
    {
      "original_id": "session id",
      "name": "Intensified session name",
      "description": "Harder description with specific numbers",
      "tip": "Motivating tip",
      "duration_mins": increased_duration
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert coach who knows how to progressively intensify training. Be specific with numbers and targets.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const intensified = parsed.intensified || [];

    // Build preview with before/after
    const preview = currentSessions.map((current, i) => {
      const intense = intensified[i] || {
        name: `Intense ${current.name}`,
        description: `${current.description} - Push harder!`,
        tip: 'Give it your all!',
        duration_mins: Math.round(current.duration_mins * 1.15),
      };

      return {
        id: current.id,
        before: {
          name: current.name,
          description: current.description,
          tip: current.tip,
          duration_mins: current.duration_mins,
        },
        after: {
          name: intense.name,
          description: intense.description,
          tip: intense.tip,
          duration_mins: intense.duration_mins,
        },
      };
    });

    // Count total future sessions
    const { count } = await supabase
      .from('schedule_blocks')
      .select('*', { count: 'exact', head: true })
      .eq('goal_id', goalId)
      .eq('status', 'scheduled')
      .gt('scheduled_start', today.toISOString());

    console.log(`✅ Generated preview for ${preview.length} sessions`);

    return res.json({
      success: true,
      preview,
      total_sessions: count || futureSessions.length,
      message: `Preview of ${preview.length} sessions (${count} total will be updated)`,
    });

  } catch (error: any) {
    console.error('❌ Intensify preview error:', error);
    return res.status(500).json({
      error: 'Failed to generate preview',
      message: error.message,
    });
  }
});

/**
 * POST /api/goals/:goalId/intensify-apply
 * Apply intensified sessions (saves to database)
 */
router.post('/:goalId/intensify-apply', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { preview } = req.body; // Array of { id, after: { name, description, tip, duration_mins } }

    if (!preview || !Array.isArray(preview)) {
      return res.status(400).json({ error: 'Missing preview data' });
    }

    console.log(`🔥 Applying intensified sessions for goal ${goalId}`);

    // Get goal for category
    const { data: goal, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (fetchError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Get ALL future sessions (not just preview)
    const today = new Date();
    const { data: allFutureSessions, error: sessionsError } = await supabase
      .from('schedule_blocks')
      .select('id, duration_mins, notes, scheduled_start')
      .eq('goal_id', goalId)
      .eq('status', 'scheduled')
      .gt('scheduled_start', today.toISOString())
      .order('scheduled_start', { ascending: true });

    if (sessionsError) throw sessionsError;

    // Update sessions that were in preview
    const previewIds = new Set(preview.map((p: any) => p.id));
    let updatedCount = 0;

    for (const p of preview) {
      const notes = `${p.after.name}|||${p.after.description}|||🔥 ${p.after.tip}`;
      
      const { error: updateError } = await supabase
        .from('schedule_blocks')
        .update({
          duration_mins: p.after.duration_mins,
          notes,
        })
        .eq('id', p.id);

      if (!updateError) updatedCount++;
    }

    // For remaining sessions not in preview, apply 15% intensity increase
    const remainingSessions = (allFutureSessions || []).filter(s => !previewIds.has(s.id));
    
    for (const session of remainingSessions) {
      const [name, description, tip] = (session.notes || '|||').split('|||');
      const newDuration = Math.round(session.duration_mins * 1.15);
      const newNotes = `${name}|||${description}|||🔥 INTENSIFIED: ${tip || 'Push harder!'}`;

      const { error: updateError } = await supabase
        .from('schedule_blocks')
        .update({
          duration_mins: newDuration,
          notes: newNotes,
        })
        .eq('id', session.id);

      if (!updateError) updatedCount++;
    }

    // Update goal intensity level
    await supabase
      .from('goals')
      .update({ intensity: 'intense' })
      .eq('id', goalId);

    console.log(`✅ Applied intensification to ${updatedCount} sessions`);

    return res.json({
      success: true,
      sessions_updated: updatedCount,
      message: `🔥 Intensified ${updatedCount} sessions! Let's go!`,
    });

  } catch (error: any) {
    console.error('❌ Intensify apply error:', error);
    return res.status(500).json({
      error: 'Failed to apply intensification',
      message: error.message,
    });
  }
});

/**
 * GET /api/goals/:goalId/sessions
 * Get completed sessions with tracked data for a goal
 */
router.get('/:goalId/sessions', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { limit = '50' } = req.query;

    console.log(`📊 Fetching sessions for goal ${goalId}`);

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

    const effortValues = sessions
      ?.map(s => s.tracked_data?.effort_level || s.tracked_data?.effort)
      .filter(e => e !== undefined && e !== null) || [];
    const avgEffort = effortValues.length > 0
      ? Math.round(effortValues.reduce((a, b) => a + b, 0) / effortValues.length * 10) / 10
      : null;

    const distanceValues = sessions
      ?.map(s => s.tracked_data?.distance_km || s.tracked_data?.distance)
      .filter(d => d !== undefined && d !== null) || [];
    const totalDistance = distanceValues.length > 0
      ? Math.round(distanceValues.reduce((a, b) => a + b, 0) * 10) / 10
      : null;

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

    console.log(`✅ Found ${totalSessions} sessions, ${totalHours}h total`);

    return res.json({
      sessions: formattedSessions,
      aggregates: {
        total_sessions: totalSessions,
        total_hours: totalHours,
        total_minutes: totalMinutes,
        avg_effort: avgEffort,
        total_distance_km: totalDistance,
      },
    });
  } catch (error: any) {
    console.error('❌ Sessions fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch sessions',
      message: error.message,
    });
  }
});

/**
 * GET /api/goals/:goalId/schedule
 * Get ALL scheduled sessions for a goal (past, present, future)
 */
router.get('/:goalId/schedule', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    console.log(`📅 Fetching full schedule for goal ${goalId}`);

    const { data: sessions, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('goal_id', goalId)
      .order('scheduled_start', { ascending: true });

    if (error) throw error;

    // Group by week
    const sessionsByWeek: Record<number, any[]> = {};
    const today = new Date();
    
    // Get goal start date
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
      
      if (!sessionsByWeek[weekNum]) {
        sessionsByWeek[weekNum] = [];
      }
      
      // Parse notes into name/description/tip
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

    console.log(`✅ Found ${sessions?.length || 0} sessions across ${Object.keys(sessionsByWeek).length} weeks`);

    return res.json({
      sessions: sessions || [],
      sessions_by_week: sessionsByWeek,
      total_sessions: sessions?.length || 0,
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
 * DELETE /api/goals/:goalId
 * Delete a goal and all associated data
 */
router.delete('/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    console.log(`🗑️ Deleting goal ${goalId} completely`);

    await supabase.from('micro_goals').delete().eq('goal_id', goalId);
    await supabase.from('schedule_blocks').delete().eq('goal_id', goalId);

    const { error: deleteError } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId);

    if (deleteError) throw deleteError;

    console.log(`✅ Deleted goal ${goalId} completely`);

    return res.json({
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Goal deletion error:', error);
    return res.status(500).json({
      error: 'Failed to delete goal',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/goals/:goalId/plan
 * Delete training plan and micro-goals for a goal
 */
router.delete('/:goalId/plan', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    console.log(`🗑️ Deleting plan for goal ${goalId}`);

    await supabase.from('micro_goals').delete().eq('goal_id', goalId);

    const { error: updateError } = await supabase
      .from('goals')
      .update({
        plan: null,
        progress: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId);

    if (updateError) throw updateError;

    console.log(`✅ Deleted plan for goal ${goalId}`);

    return res.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Plan deletion error:', error);
    return res.status(500).json({
      error: 'Failed to delete plan',
      message: error.message,
    });
  }
});

export default router;