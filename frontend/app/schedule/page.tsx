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
  Loader2,
  Target,
} from 'lucide-react';
import HourlyCalendar from '@/components/schedule/HourlyCalendar';
import MonthCalendar from '@/components/schedule/MonthCalendar';
import YearTimeline from '@/components/schedule/YearTimeline';
import {
  GlassCard,
  GlassButton,
  GlassTabs,
  GlassStat,
  GlassIconBox,
  WallpaperBackground,
} from '@/components/ui/GlassUI';

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
    <WallpaperBackground>
      <div className="h-screen flex flex-col md:pt-16 pb-16 md:pb-0 overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex-shrink-0 px-4 py-3">
          <GlassCard className="p-2" hover={false}>
            <div className="flex items-center justify-between gap-2">
              
              {/* View Toggle */}
              <GlassTabs
                tabs={[
                  { id: 'week', label: 'Week' },
                  { id: 'month', label: 'Month' },
                  { id: 'year', label: 'Year' },
                ]}
                activeTab={viewMode}
                onChange={(tab) => setViewMode(tab as 'week' | 'month' | 'year')}
                className="border-0 bg-transparent p-0"
              />

              {/* Stats Toggle */}
              <button
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/40 hover:bg-white/60 rounded-xl text-sm transition-all"
              >
                <span className="text-emerald-600 font-medium">{stats.completed}/{stats.total}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">{stats.totalHours}h</span>
                {showStats ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Regenerate Button */}
              {viewMode === 'week' && (
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="p-2.5 bg-white/40 hover:bg-white/60 rounded-xl disabled:opacity-50 transition-all"
                  title="Regenerate schedule"
                >
                  <RefreshCw className={`w-5 h-5 text-slate-500 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Expandable Stats Panel */}
            {showStats && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/40">
                <GlassStat value={stats.total} label="Sessions" />
                <GlassStat value={stats.completed} label="Done" />
                <GlassStat value={`${stats.totalHours}h`} label="Total" />
                <GlassStat value={stats.remaining} label="Left" />
              </div>
            )}
          </GlassCard>
        </div>

        {/* Warning Banner */}
        {scheduleWarning && (
          <div className="flex-shrink-0 mx-4 mb-2">
            <GlassCard className="p-3 bg-amber-50/80 border-amber-200/50" hover={false}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-700 flex-1">{scheduleWarning}</span>
                <button 
                  onClick={() => setScheduleWarning(null)}
                  className="p-1 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-amber-500" />
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Main Calendar Area */}
        <div className="flex-1 overflow-hidden mx-4 mb-4">
          <GlassCard className="h-full overflow-hidden" hover={false}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
              </div>
            ) : viewMode === 'week' ? (
              weekBlocks.length === 0 ? (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center">
                    <GlassIconBox size="lg" className="mx-auto mb-4">
                      <Calendar className="w-6 h-6 text-slate-400" />
                    </GlassIconBox>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Sessions</h3>
                    <p className="text-slate-500 text-sm mb-4">Add goals to generate your schedule</p>
                    <GlassButton onClick={() => window.location.href = '/goals'}>
                      <Target className="w-4 h-4" />
                      Add Goal
                    </GlassButton>
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
          </GlassCard>
        </div>
      </div>
    </WallpaperBackground>
  );
}