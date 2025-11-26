'use client';

import { Clock, Target, CheckCircle, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface TrackingRequirement {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'text' | 'scale';
  unit?: string;
  min?: number;
  max?: number;
}

interface TodayTask {
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
  tracking_requirements: TrackingRequirement[];
}

interface TodayTaskCardProps {
  task: TodayTask;
  onSelect?: (task: TodayTask) => void;
  isSelected?: boolean;
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

export default function TodayTaskCard({ task, onSelect, isSelected }: TodayTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = task.status === 'completed';
  const colorClass = categoryColors[task.category] || categoryColors.default;
  const icon = categoryIcons[task.category] || categoryIcons.default;

  const scheduledTime = new Date(task.scheduled_time).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatTrackedValue = (key: string, value: any, req: TrackingRequirement) => {
    if (value === undefined || value === null) return '—';
    if (req.type === 'boolean') return value ? 'Yes' : 'No';
    if (req.unit) return `${value} ${req.unit}`;
    return value;
  };

  return (
    <div
      className={`
        bg-white rounded-xl border-2 overflow-hidden transition-all
        ${isCompleted ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}
        ${isSelected ? 'ring-2 ring-purple-500 border-purple-300' : ''}
        ${!isCompleted ? 'hover:border-purple-300 cursor-pointer' : ''}
      `}
      onClick={() => !isCompleted && onSelect?.(task)}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${isCompleted 
              ? 'bg-green-100' 
              : `bg-gradient-to-br ${colorClass}`
            }
          `}>
            {isCompleted ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <span className="text-xl">{icon}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-lg ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
              {task.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-purple-600 font-medium">{task.goal_name}</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                {scheduledTime}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-sm text-gray-500">{task.duration_mins} mins</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className={`mt-3 text-sm ${isCompleted ? 'text-green-600' : 'text-gray-600'} leading-relaxed`}>
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
      </div>

      {/* Tracking Section */}
      <div 
        className={`
          border-t px-4 py-3 
          ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}
        `}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex items-center justify-between w-full text-left"
        >
          <span className={`text-sm font-medium ${isCompleted ? 'text-green-700' : 'text-gray-700'}`}>
            {isCompleted ? '✓ Tracked Data' : '📝 To Track'}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {task.tracking_requirements.map((req) => (
              <div key={req.key} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{req.label}</span>
                {isCompleted && task.tracked_data ? (
                  <span className="font-medium text-green-700">
                    {formatTrackedValue(req.key, task.tracked_data[req.key], req)}
                  </span>
                ) : (
                  <span className="text-gray-400 italic">
                    {req.type === 'scale' ? `1-${req.max}` : req.unit || '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!expanded && !isCompleted && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.tracking_requirements.map((req) => (
              <span 
                key={req.key}
                className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600"
              >
                {req.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Call to Action */}
      {!isCompleted && (
        <div className="px-4 py-3 bg-purple-50 border-t border-purple-100">
          <p className="text-sm text-purple-700">
            👉 Tell me in the chat when you've done this!
          </p>
        </div>
      )}
    </div>
  );
}