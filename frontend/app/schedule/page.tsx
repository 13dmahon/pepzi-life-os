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
  LayoutGrid,
  List,
  Clock as ClockIcon,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import WeeklyScheduleBoard from '@/components/schedule/WeeklyScheduleBoard';
import HourlyCalendar from '@/components/schedule/HourlyCalendar';
import MonthCalendar from '@/components/schedule/MonthCalendar';
import YearTimeline from '@/components/schedule/YearTimeline';

export default function SchedulePage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  // View state
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);

  // Calculate date ranges for different views
  const today = new Date();
  
  // Week view dates
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Month view dates
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Fetch schedule for WEEK view
  const {
    data: weekBlocks = [],
    isLoading: isLoadingWeek,
    refetch: refetchWeek,
  } = useQuery({
    queryKey: ['schedule', userId, 'week', weekOffset],
    queryFn: () => scheduleAPI.getWeek(userId, weekOffset),
    enabled: viewMode === 'week',
  });

  // Fetch schedule for MONTH view
  const {
    data: monthBlocks = [],
    isLoading: isLoadingMonth,
  } = useQuery({
    queryKey: ['schedule', userId, 'month', format(monthDate, 'yyyy-MM')],
    queryFn: async () => {
      // Fetch blocks for the entire month
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      const response = await scheduleAPI.getBlocks(userId, startStr, endStr);
      return response.blocks || response;
    },
    enabled: viewMode === 'month',
  });

  // Fetch goals for YEAR view
  const {
    data: goalsData,
    isLoading: isLoadingGoals,
  } = useQuery({
    queryKey: ['goals', userId, 'year'],
    queryFn: () => goalsAPI.getGoals(userId),
    enabled: viewMode === 'year',
  });

  // Fetch availability (used for week view)
  const { data: availabilityData } = useQuery({
    queryKey: ['availability', userId],
    queryFn: () => availabilityAPI.get(userId),
    enabled: viewMode === 'week',
  });

  // Auto-generate mutation
  const generateMutation = useMutation({
    mutationFn: () => scheduleAPI.autoGenerate(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      
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

  // Get current blocks based on view
  const currentBlocks = viewMode === 'week' ? weekBlocks : viewMode === 'month' ? monthBlocks : [];
  const isLoading = viewMode === 'week' ? isLoadingWeek : viewMode === 'month' ? isLoadingMonth : isLoadingGoals;

  // Stats (for week view)
  const stats = useMemo(() => {
    const blocks = viewMode === 'week' ? weekBlocks : monthBlocks;
    const trainingBlocks = blocks.filter((b) => !['work', 'commute', 'event', 'sleep'].includes(b.type));
    const completedBlocks = trainingBlocks.filter((b) => b.status === 'completed').length;
    const totalHours = Math.round(trainingBlocks.reduce((sum, b) => sum + b.duration_mins, 0) / 60);

    return {
      total: trainingBlocks.length,
      completed: completedBlocks,
      totalHours,
      remaining: trainingBlocks.length - completedBlocks,
    };
  }, [weekBlocks, monthBlocks, viewMode]);

  // Handle clicking a day in month view -> navigate to week view
  const handleDayClick = (date: Date) => {
    const clickedWeekStart = startOfWeek(date, { weekStartsOn: 0 });
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekDiff = differenceInCalendarWeeks(clickedWeekStart, currentWeekStart, { weekStartsOn: 0 });
    
    setWeekOffset(weekDiff);
    setViewMode('week');
  };

  // Handle clicking a goal in year view -> navigate to goals page
  const handleGoalClick = (goalId: string) => {
    window.location.href = `/goals?highlight=${goalId}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8 pb-24 md:pb-8 md:pt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              📅 {viewMode === 'week' ? 'Weekly' : viewMode === 'month' ? 'Monthly' : 'Yearly'} Schedule
            </h1>
            <p className="text-gray-600">
              {viewMode === 'week' && 'Your training sessions around work & commitments'}
              {viewMode === 'month' && 'Overview of your training month'}
              {viewMode === 'year' && 'Your goal timeline and progress'}
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            {/* View Toggle - Week/Month/Year */}
            <div className="flex bg-white rounded-full border border-gray-200 p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'week'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'month'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Month
              </button>
              <button
                onClick={() => setViewMode('year')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'year'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CalendarRange className="w-4 h-4" />
                Year
              </button>
            </div>

            {/* Regenerate Button - only show for week view */}
            {viewMode === 'week' && (
              <button
                onClick={() => {
                  if (window.confirm('This will regenerate ALL training sessions for the current week. Any manual changes will be lost. Continue?')) {
                    generateMutation.mutate();
                  }
                }}
                disabled={generateMutation.isPending}
                className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-full font-medium hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`}
                />
                {generateMutation.isPending ? 'Regenerating...' : 'Regenerate Week'}
              </button>
            )}
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

        {/* Stats Cards - show for week and month views */}
        {(viewMode === 'week' || viewMode === 'month') && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
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
                  <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
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
                  <div className="text-2xl font-bold text-gray-900">{stats.totalHours}h</div>
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
                  <div className="text-2xl font-bold text-gray-900">{stats.remaining}</div>
                  <div className="text-xs text-gray-500">Remaining</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
            <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500">Loading schedule...</p>
          </div>
        ) : viewMode === 'week' ? (
          // WEEK VIEW
          weekBlocks.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Sessions This Week</h3>
              <p className="text-gray-600 mb-2">
                Training sessions are automatically scheduled when you create goals with training plans.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Go to Goals → Add a goal → The schedule will appear here!
              </p>
              <button
                onClick={() => window.location.href = '/goals'}
                className="px-8 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all"
              >
                🎯 Add Your First Goal
              </button>
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
          // MONTH VIEW
          <MonthCalendar
            blocks={monthBlocks}
            currentDate={monthDate}
            onDateChange={setMonthDate}
            onDayClick={handleDayClick}
          />
        ) : (
          // YEAR VIEW
          <YearTimeline
            goals={goalsData || []}
            currentYear={currentYear}
            onYearChange={setCurrentYear}
            onGoalClick={handleGoalClick}
          />
        )}

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {viewMode === 'week' && '💡 Tip: Drag training blocks to move them. Add work/events with "Add Block" - training will schedule around them automatically.'}
          {viewMode === 'month' && '💡 Tip: Click any day to view that week\'s detailed schedule.'}
          {viewMode === 'year' && '💡 Tip: See your entire goal timeline. Click a goal to view its details.'}
        </div>
      </div>
    </div>
  );
}