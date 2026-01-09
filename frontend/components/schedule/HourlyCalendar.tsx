'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, addDays, isSameDay, parseISO, setHours, setMinutes, startOfDay, addWeeks, isBefore, isToday, isYesterday, isTomorrow, differenceInDays } from 'date-fns';
import {
  ChevronLeft, ChevronRight, Plus, GripVertical, Check, Briefcase, Moon, Car, Users, Dumbbell, X, Clock, Target, CheckCircle, Circle, Ban, Calendar, AlertTriangle, ArrowUp, CalendarDays, Edit3, Trash2, ExternalLink, LayoutGrid, CalendarRange,
} from 'lucide-react';
import { scheduleAPI } from '@/lib/api';
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor, useDraggable, useDroppable, DragStartEvent, DragEndEvent, DragOverEvent,
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
  goals?: { name: string; category?: string; description?: string };
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

// Template block - represents a recurring time slot pattern
interface TemplateBlock {
  id: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  duration_mins: number;
  notes?: string;
  type: string;
  goal_id?: string;
  goals?: { name: string; category?: string; description?: string };
  allBlockIds: string[];
}

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_HEIGHT = 60;
const START_HOUR = 5;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const SLOT_INTERVAL = 15;

// ============================================================
// STYLE HELPERS
// ============================================================

const getBlockStyle = (type: string, category?: string): string => {
  if (type === 'workout' || type === 'training') {
    if (category === 'fitness') return 'bg-emerald-100/90 border-emerald-400 text-emerald-800 backdrop-blur-sm';
    if (category === 'climbing') return 'bg-orange-100/90 border-orange-400 text-orange-800 backdrop-blur-sm';
    if (category === 'languages') return 'bg-blue-100/90 border-blue-400 text-blue-800 backdrop-blur-sm';
    if (category === 'business') return 'bg-purple-100/90 border-purple-400 text-purple-800 backdrop-blur-sm';
    if (category === 'creative') return 'bg-pink-100/90 border-pink-400 text-pink-800 backdrop-blur-sm';
    if (category === 'mental_health') return 'bg-cyan-100/90 border-cyan-400 text-cyan-800 backdrop-blur-sm';
    return 'bg-indigo-100/90 border-indigo-400 text-indigo-800 backdrop-blur-sm';
  }
  if (type === 'work') return 'bg-slate-200/80 border-slate-400 text-slate-700 backdrop-blur-sm';
  if (type === 'commute') return 'bg-slate-100/80 border-slate-300 text-slate-600 backdrop-blur-sm';
  if (type === 'event' || type === 'social') return 'bg-violet-100/80 border-violet-300 text-violet-700 backdrop-blur-sm';
  if (type === 'sleep') return 'bg-slate-50/50 border-slate-200 text-slate-500 backdrop-blur-sm';
  return 'bg-white/70 border-slate-400 text-slate-700 backdrop-blur-sm';
};

const getBlockBorderColor = (type: string, category?: string): string => {
  if (type === 'workout' || type === 'training') {
    if (category === 'fitness') return 'border-l-emerald-500';
    if (category === 'climbing') return 'border-l-orange-500';
    if (category === 'languages') return 'border-l-blue-500';
    if (category === 'business') return 'border-l-purple-500';
    if (category === 'creative') return 'border-l-pink-500';
    if (category === 'mental_health') return 'border-l-cyan-500';
    return 'border-l-indigo-500';
  }
  if (type === 'work') return 'border-l-slate-500';
  if (type === 'commute') return 'border-l-slate-400';
  if (type === 'event' || type === 'social') return 'border-l-violet-500';
  if (type === 'sleep') return 'border-l-slate-300';
  return 'border-l-slate-500';
};

const getHeaderColor = (type: string, category?: string): string => {
  if (type === 'workout' || type === 'training') {
    if (category === 'fitness') return 'bg-emerald-500';
    if (category === 'climbing') return 'bg-orange-500';
    if (category === 'languages') return 'bg-blue-500';
    if (category === 'business') return 'bg-purple-500';
    if (category === 'creative') return 'bg-pink-500';
    if (category === 'mental_health') return 'bg-cyan-500';
    return 'bg-indigo-500';
  }
  return 'bg-slate-600';
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
  const names: Record<string, string> = { work: 'Work', commute: 'Commute', event: 'Event', social: 'Event', sleep: 'Sleep', workout: 'Training', training: 'Training' };
  return names[type] || type;
};

const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

const isDraggableBlock = (block: ScheduleBlock | TemplateBlock): boolean => {
  const type = block.type;
  return (type === 'workout' || type === 'training');
};

const isBlockerType = (type: string): boolean => ['work', 'commute', 'event', 'social', 'sleep'].includes(type);
const isTrainingBlock = (block: ScheduleBlock | TemplateBlock): boolean => block.type === 'workout' || block.type === 'training';

const formatDateLabel = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE');
};

// ============================================================
// CURRENT TIME INDICATOR
// ============================================================

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  if (currentHour < START_HOUR || currentHour >= END_HOUR) return null;
  
  const top = (currentHour - START_HOUR) * HOUR_HEIGHT + (currentMinute / 60) * HOUR_HEIGHT;
  
  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: `${top}px` }}>
      <div className="w-3 h-3 rounded-full bg-rose-500 -ml-1.5 shadow-md" />
      <div className="flex-1 h-0.5 bg-rose-500 shadow-sm" />
    </div>
  );
}

// ============================================================
// OVERLAP WARNING
// ============================================================

function OverlapWarning({ show, message, onClose }: { show: boolean; message: string; blockingType: string; onClose: () => void }) {
  useEffect(() => { if (show) { const timer = setTimeout(() => onClose(), 3000); return () => clearTimeout(timer); } }, [show, onClose]);
  if (!show) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-rose-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div><p className="font-medium">Can&apos;t place here</p><p className="text-sm text-rose-100">{message}</p></div>
        <button onClick={onClose} className="p-1 hover:bg-rose-600 rounded"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ============================================================
// AVAILABILITY BACKGROUND BLOCK
// ============================================================

function AvailabilityBlock({ block }: { block: { type: string; startHour: number; startMin: number; durationMins: number; label: string } }) {
  const top = (block.startHour - START_HOUR) * HOUR_HEIGHT + (block.startMin / 60) * HOUR_HEIGHT;
  const height = (block.durationMins / 60) * HOUR_HEIGHT;
  
  let style = '';
  let borderStyle = '';
  let textStyle = '';
  let pattern = '';
  
  if (block.type === 'sleep') {
    style = 'bg-slate-100/30';
    borderStyle = 'border-l-2 border-l-slate-300/50 border-dashed';
    textStyle = 'text-slate-400/70';
    pattern = 'bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(100,116,139,0.03)_5px,rgba(100,116,139,0.03)_10px)]';
  } else if (block.type === 'work') {
    style = 'bg-blue-50/40';
    borderStyle = 'border-l-2 border-l-blue-300/60 border-dashed';
    textStyle = 'text-blue-400/80';
  } else if (block.type === 'commute') {
    style = 'bg-amber-50/30';
    borderStyle = 'border-l-2 border-l-amber-300/50 border-dashed';
    textStyle = 'text-amber-400/70';
  } else if (block.type === 'event') {
    style = 'bg-violet-50/40';
    borderStyle = 'border-l-2 border-l-violet-300/60 border-dashed';
    textStyle = 'text-violet-400/80';
  }
  
  return (
    <div className={`absolute left-0 right-0 ${style} ${borderStyle} ${pattern} px-2 py-1 overflow-hidden pointer-events-none`} style={{ top: `${top}px`, height: `${height}px`, zIndex: 1 }}>
      <div className={`flex items-center gap-1 text-xs ${textStyle}`}>
        {getBlockIcon(block.type)}
        <span className="truncate">{block.label}</span>
      </div>
    </div>
  );
}

// ============================================================
// MOBILE AGENDA VIEW
// ============================================================

function MobileAgendaView({ blocks, availability, userId, onBlockClick, onAddClick, onQuickComplete, weekOffset, setWeekOffset }: {
  blocks: ScheduleBlock[]; availability?: UserAvailability | null; userId: string; 
  onBlockClick: (block: ScheduleBlock) => void; onAddClick: () => void; 
  onQuickComplete: (block: ScheduleBlock) => void;
  weekOffset: number; setWeekOffset: (offset: number | ((prev: number) => number)) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [showTodayButton, setShowTodayButton] = useState(false);
  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allDates = useMemo(() => {
    const dates: Date[] = [];
    const start = addWeeks(today, -4);
    const end = addWeeks(today, 52);
    let current = startOfDay(start);
    while (isBefore(current, end)) { dates.push(current); current = addDays(current, 1); }
    return dates;
  }, []);

  const blocksByDate = useMemo(() => {
    const grouped: Record<string, ScheduleBlock[]> = {};
    blocks.forEach((block) => {
      const dateKey = format(parseISO(block.scheduled_start), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(block);
    });
    Object.keys(grouped).forEach((key) => { 
      grouped[key].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()); 
    });
    return grouped;
  }, [blocks]);

  const getAvailabilityForDate = useCallback((date: Date) => {
    if (!availability) return [];
    const dayName = DAYS[date.getDay()];
    const items: Array<{ type: string; start: string; end: string; label: string }> = [];
    const workSchedule = availability.work_schedule?.[dayName];
    if (workSchedule) {
      items.push({ type: 'work', start: workSchedule.start, end: workSchedule.end, label: 'Work' });
      const commuteMins = availability.daily_commute_mins || 0;
      if (commuteMins > 0) {
        const workStart = parseTime(workSchedule.start);
        const workEnd = parseTime(workSchedule.end);
        const commuteStartMins = workStart.hours * 60 + workStart.minutes - commuteMins;
        const commuteEndMins = workEnd.hours * 60 + workEnd.minutes + commuteMins;
        items.push({ type: 'commute', start: `${Math.floor(commuteStartMins / 60).toString().padStart(2, '0')}:${(commuteStartMins % 60).toString().padStart(2, '0')}`, end: workSchedule.start, label: 'Commute' });
        items.push({ type: 'commute', start: workSchedule.end, end: `${Math.floor(commuteEndMins / 60).toString().padStart(2, '0')}:${(commuteEndMins % 60).toString().padStart(2, '0')}`, label: 'Commute' });
      }
    }
    (availability.fixed_commitments || []).forEach((commitment) => {
      if (commitment.day.toLowerCase() === dayName) { 
        items.push({ type: 'event', start: commitment.start, end: commitment.end, label: commitment.name }); 
      }
    });
    return items.sort((a, b) => a.start.localeCompare(b.start));
  }, [availability]);

  useEffect(() => { 
    setTimeout(() => { todayRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 100); 
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !todayRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const todayTop = todayRef.current.offsetTop;
    setShowTodayButton(Math.abs(scrollTop - todayTop) > 200);
  }, []);

  const scrollToToday = () => { todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const handleDayClick = (date: Date) => {
    const dayOffset = differenceInDays(date, today);
    setWeekOffset(Math.floor(dayOffset / 7));
    setTimeout(() => { 
      const dateKey = format(date, 'yyyy-MM-dd'); 
      document.getElementById(`agenda-date-${dateKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
    }, 100);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="backdrop-blur-xl bg-white/70 border-b border-white/40 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="text-slate-700 font-semibold">{format(weekStart, 'MMMM yyyy')}</h2>
          <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="flex justify-between">
          {weekDates.map((date, idx) => {
            const isCurrentDay = isToday(date);
            const dayLabel = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx];
            return (
              <button key={idx} onClick={() => handleDayClick(date)} className="flex flex-col items-center">
                <span className="text-xs text-slate-400 mb-1">{dayLabel}</span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${isCurrentDay ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-white/50'}`}>
                  {format(date, 'd')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {allDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayBlocks = blocksByDate[dateKey] || [];
          const availabilityItems = getAvailabilityForDate(date);
          const isCurrentDay = isToday(date);
          const hasItems = dayBlocks.length > 0 || availabilityItems.length > 0;

          const allItems = [
            ...dayBlocks.map(block => ({ type: 'block' as const, data: block, sortTime: format(parseISO(block.scheduled_start), 'HH:mm') })),
            ...availabilityItems.map(item => ({ type: 'availability' as const, data: item, sortTime: item.start })),
          ].sort((a, b) => a.sortTime.localeCompare(b.sortTime));

          return (
            <div key={dateKey} id={`agenda-date-${dateKey}`} ref={isCurrentDay ? todayRef : null} className="border-b border-white/30">
              <div className={`sticky top-0 z-10 px-4 py-3 backdrop-blur-xl ${isCurrentDay ? 'bg-white/80' : 'bg-white/60'}`}>
                <div className="flex items-baseline gap-2">
                  <span className={`text-lg font-bold ${isCurrentDay ? 'text-slate-700' : 'text-slate-600'}`}>{format(date, 'd MMM')}</span>
                  <span className={`text-sm ${isCurrentDay ? 'text-slate-600' : 'text-slate-400'}`}>{formatDateLabel(date)}</span>
                </div>
              </div>
              <div className="px-4 pb-4">
                {!hasItems ? (<p className="text-slate-400 text-sm py-2 italic">No scheduled items</p>) : (
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
                        const isTraining = isTrainingBlock(block);
                        
                        return (
                          <div key={block.id} className={`relative group ${isCompleted || isSkipped ? 'opacity-50' : ''}`}>
                            <button onClick={() => onBlockClick(block)} className="w-full text-left flex gap-3 py-3 px-3 rounded-xl transition-colors backdrop-blur-sm bg-white/50 hover:bg-white/70 active:bg-white/80 border border-white/60">
                              <div className="w-12 flex-shrink-0">
                                <div className="text-sm text-slate-500">{startTime}</div>
                                <div className="text-xs text-slate-400">{block.duration_mins}min</div>
                              </div>
                              <div className={`flex-1 border-l-4 ${getBlockBorderColor(block.type, category)} pl-3`}>
                                <div className={`font-medium ${isCompleted || isSkipped ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                  {displayName}
                                  {block.goals?.name && displayName !== block.goals.name && (
                                    <span className="text-slate-400 font-normal ml-2">• {block.goals.name}</span>
                                  )}
                                </div>
                                {notesParts[1] && !isCompleted && !isSkipped && (
                                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{notesParts[1]}</p>
                                )}
                                {isCompleted && <span className="text-xs text-emerald-500">✓ Completed</span>}
                                {isSkipped && <span className="text-xs text-slate-400">Skipped</span>}
                              </div>
                            </button>
                            {isTraining && !isCompleted && !isSkipped && (
                              <button onClick={(e) => { e.stopPropagation(); onQuickComplete(block); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      } else {
                        const avail = item.data as { type: string; start: string; end: string; label: string };
                        return (
                          <div key={`avail-${idx}`} className="flex gap-3 py-3 px-3 opacity-40">
                            <div className="w-12 flex-shrink-0"><div className="text-sm text-slate-400">{avail.start}</div></div>
                            <div className={`flex-1 border-l-4 ${getBlockBorderColor(avail.type)} pl-3 border-dashed`}>
                              <div className="text-slate-400 flex items-center gap-2">{getBlockIcon(avail.type)}{avail.label}</div>
                              <div className="text-xs text-slate-400">{avail.start} - {avail.end}</div>
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

      {showTodayButton && (
        <button onClick={scrollToToday} className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-700 text-white rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:bg-slate-600 z-20">
          <ArrowUp className="w-4 h-4" />Today
        </button>
      )}
      <button onClick={onAddClick} className="absolute bottom-20 right-4 w-14 h-14 bg-slate-700 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-600 z-20">
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}

// ============================================================
// TEMPLATE BLOCK COMPONENT (for Template Week View)
// ============================================================

function TemplateBlockComponent({ block, top, height, onClick }: { 
  block: TemplateBlock; top: number; height: number; 
  onClick?: (block: TemplateBlock) => void 
}) {
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category);
  const formattedTime = format(setMinutes(setHours(new Date(), block.hour), block.minute), 'h:mm a');
  const notesParts = (block.notes || '').split('|||');
  const displayName = notesParts[0] || block.goals?.name || block.type;
  const isTraining = isTrainingBlock(block);
  
  return (
    <div
      className={`absolute left-1 right-1 rounded-lg border-2 px-2 py-1 overflow-hidden group ${styleClass} ${height < 40 ? 'text-xs' : 'text-sm'} cursor-pointer hover:shadow-lg hover:z-20 transition-all`}
      style={{ top: `${top}px`, height: `${Math.max(height - 2, 24)}px`, zIndex: 10 }}
      onClick={() => onClick?.(block)}
    >
      <div className="flex items-start gap-1 h-full">
        {isTraining && <GripVertical className="w-3 h-3 opacity-40 flex-shrink-0 mt-0.5" />}
        {!isTraining && getBlockIcon(block.type)}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="font-medium truncate leading-tight">{displayName}</div>
          {height >= 50 && <div className="text-xs opacity-75 leading-tight">{formattedTime} · {block.duration_mins}min</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DRAGGABLE BLOCK (for Calendar View)
// ============================================================

function DraggableBlock({ block, top, height, onComplete, onDelete, onClick }: { 
  block: ScheduleBlock; top: number; height: number; 
  onComplete?: (id: string) => void; onDelete?: (id: string) => void; onClick?: (block: ScheduleBlock) => void 
}) {
  const isDraggable = isDraggableBlock(block);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: block.id, data: { block }, disabled: !isDraggable });
  const isCompleted = block.status === 'completed';
  const isSkipped = block.status === 'skipped';
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category);
  const startTime = format(parseISO(block.scheduled_start), 'h:mm a');
  const notesParts = (block.notes || '').split('|||');
  const displayName = notesParts[0] || block.notes || block.goals?.name || block.type;
  const isTraining = isTrainingBlock(block);
  
  const style = transform 
    ? { top: `${top}px`, height: `${Math.max(height - 2, 24)}px`, transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1000 } 
    : { top: `${top}px`, height: `${Math.max(height - 2, 24)}px`, zIndex: 10 };
  
  return (
    <div ref={setNodeRef} {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={`absolute left-1 right-1 rounded-lg border-2 px-2 py-1 overflow-hidden group ${styleClass} ${isCompleted || isSkipped ? 'opacity-50' : ''} ${height < 40 ? 'text-xs' : 'text-sm'} ${isDragging ? 'opacity-50 shadow-2xl ring-2 ring-slate-500' : ''} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:shadow-lg hover:z-20 transition-all`}
      style={style} onClick={() => !isDragging && onClick?.(block)}>
      <div className="flex items-start gap-1 h-full">
        {isDraggable && <GripVertical className="w-3 h-3 opacity-40 flex-shrink-0 mt-0.5" />}
        {!isDraggable && getBlockIcon(block.type)}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="font-medium truncate leading-tight">{displayName}</div>
          {height >= 50 && <div className="text-xs opacity-75 leading-tight">{startTime} · {block.duration_mins}min</div>}
        </div>
        {isCompleted && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
      </div>
      {isTraining && !isCompleted && !isSkipped && !isDragging && height >= 40 && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onComplete?.(block.id); }} className="p-1 bg-emerald-500 text-white rounded shadow hover:bg-emerald-600 transition-colors" title="Complete">
            <Check className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DROPPABLE CELL
// ============================================================

function DroppableCell({ id, dayIndex, hour, minute, date, isBlocked, onClick }: { 
  id: string; dayIndex: number; hour: number; minute: number; date: Date; isBlocked: boolean; onClick: () => void 
}) {
  const { isOver, setNodeRef, active } = useDroppable({ id, data: { dayIndex, hour, minute, date } as DroppableData, disabled: isBlocked });
  const showDropIndicator = isOver && active && !isBlocked;
  const showBlockedIndicator = isOver && active && isBlocked;
  
  return (
    <div ref={setNodeRef}
      className={`absolute left-0 right-0 transition-colors ${showDropIndicator ? 'bg-slate-200/70 ring-2 ring-slate-500 ring-inset z-30' : ''} ${showBlockedIndicator ? 'bg-rose-200/70 ring-2 ring-rose-500 ring-inset z-30' : ''} ${!isOver && !isBlocked ? 'hover:bg-white/50' : ''} ${isBlocked ? '' : 'cursor-pointer'}`}
      style={{ top: `${(minute / 60) * HOUR_HEIGHT}px`, height: `${(SLOT_INTERVAL / 60) * HOUR_HEIGHT}px` }}
      onClick={() => !isBlocked && onClick()}>
      {showBlockedIndicator && <div className="absolute inset-0 flex items-center justify-center"><Ban className="w-4 h-4 text-rose-500" /></div>}
    </div>
  );
}

// ============================================================
// DRAG OVERLAY
// ============================================================

function DragOverlayBlock({ block }: { block: ScheduleBlock }) {
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category);
  const notesParts = (block.notes || '').split('|||');
  const displayName = notesParts[0] || block.notes || block.goals?.name || block.type;
  const height = (block.duration_mins / 60) * HOUR_HEIGHT;
  
  return (
    <div className={`rounded-lg border-2 px-2 py-1 overflow-hidden shadow-2xl ${styleClass} cursor-grabbing`} style={{ width: '140px', height: `${Math.max(height - 2, 40)}px`, opacity: 0.9 }}>
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

function AddBlockModal({ isOpen, onClose, onAdd, selectedDay, selectedHour }: { 
  isOpen: boolean; onClose: () => void; 
  onAdd: (block: { type: string; days: string[]; start: string; end: string; notes?: string; title?: string }) => void; 
  selectedDay?: string; selectedHour?: number 
}) {
  const [type, setType] = useState<'work' | 'commute' | 'event' | 'training'>('work');
  const [selectedDays, setSelectedDays] = useState<string[]>(selectedDay ? [selectedDay] : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [startTime, setStartTime] = useState(selectedHour ? `${String(selectedHour).padStart(2, '0')}:00` : '09:00');
  const [endTime, setEndTime] = useState(selectedHour ? `${String(selectedHour + 1).padStart(2, '0')}:00` : '18:00');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedDays(selectedDay ? [selectedDay] : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
      setStartTime(selectedHour ? `${String(selectedHour).padStart(2, '0')}:00` : '09:00');
      setEndTime(selectedHour ? `${String(selectedHour + 1).padStart(2, '0')}:00` : '18:00');
      setNotes('');
      setTitle('');
    }
  }, [isOpen, selectedDay, selectedHour]);

  if (!isOpen) return null;
  
  const toggleDay = (day: string) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const selectWeekdays = () => setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const selectWeekend = () => setSelectedDays(['saturday', 'sunday']);
  const selectAll = () => setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  
  const handleSubmit = () => { 
    if (selectedDays.length === 0) { alert('Please select at least one day'); return; } 
    if (type === 'training' && !title.trim()) { alert('Please enter a title for the training'); return; }
    onAdd({ type, days: selectedDays, start: startTime, end: endTime, notes: notes || undefined, title: title || undefined }); 
    onClose(); 
    setNotes(''); 
    setTitle('');
  };
  
  const applyPreset = (preset: 'work' | 'commute-morning' | 'commute-evening' | 'gym') => {
    if (preset === 'work') { setType('work'); setStartTime('09:00'); setEndTime('18:00'); selectWeekdays(); }
    else if (preset === 'commute-morning') { setType('commute'); setStartTime('08:00'); setEndTime('09:00'); selectWeekdays(); }
    else if (preset === 'commute-evening') { setType('commute'); setStartTime('18:00'); setEndTime('19:00'); selectWeekdays(); }
    else if (preset === 'gym') { setType('training'); setStartTime('07:00'); setEndTime('08:00'); setSelectedDays(['monday', 'wednesday', 'friday']); setTitle('Gym Session'); }
  };

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const durationMins = (endH * 60 + endM) - (startH * 60 + startM);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl md:rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border border-white/80">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-xl z-10 rounded-t-3xl">
          <h3 className="text-lg font-bold text-slate-700">Add Time Block</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Quick Presets</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => applyPreset('work')} className="px-3 py-1.5 text-sm bg-white/50 hover:bg-white/70 rounded-lg border border-white/60 flex items-center gap-1.5 text-slate-600"><Briefcase className="w-3.5 h-3.5" />Work (9-6)</button>
              <button onClick={() => applyPreset('commute-morning')} className="px-3 py-1.5 text-sm bg-white/50 hover:bg-white/70 rounded-lg border border-white/60 flex items-center gap-1.5 text-slate-600"><Car className="w-3.5 h-3.5" />AM Commute</button>
              <button onClick={() => applyPreset('commute-evening')} className="px-3 py-1.5 text-sm bg-white/50 hover:bg-white/70 rounded-lg border border-white/60 flex items-center gap-1.5 text-slate-600"><Car className="w-3.5 h-3.5" />PM Commute</button>
              <button onClick={() => applyPreset('gym')} className="px-3 py-1.5 text-sm bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 flex items-center gap-1.5 text-emerald-700"><Dumbbell className="w-3.5 h-3.5" />Gym (MWF)</button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'work', label: 'Work', icon: <Briefcase className="w-4 h-4" />, color: 'slate' },
                { value: 'commute', label: 'Commute', icon: <Car className="w-4 h-4" />, color: 'slate' },
                { value: 'event', label: 'Event', icon: <Users className="w-4 h-4" />, color: 'violet' },
                { value: 'training', label: 'Training', icon: <Dumbbell className="w-4 h-4" />, color: 'emerald' },
              ].map((option) => (
                <button key={option.value} onClick={() => setType(option.value as typeof type)} className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border-2 transition-colors ${
                  type === option.value 
                    ? option.color === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                      : option.color === 'violet' ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-slate-500 bg-slate-100 text-slate-700' 
                    : 'border-white/60 bg-white/50 hover:border-slate-300 text-slate-600'
                }`}>
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {(type === 'training' || type === 'event') && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Title {type === 'training' && <span className="text-rose-500">*</span>}
              </label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'training' ? "e.g., Morning Run, Yoga" : "e.g., Team Meeting"} className="w-full px-3 py-2 border border-white/60 bg-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 placeholder:text-slate-400" />
            </div>
          )}
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-600">Days</label>
              <div className="flex gap-2 text-xs">
                <button onClick={selectWeekdays} className="text-slate-500 hover:text-slate-700 hover:underline">Weekdays</button>
                <span className="text-slate-300">|</span>
                <button onClick={selectWeekend} className="text-slate-500 hover:text-slate-700 hover:underline">Weekend</button>
                <span className="text-slate-300">|</span>
                <button onClick={selectAll} className="text-slate-500 hover:text-slate-700 hover:underline">All</button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => (
                <button key={day} onClick={() => toggleDay(day)} className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${selectedDays.includes(day) ? 'border-slate-500 bg-slate-100 text-slate-700' : 'border-white/60 bg-white/50 text-slate-400 hover:border-slate-300'}`}>{DAY_LABELS[i]}</button>
              ))}
            </div>
            {selectedDays.length > 1 && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><Calendar className="w-3 h-3" />Will create blocks for all selected days</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-600 mb-2">Start Time</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-white/60 bg-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" /></div>
            <div><label className="block text-sm font-medium text-slate-600 mb-2">End Time</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 border border-white/60 bg-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" /></div>
          </div>
          
          {durationMins > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              <span>Duration: {Math.floor(durationMins / 60)}h {durationMins % 60 > 0 ? `${durationMins % 60}m` : ''}</span>
            </div>
          )}
          
          <div><label className="block text-sm font-medium text-slate-600 mb-2">Notes (optional)</label><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., Office, Focus on cardio" className="w-full px-3 py-2 border border-white/60 bg-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 placeholder:text-slate-400" /></div>
        </div>
        <div className="flex gap-3 p-4 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-xl">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={selectedDays.length === 0 || (type === 'training' && !title.trim())} className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium disabled:opacity-50 ${type === 'training' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
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

function CompleteWithNotesModal({ block, onClose, onComplete, isLoading }: { 
  block: ScheduleBlock | null; onClose: () => void; 
  onComplete: (blockId: string, notes: string) => void; isLoading?: boolean 
}) {
  const [notes, setNotes] = useState('');
  useEffect(() => { if (block) setNotes(''); }, [block?.id]);
  if (!block) return null;
  const notesParts = (block.notes || '').split('|||');
  const sessionName = notesParts[0] || block.goals?.name || 'Session';
  
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl md:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-white/80" onClick={(e) => e.stopPropagation()}>
        <div className="bg-emerald-500 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl"><Check className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-lg">Nice work! 🎉</h3><p className="text-sm opacity-80">{sessionName}</p></div>
          </div>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-slate-600 mb-2">How did it go? (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this session..." className="w-full px-4 py-3 border border-white/60 bg-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none text-slate-700" rows={3} autoFocus />
        </div>
        <div className="flex gap-3 p-4 border-t border-slate-100 bg-white/50">
          <button onClick={onClose} disabled={isLoading} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50">Cancel</button>
          <button onClick={() => onComplete(block.id, notes)} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            <Check className="w-4 h-4" />{isLoading ? 'Saving...' : 'Log It'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE DETAIL MODAL (for Template Week View)
// ============================================================

function TemplateDetailModal({ block, onClose }: {
  block: TemplateBlock | null; 
  onClose: () => void;
}) {
  if (!block) return null;
  
  const notesParts = (block.notes || '').split('|||');
  const sessionName = notesParts[0] || block.goals?.name || 'Session';
  const sessionDescription = notesParts[1] || '';
  const sessionTip = notesParts[2] || '';
  const category = block.goals?.category || block.type;
  const dayName = DAY_NAMES[block.dayOfWeek];
  const timeStr = format(setMinutes(setHours(new Date(), block.hour), block.minute), 'h:mm a');
  const endTime = format(setMinutes(setHours(new Date(), block.hour), block.minute + block.duration_mins), 'h:mm a');

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl md:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/80" onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 ${getHeaderColor(block.type, category)} text-white flex-shrink-0`}>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-xl">{getBlockIcon(block.type) || <Clock className="w-5 h-5" />}</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg leading-tight">{sessionName}</h3>
              {block.goals?.name && sessionName !== block.goals.name && <p className="text-sm opacity-80 mt-0.5">{block.goals.name}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="bg-indigo-50/80 backdrop-blur-sm rounded-xl p-3 border border-indigo-200/50">
            <div className="flex items-center gap-2 text-indigo-700">
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm font-medium">Weekly Schedule</span>
            </div>
            <p className="text-sm text-indigo-600 mt-1">This session repeats every {dayName}</p>
          </div>
          
          {sessionDescription && <div className="bg-white/50 backdrop-blur-sm rounded-xl p-3 border border-white/60"><p className="text-slate-600 text-sm leading-relaxed">{sessionDescription}</p></div>}
          {sessionTip && <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-xl p-3"><div className="flex items-start gap-2"><span className="text-lg">💡</span><p className="text-amber-800 text-sm leading-relaxed">{sessionTip}</p></div></div>}
          
          <div className="flex items-center gap-3 text-slate-600">
            <Clock className="w-5 h-5 text-slate-400" />
            <div>
              <div className="font-medium">{dayName} · {timeStr}</div>
              <div className="text-sm text-slate-400">{block.duration_mins} minutes (until {endTime})</div>
            </div>
          </div>
          
          {block.goals && (
            <div className="bg-slate-50/80 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg"><Target className="w-5 h-5 text-slate-500" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-700">{block.goals.name}</div>
                  <div className="text-xs text-slate-400 capitalize mt-0.5">{block.goals.category} goal</div>
                </div>
              </div>
              {block.goal_id && (
                <a href={`/goals?highlight=${block.goal_id}`} className="flex items-center justify-center gap-1.5 mt-3 px-3 py-2 bg-white hover:bg-slate-100 rounded-lg text-sm text-slate-600 font-medium transition-colors border border-slate-200">
                  <ExternalLink className="w-4 h-4" />View Full Goal
                </a>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-600 font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SESSION DETAIL MODAL (for Calendar View)
// ============================================================

function SessionDetailModal({ block, onClose, onComplete, onDelete, onEdit }: {
  block: ScheduleBlock | null; onClose: () => void; onComplete?: (id: string) => void; onDelete?: (id: string) => void;
  onEdit?: (block: ScheduleBlock) => void;
}) {
  if (!block) return null;
  
  const isCompleted = block.status === 'completed';
  const isSkipped = block.status === 'skipped';
  const isUserBlock = block.created_by === 'user' || isBlockerType(block.type);
  const isTraining = isTrainingBlock(block);
  const startTime = format(parseISO(block.scheduled_start), 'EEEE, MMM d · h:mm a');
  const endTime = format(new Date(parseISO(block.scheduled_start).getTime() + block.duration_mins * 60 * 1000), 'h:mm a');
  const notesParts = (block.notes || '').split('|||');
  const sessionName = notesParts[0] || block.notes || block.type;
  const sessionDescription = notesParts[1] || '';
  const sessionTip = notesParts[2] || '';
  const category = block.goals?.category || block.type;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl md:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/80" onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 ${getHeaderColor(block.type, category)} text-white flex-shrink-0`}>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-xl">{getBlockIcon(block.type) || <Clock className="w-5 h-5" />}</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg leading-tight">{sessionName}</h3>
              {block.goals?.name && sessionName !== block.goals.name && <p className="text-sm opacity-80 mt-0.5">{block.goals.name}</p>}
            </div>
            <div className="flex gap-1">
              {onEdit && !isCompleted && !isSkipped && (
                <button onClick={(e) => { e.stopPropagation(); onEdit(block); onClose(); }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Edit">
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {sessionDescription && <div className="bg-white/50 backdrop-blur-sm rounded-xl p-3 border border-white/60"><p className="text-slate-600 text-sm leading-relaxed">{sessionDescription}</p></div>}
          {sessionTip && <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-xl p-3"><div className="flex items-start gap-2"><span className="text-lg">💡</span><p className="text-amber-800 text-sm leading-relaxed">{sessionTip}</p></div></div>}
          <div className="flex items-center gap-3 text-slate-600"><Clock className="w-5 h-5 text-slate-400" /><div><div className="font-medium">{startTime}</div><div className="text-sm text-slate-400">{block.duration_mins} minutes (until {endTime})</div></div></div>
          
          {block.goals && (
            <div className="bg-slate-50/80 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg"><Target className="w-5 h-5 text-slate-500" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-700">{block.goals.name}</div>
                  <div className="text-xs text-slate-400 capitalize mt-0.5">{block.goals.category} goal</div>
                </div>
              </div>
              {block.goal_id && (
                <a href={`/goals?highlight=${block.goal_id}`} className="flex items-center justify-center gap-1.5 mt-3 px-3 py-2 bg-white hover:bg-slate-100 rounded-lg text-sm text-slate-600 font-medium transition-colors border border-slate-200">
                  <ExternalLink className="w-4 h-4" />View Full Goal
                </a>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-3">{isCompleted ? <><CheckCircle className="w-5 h-5 text-emerald-500" /><span className="text-emerald-600 font-medium">Completed</span></> : isSkipped ? <><Ban className="w-5 h-5 text-slate-400" /><span className="text-slate-500 font-medium">Skipped</span></> : <><Circle className="w-5 h-5 text-slate-400" /><span className="text-slate-500">Scheduled</span></>}</div>
        </div>
        
        {isTraining && !isCompleted && !isSkipped && (
          <div className="p-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              {onComplete && <button onClick={() => { onComplete(block.id); onClose(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-medium"><Check className="w-4 h-4" />Log It</button>}
            </div>
            {onDelete && (
              <button onClick={() => { if (window.confirm('Delete this session?')) { onDelete(block.id); onClose(); }}} className="w-full px-3 py-2 text-rose-600 hover:bg-rose-50/50 border border-rose-200 rounded-xl text-sm font-medium">Delete</button>
            )}
          </div>
        )}
        
        {isUserBlock && (
          <div className="p-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm flex-shrink-0 flex gap-2">
            {onEdit && <button onClick={() => { onEdit(block); onClose(); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-white/50 rounded-xl text-sm font-medium flex items-center justify-center gap-2"><Edit3 className="w-4 h-4" />Edit</button>}
            {onDelete && <button onClick={() => { if (window.confirm('Delete this block?')) { onDelete(block.id); onClose(); }}} className="flex-1 px-4 py-2 text-rose-600 hover:bg-rose-50/50 border border-rose-200 rounded-xl text-sm font-medium">Delete Block</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function HourlyCalendar({ blocks, availability, userId, onBlockUpdate, weekOffset, setWeekOffset }: HourlyCalendarProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [selectedTemplateBlock, setSelectedTemplateBlock] = useState<TemplateBlock | null>(null);
  const [blockToComplete, setBlockToComplete] = useState<ScheduleBlock | null>(null);
  const [activeBlock, setActiveBlock] = useState<ScheduleBlock | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<{ message: string; blockingType: string; show: boolean }>({ message: '', blockingType: '', show: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // View mode: 'template' for weekly template, 'calendar' for actual dates
  const [viewMode, setViewMode] = useState<'template' | 'calendar'>('template');

  useEffect(() => { 
    const checkMobile = () => setIsMobile(window.innerWidth < 768); 
    checkMobile(); 
    window.addEventListener('resize', checkMobile); 
    return () => window.removeEventListener('resize', checkMobile); 
  }, []);

  // Auto-scroll to 6am for template view
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = Math.max(0, (6 - START_HOUR) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, [viewMode]);

  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 0 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Mutations
  const deleteBlockMutation = useMutation({ mutationFn: (blockId: string) => scheduleAPI.deleteBlock(blockId), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedule'] }); onBlockUpdate?.(); } });
  const createRecurringMutation = useMutation({ mutationFn: (data: { user_id: string; type: string; days: string[]; start_time: string; end_time: string; notes?: string }) => scheduleAPI.createRecurringBlock(data), onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['schedule'] }); onBlockUpdate?.(); alert('✅ ' + data.message); }, onError: (error: Error & { response?: { data?: { message?: string } } }) => { alert('❌ ' + (error.response?.data?.message || 'Failed to create blocks')); } });
  const completeWithNotesMutation = useMutation({ mutationFn: async ({ blockId, notes }: { blockId: string; notes: string }) => scheduleAPI.completeBlockWithNotes(blockId, notes), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedule'] }); onBlockUpdate?.(); setBlockToComplete(null); } });

  const handleCompleteClick = (blockId: string) => { const block = blocks.find(b => b.id === blockId); if (block) { setSelectedBlock(null); setBlockToComplete(block); } };
  const handleQuickComplete = (block: ScheduleBlock) => { setBlockToComplete(block); };

  // ============================================================
  // TEMPLATE WEEK VIEW - Group blocks by day-of-week and dedupe
  // ============================================================
  const templateBlocksByDay = useMemo(() => {
    const grouped: Record<number, TemplateBlock[]> = {};
    for (let i = 0; i < 7; i++) grouped[i] = [];
    
    // Group ALL training blocks by day-of-week
    const byDayOfWeek: Record<number, ScheduleBlock[]> = {};
    for (let i = 0; i < 7; i++) byDayOfWeek[i] = [];
    
    blocks.forEach((block) => {
      // Only include training/workout blocks in template view
      if (block.type !== 'workout' && block.type !== 'training') return;
      if (block.status === 'completed' || block.status === 'skipped') return;
      
      const blockDate = parseISO(block.scheduled_start);
      const dayOfWeek = blockDate.getDay(); // 0=Sun, 1=Mon, etc.
      byDayOfWeek[dayOfWeek].push(block);
    });
    
    // For each day, dedupe by time slot (keep first occurrence of each time)
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayBlocks = byDayOfWeek[dayIndex];
      const seenTimes = new Map<string, TemplateBlock>();
      
      for (const block of dayBlocks) {
        const blockDate = parseISO(block.scheduled_start);
        const hour = blockDate.getHours();
        const minute = blockDate.getMinutes();
        const timeKey = `${hour}:${minute}`;
        
        if (!seenTimes.has(timeKey)) {
          const templateBlock: TemplateBlock = {
            id: block.id,
            dayOfWeek: dayIndex,
            hour,
            minute,
            duration_mins: block.duration_mins,
            notes: block.notes,
            type: block.type,
            goal_id: block.goal_id,
            goals: block.goals,
            allBlockIds: [block.id],
          };
          seenTimes.set(timeKey, templateBlock);
        } else {
          // Add this block's ID to the existing template block
          seenTimes.get(timeKey)!.allBlockIds.push(block.id);
        }
      }
      
      grouped[dayIndex] = Array.from(seenTimes.values());
    }
    
    return grouped;
  }, [blocks]);

  // Availability blocks for background
  const availabilityBlocks = useMemo(() => {
    if (!availability) return [];
    const result: Array<{ type: string; dayIndex: number; startHour: number; startMin: number; durationMins: number; label: string }> = [];
    const wake = parseTime(availability.wake_time || '07:00');
    const sleep = parseTime(availability.sleep_time || '23:00');
    
    DAYS.forEach((day, dayIndex) => {
      if (wake.hours > START_HOUR) result.push({ type: 'sleep', dayIndex, startHour: START_HOUR, startMin: 0, durationMins: (wake.hours - START_HOUR) * 60 + wake.minutes, label: 'Sleep' });
      if (sleep.hours < END_HOUR) result.push({ type: 'sleep', dayIndex, startHour: sleep.hours, startMin: sleep.minutes, durationMins: (END_HOUR - sleep.hours) * 60 - sleep.minutes, label: 'Sleep' });
      
      const workSchedule = availability.work_schedule?.[day];
      if (workSchedule) {
        const workStart = parseTime(workSchedule.start); const workEnd = parseTime(workSchedule.end);
        const workDuration = (workEnd.hours - workStart.hours) * 60 + (workEnd.minutes - workStart.minutes);
        result.push({ type: 'work', dayIndex, startHour: workStart.hours, startMin: workStart.minutes, durationMins: workDuration, label: 'Work ' + workSchedule.start + ' - ' + workSchedule.end });
        const commuteMins = availability.daily_commute_mins || 0;
        if (commuteMins > 0) {
          const commuteStartMins = workStart.hours * 60 + workStart.minutes - commuteMins;
          result.push({ type: 'commute', dayIndex, startHour: Math.floor(commuteStartMins / 60), startMin: commuteStartMins % 60, durationMins: commuteMins, label: 'Commute' });
          result.push({ type: 'commute', dayIndex, startHour: workEnd.hours, startMin: workEnd.minutes, durationMins: commuteMins, label: 'Commute' });
        }
      }
    });
    
    (availability.fixed_commitments || []).forEach((commitment) => { 
      const dayIndex = DAYS.indexOf(commitment.day.toLowerCase()); 
      if (dayIndex === -1) return; 
      const start = parseTime(commitment.start); 
      const end = parseTime(commitment.end); 
      result.push({ type: 'event', dayIndex, startHour: start.hours, startMin: start.minutes, durationMins: (end.hours - start.hours) * 60 + (end.minutes - start.minutes), label: commitment.name }); 
    });
    return result;
  }, [availability]);

  const handleAddBlock = (blockData: { type: string; days: string[]; start: string; end: string; notes?: string; title?: string }) => {
    createRecurringMutation.mutate({ 
      user_id: userId, 
      type: blockData.type, 
      days: blockData.days, 
      start_time: blockData.start, 
      end_time: blockData.end, 
      notes: blockData.title || blockData.notes 
    });
  };

  const handleCellClick = (dayIndex: number, hour: number) => { 
    setSelectedSlot({ day: DAYS[dayIndex], hour }); 
    setShowAddModal(true); 
  };

  // Count total sessions for header
  const totalTemplateSessions = Object.values(templateBlocksByDay).reduce((sum, arr) => sum + arr.length, 0);

  // Mobile view
  if (isMobile) {
    return (
      <>
        <div className="h-[calc(100vh-140px)] relative">
          <MobileAgendaView blocks={blocks} availability={availability} userId={userId} onBlockClick={setSelectedBlock} onAddClick={() => setShowAddModal(true)} onQuickComplete={handleQuickComplete} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
        </div>
        <AddBlockModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setSelectedSlot(null); }} onAdd={handleAddBlock} selectedDay={selectedSlot?.day} selectedHour={selectedSlot?.hour} />
        <SessionDetailModal block={selectedBlock} onClose={() => setSelectedBlock(null)} onComplete={handleCompleteClick} onDelete={(id) => deleteBlockMutation.mutate(id)} />
        <CompleteWithNotesModal block={blockToComplete} onClose={() => setBlockToComplete(null)} onComplete={(blockId, notes) => completeWithNotesMutation.mutate({ blockId, notes })} isLoading={completeWithNotesMutation.isPending} />
      </>
    );
  }

  // Desktop Template Week View
  return (
    <DndContext sensors={sensors} onDragStart={() => {}} onDragOver={() => {}} onDragEnd={() => {}}>
      <div className="backdrop-blur-xl bg-white/70 rounded-2xl shadow-lg border border-white/80 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-700 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <LayoutGrid className="w-5 h-5 opacity-80" />
            <div>
              <h2 className="text-lg font-bold">Your Weekly Schedule</h2>
              <p className="text-sm opacity-80">{totalTemplateSessions} sessions per week</p>
            </div>
          </div>
          <button onClick={() => { setSelectedSlot(null); setShowAddModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium">
            <Plus className="w-4 h-4" />Add Block
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/30 backdrop-blur-sm border-b border-white/40 flex-shrink-0">
          <div className="flex gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-slate-200/80 border border-slate-400" /><span>Work</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-indigo-100/90 border border-indigo-400" /><span>Training</span></div>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Sessions repeat weekly</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto flex" ref={scrollRef}>
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r border-white/40 bg-white/30 backdrop-blur-sm sticky left-0 z-20">
            <div className="h-12 border-b border-white/40 bg-white/30" />
            <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT + 'px' }}>
              {HOURS.map((hour, idx) => (
                <div key={hour} className="absolute right-2 text-xs text-slate-500 font-medium -translate-y-2" style={{ top: idx * HOUR_HEIGHT + 'px' }}>
                  {format(setHours(new Date(), hour), 'h a')}
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          <div className="flex-1">
            <div className="flex min-w-[700px]">
              {DAYS.map((dayName, dayIndex) => {
                const dayTemplateBlocks = templateBlocksByDay[dayIndex] || [];
                const dayAvailBlocks = availabilityBlocks.filter((b) => b.dayIndex === dayIndex);
                const todayDayIndex = today.getDay();
                const isCurrentDay = dayIndex === todayDayIndex;
                
                return (
                  <div key={dayIndex} className="flex-1 min-w-[100px] border-r border-white/40 last:border-r-0">
                    {/* Day header - just day name, no dates */}
                    <div className={`h-12 px-2 py-1 border-b border-white/40 text-center sticky top-0 z-10 backdrop-blur-sm ${isCurrentDay ? 'bg-slate-100/80' : 'bg-white/50'}`}>
                      <div className={`text-sm font-bold ${isCurrentDay ? 'text-slate-700' : 'text-slate-600'}`}>{DAY_LABELS[dayIndex]}</div>
                      <div className="text-xs text-slate-400">{dayTemplateBlocks.length} session{dayTemplateBlocks.length !== 1 ? 's' : ''}</div>
                    </div>
                    
                    {/* Time slots */}
                    <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT + 'px' }}>
                      {/* Hour grid lines */}
                      {HOURS.map((hour, idx) => (
                        <div key={hour} className={`absolute left-0 right-0 border-t border-white/30 ${idx % 2 === 0 ? 'bg-white/20' : 'bg-white/10'}`} style={{ top: idx * HOUR_HEIGHT + 'px', height: HOUR_HEIGHT + 'px' }}>
                          {[0, 15, 30, 45].map((minute) => (
                            <div 
                              key={minute}
                              className="absolute left-0 right-0 hover:bg-white/50 cursor-pointer"
                              style={{ top: `${(minute / 60) * HOUR_HEIGHT}px`, height: `${(SLOT_INTERVAL / 60) * HOUR_HEIGHT}px` }}
                              onClick={() => handleCellClick(dayIndex, hour)}
                            />
                          ))}
                        </div>
                      ))}
                      
                      {/* Availability blocks (work, sleep, etc) */}
                      {dayAvailBlocks.map((block, idx) => (
                        <AvailabilityBlock key={`avail-${idx}`} block={block} />
                      ))}
                      
                      {/* Template training blocks */}
                      {dayTemplateBlocks.map((block) => {
                        const top = (block.hour - START_HOUR) * HOUR_HEIGHT + (block.minute / 60) * HOUR_HEIGHT;
                        const height = (block.duration_mins / 60) * HOUR_HEIGHT;
                        return (
                          <TemplateBlockComponent 
                            key={block.id} 
                            block={block} 
                            top={top} 
                            height={height} 
                            onClick={(b) => setSelectedTemplateBlock(b)}
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
        <AddBlockModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setSelectedSlot(null); }} onAdd={handleAddBlock} selectedDay={selectedSlot?.day} selectedHour={selectedSlot?.hour} />
        <TemplateDetailModal block={selectedTemplateBlock} onClose={() => setSelectedTemplateBlock(null)} />
        <SessionDetailModal block={selectedBlock} onClose={() => setSelectedBlock(null)} onComplete={handleCompleteClick} onDelete={(id) => deleteBlockMutation.mutate(id)} />
        <CompleteWithNotesModal block={blockToComplete} onClose={() => setBlockToComplete(null)} onComplete={(blockId, notes) => completeWithNotesMutation.mutate({ blockId, notes })} isLoading={completeWithNotesMutation.isPending} />
      </div>

      <DragOverlay dropAnimation={null}>{activeBlock ? <DragOverlayBlock block={activeBlock} /> : null}</DragOverlay>
      <OverlapWarning show={overlapWarning.show} message={overlapWarning.message} blockingType={overlapWarning.blockingType} onClose={() => setOverlapWarning({ message: '', blockingType: '', show: false })} />
    </DndContext>
  );
}