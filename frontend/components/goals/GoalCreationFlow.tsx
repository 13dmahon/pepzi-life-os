'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, Clock, Send, Flame, GripVertical, Check, Zap, ArrowRight, Sparkles, BookOpen, Target, Calendar, Brain, Pencil, Camera, FileText, Info, Shield, Award, Star, Timer, ClipboardCheck, MessageSquare, Trophy, Users, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigation } from '@/components/NavigationContext';
import { goalsAPI } from '@/lib/api';
import PlanCreationLoader from './PlanCreationLoader';
import { CATALOGUE_GOALS, CatalogueGoal, getPopularCatalogueGoals } from './catalogueGoals';
import type { VerificationRequirement } from './catalogueGoals';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor, useDraggable, useDroppable, DragStartEvent, DragEndEvent } from '@dnd-kit/core';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

type FlowStep = 'choose_type' | 'catalogue_browse' | 'catalogue_detail' | 'ai_chat' | 'manual_input' | 'session_preview' | 'day_drop' | 'creating';

interface GoalCreationFlowProps { 
  isOpen: boolean; 
  onClose: () => void; 
  onGoalCreated: () => void; 
  userId: string; 
  initialStep?: FlowStep;
}
interface SessionToken { id: string; session_number: number; name: string; duration_mins: number; description?: string; }
interface PreparedGoal { name: string; emoji: string; category: string; description?: string; sessions_per_week: number; session_duration_mins: number; total_sessions: number; total_weeks: number; weekly_sessions: SessionToken[]; source: 'catalogue' | 'ai' | 'manual'; catalogueId?: string; }

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_emoji: string;
  completed_sessions: number;
  total_sessions: number;
  started_at: string;
  estimated_completion: string;
  streak: number;
}

const tomeColors: Record<string, { spine: string; cover: string; accent: string; glow: string; sealBg: string }> = {
  fitness: { spine: 'linear-gradient(to right, #1a2f1a 0%, #2d4a2d 50%, #1a2f1a 100%)', cover: 'linear-gradient(165deg, #2a4a2a 0%, #1c381c 40%, #142814 100%)', accent: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #2a4a30 0%, #1a2a1a 100%)' },
  health: { spine: 'linear-gradient(to right, #3d1515 0%, #5a2020 50%, #3d1515 100%)', cover: 'linear-gradient(165deg, #6a2828 0%, #4a1c1c 40%, #3a1414 100%)', accent: '#f87171', glow: 'rgba(248, 113, 113, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a3030 0%, #3a1818 100%)' },
  languages: { spine: 'linear-gradient(to right, #15253d 0%, #1e3a5a 50%, #15253d 100%)', cover: 'linear-gradient(165deg, #2a4a6a 0%, #1c3048 40%, #142030 100%)', accent: '#60a5fa', glow: 'rgba(96, 165, 250, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #304a6a 0%, #182838 100%)' },
  music: { spine: 'linear-gradient(to right, #251530 0%, #382050 50%, #251530 100%)', cover: 'linear-gradient(165deg, #4a2860 0%, #341c48 40%, #241430 100%)', accent: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #483060 0%, #281838 100%)' },
  mental_health: { spine: 'linear-gradient(to right, #102a2d 0%, #184045 50%, #102a2d 100%)', cover: 'linear-gradient(165deg, #285055 0%, #1c3840 40%, #142830 100%)', accent: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #304850 0%, #182830 100%)' },
  reading: { spine: 'linear-gradient(to right, #2d1f0f 0%, #4a3018 50%, #2d1f0f 100%)', cover: 'linear-gradient(165deg, #5a4025 0%, #4a3018 40%, #3a2010 100%)', accent: '#d97706', glow: 'rgba(217, 119, 6, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a4830 0%, #3a2818 100%)' },
  skill: { spine: 'linear-gradient(to right, #2d1a10 0%, #4a2818 50%, #2d1a10 100%)', cover: 'linear-gradient(165deg, #5a3525 0%, #4a2518 40%, #3a1a10 100%)', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a4030 0%, #3a2518 100%)' },
  default: { spine: 'linear-gradient(to right, #2d1a10 0%, #4a2818 50%, #2d1a10 100%)', cover: 'linear-gradient(165deg, #5a3525 0%, #4a2518 40%, #3a1a10 100%)', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', sealBg: 'radial-gradient(circle at 30% 30%, #5a4030 0%, #3a2518 100%)' },
};

const difficultyTiers: Record<string, { label: string; color: string }> = {
  beginner: { label: 'BRONZE', color: '#CD7F32' },
  intermediate: { label: 'SILVER', color: '#C0C0C0' },
  advanced: { label: 'GOLD', color: '#FFD700' },
  expert: { label: 'LEGENDARY', color: '#FF6B35' },
};

const verificationIcons: Record<string, typeof Camera> = {
  camera: Camera,
  notes: MessageSquare,
  metric: Target,
  timer: Timer,
  checklist: ClipboardCheck,
};

const PATH_OPTIONS = [
  {
    id: 'catalogue', name: 'Quest Board', emoji: '📚', category: 'fitness', subtitle: 'Proven challenges',
    description: 'Browse our collection of expert-designed challenges with structured progressions.',
    features: [
      { icon: BookOpen, text: 'Pre-built session plans with daily prompts' },
      { icon: Target, text: 'Clear milestones and progression tracking' },
      { icon: Calendar, text: 'Optimized schedules based on difficulty' },
    ],
    howItWorks: ['Browse challenges by category (Fitness, Music, Languages...)', 'Preview the full session breakdown before committing', 'Pick which days work best for your schedule', 'Start your first session immediately!'],
  },
  {
    id: 'ai', name: 'AI Coach', emoji: '✨', category: 'music', subtitle: 'Personalized plan',
    description: 'Tell me your goal and I\'ll create a custom plan tailored just for you.',
    features: [
      { icon: Brain, text: 'AI understands your specific goal & context' },
      { icon: Sparkles, text: 'Generates personalized session content' },
      { icon: Target, text: 'Adapts difficulty to your experience level' },
    ],
    howItWorks: ['Chat with AI about what you want to achieve', 'Answer a few questions about your schedule & experience', 'AI generates a complete custom training plan', 'Review, adjust, and start your journey!'],
  },
  {
    id: 'manual', name: 'Blank Book', emoji: '✏️', category: 'skill', subtitle: 'Build your own',
    description: 'Full control to create exactly the goal and schedule you want.',
    features: [
      { icon: Pencil, text: 'Define your own sessions and durations' },
      { icon: Calendar, text: 'Set any schedule that works for you' },
      { icon: Target, text: 'Track progress your way' },
    ],
    howItWorks: ['Name your goal and pick a category', 'Set how many sessions per week and duration', 'Choose your preferred days', 'Start tracking immediately!'],
  },
];

function TomeCard({ name, emoji, category, subtitle, isSelected, onClick }: { name: string; emoji: string; category: string; subtitle?: string; isSelected?: boolean; onClick: () => void }) {
  const colors = tomeColors[category] || tomeColors.default;
  return (
    <button onClick={onClick} className={`group relative flex-shrink-0 transition-all duration-300 ease-out focus:outline-none ${isSelected ? '-translate-y-3 scale-105' : 'hover:-translate-y-2'}`} style={{ width: '120px', height: '165px', perspective: '800px' }}>
      <div className={`absolute bottom-[-8px] left-[10%] right-[10%] h-5 rounded-[50%] transition-opacity ${isSelected ? 'opacity-60' : 'opacity-0 group-hover:opacity-40'}`} style={{ background: colors.glow, filter: 'blur(10px)' }} />
      {isSelected && <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-transparent" style={{ borderBottomColor: colors.accent }} />}
      <div className={`relative w-full h-full transition-transform duration-300 ${isSelected ? '[transform:rotateY(-8deg)]' : 'group-hover:[transform:rotateY(-5deg)]'}`} style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute top-[4px] bottom-[4px] right-0 w-[8px] rounded-r pointer-events-none" style={{ background: 'linear-gradient(to right, #c8b898 0%, #f0e8dc 30%, #c0b4a0 100%)', boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.1)' }} />
        <div className="absolute top-0 bottom-0 left-0 w-[14px] rounded-l pointer-events-none" style={{ background: colors.spine, boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.3)' }} />
        <div className="absolute top-0 left-[12px] right-[6px] bottom-0 rounded-r overflow-hidden" style={{ background: colors.cover, boxShadow: isSelected ? `0 4px 20px ${colors.glow}, 0 8px 32px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.2)', border: isSelected ? `2px solid ${colors.accent}` : 'none' }}>
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <div className="absolute inset-[5px] rounded-sm pointer-events-none" style={{ border: `1.5px solid ${colors.accent}30` }} />
          <div className="relative h-full flex flex-col items-center justify-center p-3 z-10">
            <div className="relative w-[44px] h-[44px] mb-2"><div className="absolute inset-0 rounded-full" style={{ background: colors.sealBg, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)' }} /><div className="absolute inset-0 flex items-center justify-center text-[22px]">{emoji}</div></div>
            <h3 className="text-center leading-tight mb-1 line-clamp-2 px-1" style={{ color: 'rgba(255, 235, 200, 0.95)', fontSize: '11px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{name}</h3>
            {subtitle && <span className="text-[9px] text-center px-1 line-clamp-1" style={{ color: colors.accent }}>{subtitle}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function PathSpotlight({ selectedIndex, onSelect, onContinue }: { selectedIndex: number; onSelect: (index: number) => void; onContinue: () => void }) {
  const path = PATH_OPTIONS[selectedIndex];
  const colors = tomeColors[path.category] || tomeColors.default;
  const handlePrev = () => onSelect((selectedIndex - 1 + PATH_OPTIONS.length) % PATH_OPTIONS.length);
  const handleNext = () => onSelect((selectedIndex + 1) % PATH_OPTIONS.length);
  return (
    <div className="flex flex-col items-center px-4">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={handlePrev} className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}><ChevronLeft className="w-5 h-5 text-white" /></button>
        <div className="flex items-end gap-3">{PATH_OPTIONS.map((p, idx) => (<div key={p.id} className={`transition-all duration-300 ${idx === selectedIndex ? 'z-10' : 'opacity-50 scale-90'}`}><TomeCard name={p.name} emoji={p.emoji} category={p.category} subtitle={p.subtitle} isSelected={idx === selectedIndex} onClick={() => onSelect(idx)} /></div>))}</div>
        <button onClick={handleNext} className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}><ChevronRight className="w-5 h-5 text-white" /></button>
      </div>
      <div className="flex gap-2 mb-4">{PATH_OPTIONS.map((_, idx) => (<button key={idx} onClick={() => onSelect(idx)} className={`w-2 h-2 rounded-full transition-all ${idx === selectedIndex ? 'w-6' : ''}`} style={{ background: idx === selectedIndex ? colors.accent : 'rgba(255,255,255,0.3)' }} />))}</div>
      <div className="w-full max-w-md rounded-2xl p-5 transition-all duration-300" style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)`, border: `1px solid ${colors.accent}40`, boxShadow: `0 4px 20px ${colors.glow}` }}>
        <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: colors.sealBg }}>{path.emoji}</div><div><h3 className="font-bold text-white text-lg">{path.name}</h3><p className="text-sm" style={{ color: colors.accent }}>{path.subtitle}</p></div></div>
        <p className="text-white/80 text-sm mb-4">{path.description}</p>
        <div className="space-y-2 mb-4">{path.features.map((feature, idx) => (<div key={idx} className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${colors.accent}20` }}><feature.icon className="w-4 h-4" style={{ color: colors.accent }} /></div><span className="text-white/70 text-sm">{feature.text}</span></div>))}</div>
        <div className="mb-5"><h4 className="text-white font-semibold text-sm mb-2">How it works:</h4><div className="space-y-2">{path.howItWorks.map((s, idx) => (<div key={idx} className="flex items-start gap-2"><div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: colors.accent, color: '#1a1510' }}>{idx + 1}</div><span className="text-white/60 text-xs leading-relaxed">{s}</span></div>))}</div></div>
        <button onClick={onContinue} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]" style={{ background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accent}dd 100%)`, color: '#1a1510', boxShadow: `0 4px 12px ${colors.glow}` }}>Get Started <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function CatalogueBookCard({ goal, onClick }: { goal: CatalogueGoal; onClick: () => void }) {
  const colors = tomeColors[goal.category] || tomeColors.default;
  const tier = difficultyTiers[goal.difficulty] || difficultyTiers.beginner;
  return (
    <button onClick={onClick} className="group relative flex-shrink-0 transition-all duration-300 ease-out hover:-translate-y-2 focus:outline-none" style={{ width: '100px', height: '140px', perspective: '800px' }}>
      <div className="absolute bottom-[-6px] left-[15%] right-[15%] h-3 rounded-[50%] opacity-0 group-hover:opacity-50 transition-opacity" style={{ background: colors.glow, filter: 'blur(6px)' }} />
      <div className="relative w-full h-full transition-transform duration-300 group-hover:[transform:rotateY(-4deg)]" style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute top-[3px] bottom-[3px] right-0 w-[6px] rounded-r pointer-events-none" style={{ background: 'linear-gradient(to right, #c8b898 0%, #f0e8dc 30%, #c0b4a0 100%)' }} />
        <div className="absolute top-0 bottom-0 left-0 w-[10px] rounded-l pointer-events-none" style={{ background: colors.spine, boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3)' }} />
        <div className="absolute top-0 left-[8px] right-[4px] bottom-0 rounded-r overflow-hidden" style={{ background: colors.cover, boxShadow: '0 2px 6px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)' }}>
          <div className="absolute inset-0 opacity-25 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <div className="absolute inset-[4px] rounded-sm pointer-events-none" style={{ border: `1px solid ${colors.accent}25` }} />
          {goal.popular && <div className="absolute top-[3px] right-[3px] z-20"><Flame className="w-3.5 h-3.5 text-orange-400 drop-shadow" /></div>}
          <div className="relative h-full flex flex-col items-center justify-center p-2 z-10">
            <span className="text-[20px] mb-1">{goal.emoji}</span>
            <h3 className="text-center leading-tight mb-1 line-clamp-2 px-0.5" style={{ color: 'rgba(255, 235, 200, 0.95)', fontSize: '9px', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{goal.name}</h3>
            <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full mb-0.5" style={{ background: `${tier.color}30`, color: tier.color }}>{tier.label}</span>
            <span className="text-[7px]" style={{ color: 'rgba(255, 235, 200, 0.4)' }}>{goal.total_sessions} sessions</span>
          </div>
        </div>
      </div>
    </button>
  );
}

const DAYS = [{ key: 'monday', label: 'Mon' }, { key: 'tuesday', label: 'Tue' }, { key: 'wednesday', label: 'Wed' }, { key: 'thursday', label: 'Thu' }, { key: 'friday', label: 'Fri' }, { key: 'saturday', label: 'Sat' }, { key: 'sunday', label: 'Sun' }];

function DraggableSessionToken({ session, isPlaced }: { session: SessionToken; isPlaced: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: session.id, data: { session } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  if (isPlaced) return null;
  return (<div ref={setNodeRef} {...attributes} {...listeners} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-50 scale-105' : ''}`} style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)', ...style }}><GripVertical className="w-3 h-3 text-white/60" /><div className="text-white text-[10px] font-bold truncate max-w-[120px]">S{session.session_number}: {session.name}</div><div className="text-white/70 text-[9px] flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{session.duration_mins}m</div></div>);
}
function SessionTokenOverlay({ session }: { session: SessionToken }) {
  return <div className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-2xl" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)' }}><GripVertical className="w-3 h-3 text-white/60" /><div className="text-white text-[10px] font-bold">S{session.session_number}</div></div>;
}
function DroppableDayCard({ day, existingHours, placedSessions, onRemoveSession, isRecommended }: { day: { key: string; label: string }; existingHours: number; placedSessions: SessionToken[]; onRemoveSession: (sessionId: string) => void; isRecommended: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${day.key}`, data: { day: day.key } });
  const placedMins = placedSessions.reduce((sum, s) => sum + s.duration_mins, 0);
  const totalHours = existingHours + (placedMins / 60);
  const hasSession = placedSessions.length > 0;
  return (<div ref={setNodeRef} className={`relative rounded-lg p-2 transition-all border-2 ${isOver ? 'border-purple-400 bg-purple-500/20 scale-105' : hasSession ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 bg-black/30'}`} style={{ minHeight: '100px' }}>{isRecommended && !hasSession && <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-bold">FREE</div>}<div className="text-center mb-1"><div className="text-xs font-bold text-white">{day.label}</div><div className={`text-[9px] ${totalHours > 0 ? 'text-amber-400' : 'text-white/30'}`}>{totalHours.toFixed(1)}h</div></div><div className="space-y-1">{placedSessions.map((session) => <div key={session.id} className="group relative bg-purple-500/80 text-white text-[8px] px-1.5 py-1 rounded font-medium"><div className="truncate">S{session.session_number}</div><button onClick={() => onRemoveSession(session.id)} className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-[8px]">×</button></div>)}{!hasSession && <div className="text-center py-3 text-[9px] text-white/20">Drop</div>}</div></div>);
}

function DayDropScheduler({ sessions, existingDayHours, onComplete, onCancel, goalName, totalWeeks }: { sessions: SessionToken[]; existingDayHours: Record<string, number>; onComplete: (schedule: Record<string, SessionToken[]>) => void; onCancel: () => void; goalName: string; totalWeeks: number }) {
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [activeSession, setActiveSession] = useState<SessionToken | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
  const getSessionsForDay = (dayKey: string) => sessions.filter(s => placements[s.id] === dayKey);
  const isSessionPlaced = (sessionId: string) => sessionId in placements;
  const unplacedCount = sessions.filter(s => !isSessionPlaced(s.id)).length;
  const allPlaced = unplacedCount === 0;
  const sortedDays = [...DAYS].sort((a, b) => (existingDayHours[a.key] || 0) - (existingDayHours[b.key] || 0));
  const recommendedDays = sortedDays.slice(0, sessions.length).map(d => d.key);
  const handleDragStart = (event: DragStartEvent) => { const s = event.active.data.current?.session; if (s) setActiveSession(s); };
  const handleDragEnd = (event: DragEndEvent) => { setActiveSession(null); const { active, over } = event; if (!over) return; const session = active.data.current?.session; const dayKey = over.data.current?.day; if (session && dayKey) setPlacements(prev => ({ ...prev, [session.id]: dayKey })); };
  const handleRemoveSession = (id: string) => setPlacements(prev => { const n = { ...prev }; delete n[id]; return n; });
  const handleAutoPick = () => { const newPlacements: Record<string, string> = {}; sessions.filter(s => !isSessionPlaced(s.id)).forEach((s, i) => { newPlacements[s.id] = sortedDays[i % sortedDays.length].key; }); setPlacements(prev => ({ ...prev, ...newPlacements })); };
  const handleComplete = () => { const schedule: Record<string, SessionToken[]> = {}; DAYS.forEach(d => { schedule[d.key] = getSessionsForDay(d.key); }); onComplete(schedule); };
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="fixed inset-0 z-[9999] overflow-hidden"><div className="absolute inset-0 bg-[#1a1510]" /><div className="absolute inset-0 opacity-30 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')" }} />
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', background: 'rgba(20, 15, 10, 0.95)', borderBottom: '1px solid rgba(255, 200, 100, 0.2)' }}><button onClick={onCancel} className="text-sm font-medium text-amber-400">Cancel</button><h2 className="font-bold text-white">📅 Pick Your Days</h2><div className="w-12" /></div>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(139, 92, 246, 0.15)', borderBottom: '1px solid rgba(139, 92, 246, 0.3)' }}><div><h3 className="font-bold text-white text-sm">{goalName}</h3><p className="text-xs text-purple-300">{sessions.length}/week · {totalWeeks} weeks</p></div><div className="text-right"><div className="text-xl font-black text-purple-400">{sessions.length * totalWeeks}</div><div className="text-[9px] text-purple-300">total</div></div></div>
          <div className="px-4 py-3" style={{ background: 'rgba(0, 0, 0, 0.4)' }}><div className="flex items-center justify-between mb-2"><span className="text-xs text-white">Sessions <span className="text-amber-400">({unplacedCount} left)</span></span><button onClick={handleAutoPick} disabled={allPlaced} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-green-500 text-white disabled:opacity-50"><Zap className="w-3 h-3" />Auto-pick</button></div><div className="flex flex-wrap gap-2">{sessions.map(s => <DraggableSessionToken key={s.id} session={s} isPlaced={isSessionPlaced(s.id)} />)}{allPlaced && <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs"><Check className="w-4 h-4" />All placed!</div>}</div></div>
          <div className="flex-1 overflow-auto p-4"><div className="grid grid-cols-7 gap-2">{DAYS.map(d => <DroppableDayCard key={d.key} day={d} existingHours={existingDayHours[d.key] || 0} placedSessions={getSessionsForDay(d.key)} onRemoveSession={handleRemoveSession} isRecommended={recommendedDays.includes(d.key)} />)}</div><p className="text-center text-[10px] text-white/30 mt-3">Repeats weekly for {totalWeeks} weeks</p></div>
          <div className="p-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'rgba(20, 15, 10, 0.95)', borderTop: '1px solid rgba(255, 200, 100, 0.2)' }}><button onClick={handleComplete} disabled={!allPlaced} className="w-full py-3.5 rounded-xl font-bold transition-all disabled:opacity-40" style={{ background: allPlaced ? 'linear-gradient(135deg, #B8860B 0%, #DAA520 100%)' : 'rgba(255,255,255,0.1)', color: allPlaced ? '#1a1510' : 'rgba(255,255,255,0.4)' }}>{allPlaced ? '🚀 Create Goal' : `Place ${unplacedCount} more`}</button></div>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{activeSession && <SessionTokenOverlay session={activeSession} />}</DragOverlay>
    </DndContext>
  );
}

export default function GoalCreationFlow({ isOpen, onClose, onGoalCreated, userId, initialStep }: GoalCreationFlowProps) {
  const { hideNav, showNav } = useNavigation();
  const [step, setStep] = useState<FlowStep>(initialStep || 'choose_type');
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [preparedGoal, setPreparedGoal] = useState<PreparedGoal | null>(null);
  const [selectedCatalogue, setSelectedCatalogue] = useState<CatalogueGoal | null>(null);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueCategory, setCatalogueCategory] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiConversationState, setAiConversationState] = useState<any>(null);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('fitness');
  const [manualSessionsPerWeek, setManualSessionsPerWeek] = useState(3);
  const [manualDurationMins, setManualDurationMins] = useState(30);
  const [manualTotalWeeks, setManualTotalWeeks] = useState(8);
  const [existingDayHours] = useState<Record<string, number>>({ monday: 0, tuesday: 0.5, wednesday: 0, thursday: 1, friday: 0, saturday: 0, sunday: 0 });
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showSessions, setShowSessions] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showGains, setShowGains] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch leaderboard for catalogue challenges
  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ['challenge-leaderboard', selectedCatalogue?.id],
    queryFn: async () => {
      if (!selectedCatalogue) return [];
      try {
        const res = await fetch(`${API_BASE}/api/goals/challenges/${selectedCatalogue.id}/leaderboard`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.leaderboard || [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedCatalogue && step === 'catalogue_detail',
  });

  useEffect(() => { if (isOpen) hideNav(); else showNav(); return () => showNav(); }, [isOpen, hideNav, showNav]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);
  
  useEffect(() => { 
    if (isOpen) { 
      setStep(initialStep || 'choose_type'); setSelectedPathIndex(0); setPreparedGoal(null); setSelectedCatalogue(null); 
      setCatalogueSearch(''); setCatalogueCategory(null); setExpandedSession(null); setShowLeaderboard(true);
      setShowSessions(false); setShowVerification(false); setShowGains(false);
      setAiMessages([{ role: 'assistant', content: `🎯 What do you want to achieve?\n\nExamples:\n• "Learn piano"\n• "Run a 5K"\n• "Read more"` }]); 
      setAiInput(''); setAiConversationState(null); setManualName(''); 
    } 
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  const handleBack = () => {
    if (step === 'catalogue_browse') { if (initialStep === 'catalogue_browse') { onClose(); } else { setStep('choose_type'); } }
    else if (step === 'ai_chat') { if (initialStep === 'ai_chat') { onClose(); } else { setStep('choose_type'); } }
    else if (step === 'manual_input') { if (initialStep === 'manual_input') { onClose(); } else { setStep('choose_type'); } }
    else if (step === 'catalogue_detail') { setStep('catalogue_browse'); setSelectedCatalogue(null); setExpandedSession(null); }
    else if (step === 'session_preview') { if (preparedGoal?.source === 'catalogue') setStep('catalogue_detail'); else if (preparedGoal?.source === 'ai') setStep('ai_chat'); else setStep('manual_input'); }
    else if (step === 'day_drop') { setStep('session_preview'); }
    else { onClose(); }
  };

  const handlePathContinue = () => { const pathId = PATH_OPTIONS[selectedPathIndex].id; if (pathId === 'catalogue') setStep('catalogue_browse'); else if (pathId === 'ai') setStep('ai_chat'); else setStep('manual_input'); };
  const handleSelectCatalogue = (goal: CatalogueGoal) => { setSelectedCatalogue(goal); setExpandedSession(null); setShowLeaderboard(true); setShowSessions(false); setShowVerification(false); setShowGains(false); setStep('catalogue_detail'); };
  
  const handleConfirmCatalogue = () => { 
    if (!selectedCatalogue) return; 
    setPreparedGoal({ name: selectedCatalogue.name, emoji: selectedCatalogue.emoji, category: selectedCatalogue.category, description: selectedCatalogue.description, sessions_per_week: selectedCatalogue.sessions_per_week, session_duration_mins: selectedCatalogue.session_duration_mins, total_sessions: selectedCatalogue.total_sessions, total_weeks: selectedCatalogue.total_weeks, 
      weekly_sessions: selectedCatalogue.weekly_sessions.map((s, i) => ({ id: `session-${i + 1}`, session_number: s.session_number, name: s.name, duration_mins: s.duration_mins, description: s.description })), source: 'catalogue', catalogueId: selectedCatalogue.id }); 
    setStep('session_preview'); 
  };
  
  const handleConfirmManual = () => { if (!manualName.trim()) return; const total = manualSessionsPerWeek * manualTotalWeeks; setPreparedGoal({ name: manualName, emoji: '🎯', category: manualCategory, sessions_per_week: manualSessionsPerWeek, session_duration_mins: manualDurationMins, total_sessions: total, total_weeks: manualTotalWeeks, weekly_sessions: Array.from({ length: manualSessionsPerWeek }, (_, i) => ({ id: `session-${i + 1}`, session_number: i + 1, name: `Session ${i + 1}`, duration_mins: manualDurationMins })), source: 'manual' }); setStep('session_preview'); };

  const handleAiSend = async () => {
    if (!aiInput.trim() || aiProcessing) return;
    const msg = aiInput; setAiMessages(prev => [...prev, { role: 'user', content: msg }]); setAiInput(''); setAiProcessing(true);
    try {
      const data = await goalsAPI.conversation(userId, msg, aiConversationState);
      setAiMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      if (data.state) setAiConversationState(data.state);
      if (data.complete && data.goal) {
        const spw = data.sessions_per_week || 3; const dur = Math.round(((data.weekly_hours || 3) * 60) / spw); const tw = data.state?.total_weeks || 8;
        setPreparedGoal({ name: data.goal.name, emoji: '🎯', category: data.goal.category, description: data.goal.description, sessions_per_week: spw, session_duration_mins: dur, total_sessions: spw * tw, total_weeks: tw, weekly_sessions: Array.from({ length: spw }, (_, i) => ({ id: `session-${i + 1}`, session_number: i + 1, name: `Session ${i + 1}`, duration_mins: dur })), source: 'ai' });
        setStep('session_preview');
      }
    } catch { setAiMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, try again?' }]); }
    finally { setAiProcessing(false); }
  };

  const handleDayDropComplete = async (schedule: Record<string, SessionToken[]>) => {
    if (!preparedGoal) return; setStep('creating');
    try {
      const days = Object.entries(schedule).filter(([_, s]) => s.length > 0).map(([d]) => d);
      const goal = await goalsAPI.createGoal({ user_id: userId, name: preparedGoal.name, category: preparedGoal.category, description: preparedGoal.description, preferred_days: days, preferred_time: 'any' });
      await goalsAPI.createPlanWithMilestones(goal.id, { weekly_hours: (preparedGoal.sessions_per_week * preparedGoal.session_duration_mins) / 60, sessions_per_week: preparedGoal.sessions_per_week, total_hours: (preparedGoal.total_sessions * preparedGoal.session_duration_mins) / 60, preferred_days: days, preferred_time: 'any', milestones: [], catalogue_id: preparedGoal.catalogueId, placed_sessions: Object.entries(schedule).flatMap(([day, ss]) => ss.map(s => ({ day, session_number: s.session_number, duration_mins: s.duration_mins, session_name: s.name, description: s.description || '' }))) } as any);
      setTimeout(() => { onGoalCreated(); onClose(); }, 1500);
    } catch (e) { console.error(e); setStep('day_drop'); alert('Failed. Try again.'); }
  };

  const filteredGoals = CATALOGUE_GOALS.filter(g => { const search = !catalogueSearch || g.name.toLowerCase().includes(catalogueSearch.toLowerCase()) || g.tags.some(t => t.includes(catalogueSearch.toLowerCase())); const cat = !catalogueCategory || g.category === catalogueCategory; return search && cat; });
  const categories = [...new Set(CATALOGUE_GOALS.map(g => g.category))];
  const weeklyMins = selectedCatalogue ? selectedCatalogue.sessions_per_week * selectedCatalogue.session_duration_mins : 0;
  const weeklyHoursDisplay = weeklyMins >= 60 ? `${Math.floor(weeklyMins / 60)}h ${weeklyMins % 60 > 0 ? `${weeklyMins % 60}m` : ''}` : `${weeklyMins}m`;

  if (step === 'creating') return <PlanCreationLoader isVisible={true} goalName={preparedGoal?.name || 'your goal'} estimatedSeconds={30} />;
  if (step === 'day_drop' && preparedGoal) return <DayDropScheduler sessions={preparedGoal.weekly_sessions} existingDayHours={existingDayHours} onComplete={handleDayDropComplete} onCancel={() => setStep('session_preview')} goalName={preparedGoal.name} totalWeeks={preparedGoal.total_weeks} />;

  // For catalogue detail, render the diary-page-style full screen view
  if (step === 'catalogue_detail' && selectedCatalogue) {
    const colors = tomeColors[selectedCatalogue.category] || tomeColors.default;
    const tier = difficultyTiers[selectedCatalogue.difficulty] || difficultyTiers.beginner;
    return (
      <div className="fixed inset-0 z-[9999]">
        {/* Mountain Background - same as DiaryPage */}
        <div className="absolute inset-0" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />

        {/* Book Container */}
        <div className="relative h-full flex items-center justify-center p-4 sm:p-8" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <div className="w-full max-w-2xl h-full max-h-[800px] flex rounded-lg overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0,0,0,0.3)' }}>
            
            {/* Left Page - Challenge Info */}
            <div className="hidden sm:flex w-1/3 flex-col relative" style={{ background: 'linear-gradient(135deg, #f5f0e6 0%, #ebe5d9 50%, #e0d9cb 100%)', borderRight: '1px solid rgba(139, 115, 85, 0.2)' }}>
              <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
              <div className="absolute top-0 bottom-0 right-0 w-6 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.1) 0%, transparent 100%)' }} />

              <div className="relative p-4 flex-1 overflow-y-auto">
                <div className="text-center mb-4 pb-3 border-b border-stone-300/50">
                  <span className="text-4xl mb-1 block">{selectedCatalogue.emoji}</span>
                  <h2 className="font-serif font-bold text-stone-700 text-sm leading-tight">{selectedCatalogue.name}</h2>
                  <div className="flex justify-center gap-1.5 mt-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] capitalize font-medium bg-stone-200 text-stone-600">{selectedCatalogue.category.replace('_', ' ')}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${tier.color}20`, color: tier.color }}>{tier.label}</span>
                  </div>
                </div>

                {/* Time stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-black text-stone-700">{weeklyHoursDisplay}</div>
                    <div className="text-[8px] text-stone-400">Per Week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-stone-700">{selectedCatalogue.sessions_per_week}×</div>
                    <div className="text-[8px] text-stone-400">{selectedCatalogue.session_duration_mins}m each</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-stone-700">{selectedCatalogue.total_weeks}</div>
                    <div className="text-[8px] text-stone-400">Weeks</div>
                  </div>
                </div>

                {/* Participants count */}
                {leaderboard.length > 0 && (
                  <div className="mb-4 p-2 bg-amber-100 border border-amber-300 rounded-lg text-center">
                    <p className="text-[10px] font-medium text-amber-800 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" />
                      {leaderboard.length} {leaderboard.length === 1 ? 'person' : 'people'} doing this challenge
                    </p>
                  </div>
                )}

                {/* Progress placeholder */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-stone-500 mb-1">
                    <span>Your Progress</span>
                    <span>0%</span>
                  </div>
                  <div className="h-1.5 bg-stone-300/50 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full" style={{ width: '0%' }} />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">0 of {selectedCatalogue.total_sessions} pages</p>
                </div>

                <div className="text-center text-[10px] text-stone-500 mb-4">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {selectedCatalogue.total_weeks} weeks to complete
                </div>
              </div>

              {/* Ribbon bookmark */}
              <div className="absolute top-0 left-6 w-4 h-20" style={{ background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%)', boxShadow: '2px 2px 4px rgba(0,0,0,0.2)' }} />
            </div>

            {/* Center Binding */}
            <div className="w-3 sm:w-4 flex-shrink-0 relative" style={{ background: 'linear-gradient(to right, #8b7355 0%, #a08060 20%, #c9b896 50%, #a08060 80%, #8b7355 100%)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)' }}>
              <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-around items-center py-8">{[...Array(8)].map((_, i) => (<div key={i} className="w-1 h-1 rounded-full bg-amber-900/40" />))}</div>
            </div>

            {/* Right Page - Main Content */}
            <div className="flex-1 flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #faf6ee 0%, #f5f0e6 50%, #ebe5d9 100%)' }}>
              {/* Paper texture */}
              <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
              {/* Ruled lines */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #5c4a38 28px)', backgroundSize: '100% 28px', marginTop: '60px' }} />
              {/* Red margin line */}
              <div className="absolute top-14 bottom-0 left-10 w-[1px] pointer-events-none opacity-20 hidden sm:block" style={{ background: '#c4646a' }} />
              {/* Binding shadow */}
              <div className="absolute top-0 bottom-0 left-0 w-8 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 100%)' }} />

              {/* Header */}
              <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-stone-300/30">
                <button onClick={handleBack} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-stone-200/50 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-stone-700" />
                  <span className="text-xs font-medium text-stone-600 hidden sm:inline">Back</span>
                </button>
                <div className="text-center">
                  <p className="text-xs font-serif text-stone-600">{selectedCatalogue.emoji} Challenge Overview</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-200/50 transition-colors">
                  <span className="text-stone-500 text-lg leading-none">✕</span>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="space-y-4">
                  {/* Mobile Title */}
                  <div className="sm:hidden text-center mb-2">
                    <span className="text-3xl">{selectedCatalogue.emoji}</span>
                    <h2 className="font-serif font-bold text-stone-700 text-base">{selectedCatalogue.name}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-[9px] capitalize font-medium bg-stone-200 text-stone-600">{selectedCatalogue.category.replace('_', ' ')}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${tier.color}20`, color: tier.color }}>{tier.label}</span>
                    </div>
                  </div>

                  {/* About */}
                  <div className="rounded-lg p-3 border border-stone-200/50 bg-stone-100/50">
                    <p className="text-xs text-stone-600 leading-relaxed font-serif italic">
                      "{selectedCatalogue.long_description || selectedCatalogue.description}"
                    </p>
                  </div>

                  {/* Mobile time stats */}
                  <div className="sm:hidden flex items-center justify-around p-3 bg-amber-50/80 border border-amber-200/50 rounded-lg">
                    <div className="text-center"><div className="text-sm font-black text-stone-700">{weeklyHoursDisplay}</div><div className="text-[8px] text-stone-400">Per Week</div></div>
                    <div className="text-center"><div className="text-sm font-black text-stone-700">{selectedCatalogue.sessions_per_week}×{selectedCatalogue.session_duration_mins}m</div><div className="text-[8px] text-stone-400">Sessions</div></div>
                    <div className="text-center"><div className="text-sm font-black text-stone-700">{selectedCatalogue.total_weeks}w</div><div className="text-[8px] text-stone-400">Duration</div></div>
                  </div>

                  {/* What You'll Gain - collapsible */}
                  {selectedCatalogue.what_youll_gain && selectedCatalogue.what_youll_gain.length > 0 && (
                    <>
                      <button onClick={() => setShowGains(!showGains)} className="w-full p-2.5 flex items-center justify-between bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200/50 rounded-lg transition-colors">
                        <span className="flex items-center gap-2 text-xs text-stone-700"><Award className="w-4 h-4 text-emerald-600" />What You'll Gain</span>
                        {showGains ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                      </button>
                      {showGains && (
                        <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200/30 space-y-2">
                          {selectedCatalogue.what_youll_gain.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <Star className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-stone-600">{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* What You'll Submit - collapsible */}
                  {selectedCatalogue.verification && selectedCatalogue.verification.length > 0 && (
                    <>
                      <button onClick={() => setShowVerification(!showVerification)} className="w-full p-2.5 flex items-center justify-between bg-purple-50/80 hover:bg-purple-100/80 border border-purple-200/50 rounded-lg transition-colors">
                        <span className="flex items-center gap-2 text-xs text-stone-700"><Shield className="w-4 h-4 text-purple-600" />What You'll Submit</span>
                        {showVerification ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                      </button>
                      {showVerification && (
                        <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200/30 space-y-2">
                          <p className="text-[10px] text-stone-400 mb-1">Each session, you'll provide:</p>
                          {selectedCatalogue.verification.map((req, i) => {
                            const IconComponent = verificationIcons[req.icon] || Check;
                            return (
                              <div key={i} className="flex items-start gap-2.5 p-2 bg-white/60 rounded-lg border border-purple-100/50">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-100">
                                  <IconComponent className="w-3.5 h-3.5 text-purple-600" />
                                </div>
                                <div>
                                  <span className="text-[11px] font-bold text-stone-700 block">{req.label}</span>
                                  <span className="text-[10px] text-stone-500">{req.description}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Leaderboard - collapsible */}
                  <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="w-full p-2.5 flex items-center justify-between bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/50 rounded-lg transition-colors">
                    <span className="flex items-center gap-2 text-xs text-stone-700">
                      <Trophy className="w-4 h-4 text-amber-600" />
                      Leaderboard
                      {leaderboard.length > 0 && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{leaderboard.length}</span>
                      )}
                    </span>
                    {showLeaderboard ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                  </button>
                  {showLeaderboard && (
                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/30">
                      {leaderboard.length === 0 ? (
                        <div className="text-center py-4">
                          <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                          <p className="text-xs text-stone-400">No one has started yet</p>
                          <p className="text-[10px] text-stone-400 mt-1">Be the first to take on this challenge!</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {leaderboard.map((entry, i) => {
                            const progress = entry.total_sessions > 0 ? Math.round((entry.completed_sessions / entry.total_sessions) * 100) : 0;
                            const startDate = new Date(entry.started_at);
                            const estDate = entry.estimated_completion ? new Date(entry.estimated_completion) : null;
                            return (
                              <div key={entry.user_id} className="flex items-center gap-3 p-2 bg-white/60 rounded-lg border border-stone-200/50">
                                {/* Rank */}
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${i === 0 ? 'bg-amber-400 text-amber-900' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-orange-800' : 'bg-stone-200 text-stone-500'}`}>
                                  {i + 1}
                                </div>
                                {/* Avatar & name */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{entry.avatar_emoji || '👤'}</span>
                                    <span className="text-[11px] font-bold text-stone-700 truncate">{entry.username}</span>
                                    {entry.streak > 0 && <span className="text-[9px] text-orange-500 flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" />{entry.streak}</span>}
                                  </div>
                                  {/* Progress bar */}
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, progress)}%` }} />
                                    </div>
                                    <span className="text-[9px] font-medium text-stone-500 flex-shrink-0">
                                      {entry.completed_sessions}/{entry.total_sessions}
                                    </span>
                                  </div>
                                  {/* Meta info */}
                                  <div className="flex items-center gap-2 mt-0.5 text-[8px] text-stone-400">
                                    <span>Started {startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                    {estDate && <span>· Est. finish {estDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Weekly Sessions - collapsible */}
                  <button onClick={() => setShowSessions(!showSessions)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                    <span className="flex items-center gap-2 text-xs text-stone-700">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      Weekly Sessions ({selectedCatalogue.sessions_per_week})
                    </span>
                    {showSessions ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                  </button>
                  {showSessions && (
                    <div className="p-3 bg-stone-100/80 rounded-lg space-y-2">
                      <p className="text-[10px] text-stone-400 mb-1">Repeats each week for {selectedCatalogue.total_weeks} weeks ({selectedCatalogue.total_sessions} sessions total)</p>
                      {selectedCatalogue.weekly_sessions.map((s, i) => (
                        <button key={i} onClick={() => setExpandedSession(expandedSession === i ? null : i)} className="w-full text-left rounded-lg p-2.5 bg-white/60 border border-stone-200/50 transition-all hover:border-stone-300/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] text-white bg-indigo-500">{s.session_number}</div>
                              <span className="font-semibold text-stone-700 text-[11px]">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-stone-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{s.duration_mins}m</span>
                              <ChevronRight className={`w-3 h-3 text-stone-300 transition-transform ${expandedSession === i ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                          {s.description && <p className="text-[10px] text-stone-500 ml-7 mt-0.5">{s.description}</p>}
                          {expandedSession === i && (
                            <div className="mt-2 ml-7 p-2 rounded bg-stone-50 border border-stone-200/50 text-[10px] text-stone-500 leading-relaxed whitespace-pre-wrap">
                              {s.prompt.replace(/\{\{session_number\}\}/g, String(s.session_number)).replace(/\{\{total_sessions\}\}/g, String(selectedCatalogue.total_sessions)).replace(/\{\{week_number\}\}/g, '1')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="h-16" />
                </div>
              </div>

              {/* Accept Challenge Button */}
              <div className="relative z-10 p-3 border-t border-stone-200/50 bg-gradient-to-t from-stone-100 to-transparent flex-shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                <button onClick={handleConfirmCatalogue} className="w-full py-3 font-serif font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white">
                  <Zap className="w-4 h-4" /> Accept Challenge
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      <div className="absolute inset-0 bg-[#1a1510]" />
      <div className="absolute inset-0 opacity-30 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')" }} />
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', background: 'rgba(20, 15, 10, 0.95)', borderBottom: '1px solid rgba(255, 200, 100, 0.2)' }}>
          <button onClick={step === 'choose_type' ? onClose : handleBack} className="text-amber-400"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex-1 text-center"><h2 className="font-bold text-white">{step === 'choose_type' && '📖 New Book'}{step === 'catalogue_browse' && '📚 Quest Board'}{step === 'ai_chat' && '✨ AI Coach'}{step === 'manual_input' && '✏️ Custom'}{step === 'session_preview' && '📋 Plan'}</h2></div>
          <div className="w-6" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'choose_type' && (
            <div className="py-6"><p className="text-center text-amber-200/70 text-sm mb-4">Choose your path</p><PathSpotlight selectedIndex={selectedPathIndex} onSelect={setSelectedPathIndex} onContinue={handlePathContinue} /></div>
          )}

          {step === 'catalogue_browse' && (
            <div className="p-4">
              <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" /><input type="text" value={catalogueSearch} onChange={(e) => setCatalogueSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,200,100,0.2)', color: 'white' }} /></div>
              <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4"><button onClick={() => setCatalogueCategory(null)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${!catalogueCategory ? 'bg-amber-500 text-black' : 'bg-black/40 text-amber-400 border border-amber-500/30'}`}>All</button>{categories.map(c => <button key={c} onClick={() => setCatalogueCategory(c)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold capitalize ${catalogueCategory === c ? 'bg-amber-500 text-black' : 'bg-black/40 text-amber-400 border border-amber-500/30'}`}>{c.replace('_', ' ')}</button>)}</div>
              {!catalogueSearch && !catalogueCategory && <div className="mb-6"><h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" />Popular</h3><div className="flex flex-wrap gap-3 justify-center">{getPopularCatalogueGoals().map(g => <CatalogueBookCard key={g.id} goal={g} onClick={() => handleSelectCatalogue(g)} />)}</div></div>}
              <div><h3 className="font-bold text-white text-sm mb-3">{catalogueSearch || catalogueCategory ? 'Results' : 'All'}</h3><div className="flex flex-wrap gap-3 justify-center">{filteredGoals.map(g => <CatalogueBookCard key={g.id} goal={g} onClick={() => handleSelectCatalogue(g)} />)}</div>{!filteredGoals.length && <p className="text-center py-8 text-white/40">No results</p>}</div>
            </div>
          )}

          {step === 'ai_chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {aiMessages.map((m, i) => <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className="max-w-[85%] rounded-xl px-3 py-2" style={{ background: m.role === 'user' ? 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)' : 'rgba(0,0,0,0.5)', color: 'white', border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}><div className="text-sm whitespace-pre-wrap">{m.content}</div></div></div>)}
                {aiProcessing && <div className="flex justify-start"><div className="rounded-xl px-3 py-2 bg-black/50"><div className="flex gap-1"><div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" /><div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div></div></div>}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {step === 'manual_input' && (
            <div className="p-4 space-y-4">
              <div><label className="block text-xs font-bold text-white mb-1">Name</label><input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g., Learn Piano" className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,200,100,0.2)', color: 'white' }} /></div>
              <div><label className="block text-xs font-bold text-white mb-1">Category</label><div className="grid grid-cols-3 gap-2">{['fitness', 'health', 'music', 'languages', 'reading', 'mental_health'].map(c => <button key={c} onClick={() => setManualCategory(c)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold capitalize" style={{ background: manualCategory === c ? 'rgba(251,191,36,0.3)' : 'rgba(0,0,0,0.4)', color: manualCategory === c ? '#fbbf24' : 'rgba(255,255,255,0.5)', border: manualCategory === c ? '1px solid #fbbf24' : '1px solid transparent' }}>{c.replace('_', ' ')}</button>)}</div></div>
              <div><label className="block text-xs font-bold text-white mb-1">Sessions/Week: <span className="text-amber-400">{manualSessionsPerWeek}</span></label><input type="range" min="1" max="7" value={manualSessionsPerWeek} onChange={(e) => setManualSessionsPerWeek(Number(e.target.value))} className="w-full accent-amber-500" /></div>
              <div><label className="block text-xs font-bold text-white mb-1">Duration: <span className="text-amber-400">{manualDurationMins}m</span></label><input type="range" min="10" max="120" step="5" value={manualDurationMins} onChange={(e) => setManualDurationMins(Number(e.target.value))} className="w-full accent-amber-500" /></div>
              <div><label className="block text-xs font-bold text-white mb-1">Weeks: <span className="text-amber-400">{manualTotalWeeks}</span></label><input type="range" min="1" max="52" value={manualTotalWeeks} onChange={(e) => setManualTotalWeeks(Number(e.target.value))} className="w-full accent-amber-500" /></div>
              <div className="rounded-lg p-3 bg-amber-500/20 border border-amber-500/40"><div className="text-xs text-amber-200">• {manualSessionsPerWeek}x/week · {manualDurationMins}m · {manualTotalWeeks} weeks</div><div className="font-bold text-amber-400 mt-1">= {manualSessionsPerWeek * manualTotalWeeks} sessions</div></div>
            </div>
          )}

          {step === 'session_preview' && preparedGoal && (
            <div className="p-4">
              <div className="text-center mb-4"><div className="text-4xl mb-2">{preparedGoal.emoji}</div><h2 className="text-lg font-bold text-white">{preparedGoal.name}</h2><p className="text-xs text-amber-200/60">{preparedGoal.total_sessions} sessions · {preparedGoal.total_weeks} weeks</p></div>
              <h3 className="font-bold text-white text-sm mb-2">Weekly Sessions ({preparedGoal.sessions_per_week})</h3>
              <div className="space-y-2">
                {preparedGoal.weekly_sessions.map(s => (
                  <div key={s.id} className="rounded-lg p-3 flex items-start gap-2 bg-black/40 border border-white/10">
                    <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs text-white flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)' }}>{s.session_number}</div>
                    <div className="flex-1 min-w-0"><div className="flex items-center justify-between"><div className="font-bold text-white text-xs truncate">{s.name}</div><div className="text-[9px] text-amber-400 flex items-center gap-1 flex-shrink-0 ml-2"><Clock className="w-2.5 h-2.5" />{s.duration_mins}m</div></div>{s.description && <p className="text-[10px] text-white/40 mt-0.5">{s.description}</p>}</div>
                  </div>
                ))}
              </div>
              {preparedGoal.source === 'catalogue' && <p className="text-center text-[10px] text-white/30 mt-3">This pattern repeats each week</p>}
            </div>
          )}
        </div>

        {step !== 'choose_type' && (
          <div className="p-4 flex-shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'rgba(20, 15, 10, 0.95)', borderTop: '1px solid rgba(255, 200, 100, 0.2)' }}>
            {step === 'ai_chat' && <div className="flex gap-2"><input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiSend()} placeholder="Message..." disabled={aiProcessing} className="flex-1 px-3 py-2 rounded-full text-sm focus:outline-none disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,200,100,0.3)', color: 'white' }} /><button onClick={handleAiSend} disabled={!aiInput.trim() || aiProcessing} className="px-4 py-2 rounded-full disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)', color: 'white' }}><Send className="w-4 h-4" /></button></div>}
            {(step === 'manual_input' || step === 'session_preview') && <button onClick={step === 'manual_input' ? handleConfirmManual : () => setStep('day_drop')} disabled={step === 'manual_input' && !manualName.trim()} className="w-full py-3 rounded-xl font-bold disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #B8860B 0%, #DAA520 100%)', color: '#1a1510' }}>{step === 'session_preview' ? '📅 Pick Days →' : 'Continue →'}</button>}
          </div>
        )}
      </div>
    </div>
  );
}