import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { openai } from '../services/openai';

const router = Router();

// ============================================================
// TYPES
// ============================================================

interface ExtractedMetric {
  name: string;
  value: number;
  unit: string;
  type: 'money' | 'weight' | 'duration' | 'count' | 'distance' | 'scale';
}

interface ExtractedData {
  metrics: ExtractedMetric[];
  notes: string[];
}

// ============================================================
// AI EXTRACTION PROMPT
// ============================================================

const EXTRACTION_PROMPT = `You are an AI that extracts structured data from natural language about completed activities.

Given a user message about what they did, extract:
1. METRICS - Any measurable data mentioned (money, weight, duration, counts, distances, ratings)
2. NOTES - Any text descriptions of what was accomplished

For each metric, identify:
- name: What is being measured (e.g., "Revenue", "Bench Press", "Running Distance")
- value: The numeric value
- unit: The unit of measurement (e.g., "£", "kg", "mins", "km", "reps")
- type: One of: money, weight, duration, count, distance, scale

EXAMPLES:

Input: "Made £50 in revenue today"
Output: {"metrics": [{"name": "Revenue", "value": 50, "unit": "£", "type": "money"}], "notes": []}

Input: "Benched 60kg for 3 sets of 10"
Output: {"metrics": [{"name": "Bench Press", "value": 60, "unit": "kg", "type": "weight"}, {"name": "Sets", "value": 3, "unit": "sets", "type": "count"}, {"name": "Reps", "value": 10, "unit": "reps", "type": "count"}], "notes": []}

Input: "Built the login page and fixed 3 bugs"
Output: {"metrics": [{"name": "Bugs Fixed", "value": 3, "unit": "bugs", "type": "count"}], "notes": ["Built the login page"]}

Input: "Ran 5km in 25 minutes, felt great"
Output: {"metrics": [{"name": "Running Distance", "value": 5, "unit": "km", "type": "distance"}, {"name": "Running Time", "value": 25, "unit": "mins", "type": "duration"}], "notes": ["Felt great"]}

Input: "Session complete, worked for about 2 hours"
Output: {"metrics": [{"name": "Duration", "value": 120, "unit": "mins", "type": "duration"}], "notes": []}

Input: "Made good progress on the project"
Output: {"metrics": [], "notes": ["Made good progress on the project"]}

Input: "Effort level 8/10, knee felt a bit sore"
Output: {"metrics": [{"name": "Effort Level", "value": 8, "unit": "/10", "type": "scale"}], "notes": ["Knee felt a bit sore"]}

IMPORTANT:
- Only extract metrics that have explicit numeric values
- Convert hours to minutes when the type is duration
- For money, always use the currency symbol as the unit
- For ratings/scales, use "/10" or similar as the unit
- If no metrics are found, return an empty metrics array
- Descriptive text that isn't a metric should go in notes
- Be concise with note text - capture the key information

Respond ONLY with valid JSON in the format:
{"metrics": [...], "notes": [...]}`;

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/tracking/chat
 * Process natural language input and extract tracking data
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { user_id, session_id, goal_id, message, existing_data } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: 'Missing user_id or message' });
    }

    console.log(`📊 Tracking chat: "${message.substring(0, 50)}..."`);

    // Get goal context for better extraction
    let goalContext = '';
    if (goal_id) {
      const { data: goal } = await supabase
        .from('goals')
        .select('name, category, plan')
        .eq('id', goal_id)
        .single();

      if (goal) {
        goalContext = `\nContext: This is for a "${goal.name}" goal in the ${goal.category} category.`;
        if (goal.plan?.tracking_criteria) {
          goalContext += ` Expected metrics: ${goal.plan.tracking_criteria.join(', ')}.`;
        }
      }
    }

    // Call OpenAI to extract data
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT + goalContext },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || '{"metrics": [], "notes": []}';
    
    // Parse the JSON response
    let extracted: ExtractedData;
    try {
      // Clean up the response in case it has markdown code blocks
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extracted = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse extraction:', responseText);
      extracted = { metrics: [], notes: [message] };
    }

    // Generate a friendly response
    let response = '';
    
    if (extracted.metrics.length > 0 || extracted.notes.length > 0) {
      response = "Got it! I've recorded:\n\n";
      
      if (extracted.metrics.length > 0) {
        extracted.metrics.forEach((m) => {
          const prefix = m.unit === '£' ? '£' : '';
          const suffix = m.unit !== '£' ? ` ${m.unit}` : '';
          response += `📊 ${m.name}: ${prefix}${m.value}${suffix}\n`;
        });
      }
      
      if (extracted.notes.length > 0) {
        extracted.notes.forEach((n) => {
          response += `📝 ${n}\n`;
        });
      }
      
      response += '\nAnything else to add?';
    } else {
      response = "I couldn't extract any specific metrics from that. Could you include some numbers? For example:\n\n• \"Made £50 revenue\"\n• \"Benched 60kg\"\n• \"Ran for 30 minutes\"\n\nOr just tell me what you accomplished and I'll note it down.";
    }

    return res.json({
      response,
      extracted,
      raw_message: message,
    });
  } catch (error) {
    console.error('Tracking chat error:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * GET /api/tracking/stats/:goalId
 * Get aggregated stats for a goal's tracked data
 */
router.get('/stats/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { user_id } = req.query;

    if (!user_id || !goalId) {
      return res.status(400).json({ error: 'Missing user_id or goalId' });
    }

    // Fetch all completed sessions with tracked data
    const { data: sessions, error } = await supabase
      .from('schedule_blocks')
      .select('id, tracked_data, completed_at, scheduled_start')
      .eq('goal_id', goalId)
      .eq('user_id', user_id)
      .eq('status', 'completed')
      .not('tracked_data', 'is', null)
      .order('completed_at', { ascending: true });

    if (error) throw error;

    // Aggregate metrics
    const metricsMap = new Map<string, {
      name: string;
      type: string;
      unit: string;
      values: number[];
      dates: string[];
    }>();

    const allNotes: Array<{ note: string; date: string }> = [];

    sessions?.forEach((session) => {
      const trackedData = session.tracked_data as ExtractedData;
      if (!trackedData) return;

      // Aggregate metrics
      trackedData.metrics?.forEach((metric) => {
        const key = metric.name.toLowerCase();
        
        if (!metricsMap.has(key)) {
          metricsMap.set(key, {
            name: metric.name,
            type: metric.type,
            unit: metric.unit,
            values: [],
            dates: [],
          });
        }
        
        const stat = metricsMap.get(key)!;
        stat.values.push(metric.value);
        stat.dates.push(session.completed_at || session.scheduled_start);
      });

      // Collect notes
      trackedData.notes?.forEach((note) => {
        allNotes.push({
          note,
          date: session.completed_at || session.scheduled_start,
        });
      });
    });

    // Calculate stats for each metric
    const stats = Array.from(metricsMap.values()).map((metric) => {
      const total = metric.values.reduce((a, b) => a + b, 0);
      const average = total / metric.values.length;
      const min = Math.min(...metric.values);
      const max = Math.max(...metric.values);

      // Determine display type based on metric type
      let displayType: 'total' | 'average' | 'max' | 'chart' = 'chart';
      const nameLower = metric.name.toLowerCase();
      
      if (metric.type === 'money' || nameLower.includes('revenue')) {
        displayType = 'total';
      } else if (metric.type === 'weight' || nameLower.includes('bench') || nameLower.includes('squat')) {
        displayType = 'max';
      } else if (metric.type === 'duration') {
        displayType = 'average';
      } else if (metric.type === 'distance') {
        displayType = 'total';
      }

      // Calculate trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (metric.values.length >= 6) {
        const recent = metric.values.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const previous = metric.values.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
        const diff = (recent - previous) / previous;
        trend = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'stable';
      }

      return {
        ...metric,
        total,
        average,
        min,
        max,
        displayType,
        trend,
        sessionCount: metric.values.length,
      };
    });

    return res.json({
      stats,
      notes: allNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      sessionCount: sessions?.length || 0,
    });
  } catch (error) {
    console.error('Get tracking stats error:', error);
    return res.status(500).json({ error: 'Failed to get tracking stats' });
  }
});

/**
 * POST /api/tracking/save
 * Save tracked data to a session
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { user_id, session_id, tracked_data } = req.body;

    if (!user_id || !session_id || !tracked_data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { error } = await supabase
      .from('schedule_blocks')
      .update({ tracked_data })
      .eq('id', session_id)
      .eq('user_id', user_id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    console.error('Save tracking data error:', error);
    return res.status(500).json({ error: 'Failed to save tracking data' });
  }
});

export default router;