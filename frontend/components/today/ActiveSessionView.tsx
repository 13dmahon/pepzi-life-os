'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Target,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Timer,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trophy,
  Flame,
  Rocket,
  Zap,
} from 'lucide-react';

interface Session {
  id: string;
  name: string;
  description?: string;
  goal_name: string;
  goal_id?: string;
  category?: string;
  duration_mins: number;
  status: string;
  started_at?: string | null;
}

interface SessionStats {
  goal: {
    id: string;
    name: string;
    category: string;
    target_date: string;
    original_target_date: string;
    resource_link: string | null;
    resource_link_label: string | null;
  };
  progress: {
    completed_sessions: number;
    total_sessions: number;
    current_session_number: number;
    percent_complete: number;
    total_hours_logged: number;
    target_hours: number;
  };
  timing: {
    average_session_mins: number;
    planned_session_mins: number;
    sessions_per_week: number;
  };
  slippage: {
    has_slipped: boolean;
    days_slipped: number;
    original_target_date: string;
    current_target_date: string;
    predicted_finish_date: string;
  };
  backlog: {
    missed_sessions: number;
    missed_session_ids: string[];
  };
  session_history: Array<{
    id: string;
    session_name: string;
    completed_at: string;
    duration_mins: number;
    actual_duration_seconds?: number;
    notes: string;
  }>;
}

interface ActiveSessionViewProps {
  session: Session;
  userId: string;
  onClose: () => void;
  onComplete: () => void;
  isGetAhead?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://pepzi-backend-1029121217006.europe-west1.run.app';

export default function ActiveSessionView({
  session,
  userId,
  onClose,
  onComplete,
  isGetAhead = false,
}: ActiveSessionViewProps) {
  const queryClient = useQueryClient();
  
  // Stopwatch state
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  
  // Completion form
  const [durationMins, setDurationMins] = useState(session.duration_mins || 60);
  const [diaryNotes, setDiaryNotes] = useState('');
  const [showLogbook, setShowLogbook] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Fetch goal stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['session-stats', session.goal_id],
    queryFn: async () => {
      if (!session.goal_id) return null;
      const response = await fetch(
        `${API_BASE}/api/schedule/session-stats/${session.goal_id}?user_id=${userId}`
      );
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<SessionStats>;
    },
    enabled: !!session.goal_id,
  });

  // Stopwatch effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  // Format stopwatch
  const formatStopwatch = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Complete session mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      // Use different endpoint for Get Ahead sessions
      const endpoint = isGetAhead 
        ? `${API_BASE}/api/schedule/${session.id}/do-ahead`
        : `${API_BASE}/api/schedule/${session.id}/complete-session`;
      
      const method = isGetAhead ? 'POST' : 'PATCH';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_seconds: durationMins * 60,
          diary_notes: diaryNotes,
        }),
      });
      if (!response.ok) throw new Error('Failed to complete session');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['today-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-count'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['session-stats'] });
      queryClient.invalidateQueries({ queryKey: ['get-ahead-options'] });
      onComplete();
    },
  });

  const handleComplete = () => {
    setIsCompleting(true);
    completeMutation.mutate();
  };

  // Escape to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Prevent scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-slate-400 text-sm">{session.goal_name}</p>
                  {isGetAhead && (
                    <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded-full flex items-center gap-1">
                      <Rocket className="w-3 h-3" />
                      Get Ahead
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-white">{session.name}</h1>
              </div>
            </div>
            
            {stats && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full">
                <span className="text-slate-400 text-sm">Session</span>
                <span className="text-white font-bold">
                  {stats.progress.current_session_number} / {stats.progress.total_sessions}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Get Ahead Banner */}
        {isGetAhead && (
          <div className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-2xl p-4 border border-violet-500/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-xl">
                <Zap className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <p className="text-violet-200 font-medium">You're getting ahead! 🚀</p>
                <p className="text-violet-300/70 text-sm">
                  Complete this session early to pull your goal deadline forward.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {statsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Predicted Finish */}
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-400 text-xs uppercase tracking-wide">Finish Date</span>
              </div>
              <p className="text-white font-bold text-lg">
                {formatDate(stats.slippage.predicted_finish_date)}
              </p>
              {stats.slippage.has_slipped && stats.slippage.days_slipped > 0 && (
                <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Slipped {stats.slippage.days_slipped} days
                </p>
              )}
              {stats.slippage.days_slipped < 0 && (
                <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {Math.abs(stats.slippage.days_slipped)} days ahead!
                </p>
              )}
            </div>

            {/* Missed Sessions */}
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400 text-xs uppercase tracking-wide">Missed</span>
              </div>
              <p className={`font-bold text-lg ${stats.backlog.missed_sessions > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {stats.backlog.missed_sessions} sessions
              </p>
            </div>

            {/* Average Time */}
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400 text-xs uppercase tracking-wide">Avg Time</span>
              </div>
              <p className="text-white font-bold text-lg">
                {stats.timing.average_session_mins} mins
              </p>
            </div>

            {/* Progress */}
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-slate-400 text-xs uppercase tracking-wide">Progress</span>
              </div>
              <p className="text-white font-bold text-lg">
                {stats.progress.percent_complete}%
              </p>
            </div>
          </div>
        ) : null}

        {/* Resource Links */}
        {stats?.goal.resource_link && (
          <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-2xl p-4 border border-violet-500/20">
            <a
              href={stats.goal.resource_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-violet-300 hover:text-violet-200 transition-colors"
            >
              <div className="p-2 bg-violet-500/20 rounded-xl">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">
                  {stats.goal.resource_link_label || 'Open Resource'}
                </p>
                <p className="text-sm text-violet-400/70 truncate max-w-xs">
                  {stats.goal.resource_link}
                </p>
              </div>
            </a>
          </div>
        )}

        {/* Stopwatch */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-slate-400" />
              <h3 className="text-white font-semibold">Stopwatch</h3>
            </div>
            <span className="text-slate-500 text-sm">Optional timing tool</span>
          </div>
          
          <div className="text-center">
            <div className="text-5xl md:text-6xl font-mono font-bold text-white mb-6">
              {formatStopwatch(stopwatchSeconds)}
            </div>
            
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsStopwatchRunning(!isStopwatchRunning)}
                className={`p-4 rounded-2xl transition-colors ${
                  isStopwatchRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {isStopwatchRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              
              <button
                onClick={() => { setStopwatchSeconds(0); setIsStopwatchRunning(false); }}
                className="p-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
              
              {stopwatchSeconds > 0 && (
                <button
                  onClick={() => setDurationMins(Math.ceil(stopwatchSeconds / 60))}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                >
                  Use time ({Math.ceil(stopwatchSeconds / 60)} mins)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Session Logbook */}
        {stats && stats.session_history.length > 0 && (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => setShowLogbook(!showLogbook)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate-400" />
                <h3 className="text-white font-semibold">Session Logbook</h3>
                <span className="text-slate-500 text-sm">({stats.session_history.length} entries)</span>
              </div>
              {showLogbook ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            
            {showLogbook && (
              <div className="border-t border-slate-700/50 max-h-80 overflow-y-auto">
                {stats.session_history.map((entry, idx) => (
                  <div key={entry.id} className={`p-4 ${idx !== stats.session_history.length - 1 ? 'border-b border-slate-700/30' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-medium">{entry.session_name}</p>
                        <p className="text-slate-500 text-sm">{formatDate(entry.completed_at)}</p>
                      </div>
                      <span className="text-slate-400 text-sm">
                        {entry.actual_duration_seconds ? `${Math.round(entry.actual_duration_seconds / 60)} mins` : `${entry.duration_mins} mins`}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-slate-300 text-sm bg-slate-700/30 rounded-lg p-3 mt-2">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Complete Form */}
        <div className={`rounded-2xl p-6 border ${
          isGetAhead 
            ? 'bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20'
            : 'bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20'
        }`}>
          <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
            {isGetAhead ? (
              <>
                <Rocket className="w-5 h-5 text-violet-400" />
                Complete Early
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Complete Session
              </>
            )}
          </h3>
          
          {/* Duration Input */}
          <div className="mb-4">
            <label className="block text-slate-400 text-sm mb-2">How long did you work? (minutes)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={durationMins}
                onChange={(e) => setDurationMins(parseInt(e.target.value) || 0)}
                className="w-32 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                min="1"
                max="480"
              />
              <span className="text-slate-400">minutes</span>
              
              <div className="flex gap-2 ml-auto">
                {[15, 30, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setDurationMins(mins)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      durationMins === mins
                        ? isGetAhead ? 'bg-violet-500 text-white' : 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Diary Notes */}
          <div className="mb-6">
            <label className="block text-slate-400 text-sm mb-2">Session notes (optional)</label>
            <textarea
              value={diaryNotes}
              onChange={(e) => setDiaryNotes(e.target.value)}
              placeholder="What did you work on? How did it go?"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              rows={4}
            />
          </div>

          {/* Complete Button */}
          <button
            onClick={handleComplete}
            disabled={isCompleting || completeMutation.isPending}
            className={`w-full py-4 font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isGetAhead
                ? 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white'
                : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white'
            }`}
          >
            {isCompleting || completeMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : isGetAhead ? (
              <>
                <Rocket className="w-5 h-5" />
                Complete & Get Ahead!
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                Complete Session
              </>
            )}
          </button>
        </div>

        {/* Session Description */}
        {session.description && (
          <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/30">
            <p className="text-slate-400 text-sm mb-1">Session Focus</p>
            <p className="text-slate-200">{session.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}