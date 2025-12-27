'use client';

import { Clock, CheckCircle, Play } from 'lucide-react';

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

const categoryColors: Record<string, string> = {
  fitness: 'from-green-500 to-emerald-500',
  climbing: 'from-orange-500 to-amber-500',
  languages: 'from-blue-500 to-indigo-500',
  business: 'from-purple-500 to-violet-500',
  creative: 'from-pink-500 to-rose-500',
  mental_health: 'from-cyan-500 to-teal-500',
  default: 'from-gray-500 to-slate-500',
};

const categoryIcons: Record<string, string> = {
  fitness: '🏃',
  climbing: '🧗',
  languages: '🌍',
  business: '💼',
  creative: '🎨',
  mental_health: '🧘',
  default: '📋',
};

export default function TodayTaskCard({ task, onComplete, onSkip, isOverdue }: TodayTaskCardProps) {
  const isCompleted = task.status === 'completed';
  const colorClass = categoryColors[task.category || 'default'] || categoryColors.default;
  const icon = categoryIcons[task.category || 'default'] || categoryIcons.default;

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
    <div
      className={`
        bg-white rounded-xl border-2 overflow-hidden transition-all
        ${isCompleted ? 'border-green-200 bg-green-50/50 opacity-75' : 'border-gray-200'}
        ${isOverdue && !isCompleted ? 'border-orange-300 bg-orange-50/30' : ''}
      `}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
            ${isCompleted 
              ? 'bg-green-100' 
              : `bg-gradient-to-br ${colorClass}`
            }
          `}>
            {isCompleted ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <span className="text-2xl">{icon}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`font-bold text-lg ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                  {task.name}
                </h3>
                <p className="text-sm text-purple-600 font-medium">{task.goal_name}</p>
              </div>
              
              {/* Time badge */}
              <div className={`
                flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium flex-shrink-0
                ${isOverdue && !isCompleted 
                  ? 'bg-orange-100 text-orange-700' 
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                <Clock className="w-3.5 h-3.5" />
                {scheduledTime}
              </div>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <span>{formatDuration(task.duration_mins)}</span>
            </div>

            {/* Description */}
            {task.description && (
              <p className={`mt-2 text-sm ${isCompleted ? 'text-green-600' : 'text-gray-600'} leading-relaxed`}>
                {task.description}
              </p>
            )}

            {/* Tip */}
            {task.tip && !isCompleted && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  💡 {task.tip}
                </p>
              </div>
            )}

            {/* Previous notes (if any) */}
            {task.previous_notes && !isCompleted && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-1">📝 Last time:</p>
                <p className="text-xs text-blue-800">{task.previous_notes}</p>
              </div>
            )}

            {/* Completed notes */}
            {isCompleted && task.notes && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-600 font-medium mb-1">✓ Notes:</p>
                <p className="text-xs text-green-800">{task.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons - only show if not completed */}
        {!isCompleted && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onComplete?.(task)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
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