'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { Clock, GripVertical, Check, X, Calendar } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface SessionToken {
  id: string;
  session_number: number;
  name: string;
  duration_mins: number;
  description?: string;
}

export interface DaySchedule {
  day: string; // 'monday', 'tuesday', etc.
  label: string; // 'Mon', 'Tue', etc.
  sessions: SessionToken[];
  totalMins: number; // Total minutes already scheduled on this day
}

interface DayDropSchedulerProps {
  sessions: SessionToken[]; // The session tokens to place
  existingDayHours: Record<string, number>; // Current hours per day from other goals
  onComplete: (schedule: Record<string, SessionToken[]>) => void;
  onCancel: () => void;
  goalName: string;
  totalWeeks: number;
}

// ============================================
// CONSTANTS
// ============================================

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

// ============================================
// DRAGGABLE SESSION TOKEN
// ============================================

function DraggableToken({ 
  session, 
  isPlaced 
}: { 
  session: SessionToken; 
  isPlaced: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { session },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  if (isPlaced) return null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50 scale-105 shadow-lg' : 'hover:shadow-md'
      }`}
      style={{
        background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
        ...style,
      }}
    >
      <GripVertical className="w-4 h-4 text-white/60" />
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">
          Session {session.session_number}
        </div>
        <div className="text-white/70 text-xs truncate">
          {session.name}
        </div>
      </div>
      <div className="text-white/80 text-xs flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {session.duration_mins}m
      </div>
    </div>
  );
}

// Drag overlay version (ghost while dragging)
function TokenOverlay({ session }: { session: SessionToken }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
        opacity: 0.9,
      }}
    >
      <GripVertical className="w-4 h-4 text-white/60" />
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">
          Session {session.session_number}
        </div>
        <div className="text-white/70 text-xs truncate">
          {session.name}
        </div>
      </div>
      <div className="text-white/80 text-xs flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {session.duration_mins}m
      </div>
    </div>
  );
}

// ============================================
// DROPPABLE DAY COLUMN
// ============================================

function DroppableDay({ 
  day, 
  existingHours,
  placedSessions,
  onRemoveSession,
}: { 
  day: { key: string; label: string };
  existingHours: number;
  placedSessions: SessionToken[];
  onRemoveSession: (sessionId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${day.key}`,
    data: { day: day.key },
  });

  const placedMins = placedSessions.reduce((sum, s) => sum + s.duration_mins, 0);
  const totalHours = existingHours + (placedMins / 60);

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-0 rounded-xl p-2 transition-all ${
        isOver 
          ? 'bg-purple-100 border-2 border-purple-400 border-dashed' 
          : 'bg-gray-50 border-2 border-transparent'
      }`}
    >
      {/* Day header */}
      <div className="text-center mb-2">
        <div className="text-sm font-bold text-gray-800">{day.label}</div>
        <div className={`text-xs ${totalHours > 0 ? 'text-purple-600 font-medium' : 'text-gray-400'}`}>
          {totalHours.toFixed(1)}h
        </div>
      </div>

      {/* Placed sessions */}
      <div className="space-y-1 min-h-[60px]">
        {placedSessions.map((session) => (
          <div
            key={session.id}
            className="relative group bg-purple-500 text-white text-[10px] px-2 py-1.5 rounded-lg"
          >
            <div className="font-medium truncate">S{session.session_number}</div>
            <div className="text-white/70">{session.duration_mins}m</div>
            <button
              onClick={() => onRemoveSession(session.id)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}
        
        {placedSessions.length === 0 && (
          <div className="text-center text-gray-300 text-xs py-4">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DayDropScheduler({
  sessions,
  existingDayHours,
  onComplete,
  onCancel,
  goalName,
  totalWeeks,
}: DayDropSchedulerProps) {
  // Track where each session is placed: sessionId -> day key
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [activeSession, setActiveSession] = useState<SessionToken | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Get sessions placed on a specific day
  const getSessionsForDay = (dayKey: string): SessionToken[] => {
    return sessions.filter(s => placements[s.id] === dayKey);
  };

  // Check if a session is placed
  const isSessionPlaced = (sessionId: string): boolean => {
    return sessionId in placements;
  };

  // Count unplaced sessions
  const unplacedCount = sessions.filter(s => !isSessionPlaced(s.id)).length;

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const session = event.active.data.current?.session as SessionToken;
    if (session) setActiveSession(session);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSession(null);
    const { active, over } = event;
    
    if (!over) return;

    const session = active.data.current?.session as SessionToken;
    const overData = over.data.current as { day?: string };
    
    if (!session || !overData?.day) return;

    // Place the session on this day
    setPlacements(prev => ({
      ...prev,
      [session.id]: overData.day!,
    }));
  };

  // Remove a session from a day
  const handleRemoveSession = (sessionId: string) => {
    setPlacements(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  };

  // Handle complete - convert placements to schedule
  const handleComplete = () => {
    const schedule: Record<string, SessionToken[]> = {};
    
    DAYS.forEach(day => {
      schedule[day.key] = getSessionsForDay(day.key);
    });

    onComplete(schedule);
  };

  // Check if all sessions are placed
  const allPlaced = unplacedCount === 0;

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
    >
      <div className="fixed inset-0 bg-white z-[9999] flex flex-col">
        {/* Header */}
        <div 
          className="px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </button>
            <h2 className="text-lg font-bold text-gray-900">Choose Your Days</h2>
            <div className="w-12" /> {/* Spacer */}
          </div>
          <p className="text-center text-sm text-gray-500">
            Drag sessions onto the days you want to do them
          </p>
        </div>

        {/* Goal summary */}
        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-900">{goalName}</h3>
              <p className="text-xs text-purple-600">
                {sessions.length} sessions/week · {totalWeeks} weeks total
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600">
                {sessions.length * totalWeeks}
              </div>
              <div className="text-xs text-purple-500">total sessions</div>
            </div>
          </div>
        </div>

        {/* Session tokens (unplaced) */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Sessions to place ({unplacedCount} remaining)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessions.map((session) => (
              <DraggableToken
                key={session.id}
                session={session}
                isPlaced={isSessionPlaced(session.id)}
              />
            ))}
            {allPlaced && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-100 text-green-700">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">All sessions placed!</span>
              </div>
            )}
          </div>
        </div>

        {/* Day columns */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-2 min-w-max">
            {DAYS.map((day) => (
              <DroppableDay
                key={day.key}
                day={day}
                existingHours={existingDayHours[day.key] || 0}
                placedSessions={getSessionsForDay(day.key)}
                onRemoveSession={handleRemoveSession}
              />
            ))}
          </div>
          
          {/* Info text */}
          <p className="text-center text-xs text-gray-400 mt-4">
            This pattern repeats every week for {totalWeeks} weeks
          </p>
        </div>

        {/* Bottom action */}
        <div 
          className="p-4 border-t border-gray-200 bg-white flex-shrink-0"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleComplete}
            disabled={!allPlaced}
            className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${
              allPlaced
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {allPlaced ? 'Generate Schedule →' : `Place ${unplacedCount} more session${unplacedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeSession && <TokenOverlay session={activeSession} />}
      </DragOverlay>
    </DndContext>
  );
}