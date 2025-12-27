'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, addDays, isSameDay, parseISO, setHours, setMinutes, startOfDay, addWeeks, isBefore, isAfter, isToday, isYesterday, isTomorrow, differenceInDays } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  GripVertical,
  Check,
  Trash2,
  Briefcase,
  Moon,
  Car,
  Users,
  Dumbbell,
  X,
  Clock,
  Target,
  CheckCircle,
  Circle,
  Ban,
  Calendar,
  AlertTriangle,
  ArrowUp,
  CalendarDays,
} from 'lucide-react';
import { scheduleAPI } from '@/lib/api';

// ============================================================
// DND-KIT IMPORTS
// ============================================================
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';

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

interface UserAvailability {
  wake_time: string;
  sleep_time: string;
  work_schedule: Record<string, { start: string; end: string } | null>;
  fixed_commitments: Array<{ day: string; start: string; end: string; name: string }>;
  daily_commute_mins?: number;
}

interface HourlyCalendarProps {
  blocks: ScheduleBlock[];
  availability?: UserAvailability | null;
  userId: string;
  onBlockUpdate?: () => void;
  weekOffset: number;
  setWeekOffset: (offset: number | ((prev: number) => number)) => void;
}

interface DroppableData {
  dayIndex: number;
  hour: number;
  minute: number;
  date: Date;
}

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 5; // 5 AM
const END_HOUR = 24; // Midnight
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const SLOT_INTERVAL = 15; // 15-minute slots for more precise dropping

// ============================================================
// HELPERS
// ============================================================

const getBlockStyle = (type: string, category?: string, createdBy?: string): string => {
  // User-created blocks
  if (type === 'work') return 'bg-slate-200 border-slate-400 text-slate-700';
  if (type === 'commute') return 'bg-amber-100 border-amber-400 text-amber-800';
  if (type === 'event' || type === 'social') return 'bg-rose-100 border-rose-400 text-rose-800';
  if (type === 'sleep') return 'bg-indigo-100 border-indigo-300 text-indigo-700';

  // Training blocks (by category)
  const colors: Record<string, string> = {
    fitness: 'bg-green-100 border-green-400 text-green-800',
    business: 'bg-orange-100 border-orange-400 text-orange-800',
    skill: 'bg-blue-100 border-blue-400 text-blue-800',
    languages: 'bg-purple-100 border-purple-400 text-purple-800',
    career: 'bg-indigo-100 border-indigo-400 text-indigo-800',
    education: 'bg-cyan-100 border-cyan-400 text-cyan-800',
    creative: 'bg-pink-100 border-pink-400 text-pink-800',
    climbing: 'bg-emerald-100 border-emerald-400 text-emerald-800',
    mental_health: 'bg-teal-100 border-teal-400 text-teal-800',
  };
  return colors[category || ''] || 'bg-gray-100 border-gray-400 text-gray-800';
};

const getBlockBorderColor = (type: string, category?: string): string => {
  if (type === 'work') return 'border-l-slate-500';
  if (type === 'commute') return 'border-l-amber-500';
  if (type === 'event' || type === 'social') return 'border-l-rose-500';
  if (type === 'sleep') return 'border-l-indigo-400';

  const colors: Record<string, string> = {
    fitness: 'border-l-green-500',
    business: 'border-l-orange-500',
    skill: 'border-l-blue-500',
    languages: 'border-l-purple-500',
    career: 'border-l-indigo-500',
    education: 'border-l-cyan-500',
    creative: 'border-l-pink-500',
    climbing: 'border-l-emerald-500',
    mental_health: 'border-l-teal-500',
  };
  return colors[category || ''] || 'border-l-gray-400';
};

const getBlockIcon = (type: string) => {
  if (type === 'work') return <Briefcase className="w-3 h-3" />;
  if (type === 'commute') return <Car className="w-3 h-3" />;
  if (type === 'event' || type === 'social') return <Users className="w-3 h-3" />;
  if (type === 'sleep') return <Moon className="w-3 h-3" />;
  if (type === 'workout' || type === 'training') return <Dumbbell className="w-3 h-3" />;
  return null;
};

const getBlockTypeName = (type: string): string => {
  const names: Record<string, string> = {
    work: 'Work',
    commute: 'Commute',
    event: 'Event',
    social: 'Event',
    sleep: 'Sleep',
    workout: 'Training',
    training: 'Training',
  };
  return names[type] || type;
};

const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

// Check if a block is draggable
const isDraggableBlock = (block: ScheduleBlock): boolean => {
  const isTrainingType = block.type === 'workout' || block.type === 'training';
  const isNotCompleted = block.status !== 'completed';
  return isTrainingType && isNotCompleted;
};

// Check if a block is a "blocker" (can't drop on it)
const isBlockerType = (type: string): boolean => {
  return ['work', 'commute', 'event', 'social', 'sleep'].includes(type);
};

// Check if a block is a training block
const isTrainingBlock = (block: ScheduleBlock): boolean => {
  return block.type === 'workout' || block.type === 'training';
};

// Format date label like Teams
const formatDateLabel = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE');
};

// ============================================================
// OVERLAP WARNING POPUP
// ============================================================

interface OverlapWarningProps {
  show: boolean;
  message: string;
  blockingType: string;
  onClose: () => void;
}

function OverlapWarning({ show, message, blockingType, onClose }: OverlapWarningProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-medium">Can't place here</p>
          <p className="text-sm text-red-100">{message}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-red-600 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MOBILE AGENDA VIEW (Teams-style)
// ============================================================

interface MobileAgendaViewProps {
  blocks: ScheduleBlock[];
  availability?: UserAvailability | null;
  userId: string;
  onBlockClick: (block: ScheduleBlock) => void;
  onAddClick: () => void;
  weekOffset: number;
  setWeekOffset: (offset: number | ((prev: number) => number)) => void;
}

function MobileAgendaView({ 
  blocks, 
  availability, 
  userId, 
  onBlockClick, 
  onAddClick,
  weekOffset,
  setWeekOffset,
}: MobileAgendaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [showTodayButton, setShowTodayButton] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 }); // Monday start
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Generate dates for scrolling (from 4 weeks ago to 52 weeks ahead)
  const allDates = useMemo(() => {
    const dates: Date[] = [];
    const start = addWeeks(today, -4);
    const end = addWeeks(today, 52);
    let current = startOfDay(start);
    while (isBefore(current, end)) {
      dates.push(current);
      current = addDays(current, 1);
    }
    return dates;
  }, []);

  // Group blocks by date
  const blocksByDate = useMemo(() => {
    const grouped: Record<string, ScheduleBlock[]> = {};
    
    blocks.forEach((block) => {
      const dateKey = format(parseISO(block.scheduled_start), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(block);
    });

    // Sort blocks within each day by start time
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => 
        new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      );
    });

    return grouped;
  }, [blocks]);

  // Generate availability items for a specific date
  const getAvailabilityForDate = useCallback((date: Date) => {
    if (!availability) return [];
    
    const dayName = DAYS[date.getDay()];
    const items: Array<{ type: string; start: string; end: string; label: string }> = [];

    // Work schedule
    const workSchedule = availability.work_schedule?.[dayName];
    if (workSchedule) {
      items.push({
        type: 'work',
        start: workSchedule.start,
        end: workSchedule.end,
        label: 'Work',
      });

      // Commute
      const commuteMins = availability.daily_commute_mins || 0;
      if (commuteMins > 0) {
        const workStart = parseTime(workSchedule.start);
        const workEnd = parseTime(workSchedule.end);
        
        const commuteStartMins = workStart.hours * 60 + workStart.minutes - commuteMins;
        const commuteEndMins = workEnd.hours * 60 + workEnd.minutes + commuteMins;
        
        items.push({
          type: 'commute',
          start: `${Math.floor(commuteStartMins / 60).toString().padStart(2, '0')}:${(commuteStartMins % 60).toString().padStart(2, '0')}`,
          end: workSchedule.start,
          label: 'Commute',
        });
        
        items.push({
          type: 'commute',
          start: workSchedule.end,
          end: `${Math.floor(commuteEndMins / 60).toString().padStart(2, '0')}:${(commuteEndMins % 60).toString().padStart(2, '0')}`,
          label: 'Commute',
        });
      }
    }

    // Fixed commitments
    (availability.fixed_commitments || []).forEach((commitment) => {
      if (commitment.day.toLowerCase() === dayName) {
        items.push({
          type: 'event',
          start: commitment.start,
          end: commitment.end,
          label: commitment.name,
        });
      }
    });

    return items.sort((a, b) => a.start.localeCompare(b.start));
  }, [availability]);

  // Scroll to today on mount
  useEffect(() => {
    setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 100);
  }, []);

  // Track scroll position for Today button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !todayRef.current) return;
    
    const scrollTop = scrollRef.current.scrollTop;
    const todayTop = todayRef.current.offsetTop;
    const threshold = 200;
    
    setShowTodayButton(Math.abs(scrollTop - todayTop) > threshold);
  }, []);

  const scrollToToday = () => {
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Handle week selector day click
  const handleDayClick = (date: Date) => {
    const dayOffset = differenceInDays(date, today);
    const newWeekOffset = Math.floor(dayOffset / 7);
    setWeekOffset(newWeekOffset);
    
    // Find and scroll to the date
    setTimeout(() => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const element = document.getElementById(`agenda-date-${dateKey}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Week Selector Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-2 hover:bg-gray-800 rounded-full"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <h2 className="text-white font-semibold">{format(weekStart, 'MMMM yyyy')}</h2>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-2 hover:bg-gray-800 rounded-full"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Day Pills */}
        <div className="flex justify-between">
          {weekDates.map((date, idx) => {
            const isCurrentDay = isToday(date);
            const dayLabel = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx];
            
            return (
              <button
                key={idx}
                onClick={() => handleDayClick(date)}
                className="flex flex-col items-center"
              >
                <span className="text-xs text-gray-500 mb-1">{dayLabel}</span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isCurrentDay
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}>
                  {format(date, 'd')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Agenda */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {allDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayBlocks = blocksByDate[dateKey] || [];
          const availabilityItems = getAvailabilityForDate(date);
          const isCurrentDay = isToday(date);
          const hasItems = dayBlocks.length > 0 || availabilityItems.length > 0;

          // Combine and sort all items
          const allItems: Array<{
            type: 'block' | 'availability';
            data: ScheduleBlock | { type: string; start: string; end: string; label: string };
            sortTime: string;
          }> = [
            ...dayBlocks.map(block => ({
              type: 'block' as const,
              data: block,
              sortTime: format(parseISO(block.scheduled_start), 'HH:mm'),
            })),
            ...availabilityItems.map(item => ({
              type: 'availability' as const,
              data: item,
              sortTime: item.start,
            })),
          ].sort((a, b) => a.sortTime.localeCompare(b.sortTime));

          return (
            <div 
              key={dateKey} 
              id={`agenda-date-${dateKey}`}
              ref={isCurrentDay ? todayRef : null}
              className="border-b border-gray-800"
            >
              {/* Date Header */}
              <div className={`sticky top-0 z-10 px-4 py-3 ${isCurrentDay ? 'bg-gray-900' : 'bg-gray-950'}`}>
                <div className="flex items-baseline gap-2">
                  <span className={`text-lg font-bold ${isCurrentDay ? 'text-purple-400' : 'text-white'}`}>
                    {format(date, 'd MMM')}
                  </span>
                  <span className={`text-sm ${isCurrentDay ? 'text-purple-400' : 'text-gray-500'}`}>
                    {formatDateLabel(date)}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="px-4 pb-4">
                {!hasItems ? (
                  <p className="text-gray-600 text-sm py-2 italic">No meetings</p>
                ) : (
                  <div className="space-y-2">
                    {allItems.map((item, idx) => {
                      if (item.type === 'block') {
                        const block = item.data as ScheduleBlock;
                        const startTime = format(parseISO(block.scheduled_start), 'HH:mm');
                        const notesParts = (block.notes || '').split('|||');
                        const displayName = notesParts[0] || block.goals?.name || getBlockTypeName(block.type);
                        const category = block.goals?.category || block.type;
                        const isCompleted = block.status === 'completed';
                        const isSkipped = block.status === 'skipped';

                        return (
                          <button
                            key={block.id}
                            onClick={() => onBlockClick(block)}
                            className={`w-full text-left flex gap-3 py-3 px-3 rounded-xl transition-colors ${
                              isCompleted || isSkipped ? 'opacity-50' : ''
                            } hover:bg-gray-900 active:bg-gray-800`}
                          >
                            {/* Time */}
                            <div className="w-12 flex-shrink-0">
                              <div className="text-sm text-gray-400">{startTime}</div>
                              <div className="text-xs text-gray-600">{block.duration_mins}min</div>
                            </div>

                            {/* Color Bar + Content */}
                            <div className={`flex-1 border-l-4 ${getBlockBorderColor(block.type, category)} pl-3`}>
                              <div className={`font-medium ${
                                isCompleted ? 'text-gray-500 line-through' :
                                isSkipped ? 'text-gray-500 line-through' :
                                'text-white'
                              }`}>
                                {displayName}
                                {block.goals?.name && displayName !== block.goals.name && (
                                  <span className="text-gray-500 font-normal ml-2">• {block.goals.name}</span>
                                )}
                              </div>
                              {notesParts[1] && !isCompleted && !isSkipped && (
                                <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{notesParts[1]}</p>
                              )}
                              {isCompleted && (
                                <span className="text-xs text-green-500">✓ Completed</span>
                              )}
                              {isSkipped && (
                                <span className="text-xs text-gray-500">Skipped</span>
                              )}
                            </div>
                          </button>
                        );
                      } else {
                        // Availability item (work, commute, event)
                        const avail = item.data as { type: string; start: string; end: string; label: string };
                        
                        return (
                          <div
                            key={`avail-${idx}`}
                            className="flex gap-3 py-3 px-3 opacity-60"
                          >
                            <div className="w-12 flex-shrink-0">
                              <div className="text-sm text-gray-500">{avail.start}</div>
                            </div>
                            <div className={`flex-1 border-l-4 ${getBlockBorderColor(avail.type)} pl-3`}>
                              <div className="text-gray-500 flex items-center gap-2">
                                {getBlockIcon(avail.type)}
                                {avail.label}
                              </div>
                              <div className="text-xs text-gray-600">{avail.start} - {avail.end}</div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Today Button */}
      {showTodayButton && (
        <button
          onClick={scrollToToday}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-purple-500 text-white rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:bg-purple-600 transition-colors z-20"
        >
          <ArrowUp className="w-4 h-4" />
          Today
        </button>
      )}

      {/* Floating Add Button */}
      <button
        onClick={onAddClick}
        className="absolute bottom-20 right-4 w-14 h-14 bg-purple-500 rounded-full shadow-lg flex items-center justify-center hover:bg-purple-600 transition-colors z-20"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}

// ============================================================
// DRAGGABLE BLOCK COMPONENT (Desktop) - UPDATED: Entire block draggable, no action buttons
// ============================================================

interface DraggableBlockProps {
  block: ScheduleBlock;
  top: number;
  height: number;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (block: ScheduleBlock) => void;
}

function DraggableBlock({ block, top, height, onComplete, onDelete, onClick }: DraggableBlockProps) {
  const isDraggable = isDraggableBlock(block);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: { block },
    disabled: !isDraggable,
  });

  const isCompleted = block.status === 'completed';
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category, block.created_by);

  const startTime = format(parseISO(block.scheduled_start), 'h:mm a');
  
  const notesParts = (block.notes || '').split('|||');
  const displayName = notesParts[0] || block.notes || block.goals?.name || block.type;

  const style = transform
    ? {
        top: `${top}px`,
        height: `${Math.max(height - 2, 24)}px`,
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
      }
    : {
        top: `${top}px`,
        height: `${Math.max(height - 2, 24)}px`,
        zIndex: 10,
      };

  return (
    <div
      ref={setNodeRef}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={`
        absolute left-1 right-1 rounded-lg border-2 px-2 py-1 overflow-hidden
        ${styleClass}
        ${isCompleted ? 'opacity-60' : ''}
        ${height < 40 ? 'text-xs' : 'text-sm'}
        ${isDragging ? 'opacity-50 shadow-2xl ring-2 ring-purple-500' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        hover:shadow-lg hover:z-20 transition-shadow
      `}
      style={style}
      onClick={() => !isDragging && onClick?.(block)}
    >
      <div className="flex items-start gap-1 h-full">
        {isDraggable && (
          <GripVertical className="w-3 h-3 opacity-40 flex-shrink-0 mt-0.5" />
        )}
        
        {!isDraggable && getBlockIcon(block.type)}
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="font-medium truncate leading-tight">{displayName}</div>
          {height >= 50 && (
            <div className="text-xs opacity-75 leading-tight">
              {startTime} · {block.duration_mins}min
            </div>
          )}
        </div>

        {isCompleted && (
          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// DROPPABLE CELL COMPONENT
// ============================================================

interface DroppableCellProps {
  id: string;
  dayIndex: number;
  hour: number;
  minute: number;
  date: Date;
  isBlocked: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

function DroppableCell({ id, dayIndex, hour, minute, date, isBlocked, onClick, children }: DroppableCellProps) {
  const { isOver, setNodeRef, active } = useDroppable({
    id,
    data: { dayIndex, hour, minute, date } as DroppableData,
    disabled: isBlocked,
  });

  const showDropIndicator = isOver && active && !isBlocked;
  const showBlockedIndicator = isOver && active && isBlocked;

  return (
    <div
      ref={setNodeRef}
      className={`
        absolute left-0 right-0 transition-colors
        ${showDropIndicator ? 'bg-purple-200/70 ring-2 ring-purple-500 ring-inset z-30' : ''}
        ${showBlockedIndicator ? 'bg-red-200/70 ring-2 ring-red-500 ring-inset z-30' : ''}
        ${!isOver && !isBlocked ? 'hover:bg-purple-50/50' : ''}
        ${isBlocked ? '' : 'cursor-pointer'}
      `}
      style={{
        top: `${(minute / 60) * HOUR_HEIGHT}px`,
        height: `${(SLOT_INTERVAL / 60) * HOUR_HEIGHT}px`,
      }}
      onClick={() => !isBlocked && onClick()}
    >
      {showBlockedIndicator && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Ban className="w-4 h-4 text-red-500" />
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================================
// DRAG OVERLAY COMPONENT
// ============================================================

interface DragOverlayBlockProps {
  block: ScheduleBlock;
}

function DragOverlayBlock({ block }: DragOverlayBlockProps) {
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category, block.created_by);
  const notesParts = (block.notes || '').split('|||');
  const displayName = notesParts[0] || block.notes || block.goals?.name || block.type;
  const height = (block.duration_mins / 60) * HOUR_HEIGHT;

  return (
    <div
      className={`
        rounded-lg border-2 px-2 py-1 overflow-hidden shadow-2xl
        ${styleClass}
        cursor-grabbing
      `}
      style={{ 
        width: '140px', 
        height: `${Math.max(height - 2, 40)}px`,
        opacity: 0.9,
      }}
    >
      <div className="flex items-start gap-1 h-full">
        <GripVertical className="w-3 h-3 opacity-50 flex-shrink-0" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="font-medium truncate leading-tight text-sm">{displayName}</div>
          <div className="text-xs opacity-75">{block.duration_mins}min</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADD BLOCK MODAL
// ============================================================

interface AddBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (block: { type: string; days: string[]; start: string; end: string; notes?: string }) => void;
  selectedDay?: string;
  selectedHour?: number;
}

function AddBlockModal({ isOpen, onClose, onAdd, selectedDay, selectedHour }: AddBlockModalProps) {
  const [type, setType] = useState<'work' | 'commute' | 'event'>('work');
  const [selectedDays, setSelectedDays] = useState<string[]>(selectedDay ? [selectedDay] : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [startTime, setStartTime] = useState(selectedHour ? `${String(selectedHour).padStart(2, '0')}:00` : '09:00');
  const [endTime, setEndTime] = useState(selectedHour ? `${String(selectedHour + 1).padStart(2, '0')}:00` : '18:00');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (selectedDay) {
        setSelectedDays([selectedDay]);
      } else {
        setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
      }
      setStartTime(selectedHour ? `${String(selectedHour).padStart(2, '0')}:00` : '09:00');
      setEndTime(selectedHour ? `${String(selectedHour + 1).padStart(2, '0')}:00` : '18:00');
      setNotes('');
    }
  }, [isOpen, selectedDay, selectedHour]);

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const selectWeekdays = () => setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const selectWeekend = () => setSelectedDays(['saturday', 'sunday']);
  const selectAll = () => setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

  const handleSubmit = () => {
    if (selectedDays.length === 0) {
      alert('Please select at least one day');
      return;
    }
    onAdd({ type, days: selectedDays, start: startTime, end: endTime, notes: notes || undefined });
    onClose();
    setNotes('');
  };

  const applyPreset = (preset: 'work' | 'commute-morning' | 'commute-evening') => {
    if (preset === 'work') {
      setType('work');
      setStartTime('09:00');
      setEndTime('18:00');
      selectWeekdays();
    } else if (preset === 'commute-morning') {
      setType('commute');
      setStartTime('08:00');
      setEndTime('09:00');
      selectWeekdays();
    } else if (preset === 'commute-evening') {
      setType('commute');
      setStartTime('18:00');
      setEndTime('19:00');
      selectWeekdays();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold">Add Time Block</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Quick Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Presets</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => applyPreset('work')}
                className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                Work (9-6)
              </button>
              <button
                onClick={() => applyPreset('commute-morning')}
                className="px-3 py-1.5 text-sm bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 flex items-center gap-1.5"
              >
                <Car className="w-3.5 h-3.5" />
                AM Commute
              </button>
              <button
                onClick={() => applyPreset('commute-evening')}
                className="px-3 py-1.5 text-sm bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 flex items-center gap-1.5"
              >
                <Car className="w-3.5 h-3.5" />
                PM Commute
              </button>
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-2">
              {[
                { value: 'work', label: 'Work', icon: <Briefcase className="w-4 h-4" /> },
                { value: 'commute', label: 'Commute', icon: <Car className="w-4 h-4" /> },
                { value: 'event', label: 'Event', icon: <Users className="w-4 h-4" /> },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setType(option.value as any)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                    type === option.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Days</label>
              <div className="flex gap-2 text-xs">
                <button onClick={selectWeekdays} className="text-purple-600 hover:underline">Weekdays</button>
                <span className="text-gray-300">|</span>
                <button onClick={selectWeekend} className="text-purple-600 hover:underline">Weekend</button>
                <span className="text-gray-300">|</span>
                <button onClick={selectAll} className="text-purple-600 hover:underline">All</button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    selectedDays.includes(day)
                      ? 'border-purple-500 bg-purple-100 text-purple-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {DAY_LABELS[i]}
                </button>
              ))}
            </div>
            {selectedDays.length > 1 && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Will create blocks for all selected days
              </p>
            )}
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Office, Meeting with client"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedDays.length === 0}
            className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedDays.length > 1 ? `Add to ${selectedDays.length} Days` : 'Add Block'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPLETE WITH NOTES MODAL
// ============================================================

interface CompleteWithNotesModalProps {
  block: ScheduleBlock | null;
  onClose: () => void;
  onComplete: (blockId: string, notes: string) => void;
  isLoading?: boolean;
}

function CompleteWithNotesModal({ block, onClose, onComplete, isLoading }: CompleteWithNotesModalProps) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (block) setNotes('');
  }, [block?.id]);

  if (!block) return null;

  const notesParts = (block.notes || '').split('|||');
  const sessionName = notesParts[0] || block.goals?.name || 'Session';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Nice work! 🎉</h3>
              <p className="text-sm opacity-80">{sessionName}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How did it go? (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this session..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-800"
            rows={3}
            autoFocus
          />
        </div>

        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete(block.id, notes)}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Log It'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SESSION DETAIL MODAL (with Reschedule)
// ============================================================

interface SessionDetailModalProps {
  block: ScheduleBlock | null;
  onClose: () => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPushToNextWeek?: (id: string) => Promise<{ deadline_impact?: string }>;
  onSkip?: (id: string) => Promise<{ deadline_impact?: string }>;
  onCompleteEarly?: (id: string) => Promise<{ deadline_impact?: string }>;
  onReschedule?: (id: string, newDateTime: string) => Promise<void>;
}

function SessionDetailModal({ 
  block, 
  onClose, 
  onComplete, 
  onDelete, 
  onPushToNextWeek, 
  onSkip, 
  onCompleteEarly,
  onReschedule,
}: SessionDetailModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [showConfirmPush, setShowConfirmPush] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Reset state when block changes
  useEffect(() => {
    if (block) {
      setActionResult(null);
      setShowConfirmPush(false);
      setShowReschedule(false);
      const blockDate = parseISO(block.scheduled_start);
      setRescheduleDate(format(blockDate, 'yyyy-MM-dd'));
      setRescheduleTime(format(blockDate, 'HH:mm'));
    }
  }, [block?.id]);

  if (!block) return null;

  const isCompleted = block.status === 'completed';
  const isUserBlock = block.created_by === 'user' || isBlockerType(block.type);
  const isTraining = isTrainingBlock(block);
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category, block.created_by);

  const startTime = format(parseISO(block.scheduled_start), 'EEEE, MMM d · h:mm a');
  const endTime = format(
    new Date(parseISO(block.scheduled_start).getTime() + block.duration_mins * 60 * 1000),
    'h:mm a'
  );

  const notesParts = (block.notes || '').split('|||');
  const sessionName = notesParts[0] || block.notes || block.type;
  const sessionDescription = notesParts[1] || '';
  const sessionTip = notesParts[2] || '';

  const handlePushToNextWeek = async () => {
    if (!onPushToNextWeek) return;
    setIsLoading(true);
    try {
      const result = await onPushToNextWeek(block.id);
      setActionResult({ 
        message: result.deadline_impact ? `Pushed to next week. ${result.deadline_impact}` : 'Pushed to next week!', 
        type: result.deadline_impact ? 'warning' : 'success' 
      });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      setActionResult({ message: 'Failed to push session', type: 'error' });
    } finally {
      setIsLoading(false);
      setShowConfirmPush(false);
    }
  };

  const handleSkip = async () => {
    if (!onSkip) return;
    setIsLoading(true);
    try {
      const result = await onSkip(block.id);
      setActionResult({ 
        message: result.deadline_impact ? `Skipped. ${result.deadline_impact}` : 'Session skipped', 
        type: result.deadline_impact ? 'warning' : 'success' 
      });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      setActionResult({ message: 'Failed to skip session', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteEarly = async () => {
    if (!onCompleteEarly) return;
    setIsLoading(true);
    try {
      const result = await onCompleteEarly(block.id);
      setActionResult({ message: result.deadline_impact || 'Goal completed early! 🎉', type: 'success' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      setActionResult({ message: 'Failed to complete early', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!onReschedule || !rescheduleDate || !rescheduleTime) return;
    setIsLoading(true);
    try {
      const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();
      await onReschedule(block.id, newDateTime);
      setActionResult({ message: 'Rescheduled successfully!', type: 'success' });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      setActionResult({ message: 'Failed to reschedule', type: 'error' });
    } finally {
      setIsLoading(false);
      setShowReschedule(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${styleClass} p-4 border-b-2 flex-shrink-0`}>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/50 rounded-lg">
              {getBlockIcon(block.type) || <Clock className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg leading-tight">{sessionName}</h3>
              {block.goals?.name && sessionName !== block.goals.name && (
                <p className="text-sm opacity-75 mt-1">{block.goals.name}</p>
              )}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-black/10 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Result Banner */}
        {actionResult && (
          <div className={`px-4 py-3 flex items-center gap-2 ${
            actionResult.type === 'success' ? 'bg-green-50 text-green-800' :
            actionResult.type === 'warning' ? 'bg-orange-50 text-orange-800' :
            'bg-red-50 text-red-800'
          }`}>
            {actionResult.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            {actionResult.type === 'success' && <Check className="w-4 h-4" />}
            <span className="text-sm font-medium">{actionResult.message}</span>
          </div>
        )}

        {/* Details - scrollable */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {sessionDescription && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-700 text-sm leading-relaxed">{sessionDescription}</p>
            </div>
          )}

          {sessionTip && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <p className="text-yellow-800 text-sm leading-relaxed">{sessionTip}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 text-gray-700">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <div className="font-medium">{startTime}</div>
              <div className="text-sm text-gray-500">
                {block.duration_mins} minutes (until {endTime})
              </div>
            </div>
          </div>

          {block.goals && (
            <div className="flex items-center gap-3 text-gray-700">
              <Target className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium">{block.goals.name}</div>
                <div className="text-sm text-gray-500 capitalize">{block.goals.category} goal</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {isCompleted ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700 font-medium">Completed</span>
              </>
            ) : (
              <>
                <Circle className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">Scheduled</span>
              </>
            )}
          </div>
        </div>

        {/* Reschedule Panel */}
        {showReschedule && (
          <div className="p-4 bg-blue-50 border-t border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-5 h-5 text-blue-500" />
              <p className="font-medium text-blue-800">Reschedule Session</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-blue-700 mb-1">Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1">Time</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReschedule(false)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white text-sm font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {/* Push Confirmation */}
        {showConfirmPush && (
          <div className="p-4 bg-orange-50 border-t border-orange-200">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Push to next week?</p>
                <p className="text-sm text-orange-700 mt-1">
                  This may delay your goal deadline.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmPush(false)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white text-sm font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handlePushToNextWeek}
                className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
                disabled={isLoading}
              >
                {isLoading ? 'Pushing...' : 'Yes, Push'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {isTraining && !isCompleted && !showConfirmPush && !showReschedule && !actionResult && (
          <div className="p-4 border-t bg-gray-50 flex-shrink-0 space-y-2">
            {/* Primary Actions */}
            <div className="flex gap-2">
              {onComplete && (
                <button
                  onClick={() => {
                    onComplete(block.id);
                    onClose();
                  }}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Log It
                </button>
              )}
              {onCompleteEarly && block.goal_id && (
                <button
                  onClick={handleCompleteEarly}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 font-medium disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Goal
                </button>
              )}
            </div>

            {/* Secondary Actions */}
            <div className="flex gap-2">
              {onReschedule && (
                <button
                  onClick={() => setShowReschedule(true)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 text-sm font-medium disabled:opacity-50"
                >
                  <CalendarDays className="w-4 h-4" />
                  Reschedule
                </button>
              )}
              {onPushToNextWeek && (
                <button
                  onClick={() => setShowConfirmPush(true)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 text-sm font-medium disabled:opacity-50"
                >
                  <Calendar className="w-4 h-4" />
                  Push Week
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {onSkip && (
                <button
                  onClick={handleSkip}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 text-sm font-medium disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" />
                  Skip
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete this session?')) {
                      onDelete(block.id);
                      onClose();
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Non-training block actions (user blocks like work/event) */}
        {isUserBlock && !actionResult && (
          <div className="p-4 border-t bg-gray-50 flex-shrink-0">
            {onDelete && (
              <button
                onClick={() => {
                  if (window.confirm('Delete this block?')) {
                    onDelete(block.id);
                    onClose();
                  }
                }}
                disabled={isLoading}
                className="w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Delete Block
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// APPLY TO FUTURE MODAL
// ============================================================

interface ApplyToFutureModalProps {
  pendingMove: {
    block: ScheduleBlock;
    newStart: string;
    newDayIndex: number;
    newHour: number;
    newMinute: number;
  } | null;
  onConfirm: (applyToFuture: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ApplyToFutureModal({ pendingMove, onConfirm, onCancel, isLoading }: ApplyToFutureModalProps) {
  if (!pendingMove) return null;

  const { block, newDayIndex, newHour, newMinute } = pendingMove;
  const notesParts = (block.notes || '').split('|||');
  const sessionName = notesParts[0] || block.goals?.name || 'this session';
  const newTimeStr = format(setMinutes(setHours(new Date(), newHour), newMinute), 'h:mm a');
  const newDayStr = DAY_NAMES[newDayIndex];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50" onClick={onCancel}>
      <div 
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <GripVertical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Session Moved</h3>
              <p className="text-sm opacity-80">Apply this change to future sessions?</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="font-medium text-gray-900 mb-2">{sessionName}</div>
            <div className="text-sm text-gray-600">
              → Moving to <span className="font-medium text-purple-600">{newDayStr}</span> at{' '}
              <span className="font-medium text-purple-600">{newTimeStr}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onConfirm(true)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 font-medium disabled:opacity-50"
            >
              <Calendar className="w-4 h-4" />
              Apply to all future sessions
            </button>
            <button
              onClick={() => onConfirm(false)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium disabled:opacity-50"
            >
              Just this session
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function HourlyCalendar({
  blocks,
  availability,
  userId,
  onBlockUpdate,
  weekOffset,
  setWeekOffset,
}: HourlyCalendarProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    block: ScheduleBlock;
    newStart: string;
    newDayIndex: number;
    newHour: number;
    newMinute: number;
  } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [blockToComplete, setBlockToComplete] = useState<ScheduleBlock | null>(null);
  const [activeBlock, setActiveBlock] = useState<ScheduleBlock | null>(null);
  const [isOverBlocked, setIsOverBlocked] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState<{ message: string; blockingType: string; show: boolean }>({ 
    message: '', 
    blockingType: '',
    show: false 
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 0 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Mutations
  const completeBlockMutation = useMutation({
    mutationFn: (blockId: string) => scheduleAPI.completeBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => scheduleAPI.deleteBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (block: {
      user_id: string;
      type: string;
      scheduled_start: string;
      duration_mins: number;
      notes?: string;
    }) => scheduleAPI.createBlock(block),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data: {
      user_id: string;
      type: string;
      days: string[];
      start_time: string;
      end_time: string;
      notes?: string;
    }) => scheduleAPI.createRecurringBlock(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
      alert(`✅ ${data.message}`);
    },
    onError: (error: any) => {
      alert(`❌ ${error.response?.data?.message || 'Failed to create blocks'}`);
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, scheduled_start }: { blockId: string; scheduled_start: string }) =>
      scheduleAPI.updateBlock(blockId, { scheduled_start }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

  const updateFutureMutation = useMutation({
    mutationFn: ({ blockId, scheduled_start, applyToFuture }: { 
      blockId: string; 
      scheduled_start: string;
      applyToFuture: boolean;
    }) => scheduleAPI.updateBlockWithFuture(blockId, scheduled_start, applyToFuture),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
      if (data.updatedCount > 1) {
        alert(`✅ Updated ${data.updatedCount} sessions`);
      }
    },
  });

  const completeWithNotesMutation = useMutation({
    mutationFn: async ({ blockId, notes }: { blockId: string; notes: string }) => {
      return scheduleAPI.completeBlockWithNotes(blockId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
      setBlockToComplete(null);
    },
  });

  const pushToNextWeekMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/schedule/${blockId}/push-to-next-week`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to push');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

  const skipBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/schedule/${blockId}/skip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to skip');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

  const completeEarlyMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/schedule/${blockId}/complete-early`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to complete early');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      onBlockUpdate?.();
    },
  });

  const handleConfirmMove = (applyToFuture: boolean) => {
    if (!pendingMove) return;
    
    if (applyToFuture) {
      updateFutureMutation.mutate({
        blockId: pendingMove.block.id,
        scheduled_start: pendingMove.newStart,
        applyToFuture: true,
      });
    } else {
      updateBlockMutation.mutate({
        blockId: pendingMove.block.id,
        scheduled_start: pendingMove.newStart,
      });
    }
    
    setPendingMove(null);
  };

  const handleCompleteClick = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (block) {
      setSelectedBlock(null);
      setBlockToComplete(block);
    }
  };

  const handleReschedule = async (blockId: string, newDateTime: string) => {
    await updateBlockMutation.mutateAsync({ blockId, scheduled_start: newDateTime });
  };

  // Generate availability blocks
  const availabilityBlocks = useMemo(() => {
    if (!availability) return [];

    const blocks: Array<{
      type: string;
      dayIndex: number;
      startHour: number;
      startMin: number;
      durationMins: number;
      label: string;
    }> = [];

    const wake = parseTime(availability.wake_time || '07:00');
    const sleep = parseTime(availability.sleep_time || '23:00');

    DAYS.forEach((day, dayIndex) => {
      if (wake.hours > START_HOUR) {
        blocks.push({
          type: 'sleep',
          dayIndex,
          startHour: START_HOUR,
          startMin: 0,
          durationMins: (wake.hours - START_HOUR) * 60 + wake.minutes,
          label: 'Sleep',
        });
      }

      if (sleep.hours < END_HOUR) {
        blocks.push({
          type: 'sleep',
          dayIndex,
          startHour: sleep.hours,
          startMin: sleep.minutes,
          durationMins: (END_HOUR - sleep.hours) * 60 - sleep.minutes,
          label: 'Sleep',
        });
      }

      const workSchedule = availability.work_schedule?.[day];
      if (workSchedule) {
        const workStart = parseTime(workSchedule.start);
        const workEnd = parseTime(workSchedule.end);
        const workDuration = (workEnd.hours - workStart.hours) * 60 + (workEnd.minutes - workStart.minutes);

        blocks.push({
          type: 'work',
          dayIndex,
          startHour: workStart.hours,
          startMin: workStart.minutes,
          durationMins: workDuration,
          label: `Work ${workSchedule.start} - ${workSchedule.end}`,
        });

        const commuteMins = availability.daily_commute_mins || 0;
        if (commuteMins > 0) {
          const commuteStartMins = workStart.hours * 60 + workStart.minutes - commuteMins;
          blocks.push({
            type: 'commute',
            dayIndex,
            startHour: Math.floor(commuteStartMins / 60),
            startMin: commuteStartMins % 60,
            durationMins: commuteMins,
            label: 'Commute',
          });

          blocks.push({
            type: 'commute',
            dayIndex,
            startHour: workEnd.hours,
            startMin: workEnd.minutes,
            durationMins: commuteMins,
            label: 'Commute',
          });
        }
      }
    });

    (availability.fixed_commitments || []).forEach((commitment) => {
      const dayIndex = DAYS.indexOf(commitment.day.toLowerCase());
      if (dayIndex === -1) return;

      const start = parseTime(commitment.start);
      const end = parseTime(commitment.end);
      const duration = (end.hours - start.hours) * 60 + (end.minutes - start.minutes);

      blocks.push({
        type: 'event',
        dayIndex,
        startHour: start.hours,
        startMin: start.minutes,
        durationMins: duration,
        label: commitment.name,
      });
    });

    return blocks;
  }, [availability]);

  const blockedTimeSlots = useMemo(() => {
    const blocked: Record<string, string> = {};

    availabilityBlocks.forEach((block) => {
      const startMins = block.startHour * 60 + block.startMin;
      const endMins = startMins + block.durationMins;
      
      for (let min = startMins; min < endMins; min += SLOT_INTERVAL) {
        const key = `${block.dayIndex}-${Math.floor(min / 60)}-${min % 60}`;
        blocked[key] = block.type;
      }
    });

    blocks.filter((b) => isBlockerType(b.type)).forEach((block) => {
      const blockDate = parseISO(block.scheduled_start);
      weekDates.forEach((date, dayIndex) => {
        if (isSameDay(date, blockDate)) {
          const startMins = blockDate.getHours() * 60 + blockDate.getMinutes();
          const endMins = startMins + block.duration_mins;
          
          for (let min = startMins; min < endMins; min += SLOT_INTERVAL) {
            const key = `${dayIndex}-${Math.floor(min / 60)}-${min % 60}`;
            blocked[key] = block.type;
          }
        }
      });
    });

    return blocked;
  }, [availabilityBlocks, blocks, weekDates]);

  const getCollisionType = useCallback((dayIndex: number, hour: number, minute: number, durationMins: number): string | null => {
    const startMins = hour * 60 + minute;
    const endMins = startMins + durationMins;
    
    for (let min = startMins; min < endMins; min += SLOT_INTERVAL) {
      const key = `${dayIndex}-${Math.floor(min / 60)}-${min % 60}`;
      if (blockedTimeSlots[key]) return blockedTimeSlots[key];
    }
    return null;
  }, [blockedTimeSlots]);

  const blocksByDay = useMemo(() => {
    const grouped: Record<number, ScheduleBlock[]> = {};
    for (let i = 0; i < 7; i++) grouped[i] = [];

    blocks.forEach((block) => {
      const blockDate = parseISO(block.scheduled_start);
      weekDates.forEach((date, dayIndex) => {
        if (isSameDay(date, blockDate)) {
          grouped[dayIndex].push(block);
        }
      });
    });

    return grouped;
  }, [blocks, weekDates]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const block = active.data.current?.block as ScheduleBlock;
    if (block) setActiveBlock(block);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || !active) {
      setIsOverBlocked(false);
      return;
    }

    const block = active.data.current?.block as ScheduleBlock;
    const dropData = over.data.current as DroppableData;
    
    if (block && dropData) {
      const collisionType = getCollisionType(dropData.dayIndex, dropData.hour, dropData.minute, block.duration_mins);
      setIsOverBlocked(!!collisionType);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBlock(null);
    setIsOverBlocked(false);

    if (!over) return;

    const block = active.data.current?.block as ScheduleBlock;
    const dropData = over.data.current as DroppableData;

    if (!block || !dropData) return;

    const collisionType = getCollisionType(dropData.dayIndex, dropData.hour, dropData.minute, block.duration_mins);
    if (collisionType) {
      const typeName = getBlockTypeName(collisionType);
      setOverlapWarning({
        message: `Overlaps with ${typeName}. Choose a different time.`,
        blockingType: collisionType,
        show: true,
      });
      return;
    }

    const targetDate = weekDates[dropData.dayIndex];
    const newStart = setMinutes(setHours(targetDate, dropData.hour), dropData.minute);
    
    setPendingMove({
      block,
      newStart: newStart.toISOString(),
      newDayIndex: dropData.dayIndex,
      newHour: dropData.hour,
      newMinute: dropData.minute,
    });
  };

  const handleAddBlock = (blockData: { type: string; days: string[]; start: string; end: string; notes?: string }) => {
    if (blockData.days.length > 1) {
      createRecurringMutation.mutate({
        user_id: userId,
        type: blockData.type,
        days: blockData.days,
        start_time: blockData.start,
        end_time: blockData.end,
        notes: blockData.notes,
      });
    } else {
      const dayIndex = DAYS.indexOf(blockData.days[0]);
      const targetDate = weekDates[dayIndex];
      const [startHours, startMins] = blockData.start.split(':').map(Number);
      const [endHours, endMins] = blockData.end.split(':').map(Number);

      const scheduledStart = setMinutes(setHours(targetDate, startHours), startMins);
      const durationMins = (endHours * 60 + endMins) - (startHours * 60 + startMins);

      const collisionType = getCollisionType(dayIndex, startHours, startMins, durationMins);
      if (collisionType) {
        const typeName = getBlockTypeName(collisionType);
        setOverlapWarning({
          message: `This overlaps with ${typeName}. Choose a different time.`,
          blockingType: collisionType,
          show: true,
        });
        return;
      }

      createBlockMutation.mutate({
        user_id: userId,
        type: blockData.type,
        scheduled_start: scheduledStart.toISOString(),
        duration_mins: durationMins,
        notes: blockData.notes,
      });
    }
  };

  const handleCellClick = (dayIndex: number, hour: number) => {
    setSelectedSlot({ day: DAYS[dayIndex], hour });
    setShowAddModal(true);
  };

  // ============================================================
  // MOBILE VIEW
  // ============================================================
  if (isMobile) {
    return (
      <>
        <div className="h-[calc(100vh-140px)] relative">
          <MobileAgendaView
            blocks={blocks}
            availability={availability}
            userId={userId}
            onBlockClick={setSelectedBlock}
            onAddClick={() => setShowAddModal(true)}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
          />
        </div>

        <AddBlockModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setSelectedSlot(null);
          }}
          onAdd={handleAddBlock}
          selectedDay={selectedSlot?.day}
          selectedHour={selectedSlot?.hour}
        />

        <SessionDetailModal
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onComplete={handleCompleteClick}
          onDelete={(id) => deleteBlockMutation.mutate(id)}
          onPushToNextWeek={async (id) => {
            const result = await pushToNextWeekMutation.mutateAsync(id);
            return result;
          }}
          onSkip={async (id) => {
            const result = await skipBlockMutation.mutateAsync(id);
            return result;
          }}
          onCompleteEarly={async (id) => {
            const result = await completeEarlyMutation.mutateAsync(id);
            return result;
          }}
          onReschedule={handleReschedule}
        />

        <CompleteWithNotesModal
          block={blockToComplete}
          onClose={() => setBlockToComplete(null)}
          onComplete={(blockId, notes) => completeWithNotesMutation.mutate({ blockId, notes })}
          isLoading={completeWithNotesMutation.isPending}
        />
      </>
    );
  }

  // ============================================================
  // DESKTOP VIEW (Grid)
  // ============================================================
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white flex-shrink-0">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="text-lg font-bold">{format(weekStart, 'MMMM yyyy')}</h2>
            <p className="text-sm opacity-80">
              Week of {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
            </p>
          </div>

          <div className="flex gap-2">
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded-full"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Legend & Add Block Button */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b flex-shrink-0">
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-200 border border-slate-400" />
              <span>Work</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />
              <span>Commute</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-rose-100 border border-rose-400" />
              <span>Event</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300" />
              <span>Sleep</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-400" />
              <span>Training</span>
            </div>
            <div className="flex items-center gap-1 ml-2 text-purple-600">
              <GripVertical className="w-3 h-3" />
              <span>Drag to move</span>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedSlot(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 text-white rounded-full text-sm hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Block
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto flex" ref={scrollRef}>
          {/* Time Column */}
          <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50 sticky left-0 z-20">
            <div className="h-12 border-b border-gray-200 bg-gray-50" />
            <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
              {HOURS.map((hour, idx) => (
                <div
                  key={hour}
                  className="absolute right-2 text-xs text-gray-500 font-medium -translate-y-2"
                  style={{ top: `${idx * HOUR_HEIGHT}px` }}
                >
                  {format(setHours(new Date(), hour), 'h a')}
                </div>
              ))}
            </div>
          </div>

          {/* Days Grid */}
          <div className="flex-1">
            <div className="flex min-w-[700px]">
              {weekDates.map((date, dayIndex) => {
                const isCurrentDay = isSameDay(date, today);
                const dayBlocks = blocksByDay[dayIndex] || [];
                const dayAvailBlocks = availabilityBlocks.filter((b) => b.dayIndex === dayIndex);

                return (
                  <div key={dayIndex} className="flex-1 min-w-[100px] border-r border-gray-200 last:border-r-0">
                    {/* Day Header */}
                    <div
                      className={`h-12 px-2 py-1 border-b border-gray-200 text-center sticky top-0 z-10 ${
                        isCurrentDay ? 'bg-purple-100' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`text-sm font-bold ${isCurrentDay ? 'text-purple-700' : 'text-gray-700'}`}>
                        {DAY_LABELS[dayIndex]}
                      </div>
                      <div className={`text-xs ${isCurrentDay ? 'text-purple-600' : 'text-gray-500'}`}>
                        {format(date, 'MMM d')}
                      </div>
                    </div>

                    {/* Hours Grid */}
                    <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                      {HOURS.map((hour, idx) => (
                        <div
                          key={hour}
                          className={`absolute left-0 right-0 border-t border-gray-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                          style={{ top: `${idx * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        >
                          {[0, 15, 30, 45].map((minute) => {
                            const slotId = `drop-${dayIndex}-${hour}-${minute}`;
                            const blockingType = blockedTimeSlots[`${dayIndex}-${hour}-${minute}`];
                            const isBlocked = !!blockingType;
                            
                            return (
                              <DroppableCell
                                key={slotId}
                                id={slotId}
                                dayIndex={dayIndex}
                                hour={hour}
                                minute={minute}
                                date={date}
                                isBlocked={isBlocked}
                                onClick={() => handleCellClick(dayIndex, hour)}
                              />
                            );
                          })}
                        </div>
                      ))}

                      {/* Availability blocks */}
                      {dayAvailBlocks.map((block, idx) => {
                        const top = (block.startHour - START_HOUR) * HOUR_HEIGHT + (block.startMin / 60) * HOUR_HEIGHT;
                        const height = (block.durationMins / 60) * HOUR_HEIGHT;

                        return (
                          <div
                            key={`avail-${idx}`}
                            className={`absolute left-0 right-0 ${getBlockStyle(block.type, undefined, 'user')} border-l-4 opacity-50 px-2 py-1 overflow-hidden pointer-events-none`}
                            style={{ top: `${top}px`, height: `${height}px`, zIndex: 5 }}
                          >
                            <div className="flex items-center gap-1 text-xs">
                              {getBlockIcon(block.type)}
                              <span className="truncate">{block.label}</span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Schedule blocks */}
                      {dayBlocks.map((block) => {
                        const blockStart = parseISO(block.scheduled_start);
                        const startHour = blockStart.getHours();
                        const startMin = blockStart.getMinutes();
                        const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMin / 60) * HOUR_HEIGHT;
                        const height = (block.duration_mins / 60) * HOUR_HEIGHT;

                        return (
                          <DraggableBlock
                            key={block.id}
                            block={block}
                            top={top}
                            height={height}
                            onComplete={handleCompleteClick}
                            onDelete={(id) => {
                              if (window.confirm('Delete this block?')) {
                                deleteBlockMutation.mutate(id);
                              }
                            }}
                            onClick={(block) => setSelectedBlock(block)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modals */}
        <AddBlockModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setSelectedSlot(null);
          }}
          onAdd={handleAddBlock}
          selectedDay={selectedSlot?.day}
          selectedHour={selectedSlot?.hour}
        />

        <SessionDetailModal
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onComplete={handleCompleteClick}
          onDelete={(id) => deleteBlockMutation.mutate(id)}
          onPushToNextWeek={async (id) => {
            const result = await pushToNextWeekMutation.mutateAsync(id);
            return result;
          }}
          onSkip={async (id) => {
            const result = await skipBlockMutation.mutateAsync(id);
            return result;
          }}
          onCompleteEarly={async (id) => {
            const result = await completeEarlyMutation.mutateAsync(id);
            return result;
          }}
          onReschedule={handleReschedule}
        />

        <CompleteWithNotesModal
          block={blockToComplete}
          onClose={() => setBlockToComplete(null)}
          onComplete={(blockId, notes) => completeWithNotesMutation.mutate({ blockId, notes })}
          isLoading={completeWithNotesMutation.isPending}
        />

        <ApplyToFutureModal
          pendingMove={pendingMove}
          onConfirm={handleConfirmMove}
          onCancel={() => setPendingMove(null)}
          isLoading={updateFutureMutation.isPending || updateBlockMutation.isPending}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeBlock ? <DragOverlayBlock block={activeBlock} /> : null}
      </DragOverlay>

      <OverlapWarning
        show={overlapWarning.show}
        message={overlapWarning.message}
        blockingType={overlapWarning.blockingType}
        onClose={() => setOverlapWarning({ message: '', blockingType: '', show: false })}
      />
    </DndContext>
  );
}