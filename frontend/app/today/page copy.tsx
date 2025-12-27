'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Calendar as CalendarIcon, CheckCircle, Circle, Loader2, MessageSquare, ListTodo } from 'lucide-react';
import TodayTaskCard from '@/components/today/TodayTaskCard';
import TodayChat from '@/components/today/TodayChat';
import { chatAPI, scheduleAPI } from '@/lib/api';

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
  
  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'tasks' | 'chat'>('tasks');

  // Fetch today's tasks
  const { data: todayData, isLoading } = useQuery({
    queryKey: ['today-summary', userId],
    queryFn: async () => {
      const data = await chatAPI.getTodaySummary(userId);
      return data;
    },
    refetchInterval: 30000,
  });

  // Complete task mutation
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

  // Filter to only training sessions
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

  const handleTaskComplete = (taskId: string, notes: string) => {
    queryClient.invalidateQueries({ queryKey: ['today-summary'] });
  };

  // Task List Content
  const TaskListContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200 bg-white/80">
        <div className="flex items-center gap-3 mb-1">
          <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Today</h1>
        </div>
        <p className="text-sm text-gray-600">{today}</p>

        {!isLoading && tasks.length > 0 && (
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <Circle className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{pendingTasks.length} to do</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-600">{completedTasks.length} done</span>
            </div>
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No sessions today</h3>
            <p className="text-gray-500 text-sm">
              Rest day! Or generate a new schedule from the Schedule page.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
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
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
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
    <div className="flex flex-col lg:flex-row h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Mobile Tab Bar - Only visible on mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 pt-safe">
        <div className="flex">
          <button
            onClick={() => setMobileTab('tasks')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              mobileTab === 'tasks'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                : 'text-gray-500'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            Tasks
            {pendingTasks.length > 0 && (
              <span className="bg-purple-100 text-purple-600 text-xs px-1.5 py-0.5 rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              mobileTab === 'chat'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                : 'text-gray-500'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Pepzi AI
          </button>
        </div>
      </div>

      {/* Mobile Content Area */}
      <div className="lg:hidden flex-1 pt-12 pb-16 overflow-hidden">
        {mobileTab === 'tasks' ? (
          <div className="h-full overflow-y-auto bg-white/50 backdrop-blur-sm">
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

      {/* Desktop Layout - Side by side */}
      <div className="hidden lg:flex lg:flex-row flex-1 pt-16">
        {/* Left Side - Task List */}
        <div className="w-[55%] xl:w-[60%] border-r border-gray-200 bg-white/50 backdrop-blur-sm overflow-y-auto">
          <TaskListContent />
        </div>

        {/* Right Side - PA Chat */}
        <div className="w-[45%] xl:w-[40%] flex flex-col">
          <TodayChat
            userId={userId}
            tasks={tasks}
            onActivityLogged={handleActivityLogged}
            onTaskComplete={handleTaskComplete}
          />
        </div>
      </div>

      {/* Notes Modal */}
      {showNotesModal && activeTask && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl lg:rounded-2xl w-full lg:max-w-md shadow-xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Nice work! 🎉</h3>
              <p className="text-sm text-gray-500">{activeTask.name}</p>
            </div>
            
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How'd it go? (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this session..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none text-sm"
                rows={3}
                autoFocus
              />
              
              {activeTask.previous_notes && (
                <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium mb-1">📝 Last time:</p>
                  <p className="text-xs text-gray-600">{activeTask.previous_notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setActiveTask(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeTask) {
                    completeMutation.mutate({ taskId: activeTask.id, notes });
                  }
                }}
                disabled={completeMutation.isPending}
                className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {completeMutation.isPending ? 'Saving...' : 'Log It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}