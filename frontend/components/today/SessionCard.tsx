'use client';

import { useState } from 'react';
import { Clock, ExternalLink, Play, Sparkles, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
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
  onStop?: (sessionId: string, elapsedSeconds: number) => void;
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

// Generate the AI session prompt with full context
function generateSessionPrompt(session: Session): string {
  const sessionNumber = session.session_number || 1;
  const totalSessions = session.total_sessions;
  const goalName = session.goal_name;
  const durationMins = session.duration_mins;
  const completedSessions = sessionNumber - 1;
  
  // Use description if available, otherwise a sensible default
  const focusIntent = session.description 
    ? session.description 
    : 'building consistency and making progress';

  // Build the progress line
  let progressLine = '';
  if (totalSessions) {
    progressLine = `I'm on Session ${sessionNumber} of ${totalSessions} for my goal "${goalName}".`;
    if (completedSessions > 0) {
      progressLine += `\n\nThis is part of a longer plan, and I've already completed ${completedSessions} session${completedSessions > 1 ? 's' : ''}.`;
    }
  } else {
    progressLine = `I'm on Session ${sessionNumber} of "${goalName}".`;
  }

  return `${progressLine}

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

export default function SessionCard({ session, onStart, isStarting }: SessionCardProps) {
  const style = categoryStyles[session.category || 'default'] || categoryStyles.default;
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const prompt = generateSessionPrompt(session);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenChatGPT = () => {
    // Copy to clipboard first, then open ChatGPT
    navigator.clipboard.writeText(prompt).catch(() => {});
    window.open('https://chat.openai.com/', '_blank');
  };

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
            {session.name}
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
                <span>Resource</span>
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

      {/* AI Prompt Toggle */}
      <button
        onClick={() => setShowPrompt(!showPrompt)}
        className="w-full mt-3 py-2 flex items-center justify-center gap-2 text-sm text-violet-600 hover:text-violet-700 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        <span>Using ChatGPT? Get session prompt</span>
        {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* AI Prompt Panel */}
      {showPrompt && (
        <div className="mt-3 p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
          {/* Prompt Text */}
          <div className="relative">
            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-white/60 rounded-lg p-3 border border-violet-100">
              {prompt}
            </pre>
            
            {/* Copy Button (top right corner) */}
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow-sm hover:bg-violet-50 transition-colors border border-violet-200"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-violet-500" />
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCopy}
              className="flex-1 py-2 px-3 bg-white hover:bg-violet-50 text-violet-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm border border-violet-200"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Prompt
                </>
              )}
            </button>
            
            <button
              onClick={handleOpenChatGPT}
              className="flex-1 py-2 px-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open ChatGPT
            </button>
          </div>

          <p className="text-xs text-violet-400 mt-2 text-center">
            Paste this prompt to get a step-by-step guide for your session
          </p>
        </div>
      )}
    </GlassCard>
  );
}