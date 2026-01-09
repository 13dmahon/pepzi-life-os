'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { 
  Calendar as CalendarIcon, 
  Loader2, 
  Rocket,
  CheckCircle2,
  Trophy
} from 'lucide-react';
import SessionCard from '@/components/today/SessionCard';
import BacklogSidebar from '@/components/today/BacklogSidebar';
import CompletionModal from '@/components/today/CompletionModal';

// Backlog session type - matches backend response
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
  type?: string;  // 🆕 Block type (training, workout, etc.)
  session_number?: number;
  total_sessions?: number;
  duration_mins: number;
  status: string;
  started_at?: string | null;
  completed_at?: string;
  chatgpt_link?: string;
}

export default function TodayPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  // Modal states
  const [completionModal, setCompletionModal] = useState<{
    isOpen: boolean;
    session: TodaySession | null;
    elapsedSeconds: number;
  }>({ isOpen: false, session: null, elapsedSeconds: 0 });
  
  const [showGetAhead, setShowGetAhead] = useState(false);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);
  
  // Track active backlog session (shown in main area when started)
  const [activeBacklogSession, setActiveBacklogSession] = useState<TodaySession | null>(null);

  // Fetch today's sessions using existing API
  const { data: todayData, isLoading } = useQuery({
    queryKey: ['today-sessions', userId],
    queryFn: async () => {
      const data = await chatAPI.getTodaySummary(userId);
      return data.tasks || [];
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  // Fetch backlog sessions
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

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const result = await scheduleAPI.startSession(sessionId);
      return result.block;
    },
    onMutate: (sessionId) => {
      setStartingSessionId(sessionId);
      
      // Optimistic update - set started_at locally
      queryClient.setQueryData(['today-sessions', userId], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((s: any) => 
          s.id === sessionId 
            ? { ...s, started_at: new Date().toISOString() }
            : s
        );
      });
      
      // Also update active backlog session if it matches
      setActiveBacklogSession(prev => 
        prev?.id === sessionId 
          ? { ...prev, started_at: new Date().toISOString(), status: 'in_progress' }
          : prev
      );
    },
    onError: (error, sessionId) => {
      console.error('Start session error:', error);
      // Revert today's sessions but keep activeBacklogSession 
      // (user can still use it even if backend failed)
      queryClient.invalidateQueries({ queryKey: ['today-sessions'] });
      // Only clear if it was a today session, not a backlog session
      // Don't clear activeBacklogSession - let user continue
    },
    onSettled: () => {
      setStartingSessionId(null);
    },
  });

  // Complete session mutation
  const completeMutation = useMutation({
    mutationFn: async (data: { 
      sessionId: string; 
      notes: string; 
      duration_seconds: number;
      photo?: File | null;
    }) => {
      await scheduleAPI.completeBlockWithNotes(data.sessionId, data.notes);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['today-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-count'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setCompletionModal({ isOpen: false, session: null, elapsedSeconds: 0 });
      
      // Clear active backlog session if it was the one completed
      if (activeBacklogSession?.id === data.sessionId) {
        setActiveBacklogSession(null);
      }
    },
  });

  // Process data - map from API format to our TodaySession format
  const allSessions = (todayData || []).map((task: any): TodaySession => ({
    id: task.id,
    name: task.name,
    description: task.description,
    goal_name: task.goal_name,
    goal_id: task.goal_id,
    category: task.category,
    type: task.type,  // 🆕 Include block type
    session_number: task.session_number,
    total_sessions: task.total_sessions,
    duration_mins: task.duration_mins,
    status: task.status,
    started_at: task.started_at || null,
    completed_at: task.completed_at,
    chatgpt_link: task.chatgpt_link || task.resource_link,
  }));

  // 🆕 FIXED: Filter to show goal-related sessions OR training/workout blocks
  // This allows manually created training sessions (without goal_id) to appear
  const todaySessions = allSessions.filter((s: TodaySession) => {
    // Exclude blocker types (work, commute, events, etc.)
    const blockerTypes = ['work', 'commute', 'event', 'sleep', 'social'];
    if (blockerTypes.includes(s.category || '') || blockerTypes.includes(s.type || '')) {
      return false;
    }
    // Include if: has goal_id OR is a training/workout type
    return s.goal_id || s.type === 'training' || s.type === 'workout';
  });
  
  const pendingSessions = todaySessions.filter((s: TodaySession) => s.status !== 'completed');
  const completedSessions = todaySessions.filter((s: TodaySession) => s.status === 'completed');
  const backlogSessions = (backlogData || []) as BacklogSession[];
  const filteredBacklogSessions = backlogSessions.filter(s => s.id !== activeBacklogSession?.id);

  // Check if Get Ahead is available (all today's work done + no backlog)
  const canGetAhead = pendingSessions.length === 0 && filteredBacklogSessions.length === 0 && completedSessions.length > 0 && !activeBacklogSession;

  // Handlers
  const handleStartSession = (sessionId: string) => {
    startMutation.mutate(sessionId);
  };

  const handleStopSession = (sessionId: string, elapsedSeconds: number) => {
    // Check regular sessions first
    let session = todaySessions.find((s: TodaySession) => s.id === sessionId);
    
    // If not found, check if it's the active backlog session
    if (!session && activeBacklogSession?.id === sessionId) {
      session = activeBacklogSession;
    }
    
    if (session) {
      setCompletionModal({
        isOpen: true,
        session,
        elapsedSeconds,
      });
    }
  };

  const handleCompleteSession = (data: { 
    notes: string; 
    duration_seconds: number;
    photo?: File | null;
  }) => {
    if (!completionModal.session) return;
    
    completeMutation.mutate({
      sessionId: completionModal.session.id,
      ...data,
    });
  };

  const handleSelectBacklog = async (session: BacklogSession) => {
    // Convert backlog session to TodaySession format and start it immediately
    const now = new Date().toISOString();
    const todaySession: TodaySession = {
      id: session.id,
      name: session.name,
      description: '', // Backlog sessions may not have description
      goal_name: session.goal_name,
      goal_id: session.goal_id,
      category: session.category,
      session_number: session.session_number,
      duration_mins: session.duration_mins,
      status: 'in_progress',
      started_at: now,  // Set immediately so timer shows
      chatgpt_link: session.resource_link || undefined, // Pass resource link for ChatGPT button
    };
    
    // Set as active backlog session (will show in main area with timer)
    setActiveBacklogSession(todaySession);
    
    // Start the session on backend (fire and forget - UI already shows timer)
    startMutation.mutate(session.id);
    
    // Refresh backlog so this session disappears from sidebar
    queryClient.invalidateQueries({ queryKey: ['backlog-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['backlog-count'] });
  };

  // Format today's date
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Loading state
  if (authLoading) {
    return (
      <WallpaperBackground>
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
        </div>
      </WallpaperBackground>
    );
  }

  return (
    <WallpaperBackground>
      <div className="min-h-screen pb-24 md:pb-8 md:pt-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          
          {/* Header */}
          <div className="py-4 md:py-6">
            <GlassCard className="p-5" hover={false}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-5 h-5 text-slate-500" />
                    <h1 className="text-xl font-semibold text-slate-700">Today</h1>
                  </div>
                  <p className="text-sm text-slate-400">{today}</p>
                </div>
                
                {!isLoading && todaySessions.length > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-700">{pendingSessions.length}</div>
                      <div className="text-xs text-slate-400">to do</div>
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{completedSessions.length}</div>
                      <div className="text-xs text-slate-400">done</div>
                    </div>
                  </div>
                )}
              </div>

              {todaySessions.length > 0 && (
                <div className="mt-4">
                  <GlassProgress value={(completedSessions.length / todaySessions.length) * 100} />
                </div>
              )}
            </GlassCard>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Sessions Column */}
            <div className="lg:col-span-2 space-y-4">
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : pendingSessions.length === 0 && completedSessions.length === 0 && !activeBacklogSession ? (
                /* Empty State */
                <GlassCard className="p-8 text-center" hover={false}>
                  <GlassIconBox size="lg" className="mx-auto mb-4">
                    <CalendarIcon className="w-6 h-6 text-slate-400" />
                  </GlassIconBox>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No sessions today</h3>
                  <p className="text-slate-500 text-sm">
                    Rest day! Or add a new goal from the Goals page.
                  </p>
                </GlassCard>
              ) : (
                <>
                  {/* Active Backlog Session (catching up) */}
                  {activeBacklogSession && activeBacklogSession.started_at && (
                    <div className="mb-4">
                      <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3 px-1">
                        🔥 Catching Up
                      </h2>
                      <SessionCard
                        key={activeBacklogSession.id}
                        session={activeBacklogSession}
                        onStart={handleStartSession}
                        onStop={handleStopSession}
                        isStarting={startingSessionId === activeBacklogSession.id}
                      />
                    </div>
                  )}

                  {/* Pending Sessions */}
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
                            onStop={handleStopSession}
                            isStarting={startingSessionId === session.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Done + Get Ahead */}
                  {pendingSessions.length === 0 && completedSessions.length > 0 && !activeBacklogSession && (
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
                          onClick={() => setShowGetAhead(true)}
                          className="!bg-gradient-to-r !from-violet-500 !to-purple-500"
                        >
                          <Rocket className="w-4 h-4" />
                          Get Ahead
                        </GlassButton>
                      )}
                    </GlassCard>
                  )}

                  {/* Completed Sessions */}
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

            {/* Sidebar - Backlog */}
            <div className="lg:col-span-1">
              {filteredBacklogSessions.length > 0 && (
                <div className="sticky top-24">
                  <BacklogSidebar 
                    sessions={filteredBacklogSessions}
                    onSelectSession={handleSelectBacklog}
                  />
                </div>
              )}

              {/* Get Ahead Card (when no backlog but all done) */}
              {filteredBacklogSessions.length === 0 && canGetAhead && (
                <GlassCard className="p-4 bg-gradient-to-br from-violet-50/80 to-purple-50/80" hover={false}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-700">Get Ahead</h3>
                      <p className="text-xs text-slate-500">Do tomorrow's session today</p>
                    </div>
                  </div>
                  <GlassButton
                    onClick={() => setShowGetAhead(true)}
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

      {/* Completion Modal */}
      <CompletionModal
        isOpen={completionModal.isOpen}
        onClose={() => setCompletionModal({ isOpen: false, session: null, elapsedSeconds: 0 })}
        onComplete={handleCompleteSession}
        session={completionModal.session || { id: '', name: '', goal_name: '' }}
        elapsedSeconds={completionModal.elapsedSeconds}
        isSubmitting={completeMutation.isPending}
      />

      {/* Get Ahead Modal */}
      {showGetAhead && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center"
          onClick={() => setShowGetAhead(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <GlassCard className="mx-4 max-w-md p-6 text-center">
              <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-8 h-8 text-violet-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">Get Ahead</h3>
              <p className="text-slate-500 text-sm mb-4">
                Choose a goal to work on tomorrow's session today. Your completion date will move closer!
              </p>
              <p className="text-xs text-slate-400 mb-4">
                (Get Ahead feature coming soon)
              </p>
              <GlassButton
                variant="secondary"
                onClick={() => setShowGetAhead(false)}
              >
                Close
              </GlassButton>
            </GlassCard>
          </div>
        </div>
      )}
    </WallpaperBackground>
  );
}