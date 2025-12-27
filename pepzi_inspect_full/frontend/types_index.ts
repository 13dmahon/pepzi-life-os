export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: any[];
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  category: string;
  target_date?: string;
  status: string;
  progress?: {
    percent_complete: number;
    completed_micro_goals: number;
    total_micro_goals: number;
  };
  micro_goals?: MicroGoal[];
}

export interface MicroGoal {
  id: string;
  goal_id: string;
  name: string;
  completed: boolean;
  order_index: number;
}

export interface ScheduleBlock {
  id: string;
  user_id: string;
  goal_id?: string;
  type: string;
  scheduled_start: string;
  duration_mins: number;
  status: string;
  notes?: string;
}
