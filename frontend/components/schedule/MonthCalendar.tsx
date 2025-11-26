'use client';

import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface ScheduleBlock {
  id: string;
  user_id: string;
  goal_id?: string;
  type: string;
  scheduled_start: string;
  duration_mins: number;
  status: string;
  notes?: string;
  created_by?: string;
  goals?: { name: string; category?: string };
}

interface MonthCalendarProps {
  blocks: ScheduleBlock[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
}

// ============================================================
// HELPERS
// ============================================================

const getCategoryColor = (category?: string): string => {
  const colors: Record<string, string> = {
    fitness: 'bg-green-500',
    business: 'bg-orange-500',
    skill: 'bg-blue-500',
    languages: 'bg-purple-500',
    career: 'bg-indigo-500',
    education: 'bg-cyan-500',
    creative: 'bg-pink-500',
    climbing: 'bg-emerald-500',
    mental_health: 'bg-teal-500',
  };
  return colors[category || ''] || 'bg-gray-500';
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MonthCalendar({
  blocks,
  currentDate,
  onDateChange,
  onDayClick,
}: MonthCalendarProps) {
  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  // Group blocks by date
  const blocksByDate = useMemo(() => {
    const grouped: Record<string, ScheduleBlock[]> = {};
    
    blocks.forEach((block) => {
      // Only include training blocks
      if (['work', 'commute', 'event', 'sleep'].includes(block.type)) return;
      
      const dateKey = format(parseISO(block.scheduled_start), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(block);
    });
    
    return grouped;
  }, [blocks]);

  // Stats for the month
  const monthStats = useMemo(() => {
    const trainingBlocks = blocks.filter(
      (b) => !['work', 'commute', 'event', 'sleep'].includes(b.type)
    );
    const completed = trainingBlocks.filter((b) => b.status === 'completed').length;
    const totalHours = Math.round(
      trainingBlocks.reduce((sum, b) => sum + b.duration_mins, 0) / 60
    );
    
    return { total: trainingBlocks.length, completed, totalHours };
  }, [blocks]);

  const today = new Date();

  // Navigate months
  const goToPrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
          <p className="text-sm opacity-80">
            {monthStats.total} sessions · {monthStats.totalHours}h planned
          </p>
        </div>

        <div className="flex gap-2">
          {!isSameMonth(currentDate, today) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded-full"
            >
              Today
            </button>
          )}
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_LABELS.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-gray-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayBlocks = blocksByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, today);
            const completedCount = dayBlocks.filter((b) => b.status === 'completed').length;
            const totalCount = dayBlocks.length;

            // Get unique categories for color dots (max 4)
            const categories = [...new Set(dayBlocks.map((b) => b.goals?.category))].slice(0, 4);

            return (
              <button
                key={dateKey}
                onClick={() => onDayClick(day)}
                className={`
                  relative min-h-[80px] p-2 rounded-lg border transition-all
                  ${isCurrentMonth ? 'bg-white hover:bg-purple-50' : 'bg-gray-50'}
                  ${isToday ? 'border-purple-500 border-2' : 'border-gray-100'}
                  ${dayBlocks.length > 0 ? 'hover:shadow-md cursor-pointer' : 'cursor-pointer'}
                `}
              >
                {/* Date Number */}
                <div
                  className={`
                    text-sm font-medium mb-1
                    ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                    ${isToday ? 'text-purple-600' : ''}
                  `}
                >
                  {format(day, 'd')}
                </div>

                {/* Session Indicators */}
                {dayBlocks.length > 0 && (
                  <div className="space-y-1">
                    {/* Category Dots */}
                    <div className="flex gap-1 flex-wrap">
                      {categories.map((category, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full ${getCategoryColor(category)}`}
                          title={category || 'Other'}
                        />
                      ))}
                    </div>

                    {/* Session Count */}
                    <div className="text-xs text-gray-500">
                      {completedCount > 0 ? (
                        <span className="text-green-600">
                          {completedCount}/{totalCount}
                        </span>
                      ) : (
                        <span>{totalCount} session{totalCount > 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Mini Progress Bar */}
                    {totalCount > 0 && (
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${(completedCount / totalCount) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-between text-xs">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600">Fitness</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-gray-600">Business</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-600">Skill</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-gray-600">Mental Health</span>
          </div>
        </div>
        <div className="text-gray-500">
          Click a day to view that week
        </div>
      </div>
    </div>
  );
}