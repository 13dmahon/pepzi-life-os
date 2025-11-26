import axios from 'axios';

// Empty string = same-origin (Next.js will proxy /api/* to your backend)
const API_BASE_URL = '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds for AI-generated plans (batched generation takes longer)
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

// Milestone type for goal plans
export interface Milestone {
  name: string;
  hours: number;
  week?: number;
  target_week?: number;
}

// Plan edits for customized generation
export interface PlanEdits {
  editInstructions: string;
}

// Plan creation payload type
export interface CreatePlanPayload {
  milestones: Milestone[];
  weekly_hours: number;
  sessions_per_week: number;
  total_hours: number;
  tracking_criteria: string[];
  plan_edits?: PlanEdits;
}

// Conversation response type
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

// Schedule generation response type
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

// API functions
export const chatAPI = {
  // Legacy send message (for old chat)
  sendMessage: async (data: ChatMessage): Promise<ChatResponse> => {
    const response = await api.post('/api/chat', data);
    return response.data;
  },

  // Smart chat for logging activities
  smartMessage: async (data: {
    user_id: string;
    message: string;
    conversation_state?: any;
  }): Promise<SmartChatResponse> => {
    const response = await api.post('/api/chat/message', data);
    return response.data;
  },

  // Confirm and log an activity
  confirmLog: async (data: {
    user_id: string;
    block_id: string;
    tracked_data: Record<string, any>;
  }): Promise<{
    success: boolean;
    block: ScheduleBlock;
    progress: GoalProgress | null;
    message: string;
    remaining_today: number;
  }> => {
    const response = await api.post('/api/chat/confirm-log', data);
    return response.data;
  },

  // Get today's summary with tracking requirements
  getTodaySummary: async (userId: string): Promise<TodaySummary> => {
    const response = await api.get('/api/chat/today-summary', {
      params: { user_id: userId },
    });
    return response.data;
  },

  // Get goal progress
  getGoalProgress: async (goalId: string): Promise<GoalProgress> => {
    const response = await api.get(`/api/chat/goal-progress/${goalId}`);
    return response.data;
  },
};

export const goalsAPI = {
  getGoals: async (userId: string): Promise<Goal[]> => {
    const response = await api.get('/api/goals', {
      params: { user_id: userId },
    });
    return response.data.goals;
  },

  createGoal: async (goal: Partial<Goal> & { user_id: string }): Promise<Goal> => {
    const response = await api.post('/api/goals', goal);
    return response.data.goal;
  },

  extractFromDreams: async (userId: string, text: string): Promise<Goal[]> => {
    const response = await api.post('/api/goals/from-dreams', {
      user_id: userId,
      text,
    });
    return response.data.goals;
  },

  generatePlan: async (goalId: string, context?: string): Promise<any> => {
    const response = await api.post(`/api/goals/${goalId}/plan`, {
      context,
    });
    return response.data;
  },

  generateTrainingPlan: async (goalId: string, context?: string): Promise<any> => {
    const response = await api.post(`/api/goals/${goalId}/generate-plan`, {
      context,
    });
    return response.data;
  },

  // Conversational goal creation with Elite Coach
  conversation: async (
    userId: string,
    message: string,
    conversationState?: any
  ): Promise<ConversationResponse> => {
    const response = await api.post('/api/goals/conversation', {
      user_id: userId,
      message,
      conversation_state: conversationState,
    });
    return response.data;
  },

  // Create plan with milestones from conversation result
  createPlanWithMilestones: async (
    goalId: string,
    payload: CreatePlanPayload
  ): Promise<any> => {
    const response = await api.post(
      `/api/goals/${goalId}/create-plan-with-milestones`,
      payload
    );
    return response.data;
  },

  // Delete goal completely
  deleteGoal: async (goalId: string): Promise<void> => {
    const response = await api.delete(`/api/goals/${goalId}`);
    return response.data;
  },

  // Delete plan only (keep goal)
  deletePlan: async (goalId: string): Promise<void> => {
    const response = await api.delete(`/api/goals/${goalId}/plan`);
    return response.data;
  },

  // Get completed sessions with tracked data for a goal
  getGoalSessions: async (goalId: string, limit?: number): Promise<{
    sessions: Array<{
      id: string;
      name: string;
      scheduled_start: string;
      completed_at: string;
      duration_mins: number;
      tracked_data: Record<string, any>;
    }>;
    aggregates: {
      total_sessions: number;
      total_hours: number;
      total_minutes: number;
      avg_effort: number | null;
      total_distance_km: number | null;
    };
  }> => {
    const response = await api.get(`/api/goals/${goalId}/sessions`, {
      params: { limit },
    });
    return response.data;
  },

  // Get progress aggregates for all goals (for goals list page)
  getAllProgress: async (userId: string): Promise<{
    progress: Record<string, {
      total_sessions: number;
      total_minutes: number;
      total_hours: number;
    }>;
  }> => {
    const response = await api.get('/api/goals/all-progress', {
      params: { user_id: userId },
    });
    return response.data;
  },
};

export const scheduleAPI = {
  // Get schedule blocks for a date range
  getSchedule: async (
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ScheduleBlock[]> => {
    const response = await api.get('/api/schedule', {
      params: { user_id: userId, start_date: startDate, end_date: endDate },
    });
    return response.data.blocks;
  },

  // Get today's schedule
  getToday: async (userId: string): Promise<ScheduleBlock[]> => {
    const response = await api.get('/api/schedule/today', {
      params: { user_id: userId },
    });
    return response.data.blocks;
  },

  // Get current week's schedule
  getWeek: async (userId: string, weekOffset: number = 0): Promise<ScheduleBlock[]> => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const response = await api.get('/api/schedule', {
      params: {
        user_id: userId,
        start_date: startOfWeek.toISOString().split('T')[0],
        end_date: endOfWeek.toISOString().split('T')[0],
      },
    });
    return response.data.blocks;
  },

  // Create a new schedule block
  createBlock: async (block: {
    user_id: string;
    goal_id?: string;
    type: string;
    scheduled_start: string;
    duration_mins: number;
    notes?: string;
  }): Promise<ScheduleBlock> => {
    const response = await api.post('/api/schedule', block);
    return response.data.block;
  },

  // Update a schedule block (for drag-and-drop)
  updateBlock: async (
    blockId: string,
    updates: {
      scheduled_start?: string;
      duration_mins?: number;
      notes?: string;
    }
  ): Promise<ScheduleBlock> => {
    const response = await api.patch(`/api/schedule/${blockId}`, updates);
    return response.data.block;
  },

  // Mark a block as complete
  completeBlock: async (blockId: string): Promise<ScheduleBlock> => {
    const response = await api.patch(`/api/schedule/${blockId}/complete`);
    return response.data.block;
  },

  // Delete a schedule block
  deleteBlock: async (blockId: string): Promise<void> => {
    await api.delete(`/api/schedule/${blockId}`);
  },

  // Auto-generate weekly schedule (now returns warnings)
  autoGenerate: async (userId: string): Promise<ScheduleGenerateResponse> => {
    const response = await api.post('/api/schedule/auto-generate', {
      user_id: userId,
    });
    return response.data;
  },

  // Reschedule a block (legacy)
  reschedule: async (blockId: string, newStartTime: string): Promise<ScheduleBlock> => {
    const response = await api.patch(`/api/schedule/${blockId}/reschedule`, {
      new_start_time: newStartTime,
    });
    return response.data.block;
  },
};

export const availabilityAPI = {
  extract: async (userId: string, text: string): Promise<any> => {
    const response = await api.post('/api/availability/extract', {
      user_id: userId,
      text,
    });
    return response.data;
  },

  save: async (userId: string, availability: any): Promise<any> => {
    const response = await api.post('/api/availability', {
      user_id: userId,
      ...availability,
    });
    return response.data;
  },

  get: async (userId: string): Promise<{ availability: UserAvailability | null; has_availability: boolean }> => {
    const response = await api.get('/api/availability', {
      params: { user_id: userId },
    });
    return response.data;
  },

  checkFeasibility: async (userId: string): Promise<any> => {
    const response = await api.get('/api/availability/feasibility', {
      params: { user_id: userId },
    });
    return response.data;
  },
};

// Export legacy name for backwards compatibility
export const goalsApi = goalsAPI;