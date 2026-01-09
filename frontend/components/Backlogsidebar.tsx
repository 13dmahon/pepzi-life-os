'use client';

import { AlertTriangle, Clock, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { GlassCard, GlassButton } from '@/components/ui/GlassUI';

// Export the interface so it can be imported elsewhere
export interface BacklogSession {
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
}

interface BacklogSidebarProps {
  sessions: BacklogSession[];
  onSelectSession: (session: BacklogSession) => void;
}

// Category colors
const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
  fitness: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '🏃' },
  climbing: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🧗' },
  languages: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '🌍' },
  music: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🎵' },
  career: { bg: 'bg-slate-100', text: 'text-slate-700', icon: '💼' },
  business: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '📈' },
  creative: { bg: 'bg-pink-100', text: 'text-pink-700', icon: '🎨' },
  default: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '📋' },
};

function getUrgencyColor(daysUntilSlip: number): string {
  if (daysUntilSlip <= 1) return 'text-red-600';
  if (daysUntilSlip <= 3) return 'text-amber-600';
  return 'text-slate-600';
}

function getUrgencyBg(daysUntilSlip: number): string {
  if (daysUntilSlip <= 1) return 'bg-red-50 border-red-200';
  if (daysUntilSlip <= 3) return 'bg-amber-50 border-amber-200';
  return 'bg-slate-50 border-slate-200';
}

function formatDeadline(deadline: string, daysUntilSlip: number): string {
  const date = new Date(deadline);
  const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNum = date.getDate();
  const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? 'st' 
    : dayNum === 2 || dayNum === 22 ? 'nd' 
    : dayNum === 3 || dayNum === 23 ? 'rd' : 'th';
  
  if (daysUntilSlip === 0) return 'Today';
  if (daysUntilSlip === 1) return 'Tomorrow';
  return `${dayName} ${dayNum}${suffix}`;
}

export default function BacklogSidebar({ sessions, onSelectSession }: BacklogSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (sessions.length === 0) {
    return null;
  }

  // Sort by urgency (days_until_slip ascending)
  const sortedSessions = [...sessions].sort((a, b) => a.days_until_slip - b.days_until_slip);
  const mostUrgent = sortedSessions[0];
  const isUrgent = mostUrgent.days_until_slip <= 2;

  return (
    <GlassCard 
      className={`p-0 overflow-hidden ${isUrgent ? 'ring-2 ring-amber-400' : ''}`} 
      hover={false}
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
          isUrgent 
            ? 'bg-gradient-to-r from-amber-50 to-orange-50' 
            : 'bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isUrgent ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${isUrgent ? 'text-amber-600' : 'text-slate-500'}`} />
          </div>
          <div className="text-left">
            <h3 className={`font-semibold text-sm ${isUrgent ? 'text-amber-800' : 'text-slate-700'}`}>
              Catch Up
            </h3>
            <p className="text-xs text-slate-500">
              {sessions.length} missed session{sessions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isUrgent ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {sessions.length}
          </span>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Sessions List */}
      {!isCollapsed && (
        <div className="divide-y divide-slate-100">
          {sortedSessions.map((session) => {
            const colors = categoryColors[session.category || 'default'] || categoryColors.default;
            const urgencyColor = getUrgencyColor(session.days_until_slip);
            
            return (
              <div
                key={session.id}
                className={`p-3 ${getUrgencyBg(session.days_until_slip)} border-l-4 ${
                  session.days_until_slip <= 1 ? 'border-l-red-400' 
                  : session.days_until_slip <= 3 ? 'border-l-amber-400' 
                  : 'border-l-slate-300'
                }`}
              >
                {/* Session Info */}
                <div className="flex items-start gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${colors.bg}`}>
                    {colors.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">
                      {session.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {session.goal_name}
                    </p>
                  </div>
                </div>

                {/* Deadline Warning */}
                <div className={`flex items-center gap-1.5 text-xs mb-3 ${urgencyColor}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Complete before{' '}
                    <span className="font-semibold">
                      {formatDeadline(session.deadline, session.days_until_slip)}
                    </span>
                  </span>
                </div>

                {/* Slip Warning */}
                {session.slip_days && session.slip_days > 0 && (
                  <p className="text-xs text-slate-500 mb-3 italic">
                    Or timeline slips by {session.slip_days} day{session.slip_days > 1 ? 's' : ''}
                  </p>
                )}

                {/* Action Button */}
                <GlassButton
                  size="sm"
                  onClick={() => onSelectSession(session)}
                  className={`w-full ${
                    session.days_until_slip <= 1 
                      ? '!bg-gradient-to-r !from-red-500 !to-orange-500' 
                      : session.days_until_slip <= 3
                      ? '!bg-gradient-to-r !from-amber-500 !to-orange-500'
                      : ''
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  Do Now
                </GlassButton>
              </div>
            );
          })}
        </div>
      )}

      {/* Collapsed Summary */}
      {isCollapsed && isUrgent && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
          <p className="text-xs text-amber-700">
            ⚠️ {sortedSessions.filter(s => s.days_until_slip <= 2).length} session{sortedSessions.filter(s => s.days_until_slip <= 2).length > 1 ? 's' : ''} need attention soon
          </p>
        </div>
      )}
    </GlassCard>
  );
}