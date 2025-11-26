'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/lib/store';
import { Calendar as CalendarIcon, CheckCircle, Circle, Loader2 } from 'lucide-react';
import TodayTaskCard from '@/components/today/TodayTaskCard';
import TodayChat from '@/components/today/TodayChat';

interface TodayTask {
  id: string;
  name: string;
  description: string;
  tip: string;
  goal_name: string;
  goal_id: string;
  category: string;
  scheduled_time: string;
  duration_mins: number;
  status: string;
  completed_at?: string;
  tracked_data?: Record<string, any>;
  tracking_requirements: Array<{
    key: string;
    label: string;
    type: 'number' | 'boolean' | 'text' | 'scale';
    unit?: string;
    min?: number;
    max?: number;
  }>;
}

export default function TodayPage() {
  const userId = useUserStore((state) => state.userId);
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<TodayTask | null>(null);

  // Fetch today's tasks
  const { data: todayData, isLoading } = useQuery({
    queryKey: ['today-summary', userId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/today-summary?user_id=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch today summary');
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const tasks: TodayTask[] = todayData?.tasks || [];
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleActivityLogged = () => {
    // Refresh the task list
    queryClient.invalidateQueries({ queryKey: ['today-summary'] });
    setSelectedTask(null);
  };

  const handleSelectTask = (task: TodayTask) => {
    setSelectedTask(task);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-16 md:pt-20 pb-20 md:pb-0">
      {/* Left Side - Task List */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] border-r border-gray-200 bg-white/50 backdrop-blur-sm flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-white/80">
          <div className="flex items-center gap-3 mb-2">
            <CalendarIcon className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Today</h1>
          </div>
          <p className="text-sm text-gray-600">{today}</p>

          {/* Summary Stats */}
          {!isLoading && tasks.length > 0 && (
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <Circle className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{pendingTasks.length} pending</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-600">{completedTasks.length} done</span>
              </div>
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-6">
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
                Check your schedule or generate a new one from the Schedule page.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Tasks */}
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
                        onSelect={handleSelectTask}
                        isSelected={selectedTask?.id === task.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
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
                        onSelect={handleSelectTask}
                        isSelected={selectedTask?.id === task.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Chat */}
      <div className="flex-1 flex flex-col">
        <TodayChat
          userId={userId}
          onActivityLogged={handleActivityLogged}
          selectedTask={selectedTask ? { id: selectedTask.id, name: selectedTask.name } : null}
        />
      </div>

      {/* Mobile: Show task summary at top */}
      <div className="lg:hidden fixed top-16 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 z-40">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Today</h1>
            <p className="text-xs text-gray-500">{today}</p>
          </div>
          {!isLoading && (
            <div className="flex gap-3 text-sm">
              <span className="text-gray-600">{pendingTasks.length} pending</span>
              <span className="text-green-600">{completedTasks.length} done</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}