'use client';

import { Clock, ExternalLink, Play } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassUI';

interface Session {
  id: string;
  name: string;
  description?: string;
  goal_name: string;
  goal_id?: string;
  category?: string;
  session_number?: number;
  total_sessions?: number;
  duration_mins: number;
  status: string;
  started_at?: string | null;
  chatgpt_link?: string;
}

interface SessionCardProps {
  session: Session;
  onStart: (sessionId: string) => void;
  onStop?: (sessionId: string, elapsedSeconds: number) => void; // Legacy, not used
  isStarting?: boolean;
}

// Category to emoji/color mapping
const categoryStyles: Record<string, { emoji: string; bgColor: string; textColor: string }> = {
  fitness: { emoji: '🏃', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
  climbing: { emoji: '🧗', bgColor: 'bg-amber-100', textColor: 'text-amber-600' },
  languages: { emoji: '🌍', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
  business: { emoji: '💼', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
  creative: { emoji: '🎨', bgColor: 'bg-pink-100', textColor: 'text-pink-600' },
  mental_health: { emoji: '🧘', bgColor: 'bg-teal-100', textColor: 'text-teal-600' },
  skill: { emoji: '🎯', bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' },
  education: { emoji: '📚', bgColor: 'bg-cyan-100', textColor: 'text-cyan-600' },
  health: { emoji: '❤️', bgColor: 'bg-red-100', textColor: 'text-red-600' },
  default: { emoji: '✨', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
};

export default function SessionCard({ session, onStart, isStarting }: SessionCardProps) {
  const style = categoryStyles[session.category || 'default'] || categoryStyles.default;

  return (
    <GlassCard className="p-4" hover={true}>
      <div className="flex items-start gap-4">
        {/* Category Icon */}
        <div className={`w-12 h-12 ${style.bgColor} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
          {style.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Goal Name */}
          <p className="text-slate-400 text-sm truncate">{session.goal_name}</p>
          
          {/* Session Name */}
          <h3 className="font-semibold text-slate-700 mb-1">
            {session.session_number 
              ? `${session.goal_name} - Session ${session.session_number}`
              : session.name
            }
          </h3>

          {/* Description */}
          {session.description && (
            <p className="text-slate-500 text-sm mb-2 line-clamp-2">
              {session.description}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-4 h-4" />
              <span>{session.duration_mins} min</span>
            </div>

            {session.chatgpt_link && (
              <a
                href={session.chatgpt_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-violet-500 hover:text-violet-600 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open ChatGPT</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={() => onStart(session.id)}
        disabled={isStarting}
        className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Play className="w-5 h-5" />
        Start Session
      </button>
    </GlassCard>
  );
}