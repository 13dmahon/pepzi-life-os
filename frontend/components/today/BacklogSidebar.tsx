'use client';

import { useState } from 'react';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Clock,
  Play,
  CalendarX,
  Sparkles,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassUI';

interface BacklogSession {
  id: string;
  name: string;
  description?: string;
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

// Generate the AI session prompt with full context
function generateSessionPrompt(session: BacklogSession): string {
  const sessionNumber = session.session_number || 1;
  const goalName = session.goal_name;
  const durationMins = session.duration_mins;
  const completedSessions = sessionNumber - 1;
  
  // Use description if available, otherwise a sensible default
  const focusIntent = session.description 
    ? session.description 
    : 'building consistency and making progress';

  // Build the progress line - backlog doesn't have total_sessions, so we adapt
  let progressLine = `I'm on Session ${sessionNumber} of "${goalName}".`;
  if (completedSessions > 0) {
    progressLine += `\n\nThis is part of a longer plan, and I've already completed ${completedSessions} session${completedSessions > 1 ? 's' : ''}.`;
  }

  // Add context that this is a catch-up session
  const catchUpContext = session.days_until_slip <= 0 
    ? `\n\nNote: This session is overdue, so I want to get back on track without burning out.`
    : session.days_until_slip <= 2
    ? `\n\nNote: This session needs to be completed soon to stay on schedule.`
    : '';

  return `${progressLine}${catchUpContext}

Today I have ${durationMins} minutes.

The intended focus for this session is:
"${focusIntent}"

I want this session to:
- Build momentum
- Avoid overreaching
- Move me meaningfully forward

Please:
1. Break this session into clear steps
2. Tell me what "good progress" looks like
3. Tell me when to stop`;
}

// Individual backlog session card with prompt
function BacklogSessionCard({ 
  session, 
  onSelectSession,
  isLast 
}: { 
  session: BacklogSession; 
  onSelectSession: (session: BacklogSession) => void;
  isLast: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const prompt = generateSessionPrompt(session);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenChatGPT = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt).catch(() => {});
    window.open('https://chat.openai.com/', '_blank');
  };

  // Format deadline
  const formatDeadline = (dateStr: string, daysUntil: number) => {
    if (daysUntil <= 0) return 'Overdue';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil <= 7) return `${daysUntil} days`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className={`p-4 ${!isLast ? 'border-b border-amber-100/50' : ''}`}>
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

      {/* AI Prompt Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowPrompt(!showPrompt);
        }}
        className="w-full mt-2 py-1.5 flex items-center justify-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 transition-colors"
      >
        <Sparkles className="w-3 h-3" />
        <span>Using ChatGPT? Get prompt</span>
        {showPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* AI Prompt Panel */}
      {showPrompt && (
        <div className="mt-2 p-3 bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border border-violet-100">
          {/* Prompt Text */}
          <div className="relative">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-white/60 rounded-lg p-2 border border-violet-100 max-h-32 overflow-y-auto">
              {prompt}
            </pre>
            
            {/* Copy Button (top right corner) */}
            <button
              onClick={handleCopy}
              className="absolute top-1 right-1 p-1 bg-white rounded shadow-sm hover:bg-violet-50 transition-colors border border-violet-200"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-violet-500" />
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-1.5 px-2 bg-white hover:bg-violet-50 text-violet-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-1 text-xs border border-violet-200"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
            
            <button
              onClick={handleOpenChatGPT}
              className="flex-1 py-1.5 px-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-1 text-xs"
            >
              <ExternalLink className="w-3 h-3" />
              ChatGPT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BacklogSidebar({ sessions, onSelectSession }: BacklogSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (sessions.length === 0) return null;

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
        <div className="border-t border-amber-200/50 max-h-[500px] overflow-y-auto">
          {sortedSessions.map((session, idx) => (
            <BacklogSessionCard
              key={session.id}
              session={session}
              onSelectSession={onSelectSession}
              isLast={idx === sortedSessions.length - 1}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}