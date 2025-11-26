import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai, simpleCompletion } from '../services/openai';

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

### CAREER & PROMOTIONS
- Skill gap closure: 5-10h/week on learning, 3-6 months
- Promotion (same company): 6-18 months, depends on review cycles
- Job search (same field): 5-10h/week, 2-4 months typical
- Career change: 6-24 months including retraining
- Key questions: Manager awareness? Skill gaps? Visibility?

### TRAVEL & ADVENTURES
- Trip planning (1-week vacation): 5-15 hours total
- Major trip planning (multi-week): 15-30 hours
- Adventure prep (e.g., Kilimanjaro): 8-12 weeks fitness prep, 4-6h/week
- Saving for travel: Convert £ target to weekly savings milestone

### EDUCATION & CERTIFICATIONS
- Online course completion: 10-100 hours depending on course
- Professional certs (AWS, PMP): 50-150 hours study
- Major certifications (CPA): 300-400 hours
- Key: 1h/day beats 7h on weekends for retention

### CREATIVE PROJECTS
- Writing a book (first draft): 50,000-80,000 words, 100-160 days at 500 words/day
- Learning instrument (basic songs): 50-100 hours, daily practice essential
- Learning instrument (intermediate): 300-500 hours
- YouTube/content: 5-20 hours per video, consistency > quality initially

### FINANCIAL GOALS
- Convert money goals to time: £10,000 savings at £500/month = 20 months
- Track weekly/monthly milestones
- Debt payoff: Calculate payoff date at current rate, optimize

### MENTAL HEALTH & WELLBEING
IMPORTANT: You are a coach, not a therapist. For clinical issues, always encourage professional support.

Focus on HABITS that support mental health:
- Exercise: 3-5x/week, 30+ min (strong evidence for mood)
- Sleep: Consistent schedule, 7-9 hours
- Mindfulness: Start with 10 min/day, build up
- Social connection: Regular scheduled contact
- Routine: Structure and predictability

Approach: "Let's build habits that support your wellbeing. Are you working with a therapist? They should guide the overall approach - I can help you stay consistent with daily habits."

If user mentions self-harm or severe symptoms: Provide crisis resources and strongly encourage professional help immediately.

### SOCIAL & RELATIONSHIPS
- Making friends: Attend 2-3 social events/week, 4-6h/week
- Deepening relationships: Schedule quality time, 2-4h/week
- Dating: Active effort 3-5h/week (apps, events, dates)
- Key: Consistency over intensity, show up regularly

### HEALTH (Non-Fitness)
- Weight loss (sustainable): 0.5-1kg/week, diet is primary driver
- Quitting smoking: Track days smoke-free, expect multiple attempts
- Sleep improvement: Focus on consistent wake time, wind-down routine
- Note: Medical advice from doctors, not Pepzi

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
 * Generate a batch of weeks for the training plan
 * @param goalName - Name of the goal
 * @param category - Goal category
 * @param sessionsPerWeek - Number of sessions per week
 * @param weeklyHours - Hours per week
 * @param startWeek - Starting week number (1-indexed)
 * @param endWeek - Ending week number (inclusive)
 * @param totalWeeks - Total weeks in the full plan
 * @param milestones - Array of milestones
 * @param previousWeekFocus - Focus of the last week from previous batch (for continuity)
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
  previousWeekFocus?: string
): Promise<any[]> {
  const milestonesInRange = milestones.filter((m: any) => {
    const targetWeek = m.week || m.target_week;
    return targetWeek && targetWeek >= startWeek && targetWeek <= endWeek;
  });

  const prompt = `Create detailed weekly training sessions for weeks ${startWeek}-${endWeek} of a ${totalWeeks}-week plan.

GOAL: ${goalName}
CATEGORY: ${category}
SESSIONS PER WEEK: ${sessionsPerWeek}
HOURS PER WEEK: ${weeklyHours}
${previousWeekFocus ? `PREVIOUS WEEK FOCUS: ${previousWeekFocus} (build on this)` : 'This is the start of the program.'}

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
      max_tokens: 4000, // ✅ INCREASED from 2500 to handle more sessions
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
 * This handles plans of ANY length by generating in 4-week chunks
 * ✅ Includes retry logic with smaller batches on failure
 */
async function generateFullWeeklyPlan(
  goalName: string,
  category: string,
  sessionsPerWeek: number,
  weeklyHours: number,
  totalWeeks: number,
  milestones: any[]
): Promise<{
  weeks: any[];
  summary: string;
  realism_notes: string;
  milestones: any[];
}> {
  console.log(`📅 Generating ${totalWeeks}-week training plan in batches...`);

  const BATCH_SIZE = 4; // ✅ REDUCED from 8 to 4 weeks (prevents token overflow)
  const RETRY_BATCH_SIZE = 2; // If 4-week batch fails, try 2 weeks at a time
  const allWeeks: any[] = [];
  let previousWeekFocus: string | undefined;

  // Generate weeks in batches
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
      previousWeekFocus
    );

    // ✅ RETRY LOGIC: If batch failed, try smaller chunks
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
          previousWeekFocus
        );
        
        if (retryWeeks.length > 0) {
          batchWeeks.push(...retryWeeks);
          const lastWeek = retryWeeks[retryWeeks.length - 1];
          previousWeekFocus = lastWeek?.focus;
          console.log(`    ✅ Retry succeeded: ${retryWeeks.length} weeks`);
        } else {
          // Create placeholder for failed retry weeks
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
        
        // Small delay between retry batches
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (batchWeeks.length > 0) {
      allWeeks.push(...batchWeeks);
      // Get last week's focus for continuity
      const lastWeek = batchWeeks[batchWeeks.length - 1];
      previousWeekFocus = lastWeek?.focus;
      console.log(`  ✅ Generated ${batchWeeks.length} weeks`);
    } else {
      console.log(`  ⚠️ Batch returned empty, creating placeholder weeks`);
      // Create placeholder weeks if batch fails completely
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

    // Small delay between batches to avoid rate limiting
    if (endWeek < totalWeeks) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Generate summary
  const summary = `Progressive ${totalWeeks}-week training plan for ${goalName}. 
${sessionsPerWeek} sessions per week, ${weeklyHours} hours total weekly commitment.
${milestones.length} key milestones to track progress.`;

  // Map milestones with target weeks
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
      "category": "fitness|business|skill|languages|career|travel|education|financial|creative|social|health|mental_health",
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

    const phase: 'collecting' | 'review' | 'done' =
      conversation_state?.phase || 'collecting';

    const scheduleContext = await buildScheduleContext(user_id);

    // ============================================================
    // PHASE: REVIEW – user is looking at a proposed plan
    // ============================================================
    if (
      phase === 'review' &&
      conversation_state?.goal &&
      conversation_state?.milestones
    ) {
      const lower = message.toLowerCase();

      const userAccepts =
        /\b(yes|yeah|yep|ok|okay|looks good|sounds good|perfect|fine|happy|love it|works for me|that's good|that works|agree|let's do it|go ahead|confirm|proceed)\b/.test(
          lower
        );

      if (userAccepts) {
        const goal = conversation_state.goal;
        const milestones = conversation_state.milestones;
        const tracking_criteria = conversation_state.tracking_criteria || [];
        const weekly_hours = conversation_state.weekly_hours;
        const total_hours = conversation_state.total_hours;
        const sessions_per_week = conversation_state.sessions_per_week;

        console.log('✅ User accepted plan – ready to create goal');

        return res.json({
          complete: true,
          goal,
          milestones,
          tracking_criteria,
          weekly_hours,
          total_hours,
          sessions_per_week,
          message: `🎉 Excellent! I'll create your "${goal.name}" plan now.\n\n📋 **Commitment Summary:**\n- ${weekly_hours} hours/week\n- ${sessions_per_week} sessions/week\n- ${milestones.length} milestones to track\n- Target: ${goal.target_date}\n\nLet's make it happen!`,
          state: {
            ...conversation_state,
            phase: 'done',
            history,
          },
        });
      }

      // User wants changes
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
    "tracking_criteria": ["metric1", "metric2"],
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

    // ============================================================
    // PHASE: COLLECTING – Elite Coach conversation
    // ============================================================

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

    const userPrompt = `CONVERSATION SO FAR:
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
    "category": "fitness|business|skill|languages|career|travel|education|financial|creative|social|health|mental_health",
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
    "tracking_criteria": ["What to measure"],
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
 * ✅ NO WEEK LIMIT - handles any duration
 * ✅ High quality detailed sessions
 * ✅ Robust error handling with retry logic
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
      } = req.body;

      console.log(
        `📋 Creating plan for goal ${goalId}: ${weekly_hours}h/week, ${sessions_per_week} sessions`
      );

      // Get goal details
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .single();

      if (goalError) throw goalError;
      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      // Normalise numbers
      const baseWeekly = Number(weekly_hours) || 5;
      const baseTotal = Number(total_hours) || 50;
      const baseSessions = Number(sessions_per_week) || 3;
      const totalWeeks = Math.max(1, Math.ceil(baseTotal / baseWeekly));
      const safeMilestones: any[] = Array.isArray(milestones) ? milestones : [];

      console.log(`📊 Plan: ${totalWeeks} weeks, ${baseSessions} sessions/week, ${baseWeekly}h/week`);

      // Create base plan object
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

      // Generate full weekly plan using batched requests
      try {
        const weeklyPlan = await generateFullWeeklyPlan(
          goal.name,
          goal.category,
          baseSessions,
          baseWeekly,
          totalWeeks,
          safeMilestones
        );

        plan.weekly_plan = weeklyPlan;
        console.log(`✅ Generated ${weeklyPlan.weeks.length} weeks of detailed training`);
      } catch (weeklyErr: any) {
        console.error('⚠️ Weekly plan generation failed:', weeklyErr.message);
        
        // Fallback plan
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

      // Save plan to goal
      const { error: updateError } = await supabase
        .from('goals')
        .update({ plan })
        .eq('id', goalId);

      if (updateError) throw updateError;

      // Insert micro-goals
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

      // Initialize progress
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