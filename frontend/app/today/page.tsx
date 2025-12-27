'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { 
  Calendar as CalendarIcon, 
  CheckCircle, 
  Circle, 
  Loader2, 
  MessageSquare, 
  ListTodo,
  X 
} from 'lucide-react';
import TodayTaskCard from '@/components/today/TodayTaskCard';
import TodayChat from '@/components/today/TodayChat';
import { chatAPI, scheduleAPI } from '@/lib/api';
import {
  GlassCard,
  GlassButton,
  GlassTextarea,
  GlassIconBox,
  GlassProgress,
  WallpaperBackground,
} from '@/components/ui/GlassUI';

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

export default function TodayPage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [activeTask, setActiveTask] = useState<TodayTask | null>(null);
  const [notes, setNotes] = useState('');
  
  const [mobileTab, setMobileTab] = useState<'tasks' | 'chat'>('tasks');

  const { data: todayData, isLoading } = useQuery({
    queryKey: ['today-summary', userId],
    queryFn: async () => {
      const data = await chatAPI.getTodaySummary(userId);
      return data;
    },
    refetchInterval: 30000,
  });

  const completeMutation = useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
      return scheduleAPI.completeBlockWithNotes(taskId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setShowNotesModal(false);
      setActiveTask(null);
      setNotes('');
    },
  });

  const allBlocks = (todayData?.tasks || []) as TodayTask[];
  const tasks = allBlocks.filter((t: any) => 
    t.goal_id && !['work', 'commute', 'event', 'sleep', 'social'].includes(t.type)
  );
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const now = new Date();
  const isOverdue = (task: TodayTask) => {
    const scheduledEnd = new Date(new Date(task.scheduled_time).getTime() + task.duration_mins * 60000);
    return scheduledEnd < now && task.status !== 'completed';
  };

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const handleComplete = (task: TodayTask) => {
    setActiveTask(task);
    setNotes('');
    setShowNotesModal(true);
  };

  const handleActivityLogged = () => {
    queryClient.invalidateQueries({ queryKey: ['today-summary'] });
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
  };

  const handleTaskComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['today-summary'] });
  };

  // Task List Content
  const TaskListContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-6">
        <GlassCard className="p-5" hover={false}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CalendarIcon className="w-5 h-5 text-slate-500" />
                <h1 className="text-xl font-semibold text-slate-700">Today</h1>
              </div>
              <p className="text-sm text-slate-400">{today}</p>
            </div>
            
            {!isLoading && tasks.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-700">{pendingTasks.length}</div>
                  <div className="text-xs text-slate-400">to do</div>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{completedTasks.length}</div>
                  <div className="text-xs text-slate-400">done</div>
                </div>
              </div>
            )}
          </div>

          {tasks.length > 0 && (
            <div className="mt-4">
              <GlassProgress value={(completedTasks.length / tasks.length) * 100} />
            </div>
          )}
        </GlassCard>
      </div>

      {/* Task List - Added extra bottom padding for mobile nav */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-24 md:pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <GlassCard className="p-8 text-center" hover={false}>
            <GlassIconBox size="lg" className="mx-auto mb-4">
              <CalendarIcon className="w-6 h-6 text-slate-400" />
            </GlassIconBox>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No sessions today</h3>
            <p className="text-slate-500 text-sm">
              Rest day! Or generate a new schedule from the Schedule page.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {pendingTasks.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 px-1">
                  To Do ({pendingTasks.length})
                </h2>
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <TodayTaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      isOverdue={isOverdue(task)}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 px-1">
                  Completed ({completedTasks.length})
                </h2>
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <TodayTaskCard
                      key={task.id}
                      task={task}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <WallpaperBackground>
      <div className="flex flex-col lg:flex-row h-screen pb-20 md:pb-0 md:pt-16">
        
        {/* Mobile Tab Bar */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/60">
          <div className="flex">
            <button
              onClick={() => setMobileTab('tasks')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                mobileTab === 'tasks'
                  ? 'text-slate-700 border-b-2 border-slate-700 bg-white/50'
                  : 'text-slate-400'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Tasks
              {pendingTasks.length > 0 && (
                <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">
                  {pendingTasks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                mobileTab === 'chat'
                  ? 'text-slate-700 border-b-2 border-slate-700 bg-white/50'
                  : 'text-slate-400'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Pepzi AI
            </button>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="lg:hidden flex-1 pt-14 overflow-hidden">
          {mobileTab === 'tasks' ? (
            <div className="h-full overflow-y-auto">
              <TaskListContent />
            </div>
          ) : (
            <div className="h-full">
              <TodayChat
                userId={userId}
                tasks={tasks}
                onActivityLogged={handleActivityLogged}
                onTaskComplete={handleTaskComplete}
              />
            </div>
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex lg:flex-row flex-1">
          {/* Left - Tasks */}
          <div className="w-[55%] xl:w-[60%] border-r border-white/30 overflow-y-auto">
            <TaskListContent />
          </div>

          {/* Right - Chat */}
          <div className="w-[45%] xl:w-[40%] flex flex-col bg-white/20 backdrop-blur-sm">
            <TodayChat
              userId={userId}
              tasks={tasks}
              onActivityLogged={handleActivityLogged}
              onTaskComplete={handleTaskComplete}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* COMPLETION MODAL - FIXED: Now at TOP of screen on mobile    */}
        {/* Changed from items-end to items-start with pt-20            */}
        {/* ============================================================ */}
        {showNotesModal && activeTask && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999]"
            onClick={() => {
              setShowNotesModal(false);
              setActiveTask(null);
            }}
          >
            {/* Modal card - positioned at top with absolute */}
            <div 
              className="absolute top-16 left-4 right-4 mx-auto max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700">Nice work! 🎉</h3>
                    <p className="text-sm text-slate-500">{activeTask.name}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowNotesModal(false);
                      setActiveTask(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  How'd it go? (optional)
                </label>
                <GlassTextarea
                  value={notes}
                  onChange={setNotes}
                  placeholder="Any notes about this session..."
                  rows={2}
                />
                
                {activeTask.previous_notes && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-400 font-medium mb-1">📝 Last time:</p>
                    <p className="text-xs text-slate-600">{activeTask.previous_notes}</p>
                  </div>
                )}
              </div>

              {/* Footer with buttons */}
              <div className="p-4 border-t border-slate-100 flex gap-3">
                <GlassButton
                  variant="secondary"
                  onClick={() => {
                    setShowNotesModal(false);
                    setActiveTask(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  onClick={() => {
                    if (activeTask) {
                      completeMutation.mutate({ taskId: activeTask.id, notes });
                    }
                  }}
                  disabled={completeMutation.isPending}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  {completeMutation.isPending ? 'Saving...' : 'Log It'}
                </GlassButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </WallpaperBackground>
  );
}