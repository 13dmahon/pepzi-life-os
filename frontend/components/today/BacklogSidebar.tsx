'use client';

import { useState } from 'react';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Clock,
  Play,
  CalendarX
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassUI';

interface BacklogSession {
  id: string;
  name: string;
  goal_name: string;
  goal_id?: string;
  category?: string;
  session_number?: number;
  duration_mins: number;
  deadline: string;
  days_until_slip: number;
  days_overdue?: number;
  slip_days?: number;
  resource_link?: string | null;
  resource_link_label?: string | null;
}

interface BacklogSidebarProps {
  sessions: BacklogSession[];
  onSelectSession: (session: BacklogSession) => void;
}

export default function BacklogSidebar({ sessions, onSelectSession }: BacklogSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (sessions.length === 0) return null;

  // Format deadline
  const formatDeadline = (dateStr: string, daysUntil: number) => {
    if (daysUntil <= 0) return 'Overdue';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil <= 7) return `${daysUntil} days`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Sort by urgency
  const sortedSessions = [...sessions].sort((a, b) => a.days_until_slip - b.days_until_slip);

  return (
    <GlassCard className="overflow-hidden bg-gradient-to-br from-amber-50/90 to-orange-50/90 border-amber-200/50" hover={false}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-700">Catch Up</h3>
            <p className="text-sm text-amber-600">{sessions.length} missed sessions</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Session List */}
      {isExpanded && (
        <div className="border-t border-amber-200/50 max-h-[400px] overflow-y-auto">
          {sortedSessions.map((session, idx) => (
            <div
              key={session.id}
              className={`p-4 ${idx !== sortedSessions.length - 1 ? 'border-b border-amber-100/50' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 truncate">{session.name}</p>
                  <p className="text-sm text-slate-500 truncate">{session.goal_name}</p>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 text-xs mb-3">
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{session.duration_mins}m</span>
                </div>
                <div className={`flex items-center gap-1 ${
                  session.days_until_slip <= 1 ? 'text-red-500' : 'text-amber-500'
                }`}>
                  <CalendarX className="w-3 h-3" />
                  <span>
                    Complete before {formatDeadline(session.deadline, session.days_until_slip)}
                  </span>
                </div>
              </div>

              {/* Slip Warning */}
              {session.slip_days && session.slip_days > 0 && (
                <p className="text-xs text-amber-600 mb-3">
                  Or timeline slips by {session.slip_days} day{session.slip_days > 1 ? 's' : ''}
                </p>
              )}

              {/* Start Button */}
              <button
                onClick={() => onSelectSession(session)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Play className="w-4 h-4" />
                Do Now
              </button>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}