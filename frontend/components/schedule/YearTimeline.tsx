'use client';

import { useMemo } from 'react';
import {
  format,
  startOfYear,
  endOfYear,
  startOfMonth,
  differenceInDays,
  addMonths,
  isSameMonth,
  parseISO,
  isAfter,
  isBefore,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Target, Calendar, CheckCircle } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface Goal {
  id: string;
  name: string;
  category: string;
  target_date?: string | null;
  status?: string;
  created_at?: string;
  progress?: {
    percentage?: number;
    completedMilestones?: number;
    totalMilestones?: number;
  };
  plan?: {
    total_weeks?: number;
    weekly_hours?: number;
  };
}

interface YearTimelineProps {
  goals: Goal[];
  currentYear: number;
  onYearChange: (year: number) => void;
  onGoalClick: (goalId: string) => void;
}

// ============================================================
// HELPERS
// ============================================================

const getCategoryColor = (category: string): { bg: string; border: string; text: string } => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    fitness: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
    business: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
    skill: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
    languages: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
    career: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800' },
    education: { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800' },
    creative: { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-800' },
    climbing: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800' },
    mental_health: { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-800' },
  };
  return colors[category] || { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function YearTimeline({
  goals,
  currentYear,
  onYearChange,
  onGoalClick,
}: YearTimelineProps) {
  const today = new Date();
  const yearStart = startOfYear(new Date(currentYear, 0, 1));
  const yearEnd = endOfYear(new Date(currentYear, 0, 1));
  const totalDays = differenceInDays(yearEnd, yearStart) + 1;

  // Calculate position of today marker
  const todayPosition = useMemo(() => {
    if (today.getFullYear() !== currentYear) return null;
    const dayOfYear = differenceInDays(today, yearStart);
    return (dayOfYear / totalDays) * 100;
  }, [today, currentYear, yearStart, totalDays]);

  // Process goals for timeline display
  const timelineGoals = useMemo(() => {
    return goals
      .filter((goal) => (goal.status === 'active' || !goal.status) && goal.target_date)
      .map((goal) => {
        const targetDate = parseISO(goal.target_date!);
        const createdDate = goal.created_at ? parseISO(goal.created_at) : yearStart;
        
        // Determine start date (created_at or start of year, whichever is later)
        let startDate = createdDate;
        if (isBefore(createdDate, yearStart)) {
          startDate = yearStart;
        }
        
        // Determine end date (target_date or end of year, whichever is earlier)
        let endDate = targetDate;
        if (isAfter(targetDate, yearEnd)) {
          endDate = yearEnd;
        }
        
        // Skip if goal doesn't overlap with current year
        if (isAfter(startDate, yearEnd) || isBefore(endDate, yearStart)) {
          return null;
        }

        const startDayOfYear = differenceInDays(startDate, yearStart);
        const endDayOfYear = differenceInDays(endDate, yearStart);
        
        const leftPercent = Math.max(0, (startDayOfYear / totalDays) * 100);
        const widthPercent = Math.min(100 - leftPercent, ((endDayOfYear - startDayOfYear) / totalDays) * 100);

        return {
          ...goal,
          startDate,
          endDate,
          targetDate,
          leftPercent,
          widthPercent,
          isOverdue: isAfter(today, targetDate),
          endsThisYear: targetDate.getFullYear() === currentYear,
        };
      })
      .filter(Boolean) as Array<Goal & {
        startDate: Date;
        endDate: Date;
        targetDate: Date;
        leftPercent: number;
        widthPercent: number;
        isOverdue: boolean;
        endsThisYear: boolean;
      }>;
  }, [goals, currentYear, yearStart, yearEnd, totalDays, today]);

  // Stats
  const stats = useMemo(() => {
    const activeGoals = goals.filter((g) => g.status === 'active' || !g.status).length;
    const completingThisYear = timelineGoals.filter((g) => g.endsThisYear).length;
    const overdue = timelineGoals.filter((g) => g.isOverdue).length;
    return { activeGoals, completingThisYear, overdue };
  }, [goals, timelineGoals]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
        <button
          onClick={() => onYearChange(currentYear - 1)}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold">{currentYear} Goal Timeline</h2>
          <p className="text-sm opacity-80">
            {stats.activeGoals} active goals · {stats.completingThisYear} completing this year
          </p>
        </div>

        <div className="flex gap-2">
          {currentYear !== today.getFullYear() && (
            <button
              onClick={() => onYearChange(today.getFullYear())}
              className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded-full"
            >
              This Year
            </button>
          )}
          <button
            onClick={() => onYearChange(currentYear + 1)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6">
        {/* Month Headers */}
        <div className="flex border-b border-gray-200 mb-4">
          {MONTHS.map((month, idx) => {
            const isCurrentMonth = 
              today.getFullYear() === currentYear && 
              today.getMonth() === idx;
            
            return (
              <div
                key={month}
                className={`flex-1 text-center py-2 text-sm font-medium ${
                  isCurrentMonth ? 'text-purple-600 bg-purple-50' : 'text-gray-600'
                }`}
              >
                {month}
              </div>
            );
          })}
        </div>

        {/* Goals Timeline */}
        <div className="space-y-3 relative">
          {/* Today Marker */}
          {todayPosition !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{ left: `${todayPosition}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 text-white text-xs rounded whitespace-nowrap">
                Today
              </div>
            </div>
          )}

          {timelineGoals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No goals with target dates in {currentYear}</p>
            </div>
          ) : (
            timelineGoals.map((goal) => {
              const colors = getCategoryColor(goal.category);
              const progress = goal.progress?.percentage || 0;

              return (
                <div
                  key={goal.id}
                  className="relative h-14 group"
                >
                  {/* Goal Bar */}
                  <button
                    onClick={() => onGoalClick(goal.id)}
                    className={`
                      absolute h-12 rounded-lg border-2 transition-all
                      ${colors.bg} ${colors.border}
                      hover:shadow-lg hover:scale-[1.02] cursor-pointer
                      flex items-center overflow-hidden
                    `}
                    style={{
                      left: `${goal.leftPercent}%`,
                      width: `${Math.max(goal.widthPercent, 5)}%`,
                    }}
                  >
                    {/* Progress Fill */}
                    <div
                      className="absolute inset-y-0 left-0 bg-green-400/30"
                      style={{ width: `${progress}%` }}
                    />

                    {/* Goal Content */}
                    <div className="relative flex items-center gap-2 px-3 min-w-0 flex-1">
                      <Target className={`w-4 h-4 flex-shrink-0 ${colors.text}`} />
                      <span className={`font-medium truncate text-sm ${colors.text}`}>
                        {goal.name}
                      </span>
                      {progress > 0 && (
                        <span className={`text-xs flex-shrink-0 ${colors.text} opacity-75`}>
                          {progress}%
                        </span>
                      )}
                    </div>

                    {/* Target Date Marker */}
                    {goal.endsThisYear && (
                      <div
                        className={`
                          absolute right-0 top-0 bottom-0 w-1 
                          ${goal.isOverdue ? 'bg-red-500' : 'bg-green-500'}
                        `}
                        title={`Target: ${format(goal.targetDate, 'MMM d, yyyy')}`}
                      />
                    )}
                  </button>

                  {/* Tooltip on Hover */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                      <div className="font-medium">{goal.name}</div>
                      <div className="text-gray-300">
                        Target: {format(goal.targetDate, 'MMM d, yyyy')}
                      </div>
                      {goal.progress?.completedMilestones !== undefined && (
                        <div className="text-gray-300">
                          {goal.progress.completedMilestones}/{goal.progress.totalMilestones} milestones
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Month Grid Lines */}
        <div className="flex mt-4 border-t border-gray-100 pt-4">
          {MONTHS.map((_, idx) => (
            <div
              key={idx}
              className="flex-1 border-l border-gray-100 first:border-l-0 h-2"
            />
          ))}
        </div>
      </div>

      {/* Legend & Stats */}
      <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-between text-xs">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-green-400/30 rounded" />
            <span className="text-gray-600">Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-3 bg-green-500 rounded" />
            <span className="text-gray-600">On Track</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-3 bg-red-500 rounded" />
            <span className="text-gray-600">Overdue</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-0.5 h-3 bg-red-500" />
            <span className="text-gray-600">Today</span>
          </div>
        </div>
        {stats.overdue > 0 && (
          <div className="text-red-600 font-medium">
            ⚠️ {stats.overdue} goal{stats.overdue > 1 ? 's' : ''} overdue
          </div>
        )}
      </div>
    </div>
  );
}