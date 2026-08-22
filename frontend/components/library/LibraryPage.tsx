'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Calendar, Flame, Loader2, BookOpen, Trophy, Clock, ChevronLeft, ChevronRight, ChevronDown, GripVertical, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import BookDiaryPage from './DiaryPage';
import GoalCreationFlow from '@/components/goals/GoalCreationFlow';
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://pepzi-backend-195009757974.europe-west1.run.app';

const tomeColors: Record<string, { spine: string; cover: string; accent: string; glow: string; sealBg: string }> = {
  fitness: { spine: 'linear-gradient(to right, #1a2f1a 0%, #2d4a2d 50%, #1a2f1a 100%)', cover: 'linear-gradient(165deg, #2a4a2a 0%, #1c381c 40%, #142814 100%)', accent: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #2a4a30 0%, #1a2a1a 100%)' },
  health: { spine: 'linear-gradient(to right, #3d1515 0%, #5a2020 50%, #3d1515 100%)', cover: 'linear-gradient(165deg, #6a2828 0%, #4a1c1c 40%, #3a1414 100%)', accent: '#f87171', glow: 'rgba(248, 113, 113, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a3030 0%, #3a1818 100%)' },
  languages: { spine: 'linear-gradient(to right, #15253d 0%, #1e3a5a 50%, #15253d 100%)', cover: 'linear-gradient(165deg, #2a4a6a 0%, #1c3048 40%, #142030 100%)', accent: '#60a5fa', glow: 'rgba(96, 165, 250, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #304a6a 0%, #182838 100%)' },
  music: { spine: 'linear-gradient(to right, #251530 0%, #382050 50%, #251530 100%)', cover: 'linear-gradient(165deg, #4a2860 0%, #341c48 40%, #241430 100%)', accent: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #483060 0%, #281838 100%)' },
  skill: { spine: 'linear-gradient(to right, #2d1a10 0%, #4a2818 50%, #2d1a10 100%)', cover: 'linear-gradient(165deg, #5a3525 0%, #4a2518 40%, #3a1a10 100%)', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a4030 0%, #3a2518 100%)' },
  business: { spine: 'linear-gradient(to right, #1a1a10 0%, #2d2d18 50%, #1a1a10 100%)', cover: 'linear-gradient(165deg, #3d3d25 0%, #2a2a18 40%, #1a1a10 100%)', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #4a4a30 0%, #2a2a18 100%)' },
  creative: { spine: 'linear-gradient(to right, #3d1525 0%, #5a2038 50%, #3d1525 100%)', cover: 'linear-gradient(165deg, #6a2848 0%, #4a1c34 40%, #3a1428 100%)', accent: '#f472b6', glow: 'rgba(244, 114, 182, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a3048 0%, #3a1828 100%)' },
  education: { spine: 'linear-gradient(to right, #2d1a10 0%, #4a2818 50%, #2d1a10 100%)', cover: 'linear-gradient(165deg, #5a3828 0%, #4a2818 40%, #3a1a10 100%)', accent: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a4030 0%, #3a2518 100%)' },
  mental_health: { spine: 'linear-gradient(to right, #102a2d 0%, #184045 50%, #102a2d 100%)', cover: 'linear-gradient(165deg, #285055 0%, #1c3840 40%, #142830 100%)', accent: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #304850 0%, #182830 100%)' },
  finance: { spine: 'linear-gradient(to right, #152d1a 0%, #1e4025 50%, #152d1a 100%)', cover: 'linear-gradient(165deg, #2a5030 0%, #1c3820 40%, #142818 100%)', accent: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #305038 0%, #182818 100%)' },
  coding: { spine: 'linear-gradient(to right, #15202d 0%, #1e3045 50%, #15202d 100%)', cover: 'linear-gradient(165deg, #283848 0%, #1c2838 40%, #141c28 100%)', accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #304050 0%, #182028 100%)' },
  reading: { spine: 'linear-gradient(to right, #2d1f0f 0%, #4a3018 50%, #2d1f0f 100%)', cover: 'linear-gradient(165deg, #5a4025 0%, #4a3018 40%, #3a2010 100%)', accent: '#d97706', glow: 'rgba(217, 119, 6, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a4830 0%, #3a2818 100%)' },
  default: { spine: 'linear-gradient(to right, #2d1a10 0%, #4a2818 50%, #2d1a10 100%)', cover: 'linear-gradient(165deg, #5a3525 0%, #4a2518 40%, #3a1a10 100%)', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a4030 0%, #3a2518 100%)' },
};

const BOOK_COLORS = [
  '#8B4513', '#B8860B', '#556B2F', '#4A5568', '#744210', '#22543D', '#742A2A', '#2C5282',
  '#5B21B6', '#92400E', '#1E3A5F', '#4A1D1D', '#2D3748', '#6B4226', '#3D5A3D',
];

const getDifficultyTier = (totalSessions: number): 'basic' | 'bronze' | 'silver' | 'gold' | 'legendary' => {
  if (totalSessions >= 50) return 'legendary';
  if (totalSessions >= 30) return 'gold';
  if (totalSessions >= 15) return 'silver';
  if (totalSessions >= 8) return 'bronze';
  return 'basic';
};

const difficultyStyles: Record<string, { frame: string; corners: string; pageEdge: string }> = {
  basic: { frame: 'rgba(255,215,150,0.2)', corners: 'rgba(255,215,150,0.3)', pageEdge: 'linear-gradient(to right, #c8b898 0%, #f0e8dc 30%, #c0b4a0 100%)' },
  bronze: { frame: 'rgba(205,127,50,0.4)', corners: 'rgba(205,127,50,0.6)', pageEdge: 'linear-gradient(to right, #b8906a 0%, #e8c090 30%, #a87848 100%)' },
  silver: { frame: 'rgba(192,192,192,0.5)', corners: 'rgba(220,220,220,0.7)', pageEdge: 'linear-gradient(to right, #a8a8a8 0%, #e8e8e8 30%, #a0a0a0 100%)' },
  gold: { frame: 'rgba(255,215,0,0.5)', corners: 'rgba(255,215,0,0.7)', pageEdge: 'linear-gradient(to right, #b89850 0%, #f0d890 30%, #b89848 100%)' },
  legendary: { frame: 'rgba(255,215,0,0.7)', corners: 'rgba(255,215,0,0.9)', pageEdge: 'linear-gradient(to right, #d4a850 0%, #fff0a0 30%, #d4a848 100%)' },
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

interface TomeCardProps {
  id: string;
  name: string;
  emoji: string;
  category: string;
  totalSessions: number;
  completedSessions: number;
  streak?: number;
  daysBehind?: number;
  isCompleted?: boolean;
  onClick?: () => void;
}

interface WeeklyBook {
  id: string;
  blockId: string;
  goalId: string;
  goalName: string;
  category: string;
  day: string;
  scheduledStart: string;
}

interface WeekSchedule {
  [key: string]: WeeklyBook[];
}

function DraggableBook({ book, index, isEditMode, onBookClick }: { book: WeeklyBook; index: number; isEditMode: boolean; onBookClick: (goalId: string) => void; }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: book.id, data: { book }, disabled: !isEditMode });
  const colorIndex = book.goalId ? (book.goalId.charCodeAt(0) + (book.goalId.charCodeAt(1) || 0)) % BOOK_COLORS.length : index % BOOK_COLORS.length;
  const baseColor = BOOK_COLORS[colorIndex];
  const seed = book.goalId ? book.goalId.charCodeAt(0) : index;
  const height = 160 + (seed % 30);
  const width = 52 + (seed % 15);
  const tilt = ((seed % 5) - 2) * 0.3;
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${tilt}deg)`, zIndex: 1000 } : { transform: `rotate(${tilt}deg)` };
  const handleClick = (e: React.MouseEvent) => { if (!isDragging && !isEditMode) { e.stopPropagation(); onBookClick(book.goalId); } };

  return (
    <div ref={setNodeRef} {...(isEditMode ? { ...attributes, ...listeners } : {})} onClick={handleClick} className={`relative flex-shrink-0 group transition-all duration-200 hover:scale-105 hover:-translate-y-2 ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-50 shadow-2xl' : ''}`} style={{ width: `${width}px`, height: `${height}px`, transformOrigin: 'bottom center', ...style }}>
      <div className="absolute inset-0 rounded-[3px]" style={{ background: baseColor, boxShadow: 'inset 3px 0 6px rgba(255,255,255,0.2), inset -3px 0 6px rgba(0,0,0,0.25), inset 0 3px 5px rgba(255,255,255,0.15), inset 0 -2px 5px rgba(0,0,0,0.1), 6px 0 15px rgba(0,0,0,0.35), 3px 0 6px rgba(0,0,0,0.25)' }}>
        <div className="absolute inset-0 opacity-20 rounded-[3px]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        {isEditMode && <div className="absolute top-2 left-1/2 -translate-x-1/2"><GripVertical className="w-4 h-4 text-white/50" /></div>}
        <div className="absolute top-0 left-0 right-0 h-[6px] rounded-t-[3px]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)' }} />
        <div className="absolute top-6 left-2 right-2 h-[1px]" style={{ background: 'rgba(0,0,0,0.25)' }} />
        <div className="absolute top-7 left-2 right-2 h-[1px]" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="absolute bottom-6 left-2 right-2 h-[1px]" style={{ background: 'rgba(0,0,0,0.25)' }} />
        <div className="absolute bottom-7 left-2 right-2 h-[1px]" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-1.5" style={{ writingMode: 'vertical-rl' }}>
          <span className="text-[13px] font-bold tracking-tight leading-tight" style={{ color: 'rgba(255,255,255,0.95)', transform: 'rotate(180deg)', maxHeight: `${height - 32}px`, textShadow: '0 1px 3px rgba(0,0,0,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.goalName}</span>
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-[5px] rounded-l-[3px]" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.4) 0%, transparent 100%)' }} />
        <div className="absolute right-0 top-[5px] bottom-[5px] w-[5px]" style={{ background: 'linear-gradient(90deg, #e8e0d0 0%, #f5f0e5 50%, #d8d0c0 100%)', boxShadow: 'inset 1px 0 3px rgba(0,0,0,0.2)' }} />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30" style={{ background: 'rgba(20,15,10,0.95)', color: '#f5f0e5', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>{book.goalName}{!isEditMode && <span className="text-xs opacity-60 ml-2">Click to open</span>}</div>
    </div>
  );
}

function DragOverlayBook({ book }: { book: WeeklyBook }) {
  const colorIndex = book.goalId ? (book.goalId.charCodeAt(0) + (book.goalId.charCodeAt(1) || 0)) % BOOK_COLORS.length : 0;
  const baseColor = BOOK_COLORS[colorIndex];
  const seed = book.goalId ? book.goalId.charCodeAt(0) : 0;
  const height = 160 + (seed % 30);
  const width = 52 + (seed % 15);
  return (
    <div className="relative shadow-2xl" style={{ width: `${width}px`, height: `${height}px`, opacity: 0.9 }}>
      <div className="absolute inset-0 rounded-[3px]" style={{ background: baseColor, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-1.5" style={{ writingMode: 'vertical-rl' }}>
          <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.95)', transform: 'rotate(180deg)', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{book.goalName}</span>
        </div>
      </div>
    </div>
  );
}

function DroppableShelf({ day, dayIndex, isEditMode, children }: { day: string; dayIndex: number; isEditMode: boolean; children: React.ReactNode; }) {
  const { isOver, setNodeRef } = useDroppable({ id: `shelf-${day}`, data: { day, dayIndex }, disabled: !isEditMode });
  return (
    <div ref={setNodeRef} className={`relative flex items-end gap-2 pl-14 pr-4 pt-5 pb-3 transition-colors ${isOver && isEditMode ? 'bg-amber-500/20' : ''}`} style={{ minHeight: '210px' }}>
      {children}
      {isOver && isEditMode && <div className="absolute inset-0 border-2 border-dashed border-amber-400 rounded-lg pointer-events-none" />}
    </div>
  );
}

function ApplyToFutureModal({ isOpen, book, fromDay, toDay, onConfirm, onCancel, isLoading }: { isOpen: boolean; book: WeeklyBook | null; fromDay: string; toDay: string; onConfirm: (applyToFuture: boolean) => void; onCancel: () => void; isLoading: boolean; }) {
  if (!isOpen || !book) return null;
  const DAY_NAMES: Record<string, string> = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-amber-500 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl"><Calendar className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-lg">Session Moved</h3><p className="text-sm opacity-80">Apply this change to future weeks?</p></div>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="font-medium text-gray-700 mb-2">{book.goalName}</div>
            <div className="text-sm text-gray-500">{DAY_NAMES[fromDay]} → <span className="font-medium text-gray-700">{DAY_NAMES[toDay]}</span></div>
          </div>
          <div className="space-y-3">
            <button onClick={() => onConfirm(true)} disabled={isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium disabled:opacity-50"><Calendar className="w-4 h-4" />Apply to all future weeks</button>
            <button onClick={() => onConfirm(false)} disabled={isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium disabled:opacity-50">Just this week</button>
            <button onClick={onCancel} disabled={isLoading} className="w-full px-4 py-2 text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyBookshelf({ schedule, onBookClick, onMoveBook, isUpdating }: { schedule: WeekSchedule; onBookClick: (goalId: string) => void; onMoveBook: (book: WeeklyBook, fromDay: string, toDay: string, applyToFuture: boolean) => void; isUpdating: boolean; }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeBook, setActiveBook] = useState<WeeklyBook | null>(null);
  const [pendingMove, setPendingMove] = useState<{ book: WeeklyBook; fromDay: string; toDay: string } | null>(null);
  const totalSessions = Object.values(schedule).reduce((sum, books) => sum + books.length, 0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragStart = (event: DragStartEvent) => { const book = event.active.data.current?.book as WeeklyBook; if (book) setActiveBook(book); };
  const handleDragEnd = (event: DragEndEvent) => { setActiveBook(null); const { active, over } = event; if (!over) return; const draggedBook = active.data.current?.book as WeeklyBook; const dropData = over.data.current as { day: string; dayIndex: number }; if (!draggedBook || !dropData) return; if (draggedBook.day === dropData.day) return; setPendingMove({ book: draggedBook, fromDay: draggedBook.day, toDay: dropData.day }); };
  const handleConfirmMove = (applyToFuture: boolean) => { if (pendingMove) { onMoveBook(pendingMove.book, pendingMove.fromDay, pendingMove.toDay, applyToFuture); } setPendingMove(null); };
  const handleCancelMove = () => { setPendingMove(null); };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="rounded-xl overflow-hidden mt-4" style={{ background: 'linear-gradient(180deg, #4a3828 0%, #3d2e20 50%, #2d2218 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(180deg, rgba(60,45,30,0.9) 0%, rgba(50,38,25,0.9) 100%)', borderBottom: isExpanded ? '1px solid rgba(0,0,0,0.3)' : 'none' }}>
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} style={{ color: 'rgba(255, 220, 150, 0.8)' }} />
            <Calendar className="w-4 h-4" style={{ color: 'rgba(255, 220, 150, 0.8)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'rgba(255, 248, 235, 0.9)' }}>Next Week</h3>
            <span className="text-xs ml-2" style={{ color: 'rgba(255, 220, 150, 0.6)' }}>{totalSessions} sessions</span>
          </button>
          {isExpanded && (
            <button onClick={() => setIsEditMode(!isEditMode)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isEditMode ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
              {isEditMode ? <span className="flex items-center gap-1"><X className="w-3 h-3" /> Done</span> : <span className="flex items-center gap-1"><GripVertical className="w-3 h-3" /> Edit</span>}
            </button>
          )}
        </div>
        {isExpanded && isEditMode && <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30"><p className="text-xs text-amber-200 flex items-center gap-2"><GripVertical className="w-3 h-3" />Drag books between days to reschedule. Changes apply to future weeks.</p></div>}
        {isExpanded && (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-3 z-10" style={{ background: 'linear-gradient(90deg, #5a4535 0%, #6d5545 30%, #5a4535 100%)', boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.3), 2px 0 4px rgba(0,0,0,0.2)' }} />
            <div className="absolute right-0 top-0 bottom-0 w-3 z-10" style={{ background: 'linear-gradient(90deg, #5a4535 0%, #6d5545 70%, #5a4535 100%)', boxShadow: 'inset 3px 0 6px rgba(0,0,0,0.3), -2px 0 4px rgba(0,0,0,0.2)' }} />
            <div className="px-3">
              {DAYS.map((day, dayIndex) => {
                const books = schedule[day] || [];
                return (
                  <div key={day}>
                    <DroppableShelf day={day} dayIndex={dayIndex} isEditMode={isEditMode}>
                      <div className="absolute left-3 bottom-4 w-10" style={{ color: 'rgba(255, 248, 235, 0.6)' }}><div className="text-sm font-bold">{DAY_LABELS[dayIndex]}</div></div>
                      {books.length === 0 ? <span className="text-sm italic ml-2 mb-3" style={{ color: 'rgba(255, 248, 235, 0.3)' }}>{isEditMode ? 'Drop here' : 'Rest day'}</span> : books.map((book, idx) => <DraggableBook key={book.id} book={book} index={idx} isEditMode={isEditMode} onBookClick={onBookClick} />)}
                    </DroppableShelf>
                    <div className="relative h-7" style={{ background: 'linear-gradient(180deg, #8B7355 0%, #7a6248 15%, #6d5540 40%, #5a4535 80%, #4a3828 100%)', boxShadow: '0 8px 16px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.15)' }}>
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 40px, rgba(0,0,0,0.15) 40px, rgba(0,0,0,0.15) 41px)' }} />
                      <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: 'linear-gradient(180deg, #5a4535 0%, #4a3828 100%)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>{activeBook && <DragOverlayBook book={activeBook} />}</DragOverlay>
      <ApplyToFutureModal isOpen={!!pendingMove} book={pendingMove?.book || null} fromDay={pendingMove?.fromDay || ''} toDay={pendingMove?.toDay || ''} onConfirm={handleConfirmMove} onCancel={handleCancelMove} isLoading={isUpdating} />
    </DndContext>
  );
}

function PinnedNote({ name, emoji, totalSessions, completedSessions, daysBehind = 0, onClick, index = 0 }: TomeCardProps & { index?: number }) {
  const isUrgent = daysBehind >= 3;
  const isWarning = daysBehind > 0 && daysBehind < 3;
  const rotations = [-3, 1.5, -1, 2.5, -2, 1, -0.5, 3];
  const rotation = rotations[index % rotations.length];
  return (
    <button onClick={onClick} className="group relative flex-shrink-0 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 focus:outline-none" style={{ width: '155px', transform: `rotate(${rotation}deg)` }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.08)', transform: 'translate(2px, 2px)', filter: 'blur(2px)', borderRadius: '1px' }} />
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)', transform: 'translate(4px, 5px)', filter: 'blur(5px)', borderRadius: '1px' }} />
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(175deg, #fffef8 0%, #faf6ec 15%, #f5f0e0 40%, #efe8d4 70%, #eae2cc 100%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)', padding: '12px 11px 14px', borderRadius: '1px' }}>
        <div className="absolute inset-0 opacity-[0.35] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        <div className="absolute top-[45%] left-0 right-0 h-px opacity-[0.08] pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 5%, #8b7355 30%, #8b7355 70%, transparent 95%)' }} />
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10"><div className="w-4 h-4 rounded-full" style={{ background: isUrgent ? 'radial-gradient(circle at 35% 35%, #e74c3c 0%, #c0392b 50%, #922b21 100%)' : isWarning ? 'radial-gradient(circle at 35% 35%, #f39c12 0%, #d68910 50%, #b9770e 100%)' : 'radial-gradient(circle at 35% 35%, #e74c3c 0%, #c0392b 50%, #922b21 100%)', boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.3)' }} /></div>
        {daysBehind > 0 && <div className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: isUrgent ? '#c0392b' : '#d68910', color: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{daysBehind} behind</div>}
        <div className="relative pt-2">
          <div className="flex items-start gap-2 mb-2"><span className="text-xl flex-shrink-0">{emoji}</span><h3 className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: '#2c2416', fontFamily: 'Georgia, serif' }}>{name}</h3></div>
          <div className="text-[11px] mb-2" style={{ color: '#5c4a36', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Page {completedSessions} of {totalSessions}</div>
          <div className="h-px mb-2" style={{ background: 'linear-gradient(90deg, #9c8b75 0%, #8c7b65 40%, #7c6b55 60%, transparent 100%)', opacity: 0.3 }} />
          <div className="flex items-center justify-between"><span className="text-[10px] flex items-center gap-1" style={{ color: '#7a6850' }}><Clock className="w-3 h-3" />Today</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: '#7a6850' }} /></div>
        </div>
      </div>
    </button>
  );
}

function TomeCard({ name, emoji, category, totalSessions, completedSessions, streak = 0, daysBehind = 0, isCompleted = false, onClick }: TomeCardProps) {
  const colors = tomeColors[category] || tomeColors.default;
  const progress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
  const difficulty = getDifficultyTier(totalSessions);
  const diffStyle = difficultyStyles[difficulty];
  const progressDasharray = `${(progress / 100) * 126} 126`;
  const isHot = daysBehind >= 3 && !isCompleted;
  const isWarm = daysBehind > 0 && daysBehind < 3 && !isCompleted;
  const spineStyle = isCompleted ? 'linear-gradient(to right, #8B7500 0%, #B8860B 20%, #DAA520 35%, #FFD700 50%, #DAA520 65%, #B8860B 80%, #8B7500 100%)' : colors.spine;
  const coverStyle = isCompleted ? 'linear-gradient(165deg, #c9a227 0%, #a68523 30%, #8b7320 60%, #7a6318 100%)' : colors.cover;
  const pageEdgeStyle = isCompleted ? 'linear-gradient(to right, #c9a227 0%, #f4d03f 30%, #fff8dc 50%, #f4d03f 70%, #c9a227 100%)' : diffStyle.pageEdge;

  return (
    <button onClick={onClick} className="group relative flex-shrink-0 transition-all duration-300 ease-out hover:-translate-y-2 focus:outline-none" style={{ width: '140px', height: '190px', perspective: '800px' }}>
      {isHot && <div className="absolute -inset-2 rounded-xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center bottom, rgba(160, 50, 50, 0.25) 0%, transparent 70%)' }} />}
      {isWarm && <div className="absolute -inset-1.5 rounded-xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center bottom, rgba(180, 100, 50, 0.2) 0%, transparent 70%)' }} />}
      {isCompleted && <div className="absolute -inset-2 rounded-xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.15) 0%, transparent 65%)' }} />}
      <div className="absolute bottom-[-8px] left-[18%] right-[18%] h-4 rounded-[50%] opacity-0 group-hover:opacity-30 transition-opacity" style={{ background: isCompleted ? 'rgba(255, 215, 0, 0.5)' : colors.glow, filter: 'blur(8px)' }} />
      <div className="relative w-full h-full transition-transform duration-300 group-hover:[transform:rotateY(-4deg)]" style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute top-[4px] bottom-[4px] right-0 w-[10px] rounded-r pointer-events-none" style={{ background: pageEdgeStyle, boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.1)' }}><div className="absolute inset-y-[3px] inset-x-[2px]" style={{ background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 2.5px)' }} /></div>
        <div className="absolute top-0 bottom-0 left-0 w-[18px] rounded-l pointer-events-none" style={{ background: spineStyle, boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.3)' }}><div className="absolute top-[14px] bottom-[14px] left-[3px] right-[3px]" style={{ background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 10px, rgba(0,0,0,0.15) 10px, rgba(0,0,0,0.15) 11px)' }} /></div>
        <div className="absolute top-0 left-[14px] right-[6px] bottom-0 rounded-r overflow-hidden" style={{ background: coverStyle, boxShadow: '0 2px 6px rgba(0,0,0,0.2), 0 6px 20px rgba(0,0,0,0.15)' }}>
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <div className="absolute inset-[6px] rounded-sm pointer-events-none" style={{ border: `2px solid ${isCompleted ? 'rgba(255, 215, 0, 0.4)' : diffStyle.frame}` }} />
          {['top-[4px] left-[4px]', 'top-[4px] right-[4px]', 'bottom-[4px] left-[4px]', 'bottom-[4px] right-[4px]'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-[10px] h-[10px] pointer-events-none`}>
              <div className="absolute" style={{ background: isCompleted ? 'rgba(255, 215, 0, 0.5)' : diffStyle.corners, ...(i < 2 ? { top: 0, width: '10px', height: '2px' } : { bottom: 0, width: '10px', height: '2px' }), ...(i % 2 === 0 ? { left: 0 } : { right: 0 }) }} />
              <div className="absolute" style={{ background: isCompleted ? 'rgba(255, 215, 0, 0.5)' : diffStyle.corners, ...(i < 2 ? { top: 0, height: '10px', width: '2px' } : { bottom: 0, height: '10px', width: '2px' }), ...(i % 2 === 0 ? { left: 0 } : { right: 0 }) }} />
            </div>
          ))}
          {daysBehind > 0 && !isCompleted && <div className="absolute top-[4px] right-[4px] text-[7px] font-bold px-1.5 py-0.5 rounded z-20" style={{ background: isHot ? '#a91b1b' : '#b84c00', color: 'white' }}>{daysBehind}</div>}
          {isCompleted && <div className="absolute top-[4px] right-[4px] text-[7px] font-bold px-1.5 py-0.5 rounded z-20" style={{ background: 'rgba(255, 215, 0, 0.3)', color: '#a67c00' }}>✦</div>}
          <div className="relative h-full flex flex-col items-center justify-center p-[18px_8px_12px] z-10">
            <div className="relative w-[40px] h-[40px] mb-[6px]">
              <div className="absolute inset-[-3px]"><svg className="w-full h-full -rotate-90" viewBox="0 0 46 46"><circle cx="23" cy="23" r="20" stroke="rgba(255,215,150,0.1)" strokeWidth="2" fill="none" /><circle cx="23" cy="23" r="20" stroke={isCompleted ? '#d4a520' : colors.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray={progressDasharray} style={{ filter: `drop-shadow(0 0 3px ${isCompleted ? 'rgba(255, 215, 0, 0.4)' : colors.glow})` }} /></svg></div>
              <div className="absolute inset-0 rounded-full" style={{ background: isCompleted ? 'radial-gradient(circle at 30% 30%, #c9a227 0%, #8b7320 100%)' : colors.sealBg, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }} />
              <div className="absolute inset-0 flex items-center justify-center text-[18px]">{emoji}</div>
            </div>
            <h3 className="text-center leading-tight mb-[3px] line-clamp-2 px-1" style={{ color: isCompleted ? 'rgba(255, 240, 200, 0.95)' : 'rgba(255, 235, 200, 0.9)', fontSize: '10px', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{name}</h3>
            <span className="text-[8px]" style={{ color: isCompleted ? 'rgba(255, 230, 180, 0.5)' : 'rgba(255, 235, 200, 0.4)', fontStyle: 'italic' }}>{completedSessions} of {totalSessions} pages</span>
            {streak > 0 && !isCompleted && <div className="flex items-center gap-0.5 text-[7px] font-medium px-1.5 py-0.5 rounded-full mt-1" style={{ background: 'rgba(230, 120, 40, 0.7)', color: 'white' }}><Flame className="w-2.5 h-2.5" />{streak}</div>}
            {isCompleted && <div className="text-[7px] font-medium px-1.5 py-0.5 rounded-full mt-1" style={{ background: 'rgba(255, 215, 0, 0.2)', color: '#c9a520' }}>✦ Mastered</div>}
          </div>
          <div className="absolute bottom-[6px] right-[6px] w-[24px] h-[24px] z-20">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="10" stroke={isCompleted ? '#d4a520' : colors.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 63} 63`} /></svg>
            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold" style={{ color: isCompleted ? 'rgba(255, 215, 0, 0.85)' : 'rgba(255, 235, 200, 0.8)' }}>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface ScheduledSession { id: string; goal_id: string; goal_name: string; name: string; description: string; scheduled_date: string; scheduled_time: string; duration_mins: number; status: string; category: string; }
interface Goal { id: string; name: string; category: string; status?: string; emoji?: string; }
interface GoalWithProgress extends Goal { emoji: string; progress: number; totalSessions: number; completedSessions: number; streak: number; daysBehind: number; isScheduledToday: boolean; todaySession?: ScheduledSession; oldestMissedSession?: ScheduledSession; }

const categoryEmojis: Record<string, string> = { fitness: '🏋️', climbing: '🧗', languages: '🌍', business: '💼', creative: '🎨', mental_health: '🧘', skill: '🎯', education: '📚', health: '❤️', music: '🎸', finance: '💰', productivity: '⚡', social: '👥', travel: '✈️', cooking: '🍳', writing: '✍️', coding: '💻', reading: '📖' };
async function safeJson(res: Response): Promise<any> { const text = await res.text(); try { return JSON.parse(text); } catch { return { __parseError: true }; } }
type RoomType = 'desk' | 'library' | 'trophies';

export default function LibraryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<GoalWithProgress | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomType>('desk');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const rooms: RoomType[] = ['desk', 'library', 'trophies'];
  const currentIndex = rooms.indexOf(currentRoom);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => { const diff = touchStartX.current - touchEndX.current; if (Math.abs(diff) > 50) { if (diff > 0 && currentIndex < rooms.length - 1) navigateRoom(rooms[currentIndex + 1]); else if (diff < 0 && currentIndex > 0) navigateRoom(rooms[currentIndex - 1]); } };
  const navigateRoom = (room: RoomType) => { if (room === currentRoom || isTransitioning) return; setIsTransitioning(true); setCurrentRoom(room); setTimeout(() => setIsTransitioning(false), 400); };
  const todayIndex = useMemo(() => { const jsDay = new Date().getDay(); return jsDay === 0 ? 6 : jsDay - 1; }, []);

  const moveBookMutation = useMutation({
    mutationFn: async ({ book, fromDay, toDay, applyToFuture }: { book: WeeklyBook; fromDay: string; toDay: string; applyToFuture: boolean }) => {
      const fromIndex = DAYS.indexOf(fromDay); const toIndex = DAYS.indexOf(toDay); const dayDiff = toIndex - fromIndex;
      const originalDate = new Date(book.scheduledStart); const newDate = new Date(originalDate); newDate.setDate(originalDate.getDate() + dayDiff);
      const response = await fetch(`${API_BASE}/api/schedule/${book.blockId}/with-future`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduled_start: newDate.toISOString(), apply_to_future: applyToFuture }) });
      if (!response.ok) throw new Error('Failed to move session'); return response.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['library-week-schedule'] }); queryClient.invalidateQueries({ queryKey: ['schedule'] }); },
    onError: () => { alert('Failed to move session. Please try again.'); },
  });
  const handleMoveBook = (book: WeeklyBook, fromDay: string, toDay: string, applyToFuture: boolean) => { moveBookMutation.mutate({ book, fromDay, toDay, applyToFuture }); };

  const { data: goalsData, isLoading: goalsLoading, refetch: refetchGoals } = useQuery({ queryKey: ['library-goals', user?.id], queryFn: async () => { const r = await fetch(`${API_BASE}/api/goals?user_id=${user?.id}`); if (!r.ok) throw new Error('Failed'); const d = await safeJson(r); if (d?.__parseError) throw new Error('Invalid'); return d; }, enabled: !!user?.id, retry: 1 });
  const { data: sessionStatsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({ queryKey: ['library-session-stats', user?.id, goalsData?.goals?.length], queryFn: async () => { const goals: Goal[] = goalsData?.goals || []; if (!goals.length) return {}; const results = await Promise.all(goals.map(async (g) => { try { const r = await fetch(`${API_BASE}/api/schedule/session-stats/${g.id}?user_id=${user?.id}`); if (!r.ok) return { goalId: g.id, stats: null }; const d = await safeJson(r); return { goalId: g.id, stats: d?.__parseError ? null : d }; } catch { return { goalId: g.id, stats: null }; } })); const map: Record<string, any> = {}; results.forEach(({ goalId, stats }) => { if (stats) map[goalId] = stats; }); return map; }, enabled: !!user?.id && !!goalsData?.goals?.length, retry: 1 });
  const { data: todayData, isLoading: todayLoading } = useQuery({ queryKey: ['library-today', user?.id], queryFn: async () => { const r = await fetch(`${API_BASE}/api/chat/today-summary?user_id=${user?.id}`); if (!r.ok) throw new Error('Failed'); const d = await safeJson(r); if (d?.__parseError) throw new Error('Invalid'); const tasks = Array.isArray(d?.tasks) ? d.tasks : []; const blockers = ['work', 'commute', 'event', 'sleep', 'social']; return tasks.filter((t: any) => !blockers.includes(t.category || '') && !blockers.includes(t.type || '') && (t.goal_id || t.type === 'training' || t.type === 'workout')).map((t: any) => ({ id: t.id, goal_id: t.goal_id, goal_name: t.goal_name || t.name, name: t.name, description: t.description || '', scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: t.scheduled_time, duration_mins: t.duration_mins, status: t.status, category: t.category || 'default' })); }, enabled: !!user?.id, retry: 1 });
  const { data: backlogData } = useQuery({ queryKey: ['library-backlog', user?.id], queryFn: async () => { const r = await fetch(`${API_BASE}/api/schedule/backlog?user_id=${user?.id}`); if (!r.ok) throw new Error('Failed'); const d = await safeJson(r); if (d?.__parseError) throw new Error('Invalid'); return (d?.sessions || []).map((s: any) => ({ id: s.id, goal_id: s.goal_id, goal_name: s.goal_name || s.name, name: s.name, description: s.description || '', scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time, duration_mins: s.duration_mins, status: s.status, category: s.category || 'default' })); }, enabled: !!user?.id, retry: 1 });
  const { data: weekScheduleData } = useQuery({ queryKey: ['library-week-schedule', user?.id], queryFn: async () => { const today = new Date(); const jsDay = today.getDay(); const daysUntilNextMonday = jsDay === 0 ? 1 : 8 - jsDay; const nextMonday = new Date(today); nextMonday.setDate(today.getDate() + daysUntilNextMonday); nextMonday.setHours(0, 0, 0, 0); const endExclusive = new Date(nextMonday); endExclusive.setDate(nextMonday.getDate() + 7); endExclusive.setHours(0, 0, 0, 0); const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; const startStr = ymd(nextMonday); const endStr = ymd(endExclusive); const r = await fetch(`${API_BASE}/api/schedule?user_id=${user?.id}&start_date=${startStr}&end_date=${endStr}`); if (!r.ok) return []; const d = await safeJson(r); if (d?.__parseError) return []; return d?.blocks || []; }, enabled: !!user?.id, retry: 1 });

  const goals: Goal[] = Array.isArray(goalsData?.goals) ? goalsData.goals : [];
  const sessionStats: Record<string, any> = sessionStatsData || {};
  const todaySessions: ScheduledSession[] = todayData || [];
  const backlogSessions: ScheduledSession[] = backlogData || [];

  const booksWithProgress: GoalWithProgress[] = goals.map((goal) => { const stats = sessionStats[goal.id]; const totalSessions = stats?.progress?.total_sessions || 0; const completedSessions = stats?.progress?.completed_sessions || 0; const todaySession = todaySessions.find((s) => s.goal_id === goal.id && s.status !== 'completed'); const missedSessions = backlogSessions.filter((s) => s.goal_id === goal.id); return { ...goal, emoji: goal.emoji || categoryEmojis[goal.category] || '📖', progress: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0, totalSessions, completedSessions, streak: 0, daysBehind: missedSessions.length, isScheduledToday: !!todaySession, todaySession, oldestMissedSession: missedSessions[missedSessions.length - 1] }; });

  const openDiaryByGoalId = (goalId: string) => { const bookWithProgress = booksWithProgress.find(g => g.id === goalId); if (bookWithProgress) { setSelectedBook(bookWithProgress); setSelectedSession(bookWithProgress.oldestMissedSession || bookWithProgress.todaySession || null); return; } const goal = goals.find(g => g.id === goalId); if (goal) { setSelectedBook({ ...goal, emoji: goal.emoji || categoryEmojis[goal.category] || '📖', progress: 0, totalSessions: 0, completedSessions: 0, streak: 0, daysBehind: 0, isScheduledToday: false } as GoalWithProgress); setSelectedSession(null); } };
  const openDiaryFromBook = (book: GoalWithProgress) => { setSelectedBook(book); setSelectedSession(book.oldestMissedSession || book.todaySession || null); };

  const weekSchedule: WeekSchedule = useMemo(() => { const schedule: WeekSchedule = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }; const blocks = weekScheduleData || []; const blockerTypes = ['work', 'commute', 'event', 'social', 'sleep']; blocks.forEach((block: any) => { if (blockerTypes.includes(block.type)) return; if (block.status === 'completed' || block.status === 'skipped') return; if (!block.scheduled_start) return; if (!block.goal_id) return; const blockDate = new Date(block.scheduled_start); const jsDay = blockDate.getDay(); const dayIndex = jsDay === 0 ? 6 : jsDay - 1; const dayName = DAYS[dayIndex]; const goalId = block.goal_id; const notesParts = (block.notes || '').split('|||'); const sessionName = notesParts[0] || ''; const goalName = block.goals?.name || sessionName || block.type || 'Session'; const category = block.goals?.category || 'default'; schedule[dayName]?.push({ id: block.id, blockId: block.id, goalId: goalId, goalName: goalName, category: category, day: dayName, scheduledStart: block.scheduled_start }); }); return schedule; }, [weekScheduleData]);

  const todayDayName = DAYS[todayIndex];
  const todayBooks = booksWithProgress.filter((b) => b.isScheduledToday && b.progress < 100 && b.status !== 'completed');
  const activeBooks = booksWithProgress.filter((b) => b.progress < 100 && b.status !== 'completed');
  const completedBooks = booksWithProgress.filter((b) => b.progress >= 100 || b.status === 'completed');
  const filterBooks = (list: GoalWithProgress[]) => list.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const handleGoalCreated = () => { setShowAddGoal(false); refetchGoals(); refetchStats(); };

  if (goalsLoading || todayLoading || statsLoading) { return (<div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1510' }}><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#b8860b' }} /><p className="text-sm" style={{ color: 'rgba(255, 245, 230, 0.5)' }}>Loading...</p></div></div>); }
  if (selectedBook) return <BookDiaryPage book={selectedBook} userId={user?.id || ''} initialSession={selectedSession || undefined} onClose={() => { setSelectedBook(null); setSelectedSession(null); }} />;

  const roomLabels = { desk: 'Today', library: 'Library', trophies: 'Mastered' };

  return (
    <div className="min-h-screen relative overflow-hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')" }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(25, 20, 15, 0.25) 0%, rgba(35, 28, 20, 0.45) 50%, rgba(20, 16, 12, 0.6) 100%)' }} />
      </div>
      <GoalCreationFlow isOpen={showAddGoal} onClose={() => setShowAddGoal(false)} onGoalCreated={handleGoalCreated} userId={user?.id || ''} />
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="h-14 md:h-16" />
        {/* Header - SCHEDULE BUTTON REMOVED */}
        <header className="relative z-20 mb-2 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(8px)' }}>{currentRoom === 'desk' ? '📋' : currentRoom === 'library' ? '📚' : '🏆'}</div>
                <div><h1 className="text-sm font-semibold" style={{ color: 'rgba(255, 255, 255, 0.92)' }}>{roomLabels[currentRoom]}</h1><p className="text-[9px]" style={{ color: 'rgba(255, 255, 255, 0.45)' }}>{currentRoom === 'desk' && `${todayBooks.length} sessions`}{currentRoom === 'library' && `${activeBooks.length} books`}{currentRoom === 'trophies' && `${completedBooks.length} completed`}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddGoal(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: 'rgba(180, 140, 60, 0.35)', backdropFilter: 'blur(8px)', color: 'rgba(255, 255, 255, 0.9)' }}><Plus className="w-3.5 h-3.5" /><span>New</span></button>
              </div>
            </div>
          </div>
        </header>
        {/* Navigation */}
        <div className="relative z-20 px-4 mb-3">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-3">
            <button onClick={() => currentIndex > 0 && navigateRoom(rooms[currentIndex - 1])} disabled={currentIndex === 0} className="p-1 rounded-full disabled:opacity-15" style={{ background: 'rgba(255, 255, 255, 0.08)' }}><ChevronLeft className="w-4 h-4" style={{ color: 'rgba(255, 255, 255, 0.6)' }} /></button>
            <div className="flex items-center gap-1 p-0.5 rounded-full" style={{ background: 'rgba(0, 0, 0, 0.25)', backdropFilter: 'blur(8px)' }}>
              {rooms.map((room) => (<button key={room} onClick={() => navigateRoom(room)} className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium transition-all" style={{ background: currentRoom === room ? 'rgba(255, 255, 255, 0.15)' : 'transparent', color: currentRoom === room ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)' }}>{room === 'desk' && <Clock className="w-3 h-3" />}{room === 'library' && <BookOpen className="w-3 h-3" />}{room === 'trophies' && <Trophy className="w-3 h-3" />}<span className="hidden sm:inline">{roomLabels[room]}</span></button>))}
            </div>
            <button onClick={() => currentIndex < rooms.length - 1 && navigateRoom(rooms[currentIndex + 1])} disabled={currentIndex === rooms.length - 1} className="p-1 rounded-full disabled:opacity-15" style={{ background: 'rgba(255, 255, 255, 0.08)' }}><ChevronRight className="w-4 h-4" style={{ color: 'rgba(255, 255, 255, 0.6)' }} /></button>
          </div>
        </div>
        {/* Content */}
        <main className={`flex-1 px-4 pb-24 transition-all duration-400 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
          <div className="max-w-5xl mx-auto">
            {/* TODAY - Cork Board + Weekly Bookshelf */}
            {currentRoom === 'desk' && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #b8956e 0%, #a6845e 25%, #c9a678 50%, #b18a5c 75%, #a07848 100%)', boxShadow: 'inset 0 0 40px rgba(80, 50, 20, 0.3), 0 4px 20px rgba(0, 0, 0, 0.3)', minHeight: '280px', padding: '20px' }}>
                  <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
                  <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 8px #5c4030, inset 0 0 0 10px #4a3425, inset 0 0 0 12px #3d2a1c', borderRadius: '12px' }} />
                  <div className="absolute inset-[12px] pointer-events-none" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)', borderRadius: '4px' }} />
                  <div className="relative pt-2" style={{ marginLeft: '6px', marginRight: '6px' }}>
                    {filterBooks(todayBooks).length > 0 ? (
                      <>
                        <div className="mb-4 text-center"><span className="inline-block text-[11px] font-medium px-3 py-1 rounded" style={{ background: 'rgba(255,255,255,0.85)', color: '#4a3520', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', fontFamily: 'Georgia, serif' }}>Today's Sessions</span></div>
                        <div className="flex flex-wrap justify-center gap-4">{filterBooks(todayBooks).map((book, i) => (<PinnedNote key={book.id} {...book} index={i} onClick={() => openDiaryFromBook(book)} />))}</div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <div className="inline-block text-4xl mb-3 p-4 rounded" style={{ background: 'rgba(255,255,255,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>📋</div>
                        <h3 className="text-sm mb-1 font-medium" style={{ color: '#3d2a1c' }}>Board is clear</h3>
                        <p className="text-[11px] mb-3" style={{ color: '#6b5040' }}>No sessions scheduled for today</p>
                        <button onClick={() => navigateRoom('library')} className="text-[10px] px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.8)', color: '#5c4030', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>Browse Library →</button>
                      </div>
                    )}
                  </div>
                </div>
                <WeeklyBookshelf schedule={weekSchedule} onBookClick={openDiaryByGoalId} onMoveBook={handleMoveBook} isUpdating={moveBookMutation.isPending} />
                <div className="flex justify-end text-[8px] px-1" style={{ color: 'rgba(255, 255, 255, 0.2)' }}><div className="flex items-center gap-1"><span>Library</span><ChevronRight className="w-3 h-3" /></div></div>
              </div>
            )}
            {/* LIBRARY */}
            {currentRoom === 'library' && (
              <div className="space-y-3">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255, 255, 255, 0.25)' }} /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg text-xs focus:outline-none" style={{ background: 'rgba(30, 24, 18, 0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.06)', color: 'rgba(255, 255, 255, 0.9)' }} /></div>
                {filterBooks(activeBooks).length > 0 ? (
                  <div className="relative rounded-xl overflow-y-auto" style={{ background: 'rgba(30, 22, 16, 0.75)', backdropFilter: 'blur(8px)', border: '6px solid rgba(55, 40, 28, 0.8)', boxShadow: 'inset 0 0 25px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.25)', maxHeight: 'calc(100vh - 220px)' }}>
                    <div className="p-4"><div className="grid gap-4 justify-items-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>{filterBooks(activeBooks).map((book) => (<TomeCard key={book.id} {...book} onClick={() => openDiaryFromBook(book)} />))}</div></div>
                    <div className="sticky bottom-0 h-3" style={{ background: 'linear-gradient(180deg, rgba(70, 52, 36, 0.95) 0%, rgba(55, 40, 28, 1) 100%)', boxShadow: '0 -2px 8px rgba(0,0,0,0.2)' }} />
                  </div>
                ) : (
                  <div className="text-center py-14 rounded-xl" style={{ background: 'rgba(30, 22, 16, 0.6)', backdropFilter: 'blur(8px)' }}>
                    <div className="text-3xl mb-3 opacity-40">📚</div>
                    <h3 className="text-sm mb-1" style={{ color: 'rgba(255, 240, 220, 0.6)' }}>Library is empty</h3>
                    <button onClick={() => setShowAddGoal(true)} className="mt-3 text-[10px] px-3 py-1.5 rounded" style={{ background: 'rgba(160, 120, 50, 0.35)', color: 'rgba(255, 255, 255, 0.85)' }}>Add First Book</button>
                  </div>
                )}
                <div className="flex justify-between text-[8px] px-1" style={{ color: 'rgba(255, 255, 255, 0.2)' }}><div className="flex items-center gap-1"><ChevronLeft className="w-3 h-3" /><span>Today</span></div><div className="flex items-center gap-1"><span>Trophies</span><ChevronRight className="w-3 h-3" /></div></div>
              </div>
            )}
            {/* TROPHIES */}
            {currentRoom === 'trophies' && (
              <div className="relative rounded-xl overflow-y-auto" style={{ background: 'rgba(35, 28, 18, 0.75)', backdropFilter: 'blur(8px)', border: '6px solid rgba(70, 55, 35, 0.7)', boxShadow: 'inset 0 0 30px rgba(255, 200, 50, 0.03), 0 4px 16px rgba(0,0,0,0.25)', maxHeight: 'calc(100vh - 180px)' }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 100% 50% at 50% 100%, rgba(255, 200, 50, 0.05) 0%, transparent 50%)' }} />
                {filterBooks(completedBooks).length > 0 ? (
                  <>
                    <div className="relative pt-4 pb-2 text-center sticky top-0 z-10" style={{ background: 'rgba(35, 28, 18, 0.95)' }}><h2 className="text-[10px] font-medium tracking-[0.15em]" style={{ color: 'rgba(255, 200, 100, 0.55)' }}>✦ HALL OF MASTERY ✦</h2></div>
                    <div className="p-4 pt-2"><div className="grid gap-4 justify-items-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>{filterBooks(completedBooks).map((book) => (<TomeCard key={book.id} {...book} isCompleted={true} onClick={() => openDiaryFromBook(book)} />))}</div></div>
                    <div className="sticky bottom-0 h-3" style={{ background: 'linear-gradient(180deg, rgba(80, 65, 42, 0.95) 0%, rgba(60, 48, 32, 1) 100%)', boxShadow: '0 -2px 8px rgba(0,0,0,0.2)' }} />
                  </>
                ) : (
                  <div className="text-center py-14">
                    <div className="text-3xl mb-3 opacity-30">🏆</div>
                    <h3 className="text-sm mb-1" style={{ color: 'rgba(255, 200, 100, 0.45)' }}>No achievements yet</h3>
                    <button onClick={() => navigateRoom('library')} className="mt-3 text-[10px] px-3 py-1.5 rounded" style={{ background: 'rgba(255, 200, 50, 0.12)', color: 'rgba(255, 200, 100, 0.75)' }}>View Library →</button>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 flex items-center gap-1 text-[8px]" style={{ color: 'rgba(255, 200, 100, 0.2)' }}><ChevronLeft className="w-3 h-3" /><span>Library</span></div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}