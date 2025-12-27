'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { Clock, GripVertical, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { scheduleAPI } from '@/lib/api';

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
  goals?: { name: string; category?: string };
}

interface UserAvailability {
  wake_time: string;
  sleep_time: string;
  work_schedule: Record<string, { start: string; end: string } | null>;
  fixed_commitments: Array<{ day: string; start: string; end: string; name: string }>;
}

interface WeeklyScheduleBoardProps {
  blocks: ScheduleBlock[];
  availability?: UserAvailability | null;
  userId: string;
  onBlockUpdate?: () => void;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getCategoryColor = (category?: string): string => {
  const colors: Record<string, string> = {
    fitness: 'bg-green-100 border-green-300 text-green-800',
    business: 'bg-orange-100 border-orange-300 text-orange-800',
    skill: 'bg-blue-100 border-blue-300 text-blue-800',
    languages: 'bg-purple-100 border-purple-300 text-purple-800',
    career: 'bg-indigo-100 border-indigo-300 text-indigo-800',
    education: 'bg-cyan-100 border-cyan-300 text-cyan-800',
    creative: 'bg-pink-100 border-pink-300 text-pink-800',
    health: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    social: 'bg-rose-100 border-rose-300 text-rose-800',
    travel: 'bg-violet-100 border-violet-300 text-violet-800',
  };
  return colors[category || ''] || 'bg-gray-100 border-gray-300 text-gray-800';
};

const formatTime = (dateStr: string): string => {
  return format(parseISO(dateStr), 'h:mm a');
};

// ============================================================
// DRAGGABLE BLOCK COMPONENT
// ============================================================

interface DraggableBlockProps {
  block: ScheduleBlock;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

function DraggableBlock({ block, onComplete, onDelete, isDragging }: DraggableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isCompleted = block.status === 'completed';
  const category = block.goals?.category || block.type;
  const colorClass = getCategoryColor(category);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${colorClass} 
        border-2 rounded-xl p-3 mb-2 
        ${isCompleted ? 'opacity-60' : ''} 
        hover:shadow-md transition-all cursor-grab active:cursor-grabbing
        group
      `}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium opacity-75">
              {formatTime(block.scheduled_start)}
            </span>
            <span className="text-xs opacity-60">
              {block.duration_mins}min
            </span>
          </div>
          <p className="text-sm font-medium truncate">
            {block.goals?.name || block.notes || block.type}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCompleted && (
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
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DAY COLUMN COMPONENT
// ============================================================

interface DayColumnProps {
  date: Date;
  dayName: string;
  dayLabel: string;
  blocks: ScheduleBlock[];
  availability?: UserAvailability | null;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  isToday: boolean;
}

function DayColumn({
  date,
  dayName,
  dayLabel,
  blocks,
  availability,
  onComplete,
  onDelete,
  isToday,
}: DayColumnProps) {
  // Get work hours for this day
  const workHours = availability?.work_schedule?.[dayName];
  
  // Get fixed commitments for this day
  const fixedCommitments = (availability?.fixed_commitments || [])
    .filter((c) => c.day.toLowerCase() === dayName);

  return (
    <div
      className={`
        flex-1 min-w-[140px] border-r border-gray-200 last:border-r-0
        ${isToday ? 'bg-purple-50/50' : 'bg-white'}
      `}
    >
      {/* Day Header */}
      <div
        className={`
          sticky top-0 z-10 px-3 py-3 border-b border-gray-200
          ${isToday ? 'bg-purple-100' : 'bg-gray-50'}
        `}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-bold ${isToday ? 'text-purple-700' : 'text-gray-700'}`}>
              {dayLabel}
            </div>
            <div className="text-xs text-gray-500">
              {format(date, 'MMM d')}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {blocks.length}
          </div>
        </div>
      </div>

      {/* Work Hours Indicator */}
      {workHours && (
        <div className="mx-2 mt-2 px-2 py-1 bg-gray-100 rounded text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Work: {workHours.start} - {workHours.end}
        </div>
      )}

      {/* Fixed Commitments */}
      {fixedCommitments.map((commitment, idx) => (
        <div
          key={idx}
          className="mx-2 mt-2 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800"
        >
          🔒 {commitment.name} ({commitment.start}-{commitment.end})
        </div>
      ))}

      {/* Blocks */}
      <div className="p-2 min-h-[200px]">
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No sessions
            </div>
          ) : (
            blocks.map((block) => (
              <DraggableBlock
                key={block.id}
                block={block}
                onComplete={onComplete}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function WeeklyScheduleBoard({
  blocks,
  availability,
  userId,
  onBlockUpdate,
}: WeeklyScheduleBoardProps) {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeBlock, setActiveBlock] = useState<ScheduleBlock | null>(null);

  // Calculate week dates
  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 0 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Group blocks by day
  const blocksByDay = useMemo(() => {
    const grouped: Record<string, ScheduleBlock[]> = {};
    DAYS.forEach((day) => {
      grouped[day] = [];
    });

    blocks.forEach((block) => {
      const blockDate = parseISO(block.scheduled_start);
      const dayIndex = blockDate.getDay();
      const dayName = DAYS[dayIndex];
      
      // Only include blocks from the current week view
      const matchingDate = weekDates.find((d) => isSameDay(d, blockDate));
      if (matchingDate) {
        grouped[dayName].push(block);
      }
    });

    // Sort by time within each day
    Object.keys(grouped).forEach((day) => {
      grouped[day].sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      );
    });

    return grouped;
  }, [blocks, weekDates]);

  // Mutations
  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, newStart }: { blockId: string; newStart: string }) =>
      scheduleAPI.updateBlock(blockId, { scheduled_start: newStart }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      onBlockUpdate?.();
    },
  });

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

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const block = blocks.find((b) => b.id === event.active.id);
    setActiveBlock(block || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBlock(null);

    if (!over || active.id === over.id) return;

    // Find the block being dragged
    const draggedBlock = blocks.find((b) => b.id === active.id);
    if (!draggedBlock) return;

    // Find which day the block is being dropped into
    // For now, we'll swap positions within the same day
    // A more advanced version would allow cross-day drops

    // Get the target block
    const targetBlock = blocks.find((b) => b.id === over.id);
    if (!targetBlock) return;

    // Swap the scheduled times
    updateBlockMutation.mutate({
      blockId: draggedBlock.id,
      newStart: targetBlock.scheduled_start,
    });
  };

  const handleComplete = (blockId: string) => {
    completeBlockMutation.mutate(blockId);
  };

  const handleDelete = (blockId: string) => {
    if (window.confirm('Delete this session?')) {
      deleteBlockMutation.mutate(blockId);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
        <button
          onClick={() => setWeekOffset((prev) => prev - 1)}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-bold">
            {format(weekStart, 'MMMM yyyy')}
          </h2>
          <p className="text-sm opacity-80">
            Week of {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
          </p>
        </div>

        <div className="flex gap-2">
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded-full transition-colors"
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

      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm">
        <div>
          <span className="text-gray-500">Sessions: </span>
          <span className="font-bold text-gray-900">{blocks.length}</span>
        </div>
        <div>
          <span className="text-gray-500">Completed: </span>
          <span className="font-bold text-green-600">
            {blocks.filter((b) => b.status === 'completed').length}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Total Time: </span>
          <span className="font-bold text-purple-600">
            {Math.round(blocks.reduce((sum, b) => sum + b.duration_mins, 0) / 60)}h
          </span>
        </div>
      </div>

      {/* Week Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex overflow-x-auto">
          {weekDates.map((date, idx) => (
            <DayColumn
              key={idx}
              date={date}
              dayName={DAYS[idx]}
              dayLabel={DAY_LABELS[idx]}
              blocks={blocksByDay[DAYS[idx]] || []}
              availability={availability}
              onComplete={handleComplete}
              onDelete={handleDelete}
              isToday={isSameDay(date, today)}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeBlock && (
            <div className={`${getCategoryColor(activeBlock.goals?.category)} border-2 rounded-xl p-3 shadow-xl`}>
              <div className="text-sm font-medium">
                {activeBlock.goals?.name || activeBlock.notes || activeBlock.type}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Legend */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-200 border border-green-400" />
            <span>Fitness</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-200 border border-purple-400" />
            <span>Languages</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-200 border border-orange-400" />
            <span>Business</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-200 border border-blue-400" />
            <span>Skill</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400" />
            <span>🔒 Fixed</span>
          </div>
        </div>
      </div>
    </div>
  );
}