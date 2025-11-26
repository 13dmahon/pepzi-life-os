'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, addDays, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';
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
  };
  return colors[category || ''] || 'bg-gray-100 border-gray-400 text-gray-800';
};

const getBlockIcon = (type: string) => {
  if (type === 'work') return <Briefcase className="w-3 h-3" />;
  if (type === 'commute') return <Car className="w-3 h-3" />;
  if (type === 'event' || type === 'social') return <Users className="w-3 h-3" />;
  if (type === 'sleep') return <Moon className="w-3 h-3" />;
  if (type === 'workout' || type === 'training') return <Dumbbell className="w-3 h-3" />;
  return null;
};

const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

// Check if a block is draggable
const isDraggableBlock = (block: ScheduleBlock): boolean => {
  // Only training blocks (workout/training) that aren't completed
  const isTrainingType = block.type === 'workout' || block.type === 'training';
  const isNotCompleted = block.status !== 'completed';
  return isTrainingType && isNotCompleted;
};

// Check if a block is a "blocker" (can't drop on it)
const isBlockerType = (type: string): boolean => {
  return ['work', 'commute', 'event', 'social', 'sleep'].includes(type);
};

// ============================================================
// DRAGGABLE BLOCK COMPONENT
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
  const isUserBlock = block.created_by === 'user' || isBlockerType(block.type);
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category, block.created_by);

  const startTime = format(parseISO(block.scheduled_start), 'h:mm a');
  
  // Parse notes to extract just the name (format: "name|||description|||tip")
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
      className={`
        absolute left-1 right-1 rounded-lg border-2 px-2 py-1 overflow-hidden
        ${styleClass}
        ${isCompleted ? 'opacity-60' : ''}
        ${height < 40 ? 'text-xs' : 'text-sm'}
        ${isDragging ? 'opacity-50 shadow-2xl ring-2 ring-purple-500' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        hover:shadow-lg hover:z-20 transition-shadow group
      `}
      style={style}
      onClick={() => !isDragging && onClick?.(block)}
      title={`${displayName}\n${startTime} · ${block.duration_mins}min${isDraggable ? '\n(Drag to reschedule)' : ''}`}
    >
      <div className="flex items-start gap-1 h-full">
        {/* Drag Handle for draggable blocks */}
        {isDraggable && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-black/10 rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3 opacity-50" />
          </div>
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

        {/* Actions - only for training blocks */}
        {!isUserBlock && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {!isCompleted && onComplete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(block.id);
                }}
                className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                title="Mark complete"
              >
                <Check className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(block.id);
                }}
                className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
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

  // Show visual feedback when dragging over
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
  onAdd: (block: { type: string; day: string; start: string; end: string; notes?: string }) => void;
  selectedDay?: string;
  selectedHour?: number;
}

function AddBlockModal({ isOpen, onClose, onAdd, selectedDay, selectedHour }: AddBlockModalProps) {
  const [type, setType] = useState<'work' | 'commute' | 'event'>('work');
  const [day, setDay] = useState(selectedDay || 'monday');
  const [startTime, setStartTime] = useState(selectedHour ? `${String(selectedHour).padStart(2, '0')}:00` : '09:00');
  const [endTime, setEndTime] = useState(selectedHour ? `${String(selectedHour + 1).padStart(2, '0')}:00` : '10:00');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onAdd({ type, day, start: startTime, end: endTime, notes: notes || undefined });
    onClose();
    setNotes('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold">Add Time Block</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Day</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={d}>
                  {DAY_LABELS[i]}
                </option>
              ))}
            </select>
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
              placeholder="e.g., Meeting with client"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            Add Block
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SESSION DETAIL MODAL
// ============================================================

interface SessionDetailModalProps {
  block: ScheduleBlock | null;
  onClose: () => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function SessionDetailModal({ block, onClose, onComplete, onDelete }: SessionDetailModalProps) {
  if (!block) return null;

  const isCompleted = block.status === 'completed';
  const isUserBlock = block.created_by === 'user' || isBlockerType(block.type);
  const category = block.goals?.category || block.type;
  const styleClass = getBlockStyle(block.type, category, block.created_by);

  const startTime = format(parseISO(block.scheduled_start), 'EEEE, MMM d · h:mm a');
  const endTime = format(
    new Date(parseISO(block.scheduled_start).getTime() + block.duration_mins * 60 * 1000),
    'h:mm a'
  );

  // Parse notes to extract name, description, tip
  // Format: "name|||description|||tip"
  const notesParts = (block.notes || '').split('|||');
  const sessionName = notesParts[0] || block.notes || block.type;
  const sessionDescription = notesParts[1] || '';
  const sessionTip = notesParts[2] || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${styleClass} p-4 border-b-2 flex-shrink-0`}>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/50 rounded-lg">
              {getBlockIcon(block.type) || <Clock className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg leading-tight">
                {sessionName}
              </h3>
              {block.goals?.name && sessionName !== block.goals.name && (
                <p className="text-sm opacity-75 mt-1">{block.goals.name}</p>
              )}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-black/10 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Details - scrollable */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Description */}
          {sessionDescription && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-700 text-sm leading-relaxed">{sessionDescription}</p>
            </div>
          )}

          {/* Coach Tip */}
          {sessionTip && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <p className="text-yellow-800 text-sm leading-relaxed">{sessionTip}</p>
              </div>
            </div>
          )}

          {/* Time */}
          <div className="flex items-center gap-3 text-gray-700">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <div className="font-medium">{startTime}</div>
              <div className="text-sm text-gray-500">
                {block.duration_mins} minutes (until {endTime})
              </div>
            </div>
          </div>

          {/* Goal */}
          {block.goals && (
            <div className="flex items-center gap-3 text-gray-700">
              <Target className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium">{block.goals.name}</div>
                <div className="text-sm text-gray-500 capitalize">{block.goals.category} goal</div>
              </div>
            </div>
          )}

          {/* Status */}
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

        {/* Actions */}
        {!isUserBlock && (
          <div className="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
            {!isCompleted && onComplete && (
              <button
                onClick={() => {
                  onComplete(block.id);
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
              >
                <Check className="w-4 h-4" />
                Mark Complete
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
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium"
              >
                Delete
              </button>
            )}
          </div>
        )}
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
}: HourlyCalendarProps) {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [activeBlock, setActiveBlock] = useState<ScheduleBlock | null>(null);
  const [isOverBlocked, setIsOverBlocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate week dates
  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 0 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Configure drag sensors - add activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Must drag 8px before activating
      },
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

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, scheduled_start }: { blockId: string; scheduled_start: string }) =>
      scheduleAPI.updateBlock(blockId, { scheduled_start }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

  // Generate availability blocks (work hours, sleep, commute)
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

    // Sleep blocks (before wake, after sleep)
    const wake = parseTime(availability.wake_time || '07:00');
    const sleep = parseTime(availability.sleep_time || '23:00');

    DAYS.forEach((day, dayIndex) => {
      // Morning sleep (midnight to wake)
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

      // Evening sleep (after sleep time)
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

      // Work hours
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

        // Commute before work
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

          // Commute after work
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

    // Fixed commitments
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

  // Create a map of blocked time slots (for collision detection)
  const blockedTimeSlots = useMemo(() => {
    const blocked: Record<string, boolean> = {};

    // Add availability blocks (work, sleep, commute, events)
    availabilityBlocks.forEach((block) => {
      const startMins = block.startHour * 60 + block.startMin;
      const endMins = startMins + block.durationMins;
      
      // Mark each 15-minute slot as blocked
      for (let min = startMins; min < endMins; min += SLOT_INTERVAL) {
        const key = `${block.dayIndex}-${Math.floor(min / 60)}-${min % 60}`;
        blocked[key] = true;
      }
    });

    // Add user-created blocks (work, commute, event from schedule_blocks)
    blocks.filter((b) => isBlockerType(b.type)).forEach((block) => {
      const blockDate = parseISO(block.scheduled_start);
      weekDates.forEach((date, dayIndex) => {
        if (isSameDay(date, blockDate)) {
          const startMins = blockDate.getHours() * 60 + blockDate.getMinutes();
          const endMins = startMins + block.duration_mins;
          
          for (let min = startMins; min < endMins; min += SLOT_INTERVAL) {
            const key = `${dayIndex}-${Math.floor(min / 60)}-${min % 60}`;
            blocked[key] = true;
          }
        }
      });
    });

    return blocked;
  }, [availabilityBlocks, blocks, weekDates]);

  // Check if dropping at a location would cause a collision
  const wouldCollide = useCallback((dayIndex: number, hour: number, minute: number, durationMins: number) => {
    const startMins = hour * 60 + minute;
    const endMins = startMins + durationMins;
    
    for (let min = startMins; min < endMins; min += SLOT_INTERVAL) {
      const key = `${dayIndex}-${Math.floor(min / 60)}-${min % 60}`;
      if (blockedTimeSlots[key]) return true;
    }
    return false;
  }, [blockedTimeSlots]);

  // Group schedule blocks by day
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

  // DnD Event Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const block = active.data.current?.block as ScheduleBlock;
    if (block) {
      setActiveBlock(block);
    }
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
      const isBlocked = wouldCollide(dropData.dayIndex, dropData.hour, dropData.minute, block.duration_mins);
      setIsOverBlocked(isBlocked);
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

    // Check for collision
    if (wouldCollide(dropData.dayIndex, dropData.hour, dropData.minute, block.duration_mins)) {
      // Show error feedback
      return;
    }

    // Calculate new scheduled_start
    const targetDate = weekDates[dropData.dayIndex];
    const newStart = setMinutes(setHours(targetDate, dropData.hour), dropData.minute);

    // Update the block
    updateBlockMutation.mutate({
      blockId: block.id,
      scheduled_start: newStart.toISOString(),
    });
  };

  // Handle adding a new block
  const handleAddBlock = (blockData: { type: string; day: string; start: string; end: string; notes?: string }) => {
    const dayIndex = DAYS.indexOf(blockData.day);
    const targetDate = weekDates[dayIndex];
    const [startHours, startMins] = blockData.start.split(':').map(Number);
    const [endHours, endMins] = blockData.end.split(':').map(Number);

    const scheduledStart = setMinutes(setHours(targetDate, startHours), startMins);
    const durationMins = (endHours * 60 + endMins) - (startHours * 60 + startMins);

    createBlockMutation.mutate({
      user_id: userId,
      type: blockData.type,
      scheduled_start: scheduledStart.toISOString(),
      duration_mins: durationMins,
      notes: blockData.notes,
    });
  };

  // Click on empty cell to add block
  const handleCellClick = (dayIndex: number, hour: number) => {
    setSelectedSlot({ day: DAYS[dayIndex], hour });
    setShowAddModal(true);
  };

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
            <div className="h-12 border-b border-gray-200 bg-gray-50" /> {/* Header spacer */}
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
                const isToday = isSameDay(date, today);
                const dayBlocks = blocksByDay[dayIndex] || [];
                const dayAvailBlocks = availabilityBlocks.filter((b) => b.dayIndex === dayIndex);

                return (
                  <div key={dayIndex} className="flex-1 min-w-[100px] border-r border-gray-200 last:border-r-0">
                    {/* Day Header */}
                    <div
                      className={`h-12 px-2 py-1 border-b border-gray-200 text-center sticky top-0 z-10 ${
                        isToday ? 'bg-purple-100' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`text-sm font-bold ${isToday ? 'text-purple-700' : 'text-gray-700'}`}>
                        {DAY_LABELS[dayIndex]}
                      </div>
                      <div className={`text-xs ${isToday ? 'text-purple-600' : 'text-gray-500'}`}>
                        {format(date, 'MMM d')}
                      </div>
                    </div>

                    {/* Hours Grid */}
                    <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                      {/* Hour lines with background */}
                      {HOURS.map((hour, idx) => (
                        <div
                          key={hour}
                          className={`absolute left-0 right-0 border-t border-gray-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                          style={{ top: `${idx * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        >
                          {/* Droppable slots within each hour (15-min intervals) */}
                          {[0, 15, 30, 45].map((minute) => {
                            const slotId = `drop-${dayIndex}-${hour}-${minute}`;
                            const isBlocked = blockedTimeSlots[`${dayIndex}-${hour}-${minute}`];
                            
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

                      {/* Availability blocks (sleep, work, commute, events) */}
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

                      {/* Schedule blocks (training sessions + user blocks) */}
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
                            onComplete={(id) => completeBlockMutation.mutate(id)}
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

        {/* Add Block Modal */}
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

        {/* Session Detail Modal */}
        <SessionDetailModal
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onComplete={(id) => completeBlockMutation.mutate(id)}
          onDelete={(id) => deleteBlockMutation.mutate(id)}
        />
      </div>

      {/* Drag Overlay - renders the dragged item */}
      <DragOverlay dropAnimation={null}>
        {activeBlock ? <DragOverlayBlock block={activeBlock} /> : null}
      </DragOverlay>
    </DndContext>
  );
}