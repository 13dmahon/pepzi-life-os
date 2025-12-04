'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleAPI, availabilityAPI, goalsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  differenceInCalendarWeeks,
} from 'date-fns';
import {
  Calendar,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import HourlyCalendar from '@/components/schedule/HourlyCalendar';
import MonthCalendar from '@/components/schedule/MonthCalendar';
import YearTimeline from '@/components/schedule/YearTimeline';

export default function SchedulePage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const {
    data: weekBlocks = [],
    isLoading: isLoadingWeek,
    refetch: refetchWeek,
  } = useQuery({
    queryKey: ['schedule', userId, 'week-extended'],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 28);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 112);
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const response = await scheduleAPI.getBlocks(userId, startStr, endStr);
      return response.blocks || response;
    },
    enabled: viewMode === 'week',
  });

  const {
    data: monthBlocks = [],
    isLoading: isLoadingMonth,
  } = useQuery({
    queryKey: ['schedule', userId, 'month', format(monthDate, 'yyyy-MM')],
    queryFn: async () => {
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      const response = await scheduleAPI.getBlocks(userId, startStr, endStr);
      return response.blocks || response;
    },
    enabled: viewMode === 'month',
  });

  const { data: goalsData, isLoading: isLoadingGoals } = useQuery({
    queryKey: ['goals', userId, 'year'],
    queryFn: () => goalsAPI.getGoals(userId),
    enabled: viewMode === 'year',
  });

  const { data: availabilityData } = useQuery({
    queryKey: ['availability', userId],
    queryFn: () => availabilityAPI.get(userId),
    enabled: viewMode === 'week',
  });

  const generateMutation = useMutation({
    mutationFn: () => scheduleAPI.autoGenerate(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      if (data.warning) {
        setScheduleWarning(data.warning);
      } else {
        setScheduleWarning(null);
      }
    },
  });

  const isLoading = viewMode === 'week' ? isLoadingWeek : viewMode === 'month' ? isLoadingMonth : isLoadingGoals;

  const stats = useMemo(() => {
    const blocks = viewMode === 'week' ? weekBlocks : monthBlocks;
    const trainingBlocks = blocks.filter((b) => !['work', 'commute', 'event', 'sleep'].includes(b.type));
    const completedBlocks = trainingBlocks.filter((b) => b.status === 'completed').length;
    const totalHours = Math.round(trainingBlocks.reduce((sum, b) => sum + b.duration_mins, 0) / 60);
    return { total: trainingBlocks.length, completed: completedBlocks, totalHours, remaining: trainingBlocks.length - completedBlocks };
  }, [weekBlocks, monthBlocks, viewMode]);

  const handleDayClick = (date: Date) => {
    const clickedWeekStart = startOfWeek(date, { weekStartsOn: 0 });
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekDiff = differenceInCalendarWeeks(clickedWeekStart, currentWeekStart, { weekStartsOn: 0 });
    setWeekOffset(weekDiff);
    setViewMode('week');
  };

  const handleGoalClick = (goalId: string) => {
    window.location.href = `/goals?highlight=${goalId}`;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 md:pt-16 pb-16 md:pb-0 overflow-hidden">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'week' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'month' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'year' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              Year
            </button>
          </div>

          {/* Stats Button */}
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
          >
            <span className="text-green-600 font-medium">{stats.completed}/{stats.total}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600">{stats.totalHours}h</span>
            {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Regenerate Button */}
          {viewMode === 'week' && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              title="Regenerate schedule"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Expandable Stats Panel */}
        {showStats && (
          <div className="grid grid-cols-4 gap-2 mt-3 pb-1">
            <div className="bg-purple-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-purple-700">{stats.total}</div>
              <div className="text-xs text-purple-600">Sessions</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-700">{stats.completed}</div>
              <div className="text-xs text-green-600">Done</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-700">{stats.totalHours}h</div>
              <div className="text-xs text-blue-600">Total</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-orange-700">{stats.remaining}</div>
              <div className="text-xs text-orange-600">Left</div>
            </div>
          </div>
        )}
      </div>

      {/* Warning Banner */}
      {scheduleWarning && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-700 flex-1">{scheduleWarning}</span>
          <button onClick={() => setScheduleWarning(null)}><X className="w-4 h-4 text-amber-500" /></button>
        </div>
      )}

      {/* Main Calendar Area - Takes remaining space */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === 'week' ? (
          weekBlocks.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Sessions</h3>
                <p className="text-gray-500 text-sm mb-4">Add goals to generate your schedule</p>
                <button
                  onClick={() => window.location.href = '/goals'}
                  className="px-6 py-2 bg-purple-500 text-white rounded-full text-sm font-medium"
                >
                  Add Goal
                </button>
              </div>
            </div>
          ) : (
            <HourlyCalendar
              blocks={weekBlocks}
              availability={availabilityData?.availability}
              userId={userId}
              onBlockUpdate={() => refetchWeek()}
              weekOffset={weekOffset}
              setWeekOffset={setWeekOffset}
            />
          )
        ) : viewMode === 'month' ? (
          <MonthCalendar
            blocks={monthBlocks}
            currentDate={monthDate}
            onDateChange={setMonthDate}
            onDayClick={handleDayClick}
          />
        ) : (
          <YearTimeline
            goals={goalsData || []}
            currentYear={currentYear}
            onYearChange={setCurrentYear}
            onGoalClick={handleGoalClick}
          />
        )}
      </div>
    </div>
  );
}