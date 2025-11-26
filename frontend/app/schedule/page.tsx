'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleAPI, availabilityAPI } from '@/lib/api';
import { useUserStore } from '@/lib/store';
import {
  Calendar,
  LayoutGrid,
  List,
  Clock as ClockIcon,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import WeeklyScheduleBoard from '@/components/schedule/WeeklyScheduleBoard';
import HourlyCalendar from '@/components/schedule/HourlyCalendar';

export default function SchedulePage() {
  const userId = useUserStore((state) => state.userId);
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'hourly' | 'board' | 'list'>('hourly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);

  // Calculate week range
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  // Fetch schedule
  const {
    data: blocks = [],
    isLoading: isLoadingSchedule,
    refetch: refetchSchedule,
  } = useQuery({
    queryKey: ['schedule', userId, weekOffset],
    queryFn: () => scheduleAPI.getWeek(userId, weekOffset),
  });

  // Fetch availability
  const { data: availabilityData } = useQuery({
    queryKey: ['availability', userId],
    queryFn: () => availabilityAPI.get(userId),
  });

  // Auto-generate mutation
  const generateMutation = useMutation({
    mutationFn: () => scheduleAPI.autoGenerate(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      
      // Check for warnings
      if (data.warning) {
        setScheduleWarning(data.warning);
      } else {
        setScheduleWarning(null);
        alert(`✅ ${data.message}`);
      }
    },
    onError: (error: any) => {
      alert(`❌ ${error.response?.data?.message || 'Failed to generate schedule'}`);
    },
  });

  // Stats
  const trainingBlocks = blocks.filter((b) => !['work', 'commute', 'event', 'sleep'].includes(b.type));
  const completedBlocks = trainingBlocks.filter((b) => b.status === 'completed').length;
  const totalHours = Math.round(trainingBlocks.reduce((sum, b) => sum + b.duration_mins, 0) / 60);
  const completedHours = Math.round(
    trainingBlocks
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + b.duration_mins, 0) / 60
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              📅 Weekly Schedule
            </h1>
            <p className="text-gray-600">
              Your training sessions around work & commitments
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            {/* View Toggle */}
            <div className="flex bg-white rounded-full border border-gray-200 p-1">
              <button
                onClick={() => setViewMode('hourly')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'hourly'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                Hourly
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'board'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Board
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'list'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>

            {/* Generate Button */}
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-6 py-2 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`}
              />
              {generateMutation.isPending ? 'Generating...' : 'Generate Schedule'}
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        {scheduleWarning && (
          <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-800">Scheduling Conflict</h3>
              <p className="text-amber-700 text-sm">{scheduleWarning}</p>
              <p className="text-amber-600 text-xs mt-2">
                Consider: Reducing goal hours, extending timelines, or freeing up more time in your schedule.
              </p>
            </div>
            <button
              onClick={() => setScheduleWarning(null)}
              className="ml-auto text-amber-500 hover:text-amber-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{trainingBlocks.length}</div>
                <div className="text-xs text-gray-500">Sessions</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{completedBlocks}</div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalHours}h</div>
                <div className="text-xs text-gray-500">Total Time</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {trainingBlocks.length - completedBlocks}
                </div>
                <div className="text-xs text-gray-500">Remaining</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {isLoadingSchedule ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
            <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500">Loading schedule...</p>
          </div>
        ) : blocks.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Schedule Yet</h3>
            <p className="text-gray-600 mb-6">
              Generate your weekly schedule based on your goals and availability.
            </p>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-8 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generating...' : '🚀 Generate Schedule'}
            </button>
          </div>
        ) : viewMode === 'hourly' ? (
          <HourlyCalendar
            blocks={blocks}
            availability={availabilityData?.availability}
            userId={userId}
            onBlockUpdate={() => refetchSchedule()}
          />
        ) : viewMode === 'board' ? (
          <WeeklyScheduleBoard
            blocks={blocks}
            availability={availabilityData?.availability}
            userId={userId}
            onBlockUpdate={() => refetchSchedule()}
          />
        ) : (
          // List View
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">This Week's Sessions</h2>
              <div className="space-y-3">
                {trainingBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-colors ${
                      block.status === 'completed'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {block.status === 'completed' ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <ClockIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-gray-600">
                          {new Date(block.scheduled_start).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(block.scheduled_start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {block.duration_mins} min
                        </span>
                      </div>
                      <div className="font-medium text-gray-900">
                        {block.notes || block.type}
                      </div>
                      {block.goals && (
                        <div className="text-sm text-gray-500 mt-1">
                          Goal: {block.goals.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-500">
          💡 Tip: Click any empty time slot to add a work block, event, or other commitment. Training sessions will schedule around them.
        </div>
      </div>
    </div>
  );
}