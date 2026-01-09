'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { 
  Calendar as CalendarIcon, 
  Loader2, 
  Rocket,
  CheckCircle2,
  Trophy,
  Clock,
  Zap,
  ChevronRight,
  X,
  Flame,
} from 'lucide-react';
import SessionCard from '@/components/today/SessionCard';
import BacklogSidebar from '@/components/today/BacklogSidebar';
import ActiveSessionView from '@/components/today/ActiveSessionView';
import CrashTestClient from './CrashTest.client';

// Backlog session type
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

// Get Ahead option type
interface GetAheadOption {
  goal_id: string;
  goal_name: string;
  category: string;
  next_session: {
    id: string;
    name: string;
    description: string;
    session_number: number;
    total_sessions: number;
    duration_mins: number;
    scheduled_start: string;
    days_until_scheduled: number;
  };
  time_saved_days: number;
  new_target_date: string;
  resource_link: string | null;
  resource_link_label: string | null;
}

import { scheduleAPI, chatAPI } from '@/lib/api';
import {
  GlassCard,
  GlassButton,
  GlassIconBox,
  GlassProgress,
  WallpaperBackground,
} from '@/components/ui/GlassUI';

interface TodaySession {
  id: string;
  name: string;
  description?: string;
  goal_name: string;
  goal_id?: string;
  category?: string;
  type?: string;
  session_number?: number;
  total_sessions?: number;
  duration_mins: number;
  status: string;
  started_at?: string | null;
  completed_at?: string;
  chatgpt_link?: string;
}

// Category styles
const categoryStyles: Record<string, { emoji: string; bgColor: string }> = {
  fitness: { emoji: '🏃', bgColor: 'bg-orange-500' },
  climbing: { emoji: '🧗', bgColor: 'bg-amber-500' },
  languages: { emoji: '🌍', bgColor: 'bg-blue-500' },
  business: { emoji: '💼', bgColor: 'bg-purple-500' },
  creative: { emoji: '🎨', bgColor: 'bg-pink-500' },
  mental_health: { emoji: '🧘', bgColor: 'bg-teal-500' },
  skill: { emoji: '🎯', bgColor: 'bg-indigo-500' },
  education: { emoji: '📚', bgColor: 'bg-cyan-500' },
  health: { emoji: '❤️', bgColor: 'bg-red-500' },
  default: { emoji: '✨', bgColor: 'bg-slate-500' },
};

// 🔴 STABILITY TEST - Set to true locally to test error boundary, keep false for deploy
const CRASH_TEST_ENABLED = false;

export default function TodayPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  const [activeSession, setActiveSession] = useState<TodaySession | null>(null);
  const [isGetAheadSession, setIsGetAheadSession] = useState(false);
  const [showGetAheadModal, setShowGetAheadModal] = useState(false);

  const { data: todayData, isLoading } = useQuery({
    queryKey: ['today-sessions', userId],
    queryFn: async () => {
      const data = await chatAPI.getTodaySummary(userId);
      return data.tasks || [];
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const { data: backlogData } = useQuery({
    queryKey: ['backlog-sessions', userId],
    queryFn: async () => {
      try {
        const data = await scheduleAPI.getBacklog(userId);
        return (data.sessions || []) as BacklogSession[];
      } catch (err) {
        console.error('Failed to fetch backlog:', err);
        return [] as BacklogSession[];
      }
    },
    enabled: !!userId,
    refetchInterval: 60000,
  });

  const { data: getAheadData, isLoading: getAheadLoading } = useQuery({
    queryKey: ['get-ahead-options', userId],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://pepzi-backend-1029121217006.europe-west1.run.app'}/api/schedule/get-ahead-options?user_id=${userId}`
      );
      if (!response.ok) throw new Error('Failed to fetch get-ahead options');
      return response.json();
    },
    enabled: !!userId && showGetAheadModal,
  });

  const allSessions = (todayData || []).map((task: any): TodaySession => ({
    id: task.id,
    name: task.name,
    description: task.description,
    goal_name: task.goal_name,
    goal_id: task.goal_id,
    category: task.category,
    type: task.type,
    session_number: task.session_number,
    total_sessions: task.total_sessions,
    duration_mins: task.duration_mins,
    status: task.status,
    started_at: task.started_at || null,
    completed_at: task.completed_at,
    chatgpt_link: task.chatgpt_link || task.resource_link,
  }));

  const todaySessions = allSessions.filter((s: TodaySession) => {
    const blockerTypes = ['work', 'commute', 'event', 'sleep', 'social'];
    if (blockerTypes.includes(s.category || '') || blockerTypes.includes(s.type || '')) {
      return false;
    }
    return s.goal_id || s.type === 'training' || s.type === 'workout';
  });
  
  const pendingSessions = todaySessions.filter((s: TodaySession) => s.status !== 'completed');
  const completedSessions = todaySessions.filter((s: TodaySession) => s.status === 'completed');
  const backlogSessions = (backlogData || []) as BacklogSession[];
  const getAheadOptions = (getAheadData?.options || []) as GetAheadOption[];
  const canGetAhead = pendingSessions.length === 0 && backlogSessions.length === 0;

  const handleStartSession = (sessionId: string) => {
    const session = todaySessions.find((s: TodaySession) => s.id === sessionId);
    if (session) {
      setIsGetAheadSession(false);
      setActiveSession(session);
    }
  };

  const handleSelectBacklog = (backlogSession: BacklogSession) => {
    const session: TodaySession = {
      id: backlogSession.id,
      name: backlogSession.name,
      description: '',
      goal_name: backlogSession.goal_name,
      goal_id: backlogSession.goal_id,
      category: backlogSession.category,
      session_number: backlogSession.session_number,
      duration_mins: backlogSession.duration_mins,
      status: 'scheduled',
      started_at: null,
      chatgpt_link: backlogSession.resource_link || undefined,
    };
    setIsGetAheadSession(false);
    setActiveSession(session);
  };

  const handleSelectGetAhead = (option: GetAheadOption) => {
    const session: TodaySession = {
      id: option.next_session.id,
      name: option.next_session.name,
      description: option.next_session.description,
      goal_name: option.goal_name,
      goal_id: option.goal_id,
      category: option.category,
      session_number: option.next_session.session_number,
      total_sessions: option.next_session.total_sessions,
      duration_mins: option.next_session.duration_mins,
      status: 'scheduled',
      started_at: null,
      chatgpt_link: option.resource_link || undefined,
    };
    setIsGetAheadSession(true);
    setActiveSession(session);
    setShowGetAheadModal(false);
  };

  const handleCloseActiveSession = () => {
    setActiveSession(null);
    setIsGetAheadSession(false);
  };

  const handleSessionCompleted = () => {
    setActiveSession(null);
    setIsGetAheadSession(false);
    queryClient.invalidateQueries({ queryKey: ['today-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['backlog-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['get-ahead-options'] });
  };

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formatScheduledDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  if (authLoading) {
    return (
      <WallpaperBackground>
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
        </div>
      </WallpaperBackground>
    );
  }

  if (activeSession) {
    return (
      <ActiveSessionView
        session={activeSession}
        userId={userId}
        onClose={handleCloseActiveSession}
        onComplete={handleSessionCompleted}
        isGetAhead={isGetAheadSession}
      />
    );
  }

  return (
    <WallpaperBackground>
      {/* 🔴 CRASH TEST - Only triggers when CRASH_TEST_ENABLED is true */}
      <CrashTestClient enabled={CRASH_TEST_ENABLED} />
      
      <div className="min-h-screen pb-24 md:pb-8 md:pt-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          
          <div className="py-4 md:py-6">
            <GlassCard className="p-5" hover={false}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-5 h-5 text-slate-500" />
                    <h1 className="text-xl font-semibold text-slate-700">Your focus today</h1>
                  </div>
                  <p className="text-sm text-slate-400">{today}</p>
                </div>
                
                {!isLoading && todaySessions.length > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-700">{pendingSessions.length}</div>
                      <div className="text-xs text-slate-400">
                        {pendingSessions.length === 1 ? 'session' : 'sessions'} planned
                      </div>
                    </div>
                    {completedSessions.length > 0 && (
                      <>
                        <div className="w-px h-10 bg-slate-200" />
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-600">{completedSessions.length}</div>
                          <div className="text-xs text-slate-400">done</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {todaySessions.length > 0 && (
                <div className="mt-4">
                  <GlassProgress value={(completedSessions.length / todaySessions.length) * 100} />
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    One focused session a day is enough
                  </p>
                </div>
              )}
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-4">
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : pendingSessions.length === 0 && completedSessions.length === 0 ? (
                <GlassCard className="p-8 text-center" hover={false}>
                  <GlassIconBox size="lg" className="mx-auto mb-4">
                    <CalendarIcon className="w-6 h-6 text-slate-400" />
                  </GlassIconBox>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">You are on track</h3>
                  <p className="text-slate-500 text-sm mb-4">
                    No sessions scheduled today. Catch up on past tasks, rest up or get ahead if you want
                  </p>
                  <GlassButton
                    onClick={() => setShowGetAheadModal(true)}
                    className="!bg-gradient-to-r !from-violet-500 !to-purple-500"
                  >
                    <Rocket className="w-4 h-4" />
                    Get Ahead
                  </GlassButton>
                </GlassCard>
              ) : (
                <>
                  {pendingSessions.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 px-1">
                        Today's Sessions ({pendingSessions.length})
                      </h2>
                      <div className="space-y-3">
                        {pendingSessions.map((session: TodaySession) => (
                          <SessionCard
                            key={session.id}
                            session={session}
                            onStart={handleStartSession}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingSessions.length === 0 && completedSessions.length > 0 && (
                    <GlassCard className="p-6 text-center bg-gradient-to-br from-emerald-50/80 to-green-50/80" hover={false}>
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-8 h-8 text-emerald-600" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-700 mb-2">All done for today! 🎉</h3>
                      <p className="text-slate-500 text-sm mb-4">
                        You've completed all {completedSessions.length} session{completedSessions.length > 1 ? 's' : ''}.
                      </p>
                      
                      {canGetAhead && (
                        <GlassButton
                          onClick={() => setShowGetAheadModal(true)}
                          className="!bg-gradient-to-r !from-violet-500 !to-purple-500"
                        >
                          <Rocket className="w-4 h-4" />
                          Get Ahead
                        </GlassButton>
                      )}
                    </GlassCard>
                  )}

                  {completedSessions.length > 0 && pendingSessions.length > 0 && (
                    <div className="mt-6">
                      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 px-1">
                        Completed ({completedSessions.length})
                      </h2>
                      <div className="space-y-3">
                        {completedSessions.map((session: TodaySession) => (
                          <GlassCard key={session.id} className="p-4 opacity-75" hover={false}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-600 line-through">
                                  {session.session_number 
                                    ? `Session ${session.session_number}` 
                                    : session.name
                                  }
                                </p>
                                <p className="text-sm text-slate-400">{session.goal_name}</p>
                              </div>
                            </div>
                          </GlassCard>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="lg:col-span-1 space-y-4">
              {backlogSessions.length > 0 && (
                <div className="sticky top-24">
                  <BacklogSidebar 
                    sessions={backlogSessions}
                    onSelectSession={handleSelectBacklog}
                  />
                </div>
              )}

              {backlogSessions.length === 0 && (
                <GlassCard className="p-4 bg-gradient-to-br from-violet-50/80 to-purple-50/80" hover={false}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-700">Get Ahead</h3>
                      <p className="text-xs text-slate-500">Optional: work ahead if you want</p>
                    </div>
                  </div>
                  <GlassButton
                    onClick={() => setShowGetAheadModal(true)}
                    className="w-full !bg-gradient-to-r !from-violet-500 !to-purple-500"
                    size="sm"
                  >
                    View Options
                  </GlassButton>
                </GlassCard>
              )}
            </div>
          </div>
        </div>
      </div>

      {showGetAheadModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowGetAheadModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-violet-500 to-purple-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Rocket className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Get Ahead</h2>
                    <p className="text-violet-100 text-sm">Complete future sessions early</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGetAheadModal(false)}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {getAheadLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
              ) : getAheadOptions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-700 mb-2">All caught up!</h3>
                  <p className="text-slate-500 text-sm">No future sessions to get ahead on.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getAheadOptions.map((option) => {
                    const style = categoryStyles[option.category] || categoryStyles.default;
                    return (
                      <button
                        key={option.next_session.id}
                        onClick={() => handleSelectGetAhead(option)}
                        className="w-full p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-left transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 ${style.bgColor} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                            {style.emoji}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-500">{option.goal_name}</p>
                            <h4 className="font-semibold text-slate-700 mb-1">
                              {option.next_session.name}
                            </h4>
                            
                            <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {option.next_session.duration_mins}m
                              </span>
                              <span>
                                Scheduled: {formatScheduledDate(option.next_session.scheduled_start)}
                              </span>
                            </div>

                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                              <Zap className="w-3 h-3" />
                              Finish {option.time_saved_days} day{option.time_saved_days > 1 ? 's' : ''} earlier!
                            </div>
                          </div>

                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </WallpaperBackground>
  );
}