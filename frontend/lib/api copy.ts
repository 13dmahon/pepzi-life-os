import axios from 'axios';

// Empty string = same-origin (Next.js will proxy /api/* to your backend)
const API_BASE_URL = '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds for AI-generated plans
});

// Types
export interface ChatMessage {
  user_id: string;
  message: string;
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

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  category: string;
  target_date?: string;
  description?: string;  // ← ADDED
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
  goals?: { name: string };
}

export interface UserAvailability {
  id?: string;
  user_id: string;
  wake_time: string;
  sleep_time: string;
  work_schedule: any;
  daily_commute_mins: number;
  fixed_commitments: any[];
  preferred_workout_time: string;
  total_free_hours_per_week?: number;
  total_busy_hours_per_week?: number;
}

// Milestone type for goal plans
export interface Milestone {
  name: string;
  hours: number;
  week?: number;
  target_week?: number;  // ← ADDED (some responses use this)
}

// Plan creation payload type
export interface CreatePlanPayload {
  milestones: Milestone[];
  weekly_hours: number;
  sessions_per_week: number;
  total_hours: number;
  tracking_criteria: string[];
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
}

// API functions
export const chatAPI = {
  sendMessage: async (data: ChatMessage): Promise<ChatResponse> => {
    const response = await api.post('/api/chat', data);
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

  // 🔥 Conversational goal creation with Elite Coach
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

  // 🔥 Create plan with milestones from conversation result
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

  // 🗑️ Delete goal completely
  deleteGoal: async (goalId: string): Promise<void> => {
    const response = await api.delete(`/api/goals/${goalId}`);
    return response.data;
  },

  // 🗑️ Delete plan only (keep goal)
  deletePlan: async (goalId: string): Promise<void> => {
    const response = await api.delete(`/api/goals/${goalId}/plan`);
    return response.data;
  },
};

export const scheduleAPI = {
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

  getToday: async (userId: string): Promise<ScheduleBlock[]> => {
    const response = await api.get('/api/schedule/today', {
      params: { user_id: userId },
    });
    return response.data.blocks;
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

  get: async (userId: string): Promise<any> => {
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