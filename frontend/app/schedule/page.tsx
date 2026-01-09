'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleAPI, goalsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { format, parseISO } from 'date-fns';
import {
  Calendar,
  Edit3,
  Save,
  X,
  Loader2,
  Clock,
  GripVertical,
} from 'lucide-react';
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
} from '@dnd-kit/core';

// ============================================================
// TYPES
// ============================================================

interface ScheduleBlock {
  id: string;
  goal_id?: string;
  type: string;
  scheduled_start: string;
  duration_mins: number;
  status: string;
  notes?: string;
  goals?: { name: string; category?: string };
}

interface WeeklySlot {
  id: string; // unique key
  day: string;
  dayIndex: number;
  hour: number;
  minute: number;
  goalId: string;
  goalName: string;
  category: string;
  duration_mins: number;
  sessionName: string;
  blockIds: string[];
}

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  fitness: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-700' },
  health: { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-700' },
  languages: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
  music: { bg: 'bg-fuchsia-100', border: 'border-fuchsia-400', text: 'text-fuchsia-700' },
  skill: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-700' },
  business: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700' },
  creative: { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-700' },
  education: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-700' },
  mental_health: { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-700' },
  default: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' },
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am to 9pm

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getColors(category?: string) {
  return CATEGORY_COLORS[category || 'default'] || CATEGORY_COLORS.default;
}

function formatTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute);
  return format(date, 'h:mm a');
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

// ============================================================
// DRAGGABLE SESSION CARD
// ============================================================

function DraggableSession({ 
  slot, 
  isEditMode 
}: { 
  slot: WeeklySlot; 
  isEditMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id,
    data: { slot },
    disabled: !isEditMode,
  });

  const colors = getColors(slot.category);
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        p-2 rounded-lg border-2 transition-all
        ${colors.bg} ${colors.border} ${colors.text}
        ${isEditMode ? 'cursor-grab active:cursor-grabbing hover:shadow-lg' : ''}
        ${isDragging ? 'opacity-50 shadow-xl scale-105' : ''}
      `}
    >
      <div className="flex items-start gap-1">
        {isEditMode && (
          <GripVertical className="w-4 h-4 opacity-50 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{slot.goalName}</div>
          <div className="flex items-center gap-1 mt-1 text-xs opacity-75">
            <Clock className="w-3 h-3" />
            {formatTime(slot.hour, slot.minute)}
          </div>
          <div className="text-xs opacity-75">{slot.duration_mins}m</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DRAG OVERLAY (ghost while dragging)
// ============================================================

function DragOverlayCard({ slot }: { slot: WeeklySlot }) {
  const colors = getColors(slot.category);
  
  return (
    <div className={`p-2 rounded-lg border-2 shadow-2xl ${colors.bg} ${colors.border} ${colors.text}`}>
      <div className="flex items-start gap-1">
        <GripVertical className="w-4 h-4 opacity-50 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{slot.goalName}</div>
          <div className="flex items-center gap-1 mt-1 text-xs opacity-75">
            <Clock className="w-3 h-3" />
            {formatTime(slot.hour, slot.minute)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DROPPABLE TIME SLOT
// ============================================================

function DroppableSlot({ 
  dayIndex, 
  hour, 
  isEditMode,
  hasSession,
}: { 
  dayIndex: number; 
  hour: number; 
  isEditMode: boolean;
  hasSession: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `drop-${dayIndex}-${hour}`,
    data: { dayIndex, hour },
    disabled: !isEditMode,
  });

  if (!isEditMode || hasSession) return null;

  return (
    <div
      ref={setNodeRef}
      className={`
        absolute inset-0 rounded-lg border-2 border-dashed transition-colors
        ${isOver 
          ? 'border-purple-400 bg-purple-100/50' 
          : 'border-transparent hover:border-gray-300 hover:bg-gray-50/50'
        }
      `}
    />
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();

  // State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSlots, setEditedSlots] = useState<WeeklySlot[]>([]);
  const [activeSlot, setActiveSlot] = useState<WeeklySlot | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Fetch schedule blocks (next 12 weeks to get pattern)
  const { data: blocks = [], isLoading: isLoadingBlocks } = useQuery({
    queryKey: ['schedule', userId, 'template'],
    queryFn: async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 84);
      const response = await scheduleAPI.getBlocks(
        userId,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
      return response.blocks || response;
    },
    enabled: !!userId,
  });

  // Fetch goals
  const { data: goals = [] } = useQuery({
    queryKey: ['goals', userId],
    queryFn: () => goalsAPI.getGoals(userId),
    enabled: !!userId,
  });

  // Extract weekly pattern from blocks
  const weeklySlots = useMemo(() => {
    if (!blocks.length) return [];

    const patterns: Record<string, WeeklySlot> = {};

    blocks.forEach((block: ScheduleBlock) => {
      if (block.type !== 'training' && block.type !== 'workout') return;
      if (block.status === 'completed' || block.status === 'skipped') return;

      const date = parseISO(block.scheduled_start);
      const jsDay = date.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      const hour = date.getHours();
      const minute = date.getMinutes();

      const goalId = block.goal_id || 'unknown';
      const key = `${goalId}-${dayIndex}-${hour}`;

      if (!patterns[key]) {
        const notesParts = (block.notes || '').split('|||');
        const goal = goals.find((g: any) => g.id === goalId);
        
        patterns[key] = {
          id: key,
          day: DAYS[dayIndex],
          dayIndex,
          hour,
          minute,
          goalId,
          goalName: goal?.name || block.goals?.name || 'Unknown Goal',
          category: goal?.category || block.goals?.category || 'default',
          duration_mins: block.duration_mins,
          sessionName: notesParts[0] || 'Session',
          blockIds: [],
        };
      }
      patterns[key].blockIds.push(block.id);
    });

    return Object.values(patterns).sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return a.hour - b.hour;
    });
  }, [blocks, goals]);

  // Get slots for display
  const displaySlots = isEditMode ? editedSlots : weeklySlots;

  // Group slots by day and hour for grid rendering
  const slotGrid = useMemo(() => {
    const grid: Record<string, WeeklySlot> = {};
    displaySlots.forEach(slot => {
      grid[`${slot.dayIndex}-${slot.hour}`] = slot;
    });
    return grid;
  }, [displaySlots]);

  // Enter edit mode
  const handleEnterEditMode = () => {
    setEditedSlots([...weeklySlots]);
    setIsEditMode(true);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditedSlots([]);
    setIsEditMode(false);
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const slot = event.active.data.current?.slot as WeeklySlot;
    if (slot) setActiveSlot(slot);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSlot(null);
    
    const { active, over } = event;
    if (!over) return;

    const draggedSlot = active.data.current?.slot as WeeklySlot;
    const dropData = over.data.current as { dayIndex: number; hour: number };
    
    if (!draggedSlot || !dropData) return;

    // Check if dropping on same position
    if (draggedSlot.dayIndex === dropData.dayIndex && draggedSlot.hour === dropData.hour) {
      return;
    }

    // Check if slot is already occupied
    const existingSlot = editedSlots.find(
      s => s.dayIndex === dropData.dayIndex && s.hour === dropData.hour && s.id !== draggedSlot.id
    );
    if (existingSlot) {
      alert(`${dropData.hour}:00 on ${DAYS[dropData.dayIndex]} is already taken by ${existingSlot.goalName}`);
      return;
    }

    // Update slot position
    setEditedSlots(prev => prev.map(slot => {
      if (slot.id === draggedSlot.id) {
        return {
          ...slot,
          id: `${slot.goalId}-${dropData.dayIndex}-${dropData.hour}`,
          day: DAYS[dropData.dayIndex],
          dayIndex: dropData.dayIndex,
          hour: dropData.hour,
        };
      }
      return slot;
    }));
  };

  // Save changes
  const handleSaveChanges = async () => {
    setIsSaving(true);
    
    try {
      // Find changed slots
      const changes: Array<{ original: WeeklySlot; edited: WeeklySlot }> = [];
      
      weeklySlots.forEach(original => {
        const edited = editedSlots.find(s => s.goalId === original.goalId && s.blockIds.some(id => original.blockIds.includes(id)));
        if (edited && (edited.dayIndex !== original.dayIndex || edited.hour !== original.hour)) {
          changes.push({ original, edited });
        }
      });

      // Update future blocks
      for (const { original, edited } of changes) {
        for (const blockId of original.blockIds) {
          const block = blocks.find((b: ScheduleBlock) => b.id === blockId);
          if (!block) continue;

          const oldDate = parseISO(block.scheduled_start);
          const oldJsDay = oldDate.getDay();
          const oldDayIndex = oldJsDay === 0 ? 6 : oldJsDay - 1;
          
          const dayDiff = edited.dayIndex - oldDayIndex;
          
          const newDate = new Date(oldDate);
          newDate.setDate(newDate.getDate() + dayDiff);
          newDate.setHours(edited.hour, 0, 0, 0);

          if (newDate > new Date()) {
            await scheduleAPI.updateBlock(blockId, {
              scheduled_start: newDate.toISOString(),
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setIsEditMode(false);
      setEditedSlots([]);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Loading
  if (authLoading || isLoadingBlocks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20 md:pb-4 md:pt-16">
        <div className="max-w-6xl mx-auto px-4 py-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Weekly Schedule</h1>
              <p className="text-gray-500 text-sm mt-1">
                {isEditMode ? 'Drag sessions to move them' : 'Your recurring session pattern'}
              </p>
            </div>
            
            {!isEditMode ? (
              <button
                onClick={handleEnterEditMode}
                disabled={weeklySlots.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit Future Weeks
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Edit Mode Banner */}
          {isEditMode && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <GripVertical className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-purple-900">Drag to Reschedule</p>
                  <p className="text-sm text-purple-700">
                    Changes apply to all future sessions. Current week stays unchanged.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {weeklySlots.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Sessions Scheduled</h3>
              <p className="text-gray-500 text-sm mb-4">Add goals to create your weekly schedule</p>
              <a
                href="/goals"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
              >
                Add a Goal
              </a>
            </div>
          )}

          {/* Weekly Grid */}
          {weeklySlots.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-8 border-b border-gray-200">
                <div className="p-3 bg-gray-50 border-r border-gray-200">
                  <span className="text-xs font-medium text-gray-500">Time</span>
                </div>
                {DAYS.map((day, idx) => (
                  <div key={day} className="p-3 text-center bg-gray-50 border-r border-gray-100 last:border-r-0">
                    <span className="text-sm font-semibold text-gray-700">{DAY_SHORT[idx]}</span>
                  </div>
                ))}
              </div>

              {/* Time Grid */}
              <div className="overflow-x-auto">
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
                    {/* Time Label */}
                    <div className="p-2 text-xs text-gray-500 border-r border-gray-200 bg-gray-50 flex items-center justify-center">
                      {formatHour(hour)}
                    </div>
                    
                    {/* Day Cells */}
                    {DAYS.map((_, dayIndex) => {
                      const slot = slotGrid[`${dayIndex}-${hour}`];
                      const hasSession = !!slot;
                      
                      return (
                        <div
                          key={`${dayIndex}-${hour}`}
                          className="p-1 min-h-[70px] border-r border-gray-100 last:border-r-0 relative"
                        >
                          <DroppableSlot
                            dayIndex={dayIndex}
                            hour={hour}
                            isEditMode={isEditMode}
                            hasSession={hasSession}
                          />
                          
                          {slot && (
                            <DraggableSession slot={slot} isEditMode={isEditMode} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeSlot && <DragOverlayCard slot={activeSlot} />}
      </DragOverlay>
    </DndContext>
  );
}