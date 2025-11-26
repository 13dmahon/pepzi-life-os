export interface Goal {
  id: string;
  user_id: string;
  name: string;
  category: string;
  target_date?: string;
  status?: string;
  plan?: {
    weekly_hours?: number;
    total_estimated_hours?: number;
    phases?: Array<{
      name: string;
      duration_weeks: number;
      focus: string;
    }>;
  };
  progress?: {
    percent_complete: number;
    completed_micro_goals: number;
    total_micro_goals: number;
  };
  micro_goals?: MicroGoal[];
  created_at?: string;
}

export interface MicroGoal {
  id: string;
  goal_id: string;
  name: string;
  order_index: number;
  completed_at?: string;
  completion_criteria?: {
    type: string;
    description: string;
  };
}

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