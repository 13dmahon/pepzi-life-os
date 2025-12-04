import axios from 'axios';

// Hardcoded production backend URL - bypasses Next.js rewrites
const API_BASE_URL = 'https://pepzi-backend-1029121217006.europe-west2.run.app';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
});

// Types
export interface ChatMessage {
  user_id: string;
  message: string;
  conversation_state?: any;
}

export interface ChatResponse {
  response: string;
  intents: any[];
  actions_taken: any[];
  ui_updates: {
    schedule_refresh: boolean;
    goals_refresh: boolean;
  };
}

export interface SmartChatResponse {
  response: string;
  show_confirmation: boolean;
  confirmation_data?: {
    block_id: string;
    session_name: string;
    goal_name: string;
    tracked_data: Record<string, any>;
  };
  state: any;
  ui_updates: any;
}

export interface TodayTask {
  id: string;
  name: string;
  description: string;
  tip: string;
  goal_name: string;
  goal_id: string;
  category: string;
  scheduled_time: string;
  duration_mins: number;
  status: string;
  completed_at?: string;
  tracked_data?: Record<string, any>;
  notes?: string;
  previous_notes?: string;
  tracking_requirements: Array<{
    key: string;
    label: string;
    type: string;
    unit?: string;
  }>;
}

export interface TodaySummary {
  date: string;
  tasks: TodayTask[];
  summary: {
    total: number;
    pending: number;
    completed: number;
  };
}

export interface GoalProgress {
  totalSessions: number;
  totalHours: number;
  targetHours: number;
  percentComplete: number;
  thisWeekCompleted: number;
  weeklyTarget: number;
  onTrack: boolean;
  status: 'on_track' | 'slightly_behind' | 'behind';
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  category: string;
  target_date?: string;
  description?: string;
  status?: string;
  plan?: any;
  progress?: any;
  created_at?: string;
  micro_goals?: any[];
  preferred_days?: string[];
  preferred_time?: 'morning' | 'afternoon' | 'evening' | 'any';
  intensity?: string;
}

export interface ScheduleBlock {
  id: string;
  user_id: string;
  type: string;
  scheduled_start: string;
  duration_mins: number;
  status: string;
  notes?: string;
  goal_id?: string;
  created_by?: string;
  completed_at?: string;
  original_scheduled_start?: string;
  goals?: { name: string; category?: string };
}

export interface UserAvailability {
  id?: string;
  user_id: string;
  wake_time: string;
  sleep_time: string;
  work_schedule: Record<string, { start: string; end: string } | null>;
  daily_commute_mins: number;
  fixed_commitments: Array<{ day: string; start: string; end: string; name: string }>;
  preferred_workout_time: string;
  total_free_hours_per_week?: number;
  total_busy_hours_per_week?: number;
}

export interface Milestone {
  name: string;
  hours: number;
  week?: number;
  target_week?: number;
}

export interface PlanEdits {
  editInstructions: string;
}

export interface CreatePlanPayload {
  milestones: Milestone[];
  weekly_hours: number;
  sessions_per_week: number;
  total_hours: number;
  tracking_criteria: string[];
  plan_edits?: PlanEdits;
}

export interface ConversationResponse {
  complete: boolean;
  message: string;
  goal?: any;
  milestones?: Milestone[];
  tracking_criteria?: string[];
  weekly_hours?: number;
  sessions_per_week?: number;
  total_hours?: number;
  state?: any;
  plan_edits?: PlanEdits;
  preview?: any;
}

export interface ScheduleGenerateResponse {
  success: boolean;
  schedule: ScheduleBlock[];
  message: string;
  warning?: string | null;
  stats: {
    sessions: number;
    totalHours: number;
    goalsScheduled: number;
  };
}

export interface RecurringBlockResponse {
  success: boolean;
  blocksCreated: number;
  type: string;
  days: string[];
  time: string;
  duration_mins: number;
  schedule_until: string;
  message: string;
}

// ============================================================
// CHAT API
// ============================================================

export const chatAPI = {
  sendMessage: async (data: ChatMessage): Promise<ChatResponse> => {
    const response = await api.post('/api/chat', data);
    return response.data;
  },
  smartMessage: async (data: { user_id: string; message: string; conversation_state?: any }): Promise<SmartChatResponse> => {
    const response = await api.post('/api/chat/message', data);
    return response.data;
  },
  confirmLog: async (data: { user_id: string; block_id: string; tracked_data: Record<string, any> }): Promise<{ success: boolean; block: ScheduleBlock; progress: GoalProgress | null; message: string; remaining_today: number }> => {
    const response = await api.post('/api/chat/confirm-log', data);
    return response.data;
  },
  getTodaySummary: async (userId: string): Promise<TodaySummary> => {
    const response = await api.get('/api/chat/today-summary', { params: { user_id: userId } });
    return response.data;
  },
  getGoalProgress: async (goalId: string): Promise<GoalProgress> => {
    const response = await api.get(`/api/chat/goal-progress/${goalId}`);
    return response.data;
  },
  // NEW: Get missed sessions for nudges
  getMissedSessions: async (userId: string): Promise<{ sessions: TodayTask[] }> => {
    const response = await api.get('/api/chat/missed-sessions', { params: { user_id: userId } });
    return response.data;
  },
};

// ============================================================
// GOALS API
// ============================================================

export const goalsAPI = {
  getGoals: async (userId: string): Promise<Goal[]> => {
    const response = await api.get('/api/goals', { params: { user_id: userId } });
    return response.data.goals;
  },
  createGoal: async (goal: Partial<Goal> & { user_id: string }): Promise<Goal> => {
    const response = await api.post('/api/goals', goal);
    return response.data.goal;
  },
  extractFromDreams: async (userId: string, text: string): Promise<Goal[]> => {
    const response = await api.post('/api/goals/from-dreams', { user_id: userId, text });
    return response.data.goals;
  },
  generatePlan: async (goalId: string, context?: string): Promise<any> => {
    const response = await api.post(`/api/goals/${goalId}/plan`, { context });
    return response.data;
  },
  generateTrainingPlan: async (goalId: string, context?: string): Promise<any> => {
    const response = await api.post(`/api/goals/${goalId}/generate-plan`, { context });
    return response.data;
  },
  conversation: async (userId: string, message: string, conversationState?: any): Promise<ConversationResponse> => {
    const response = await api.post('/api/goals/conversation', { user_id: userId, message, conversation_state: conversationState });
    return response.data;
  },
  createPlanWithMilestones: async (goalId: string, payload: CreatePlanPayload): Promise<any> => {
    const response = await api.post(`/api/goals/${goalId}/create-plan-with-milestones`, payload, { timeout: 300000 });
    return response.data;
  },
  deleteGoal: async (goalId: string): Promise<void> => {
    await api.delete(`/api/goals/${goalId}`);
  },
  deletePlan: async (goalId: string): Promise<void> => {
    await api.delete(`/api/goals/${goalId}/plan`);
  },
  getGoalSessions: async (goalId: string, limit?: number): Promise<{ sessions: Array<{ id: string; name: string; scheduled_start: string; completed_at: string; duration_mins: number; tracked_data: Record<string, any> }>; aggregates: { total_sessions: number; total_hours: number; total_minutes: number; avg_effort: number | null; total_distance_km: number | null } }> => {
    const response = await api.get(`/api/goals/${goalId}/sessions`, { params: { limit } });
    return response.data;
  },
  getAllProgress: async (userId: string): Promise<{ progress: Record<string, { total_sessions: number; total_minutes: number; total_hours: number }> }> => {
    const response = await api.get('/api/goals/all-progress', { params: { user_id: userId } });
    return response.data;
  },
  // NEW: Update goal intensity
  updateIntensity: async (goalId: string, intensity: string): Promise<any> => {
    const response = await api.patch(`/api/goals/${goalId}/intensity`, { intensity });
    return response.data;
  },
  // NEW: Update goal preferences (days, hours, sessions)
  updatePreferences: async (goalId: string, data: { preferred_days?: string[]; weekly_hours?: number; sessions_per_week?: number }): Promise<any> => {
    const response = await api.patch(`/api/goals/${goalId}/preferences`, data);
    return response.data;
  },
  // NEW: Get intensify preview (before/after comparison)
  getIntensifyPreview: async (goalId: string): Promise<{
    success: boolean;
    preview: Array<{
      id: string;
      before: { name: string; description: string; tip: string; duration_mins: number };
      after: { name: string; description: string; tip: string; duration_mins: number };
    }>;
    total_sessions: number;
    message: string;
  }> => {
    const response = await api.post(`/api/goals/${goalId}/intensify-preview`);
    return response.data;
  },

  // NEW: Apply intensified sessions
  applyIntensify: async (goalId: string, preview: any[]): Promise<{
    success: boolean;
    sessions_updated: number;
    message: string;
  }> => {
    const response = await api.post(`/api/goals/${goalId}/intensify-apply`, { preview });
    return response.data;
  },

  // NEW Phase 2: Get time budget (work, commute, events, training, free)
  getTimeBudget: async (userId: string): Promise<{
    work_hours: number;
    commute_hours: number;
    event_hours: number;
    training_hours: number;
    committed_hours: number;
    awake_hours: number;
    free_hours: number;
  }> => {
    const response = await api.get('/api/goals/time-budget', { params: { user_id: userId } });
    return response.data;
  },

  // NEW Phase 2: Get full schedule for a goal (all sessions grouped by week)
  getGoalSchedule: async (goalId: string): Promise<{
    sessions: any[];
    sessions_by_week: Record<number, any[]>;
    total_sessions: number;
  }> => {
    const response = await api.get(`/api/goals/${goalId}/schedule`);
    return response.data;
  },
};

// ============================================================
// SCHEDULE API
// ============================================================

export const scheduleAPI = {
  getSchedule: async (userId: string, startDate?: string, endDate?: string): Promise<ScheduleBlock[]> => {
    const response = await api.get('/api/schedule', { params: { user_id: userId, start_date: startDate, end_date: endDate } });
    return response.data.blocks;
  },
  getToday: async (userId: string): Promise<ScheduleBlock[]> => {
    const response = await api.get('/api/schedule/today', { params: { user_id: userId } });
    return response.data.blocks;
  },
  getBlocks: async (userId: string, startDate: string, endDate: string): Promise<{ blocks: ScheduleBlock[] }> => {
    const response = await api.get('/api/schedule', { params: { user_id: userId, start_date: startDate, end_date: endDate } });
    return response.data;
  },
  getWeek: async (userId: string, weekOffset: number = 0): Promise<ScheduleBlock[]> => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const response = await api.get('/api/schedule', { params: { user_id: userId, start_date: startOfWeek.toISOString().split('T')[0], end_date: endOfWeek.toISOString().split('T')[0] } });
    return response.data.blocks;
  },
  createBlock: async (block: { user_id: string; goal_id?: string; type: string; scheduled_start: string; duration_mins: number; notes?: string }): Promise<ScheduleBlock> => {
    const response = await api.post('/api/schedule', block);
    return response.data.block;
  },
  createRecurringBlock: async (data: {
    user_id: string;
    type: string;
    days: string[];
    start_time: string;
    end_time: string;
    notes?: string;
  }): Promise<RecurringBlockResponse> => {
    const response = await api.post('/api/schedule/recurring', data);
    return response.data;
  },
  updateBlock: async (blockId: string, updates: { scheduled_start?: string; duration_mins?: number; notes?: string }): Promise<ScheduleBlock> => {
    const response = await api.patch(`/api/schedule/${blockId}`, updates);
    return response.data.block;
  },
  updateBlockWithFuture: async (blockId: string, scheduledStart: string, applyToFuture: boolean): Promise<{ block: ScheduleBlock; updatedCount: number }> => {
    const response = await api.patch(`/api/schedule/${blockId}/with-future`, { scheduled_start: scheduledStart, apply_to_future: applyToFuture });
    return response.data;
  },
  completeBlock: async (blockId: string): Promise<ScheduleBlock> => {
    const response = await api.patch(`/api/schedule/${blockId}/complete`);
    return response.data.block;
  },
  deleteBlock: async (blockId: string): Promise<void> => {
    await api.delete(`/api/schedule/${blockId}`);
  },
  autoGenerate: async (userId: string): Promise<ScheduleGenerateResponse> => {
    const response = await api.post('/api/schedule/auto-generate', { user_id: userId });
    return response.data;
  },
  generateForGoal: async (userId: string, goalId: string, preferredDays?: string[], preferredTime?: string): Promise<{ success: boolean; blocksCreated: number; warning: string | null; message: string }> => {
    const response = await api.post('/api/schedule/generate-for-goal', { user_id: userId, goal_id: goalId, preferred_days: preferredDays, preferred_time: preferredTime }, { timeout: 180000 });
    return response.data;
  },
  reschedule: async (blockId: string, newStartTime: string): Promise<ScheduleBlock> => {
    const response = await api.patch(`/api/schedule/${blockId}/reschedule`, { new_start_time: newStartTime });
    return response.data.block;
  },

  // ============================================================
  // NEW PHASE 1 METHODS
  // ============================================================

  // Complete a block with notes only (simplified - no metrics)
  completeBlockWithNotes: async (blockId: string, notes: string): Promise<{ success: boolean; block: ScheduleBlock; message: string }> => {
    const response = await api.patch(`/api/schedule/${blockId}/complete-with-notes`, { notes });
    return response.data;
  },

  // Skip a block (marks as skipped, calculates deadline impact)
  skipBlock: async (blockId: string): Promise<{ success: boolean; deadline_impact: string | null; message: string }> => {
    const response = await api.patch(`/api/schedule/${blockId}/skip`);
    return response.data;
  },

  // Smart reschedule (later today, tomorrow, or custom time)
  rescheduleBlock: async (blockId: string, option: 'later_today' | 'tomorrow' | 'custom', customTime?: string): Promise<{ success: boolean; block: ScheduleBlock; new_time: string; message: string }> => {
    const response = await api.patch(`/api/schedule/${blockId}/reschedule-smart`, { option, custom_time: customTime });
    return response.data;
  },

  // NEW Phase 2: Push block to next week (affects deadline)
  pushToNextWeek: async (blockId: string): Promise<{ success: boolean; new_date: string; deadline_impact: string | null; message: string }> => {
    const response = await api.patch(`/api/schedule/${blockId}/push-to-next-week`);
    return response.data;
  },

  // NEW Phase 2: Complete block early (can pull deadline forward)
  completeEarly: async (blockId: string, notes: string): Promise<{ success: boolean; block: ScheduleBlock; deadline_impact: string | null; message: string }> => {
    const response = await api.patch(`/api/schedule/${blockId}/complete-early`, { notes });
    return response.data;
  },
};

// ============================================================
// AVAILABILITY API
// ============================================================

export const availabilityAPI = {
  extract: async (userId: string, text: string): Promise<any> => {
    const response = await api.post('/api/availability/extract', { user_id: userId, text });
    return response.data;
  },
  save: async (userId: string, availability: any): Promise<any> => {
    const response = await api.post('/api/availability', { user_id: userId, ...availability });
    return response.data;
  },
  get: async (userId: string): Promise<{ availability: UserAvailability | null; has_availability: boolean }> => {
    const response = await api.get('/api/availability', { params: { user_id: userId } });
    return response.data;
  },
  checkFeasibility: async (userId: string): Promise<any> => {
    const response = await api.get('/api/availability/feasibility', { params: { user_id: userId } });
    return response.data;
  },
  // Alias for save (for consistency)
  update: async (userId: string, availability: any): Promise<any> => {
    const response = await api.post('/api/availability', { user_id: userId, ...availability });
    return response.data;
  },
};

export const goalsApi = goalsAPI;