'use client';

import { Clock, CheckCircle, Circle, ExternalLink } from 'lucide-react';

interface TodayTask {
  id: string;
  name: string;
  description?: string;
  tip?: string;
  goal_name: string;
  goal_id?: string;
  category?: string;
  scheduled_time: string;
  duration_mins: number;
  status: string;
  completed_at?: string;
  notes?: string;
  previous_notes?: string;
  resource_link?: string;
  resource_link_label?: string;
  tracking_requirements?: Array<{
    key: string;
    label: string;
    type: string;
    unit?: string;
  }>;
}

interface TodayTaskCardProps {
  task: TodayTask;
  onComplete?: (task: TodayTask) => void;
  onSkip?: (task: TodayTask) => void;
  isOverdue?: boolean;
}

const categoryEmoji: Record<string, string> = {
  fitness: '🏃',
  climbing: '🧗',
  languages: '🌍',
  business: '💼',
  creative: '🎨',
  mental_health: '🧘',
  skill: '🎯',
  health: '❤️',
  education: '📚',
  default: '📋',
};

export default function TodayTaskCard({ task, onComplete, onSkip, isOverdue }: TodayTaskCardProps) {
  const isCompleted = task.status === 'completed';
  const emoji = categoryEmoji[task.category || 'default'] || categoryEmoji.default;

  const scheduledTime = new Date(task.scheduled_time).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  return (
    <div className={`
      backdrop-blur-xl bg-white/80 rounded-2xl border border-white/60 
      shadow-sm hover:shadow-md transition-all
      ${isCompleted ? 'opacity-60' : ''}
    `}>
      <div className="p-4">
        {/* Header row - like a tweet header */}
        <div className="flex items-start gap-3">
          {/* Avatar-style icon */}
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
            ${isCompleted 
              ? 'bg-emerald-100' 
              : 'bg-slate-100'
            }
          `}>
            {isCompleted ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <span className="text-lg">{emoji}</span>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className={`font-semibold text-base leading-tight ${
                  isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
                }`}>
                  {task.name}
                </h3>
                
                {/* Time and duration - subtle, inline */}
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-400 flex-wrap">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{scheduledTime}</span>
                  <span>·</span>
                  <span>{formatDuration(task.duration_mins)}</span>
                  {isOverdue && !isCompleted && (
                    <>
                      <span>·</span>
                      <span className="text-amber-500 font-medium">Overdue</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Description - like tweet body */}
            {task.description && (
              <p className={`mt-2 text-sm leading-relaxed ${
                isCompleted ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {task.description}
              </p>
            )}

            {/* Goal pill - subtle neutral */}
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                <Circle className="w-2 h-2 fill-current" />
                {task.goal_name}
              </span>
            </div>

            {/* Resource Link - prominent button */}
            {task.resource_link && !isCompleted && (
              <div className="mt-3">
                <a
                  href={task.resource_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                  {task.resource_link_label || 'Open Resource'}
                </a>
              </div>
            )}

            {/* Tip - subtle */}
            {task.tip && !isCompleted && (
              <div className="mt-3 p-3 bg-white/50 backdrop-blur-sm border border-slate-100 rounded-xl">
                <p className="text-sm text-slate-500">
                  <span className="text-amber-500">💡</span> {task.tip}
                </p>
              </div>
            )}

            {/* Previous notes */}
            {task.previous_notes && !isCompleted && (
              <div className="mt-3 p-3 bg-white/50 backdrop-blur-sm border border-slate-100 rounded-xl">
                <p className="text-xs text-slate-400 font-medium mb-1">Last time:</p>
                <p className="text-sm text-slate-600">{task.previous_notes}</p>
              </div>
            )}

            {/* Completed notes */}
            {isCompleted && task.notes && (
              <div className="mt-3 p-3 bg-emerald-50/50 backdrop-blur-sm border border-emerald-100 rounded-xl">
                <p className="text-xs text-emerald-500 font-medium mb-1">✓ Completed</p>
                <p className="text-sm text-emerald-700">{task.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action button - clean, full width */}
        {!isCompleted && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onComplete?.(task)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}