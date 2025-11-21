import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { simpleCompletion } from '../services/openai';

const router = Router();

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
        required: ['user_id', 'text']
      });
    }

    console.log(`🎯 Extracting goals from dreams for user ${user_id}`);

    const prompt = `Extract goals from this text and return as JSON array.

Text: "${text}"

Return JSON in this exact format:
{
  "goals": [
    {
      "name": "Goal name",
      "category": "fitness|money|skill|social|travel|habit|experience",
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
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const parsed = JSON.parse(cleanResponse);
    const goals = parsed.goals || [];

    console.log(`✅ Extracted ${goals.length} goals`);

    return res.json({
      goals,
      message: `Found ${goals.length} goals. Review and confirm to save.`
    });

  } catch (error: any) {
    console.error('❌ Goal extraction error:', error);
    return res.status(500).json({
      error: 'Failed to extract goals',
      message: error.message
    });
  }
});

/**
 * POST /api/goals
 * Create a new goal
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, name, category, target_date, description } = req.body;

    if (!user_id || !name || !category) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'name', 'category']
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
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Created goal: ${name}`);

    return res.json({
      goal,
      message: 'Goal created successfully'
    });

  } catch (error: any) {
    console.error('❌ Goal creation error:', error);
    return res.status(500).json({
      error: 'Failed to create goal',
      message: error.message
    });
  }
});

/**
 * GET /api/goals
 * Get user's goals
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, status } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing user_id query parameter'
      });
    }

    let query = supabase
      .from('goals')
      .select(`
        *,
        micro_goals (*)
      `)
      .eq('user_id', user_id as string);

    if (status) {
      query = query.eq('status', status as string);
    }

    const { data: goals, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      goals: goals || [],
      count: goals?.length || 0
    });

  } catch (error: any) {
    console.error('❌ Goals fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch goals',
      message: error.message
    });
  }
});

/**
 * POST /api/goals/:id/plan
 * Generate training plan for a goal
 */
router.post('/:id/plan', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { context } = req.body;

    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .single();

    if (goalError) throw goalError;
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    console.log(`📋 Generating plan for: ${goal.name}`);

    const prompt = `Create a training plan for this goal:

Goal: ${goal.name}
Category: ${goal.category}
Target Date: ${goal.target_date || 'Not specified'}
Context: ${context || 'None provided'}

Return JSON with this structure:
{
  "weekly_hours": 5,
  "total_estimated_hours": 200,
  "micro_goals": [
    {
      "name": "Micro-goal name",
      "order_index": 1,
      "completion_criteria": {
        "type": "performance|counter|streak|binary",
        "description": "What needs to be achieved"
      }
    }
  ],
  "phases": [
    {
      "name": "Phase name",
      "duration_weeks": 4,
      "focus": "What to focus on"
    }
  ]
}

Only return valid JSON.`;

    const response = await simpleCompletion(prompt);
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const plan = JSON.parse(cleanResponse);

    const { error: updateError } = await supabase
      .from('goals')
      .update({ plan })
      .eq('id', id);

    if (updateError) throw updateError;

    if (plan.micro_goals && plan.micro_goals.length > 0) {
      const microGoals = plan.micro_goals.map((mg: any) => ({
        goal_id: id,
        name: mg.name,
        order_index: mg.order_index,
        completion_criteria: mg.completion_criteria
      }));

      const { error: mgError } = await supabase
        .from('micro_goals')
        .insert(microGoals);

      if (mgError) throw mgError;
    }

    console.log(`✅ Plan created with ${plan.micro_goals?.length || 0} micro-goals`);

    return res.json({
      plan,
      message: 'Training plan generated successfully'
    });

  } catch (error: any) {
    console.error('❌ Plan generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate plan',
      message: error.message
    });
  }
});

export default router;
