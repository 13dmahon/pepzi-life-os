// components/goals/GoalPlanHeroCard.tsx
// Merged component: Schedule Picker + Plan Preview + Milestones
'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Target,
  Flame,
  ChevronLeft,
  Edit3,
  Check,
  X,
  Zap,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  GripVertical,
  RotateCcw,
  MessageSquare,
  Briefcase,
  Car,
  Plus,
  MapPin,
  Trophy,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface Session {
  id?: string;
  name: string;
  description: string;
  duration_mins: number;
  notes?: string;
}

interface WeekPreview {
  week_number: number;
  focus: string;
  sessions: Session[];
}

interface Milestone {
  name: string;
  target_week: number;
  criteria?: string;
}

interface TimeSlot {
  hour: number;
  minute: number;
  available: boolean;
  availableMinutes: number; // NEW: How many minutes are free in this hour
  firstAvailableMinute: number; // NEW: First available minute to start a session
  blocked_by?: string;
  blocked_label?: string;
  partiallyBlocked?: boolean; // NEW: Hour has some blocks but still has room
}

interface DaySchedule {
  day: string;
  date: Date;
  slots: TimeSlot[];
}

interface PlacedSession {
  day: string;
  hour: number;
  minute: number;
  duration_mins: number;
  session_name: string;
}

interface UserAvailability {
  wake_time: string;
  sleep_time: string;
  work_schedule?: Record<string, { start: string; end: string }>;
  daily_commute_mins?: number;
}

interface ExistingBlock {
  id: string;
  goal_id?: string;
  goal_name?: string;
  type: string;
  scheduled_start: string;
  duration_mins: number;
}

type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'any';
type TabType = 'schedule' | 'sessions' | 'milestones';

interface GoalPlanData {
  goal: {
    name: string;
    category: string;
    target_date: string;
    success_condition?: string;
  };
  plan: {
    weekly_hours: number;
    sessions_per_week: number;
    session_duration_mins: number;
    total_weeks: number;
    total_hours: number;
  };
  preview: {
    week1?: WeekPreview;
    midWeek?: WeekPreview;
    finalWeek?: WeekPreview;
  };
  milestones: Milestone[];
}

interface FitCheckData {
  fits: boolean;
  available_hours: number;
  needed_hours: number;
  existing_goal_hours?: number;
  message: string;
  availability: UserAvailability;
  existing_blocks: ExistingBlock[];
}

interface GoalPlanHeroCardProps {
  data: GoalPlanData;
  fitCheck: FitCheckData;
  onConfirm: (result: {
    placedSessions: PlacedSession[];
    preferredDays: string[];
    preferredTime: PreferredTime;
    sessionEdits: Record<string, Partial<Session>>;
  }) => void;
  onRequestChanges: (feedback: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const CATEGORY_COLORS: Record<string, { 
  gradient: string; bg: string; bgLight: string; text: string; border: string;
}> = {
  fitness: { gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  running: { gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  climbing: { gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-500', bgLight: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  languages: { gradient: 'from-blue-500 to-indigo-500', bg: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  business: { gradient: 'from-purple-500 to-violet-500', bg: 'bg-purple-500', bgLight: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  creative: { gradient: 'from-pink-500 to-rose-500', bg: 'bg-pink-500', bgLight: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  mental_health: { gradient: 'from-cyan-500 to-teal-500', bg: 'bg-cyan-500', bgLight: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  skill: { gradient: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-500', bgLight: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  career: { gradient: 'from-slate-600 to-gray-700', bg: 'bg-slate-600', bgLight: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  education: { gradient: 'from-amber-500 to-yellow-500', bg: 'bg-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  health: { gradient: 'from-rose-500 to-pink-500', bg: 'bg-rose-500', bgLight: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const TAB_CONFIG: Record<TabType, { label: string; icon: React.ReactNode }> = {
  schedule: { label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
  sessions: { label: 'Sessions', icon: <Zap className="w-4 h-4" /> },
  milestones: { label: 'Milestones', icon: <Trophy className="w-4 h-4" /> },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getCategoryStyle = (category: string) => CATEGORY_COLORS[category] || CATEGORY_COLORS.skill;

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const parseTime = (timeStr: string): { hour: number; minute: number } => {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
};

const formatTimeDisplay = (hour: number, minute: number = 0): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
};

const getWeekDates = (): Date[] => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
};

const getSafeWeek = (
  week: WeekPreview | undefined, 
  weekNumber: number, 
  focus: string, 
  sessionsPerWeek: number, 
  weeklyHours: number
): WeekPreview => {
  if (week?.sessions?.length) return week;
  return {
    week_number: weekNumber,
    focus,
    sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
      name: `Training Session ${i + 1}`,
      description: 'Focus on consistency and gradual progress',
      duration_mins: Math.round((weeklyHours * 60) / sessionsPerWeek),
      notes: 'Adjust intensity based on how you feel',
    })),
  };
};

const derivePreferredTime = (placedSessions: PlacedSession[]): PreferredTime => {
  if (placedSessions.length === 0) return 'any';
  const avgHour = placedSessions.reduce((sum, s) => sum + s.hour, 0) / placedSessions.length;
  if (avgHour < 12) return 'morning';
  if (avgHour < 17) return 'afternoon';
  return 'evening';
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

// ------------------------------------------------------------
// Schedule Picker Tab
// ------------------------------------------------------------

interface SchedulePickerTabProps {
  weekSchedule: DaySchedule[];
  weekDates: Date[];
  placedSessions: PlacedSession[];
  sessionsPerWeek: number;
  sessionDuration: number;
  colors: ReturnType<typeof getCategoryStyle>;
  onPlaceSession: (day: string, hour: number, minute: number) => void;
  onRemoveSession: (index: number) => void;
  onAutoPlace: () => void;
  fitCheck: FitCheckData;
}

function SchedulePickerTab({
  weekSchedule,
  weekDates,
  placedSessions,
  sessionsPerWeek,
  sessionDuration,
  colors,
  onPlaceSession,
  onRemoveSession,
  onAutoPlace,
  fitCheck,
}: SchedulePickerTabProps) {
  const sessionsRemaining = sessionsPerWeek - placedSessions.length;

  return (
    <div className="space-y-4">
      {/* Fit Warning */}
      {!fitCheck.fits && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800 text-sm sm:text-base">Schedule might be tight</div>
            <div className="text-xs sm:text-sm text-amber-700 mt-1">{fitCheck.message}</div>
          </div>
        </motion.div>
      )}

      {/* Session Counter & Auto-place - Mobile optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1 sm:gap-1.5 flex-wrap">
            {Array.from({ length: sessionsPerWeek }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8 }}
                animate={{ scale: i < placedSessions.length ? 1.1 : 1 }}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < placedSessions.length
                    ? `${colors.bg} text-white shadow-md`
                    : 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300'
                }`}
              >
                {i + 1}
              </motion.div>
            ))}
          </div>
          <span className="text-xs sm:text-sm text-gray-600">
            {sessionsRemaining > 0 ? `${sessionsRemaining} more` : '✓ Done!'}
          </span>
        </div>
        
        <button
          onClick={onAutoPlace}
          className={`text-sm font-medium flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${colors.bg} text-white sm:${colors.text} sm:bg-transparent sm:hover:${colors.bgLight}`}
        >
          <Zap className="w-4 h-4" />
          Auto-place
        </button>
      </div>

      {/* Session duration info */}
      <div className="text-xs text-gray-500 px-1">
        Each session: {sessionDuration} minutes • Scroll → to see all days
      </div>

      {/* Week Grid - Better mobile scroll */}
      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="grid grid-cols-8 gap-0.5 sm:gap-1 min-w-[580px]">
          {/* Header Row */}
          <div className="text-center text-[10px] sm:text-xs text-gray-400 font-medium py-1 sm:py-2">Time</div>
          {DAYS.map((day, i) => {
            const date = weekDates[i];
            const isToday = date.toDateString() === new Date().toDateString();
            const sessionsOnDay = placedSessions.filter(s => s.day === day).length;
            
            return (
              <div
                key={day}
                className={`text-center py-1 sm:py-2 rounded-t-lg transition-colors ${isToday ? `${colors.bgLight}` : ''}`}
              >
                <div className={`text-[10px] sm:text-xs font-semibold ${isToday ? colors.text : 'text-gray-500'}`}>
                  {DAY_LABELS[day]}
                </div>
                <div className={`text-sm sm:text-base font-bold ${isToday ? colors.text : 'text-gray-800'}`}>
                  {date.getDate()}
                </div>
                {sessionsOnDay > 0 && (
                  <div className={`text-[10px] sm:text-xs font-medium ${colors.text}`}>
                    {sessionsOnDay}
                  </div>
                )}
              </div>
            );
          })}

          {/* Time Slots */}
          {weekSchedule[0]?.slots.map((_, slotIndex) => {
            const hour = weekSchedule[0].slots[slotIndex].hour;
            
            return (
              <React.Fragment key={hour}>
                <div className="text-[10px] sm:text-xs text-gray-400 text-right pr-1 sm:pr-2 py-2 sm:py-3 font-medium">
                  {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'p' : 'a'}
                </div>
                
                {weekSchedule.map(daySchedule => {
                  const slot = daySchedule.slots[slotIndex];
                  const placedIndex = placedSessions.findIndex(
                    s => s.day === daySchedule.day && s.hour === hour
                  );
                  const isPlaced = placedIndex >= 0;
                  
                  // Check if this slot can fit the session
                  const canFitSession = slot.availableMinutes >= sessionDuration;
                  const isAvailable = slot.available || (slot.partiallyBlocked && canFitSession);
                  
                  return (
                    <motion.div
                      key={`${daySchedule.day}-${hour}`}
                      whileHover={isAvailable && !isPlaced ? { scale: 1.02 } : {}}
                      whileTap={isAvailable ? { scale: 0.95 } : {}}
                      onClick={() => {
                        if (isPlaced) {
                          onRemoveSession(placedIndex);
                        } else if (isAvailable && sessionsRemaining > 0) {
                          onPlaceSession(daySchedule.day, hour, slot.firstAvailableMinute);
                        }
                      }}
                      className={`
                        h-9 sm:h-11 rounded-md sm:rounded-lg border sm:border-2 transition-all cursor-pointer
                        flex items-center justify-center text-[10px] sm:text-xs font-medium relative
                        ${isPlaced
                          ? `${colors.bg} border-transparent text-white shadow-md`
                          : isAvailable
                            ? slot.partiallyBlocked
                              ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100 hover:border-amber-300 text-amber-600'
                              : 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 text-emerald-600'
                            : slot.blocked_by === 'work'
                              ? 'bg-blue-50 border-blue-100 text-blue-500'
                              : slot.blocked_by === 'commute'
                                ? 'bg-gray-50 border-gray-100 text-gray-400'
                                : slot.blocked_by?.startsWith('goal:')
                                  ? 'bg-purple-50 border-purple-100 text-purple-500'
                                  : 'bg-gray-50 border-gray-100 text-gray-300'
                        }
                      `}
                    >
                      {isPlaced ? (
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          <span>S{placedIndex + 1}</span>
                          <X className="w-3 h-3 ml-0.5 opacity-60 hover:opacity-100" />
                        </div>
                      ) : isAvailable ? (
                        sessionsRemaining > 0 ? (
                          <div className="flex flex-col items-center">
                            <Plus className="w-4 h-4 opacity-40" />
                            {slot.partiallyBlocked && slot.firstAvailableMinute > 0 && (
                              <span className="text-[10px] opacity-60">:{slot.firstAvailableMinute.toString().padStart(2, '0')}</span>
                            )}
                          </div>
                        ) : null
                      ) : (
                        <span className="flex items-center gap-1 opacity-60">
                          {slot.blocked_by === 'work' && <Briefcase className="w-3 h-3" />}
                          {slot.blocked_by === 'commute' && <Car className="w-3 h-3" />}
                          {slot.blocked_by?.startsWith('goal:') && <Target className="w-3 h-3" />}
                          {slot.blocked_by === 'partial' && <span className="text-[10px]">{slot.availableMinutes}m</span>}
                        </span>
                      )}
                      
                      {/* Partial availability indicator */}
                      {slot.partiallyBlocked && !isPlaced && slot.availableMinutes > 0 && slot.availableMinutes < 60 && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-1 bg-purple-300 rounded-b"
                          style={{ width: `${((60 - slot.availableMinutes) / 60) * 100}%` }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Placed Sessions Pills - Mobile optimized */}
      <AnimatePresence>
        {placedSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 border-t"
          >
            <div className="text-xs font-medium text-gray-500 mb-2">Your sessions:</div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {placedSessions.map((session, i) => (
                <motion.div
                  key={`${session.day}-${session.hour}-${session.minute}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className={`${colors.bg} text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 shadow-sm`}
                >
                  <span className="capitalize">{session.day.slice(0, 3)}</span>
                  <span className="opacity-80">•</span>
                  <span>{session.hour > 12 ? session.hour - 12 : session.hour}:{session.minute.toString().padStart(2, '0')}{session.hour >= 12 ? 'pm' : 'am'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveSession(i); }}
                    className="ml-0.5 hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend - Mobile optimized */}
      <div className="flex flex-wrap gap-2 sm:gap-4 pt-3 border-t text-[10px] sm:text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-emerald-50 border border-emerald-200" />
          <span>Free</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded ${colors.bg}`} />
          <span>Yours</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-blue-50 border border-blue-100" />
          <span>Work</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-purple-50 border border-purple-100" />
          <span>Goals</span>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Editable Session Component
// ------------------------------------------------------------

interface EditableSessionProps {
  session: Session;
  weekLabel: string;
  onEdit: (updates: Partial<Session>) => void;
  colors: ReturnType<typeof getCategoryStyle>;
  badge?: { label: string; color: string };
}

function EditableSession({ session, weekLabel, onEdit, colors, badge }: EditableSessionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(session.name);
  const [editedDescription, setEditedDescription] = useState(session.description);
  const [editedDuration, setEditedDuration] = useState(session.duration_mins);

  const handleSave = () => {
    onEdit({ name: editedName, description: editedDescription, duration_mins: editedDuration });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border-2 border-violet-400 rounded-xl p-3 sm:p-4 bg-violet-50/50 shadow-lg"
      >
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Editing</span>
          <button
            onClick={() => { setEditedName(session.name); setEditedDescription(session.description); setEditedDuration(session.duration_mins); }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Session Name</label>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none resize-none"
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Duration</label>
              <span className="text-sm font-bold text-violet-600">{editedDuration} min</span>
            </div>
            <input
              type="range"
              min={10}
              max={180}
              step={5}
              value={editedDuration}
              onChange={(e) => setEditedDuration(Number(e.target.value))}
              className="w-full accent-violet-500 h-2"
            />
          </div>
          
          <div className="flex gap-2 pt-1">
            <button onClick={() => setIsEditing(false)} className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSave} className="flex-1 px-3 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 flex items-center justify-center gap-1">
              <Check className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`${colors.bgLight} rounded-xl p-3 sm:p-4 border ${colors.border} group relative hover:shadow-md transition-all cursor-pointer`}
    >
      <div className="absolute top-2 right-2 p-1 sm:p-1.5 bg-white/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
        <Edit3 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
      </div>
      
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="p-1 sm:p-1.5 bg-white/70 rounded-lg mt-0.5 hidden sm:block">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">{weekLabel}</span>
            {badge && (
              <span className={`px-1 sm:px-1.5 py-0.5 ${badge.color} text-[10px] sm:text-xs rounded font-medium`}>
                {badge.label}
              </span>
            )}
          </div>
          
          <h4 className={`font-semibold ${colors.text} mb-1 text-sm sm:text-base`}>{session.name}</h4>
          <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">{session.description}</p>
          
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white rounded-lg text-[10px] sm:text-xs font-medium text-gray-700 shadow-sm">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
              {session.duration_mins}m
            </span>
            {session.notes && (
              <span className="text-[10px] sm:text-xs text-amber-700 bg-amber-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg line-clamp-1">
                💡 {session.notes}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Sessions Tab
// ------------------------------------------------------------

interface SessionsTabProps {
  safePreview: { week1: WeekPreview; midWeek: WeekPreview; finalWeek: WeekPreview };
  sessionEdits: Record<string, Partial<Session>>;
  onSessionEdit: (sessionId: string, updates: Partial<Session>) => void;
  colors: ReturnType<typeof getCategoryStyle>;
}

function SessionsTab({ safePreview, sessionEdits, onSessionEdit, colors }: SessionsTabProps) {
  const getEditedSession = (session: Session, weekLabel: string, index: number): Session => {
    const id = session.id || `${weekLabel}-${index}`;
    return { ...session, id, ...sessionEdits[id] };
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-violet-900 mb-0.5 sm:mb-1 text-sm sm:text-base">Customize Your Sessions</div>
            <div className="text-xs sm:text-sm text-violet-700">
              Tap any session to edit name, description, or duration.
            </div>
          </div>
        </div>
      </div>

      {/* Week 1 */}
      <div>
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white text-xs font-bold`}>
            1
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Week 1</h3>
            <p className="text-xs text-gray-500 line-clamp-1">{safePreview.week1.focus}</p>
          </div>
        </div>
        <div className="space-y-2 pl-8 sm:pl-9">
          {safePreview.week1.sessions.map((session, idx) => (
            <EditableSession
              key={session.id || `w1-${idx}`}
              session={getEditedSession(session, 'w1', idx)}
              weekLabel="Week 1"
              onEdit={(updates) => onSessionEdit(session.id || `w1-${idx}`, updates)}
              colors={colors}
              badge={idx === 0 ? { label: 'Start', color: 'bg-blue-100 text-blue-700' } : undefined}
            />
          ))}
        </div>
      </div>

      {/* Progression */}
      <div className="flex items-center gap-2 text-gray-400 py-1">
        <div className="h-px flex-1 bg-gray-200" />
        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
        <span className="text-[10px] sm:text-xs font-medium">Progression</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Mid Week */}
      <div>
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white text-xs font-bold`}>
            {safePreview.midWeek.week_number}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Week {safePreview.midWeek.week_number}</h3>
            <p className="text-xs text-gray-500 line-clamp-1">{safePreview.midWeek.focus}</p>
          </div>
        </div>
        <div className="space-y-2 pl-8 sm:pl-9">
          {safePreview.midWeek.sessions.map((session, idx) => (
            <EditableSession
              key={session.id || `mid-${idx}`}
              session={getEditedSession(session, 'mid', idx)}
              weekLabel={`Week ${safePreview.midWeek.week_number}`}
              onEdit={(updates) => onSessionEdit(session.id || `mid-${idx}`, updates)}
              colors={colors}
            />
          ))}
        </div>
      </div>

      {/* Peak Phase */}
      <div className="flex items-center gap-2 text-gray-400 py-1">
        <div className="h-px flex-1 bg-gray-200" />
        <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400" />
        <span className="text-[10px] sm:text-xs font-medium">Peak Phase</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Final Week */}
      <div>
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
            {safePreview.finalWeek.week_number}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Week {safePreview.finalWeek.week_number}</h3>
            <p className="text-xs text-gray-500 line-clamp-1">{safePreview.finalWeek.focus}</p>
          </div>
        </div>
        <div className="space-y-2 pl-8 sm:pl-9">
          {safePreview.finalWeek.sessions.map((session, idx) => (
            <EditableSession
              key={session.id || `final-${idx}`}
              session={getEditedSession(session, 'final', idx)}
              weekLabel={`Week ${safePreview.finalWeek.week_number}`}
              onEdit={(updates) => onSessionEdit(session.id || `final-${idx}`, updates)}
              colors={colors}
              badge={idx === safePreview.finalWeek.sessions.length - 1 ? { label: 'Peak', color: 'bg-green-100 text-green-700' } : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Milestones Tab
// ------------------------------------------------------------

interface MilestonesTabProps {
  milestones: Milestone[];
  totalWeeks: number;
  colors: ReturnType<typeof getCategoryStyle>;
}

function MilestonesTab({ milestones, totalWeeks, colors }: MilestonesTabProps) {
  if (!milestones?.length) {
    return (
      <div className="text-center py-8 sm:py-12 text-gray-500">
        <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
        <p className="text-sm sm:text-base">No milestones defined yet.</p>
        <p className="text-xs sm:text-sm mt-1">Your coach will add milestones as you progress.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[14px] sm:left-[18px] top-8 sm:top-10 bottom-8 sm:bottom-10 w-0.5 bg-gradient-to-b from-violet-300 via-violet-400 to-emerald-400" />
      
      <div className="space-y-4 sm:space-y-5">
        {/* Start */}
        <div className="relative flex items-center gap-3 sm:gap-4">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center z-10">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-violet-500" />
          </div>
          <div>
            <div className="font-medium text-gray-900 text-sm sm:text-base">Start</div>
            <div className="text-xs text-gray-500">Week 1</div>
          </div>
        </div>

        {/* Milestones */}
        {milestones.map((milestone, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex items-start gap-3 sm:gap-4"
          >
            <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white text-xs sm:text-sm font-bold z-10 shadow-md flex-shrink-0`}>
              {milestone.target_week}
            </div>
            <div className="flex-1 min-w-0 bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100">
              <div className={`font-semibold ${colors.text} mb-0.5 sm:mb-1 text-sm sm:text-base`}>{milestone.name}</div>
              {milestone.criteria && (
                <div className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2 line-clamp-2">{milestone.criteria}</div>
              )}
              <div className="text-[10px] sm:text-xs text-violet-600 font-medium">
                Week {milestone.target_week} of {totalWeeks}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Goal Achieved */}
        <div className="relative flex items-center gap-3 sm:gap-4">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-emerald-500 flex items-center justify-center z-10 shadow-md">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="font-medium text-emerald-700 text-sm sm:text-base">Goal Achieved! 🎉</div>
            <div className="text-xs text-gray-500">Week {totalWeeks}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function GoalPlanHeroCard({
  data,
  fitCheck,
  onConfirm,
  onRequestChanges,
  onCancel,
  isLoading = false,
}: GoalPlanHeroCardProps) {
  const colors = getCategoryStyle(data.goal.category);
  const weekDates = useMemo(() => getWeekDates(), []);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [placedSessions, setPlacedSessions] = useState<PlacedSession[]>([]);
  const [sessionEdits, setSessionEdits] = useState<Record<string, Partial<Session>>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Derived
  const sessionsPerWeek = data.plan.sessions_per_week;
  const sessionDuration = data.plan.session_duration_mins || Math.round((data.plan.weekly_hours * 60) / sessionsPerWeek);
  const canConfirm = placedSessions.length === sessionsPerWeek;

  // Safe preview
  const safePreview = useMemo(() => {
    const totalWeeks = data.plan.total_weeks || 8;
    const midWeekNum = Math.ceil(totalWeeks / 2);
    return {
      week1: getSafeWeek(data.preview?.week1, 1, 'Foundation & Habit Building', sessionsPerWeek, data.plan.weekly_hours),
      midWeek: getSafeWeek(data.preview?.midWeek, midWeekNum, 'Progressive Development', sessionsPerWeek, data.plan.weekly_hours),
      finalWeek: getSafeWeek(data.preview?.finalWeek, totalWeeks, 'Peak Performance', sessionsPerWeek, data.plan.weekly_hours),
    };
  }, [data.preview, data.plan, sessionsPerWeek]);

  // Build week schedule with minute-level granularity
  const weekSchedule = useMemo(() => {
    const availability = fitCheck.availability;
    const existingBlocks = fitCheck.existing_blocks || [];
    const wake = parseTime(availability?.wake_time || '07:00');
    const sleep = parseTime(availability?.sleep_time || '23:00');

    return DAYS.map((day, dayIndex) => {
      const date = weekDates[dayIndex];
      const slots: TimeSlot[] = [];

      for (let hour = wake.hour; hour < sleep.hour; hour++) {
        // Track minute-by-minute availability within this hour
        const minuteAvailability = Array(60).fill(true); // All 60 minutes start available
        let blocked_by: string | undefined;
        let blocked_label: string | undefined;

        // Work schedule - blocks entire hours
        const workDay = availability?.work_schedule?.[day];
        if (workDay) {
          const workStart = parseTime(workDay.start);
          const workEnd = parseTime(workDay.end);
          
          if (hour >= workStart.hour && hour < workEnd.hour) {
            minuteAvailability.fill(false);
            blocked_by = 'work';
            blocked_label = 'Work';
          }

          // Commute
          const commuteMins = availability?.daily_commute_mins || 0;
          const commuteHours = Math.ceil(commuteMins / 60);
          if (hour >= workStart.hour - commuteHours && hour < workStart.hour) {
            minuteAvailability.fill(false);
            blocked_by = 'commute';
            blocked_label = 'Commute';
          }
          if (hour >= workEnd.hour && hour < workEnd.hour + commuteHours) {
            minuteAvailability.fill(false);
            blocked_by = 'commute';
            blocked_label = 'Commute';
          }
        }

        // Existing blocks - mark specific minutes as blocked
        existingBlocks.forEach(block => {
          const blockDate = new Date(block.scheduled_start);
          const blockDay = DAYS[blockDate.getDay() === 0 ? 6 : blockDate.getDay() - 1];
          
          if (blockDay === day) {
            const blockHour = blockDate.getHours();
            const blockMinute = blockDate.getMinutes();
            const blockEndMinutes = blockHour * 60 + blockMinute + block.duration_mins;
            const hourStartMinutes = hour * 60;
            const hourEndMinutes = (hour + 1) * 60;
            
            // Check if this block overlaps with this hour
            if (blockHour * 60 + blockMinute < hourEndMinutes && blockEndMinutes > hourStartMinutes) {
              // Calculate which minutes within this hour are blocked
              const overlapStart = Math.max(0, (blockHour * 60 + blockMinute) - hourStartMinutes);
              const overlapEnd = Math.min(60, blockEndMinutes - hourStartMinutes);
              
              for (let m = overlapStart; m < overlapEnd; m++) {
                minuteAvailability[m] = false;
              }
              
              blocked_by = `goal:${block.goal_id || block.id}`;
              blocked_label = block.goal_name || 'Other Goal';
            }
          }
        });

        // Also check already placed sessions
        placedSessions.forEach(session => {
          if (session.day === day) {
            const sessionStartMinutes = session.hour * 60 + session.minute;
            const sessionEndMinutes = sessionStartMinutes + session.duration_mins;
            const hourStartMinutes = hour * 60;
            const hourEndMinutes = (hour + 1) * 60;
            
            if (sessionStartMinutes < hourEndMinutes && sessionEndMinutes > hourStartMinutes) {
              const overlapStart = Math.max(0, sessionStartMinutes - hourStartMinutes);
              const overlapEnd = Math.min(60, sessionEndMinutes - hourStartMinutes);
              
              for (let m = overlapStart; m < overlapEnd; m++) {
                minuteAvailability[m] = false;
              }
            }
          }
        });

        // Calculate available minutes and first available minute
        let availableMinutes = 0;
        let firstAvailableMinute = -1;
        let longestContiguousBlock = 0;
        let currentContiguous = 0;
        let contiguousStart = -1;
        let bestContiguousStart = 0;

        for (let m = 0; m < 60; m++) {
          if (minuteAvailability[m]) {
            availableMinutes++;
            if (firstAvailableMinute === -1) firstAvailableMinute = m;
            
            if (contiguousStart === -1) contiguousStart = m;
            currentContiguous++;
            
            if (currentContiguous > longestContiguousBlock) {
              longestContiguousBlock = currentContiguous;
              bestContiguousStart = contiguousStart;
            }
          } else {
            currentContiguous = 0;
            contiguousStart = -1;
          }
        }

        // Determine availability status
        const fullyAvailable = availableMinutes === 60;
        const partiallyBlocked = availableMinutes > 0 && availableMinutes < 60;
        const fullyBlocked = availableMinutes === 0;

        slots.push({
          hour,
          minute: 0,
          available: fullyAvailable,
          availableMinutes: longestContiguousBlock, // Use longest contiguous block
          firstAvailableMinute: bestContiguousStart >= 0 ? bestContiguousStart : 0,
          blocked_by: fullyBlocked ? blocked_by : (partiallyBlocked ? 'partial' : undefined),
          blocked_label,
          partiallyBlocked,
        });
      }

      return { day, date, slots };
    });
  }, [fitCheck.availability, fitCheck.existing_blocks, weekDates, placedSessions]);

  // Handlers - updated to include minute
  const handlePlaceSession = (day: string, hour: number, minute: number) => {
    if (placedSessions.length >= sessionsPerWeek) return;
    setPlacedSessions(prev => [
      ...prev,
      { day, hour, minute, duration_mins: sessionDuration, session_name: `Session ${prev.length + 1}` },
    ]);
  };

  const handleRemoveSession = (index: number) => {
    setPlacedSessions(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoPlace = () => {
    const available: { day: string; hour: number; minute: number }[] = [];
    weekSchedule.forEach(daySchedule => {
      daySchedule.slots.forEach(slot => {
        // Check if this slot can fit the session
        if (slot.availableMinutes >= sessionDuration) {
          available.push({ day: daySchedule.day, hour: slot.hour, minute: slot.firstAvailableMinute });
        }
      });
    });

    // Distribute across different days
    const daysUsed = new Set<string>();
    const sessions: PlacedSession[] = [];
    
    // First pass: one per day
    for (const slot of available) {
      if (sessions.length >= sessionsPerWeek) break;
      if (!daysUsed.has(slot.day)) {
        sessions.push({
          day: slot.day,
          hour: slot.hour,
          minute: slot.minute,
          duration_mins: sessionDuration,
          session_name: `Session ${sessions.length + 1}`,
        });
        daysUsed.add(slot.day);
      }
    }

    // Second pass: fill remaining if needed
    for (const slot of available) {
      if (sessions.length >= sessionsPerWeek) break;
      const alreadyHas = sessions.some(s => s.day === slot.day && s.hour === slot.hour);
      if (!alreadyHas) {
        sessions.push({
          day: slot.day,
          hour: slot.hour,
          minute: slot.minute,
          duration_mins: sessionDuration,
          session_name: `Session ${sessions.length + 1}`,
        });
      }
    }

    setPlacedSessions(sessions);
  };

  const handleSessionEdit = (sessionId: string, updates: Partial<Session>) => {
    setSessionEdits(prev => ({ ...prev, [sessionId]: { ...prev[sessionId], ...updates } }));
  };

  const handleConfirm = () => {
    const preferredDays = [...new Set(placedSessions.map(s => s.day))];
    const preferredTime = derivePreferredTime(placedSessions);
    onConfirm({ placedSessions, preferredDays, preferredTime, sessionEdits });
  };

  const handleRequestChanges = () => {
    if (feedback.trim()) {
      onRequestChanges(feedback);
      setFeedback('');
      setShowFeedback(false);
    }
  };

  // Render
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
    >
      {/* ============ HEADER ============ */}
      <div className={`bg-gradient-to-r ${colors.gradient} p-4 sm:p-5 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium opacity-90">Your Training Plan</span>
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 truncate">{data.goal.name}</h2>
            {data.goal.success_condition && (
              <p className="text-xs sm:text-sm opacity-90 mb-3 line-clamp-2">🎯 {data.goal.success_condition}</p>
            )}
            
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 sm:py-1 rounded-full">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">{formatDate(data.goal.target_date)}</span>
                <span className="sm:hidden">{new Date(data.goal.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </span>
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 sm:py-1 rounded-full">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {data.plan.weekly_hours}h/wk
              </span>
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 sm:py-1 rounded-full">
                <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {data.plan.total_weeks}wk
              </span>
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 sm:py-1 rounded-full">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {sessionsPerWeek}×{sessionDuration}m
              </span>
            </div>
          </div>
          
          <button onClick={onCancel} className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex">
          {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => {
            const { label, icon } = TAB_CONFIG[tab];
            const isActive = activeTab === tab;
            const hasIndicator = tab === 'sessions' && Object.keys(sessionEdits).length > 0;
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium transition-colors relative flex items-center justify-center gap-1 sm:gap-1.5 ${
                  isActive ? colors.text : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {icon}
                <span className="hidden xs:inline">{label}</span>
                {hasIndicator && (
                  <span className={`ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 ${colors.bgLight} ${colors.text} text-[10px] sm:text-xs rounded-full`}>
                    {Object.keys(sessionEdits).length}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.bg}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ CONTENT ============ */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SchedulePickerTab
                weekSchedule={weekSchedule}
                weekDates={weekDates}
                placedSessions={placedSessions}
                sessionsPerWeek={sessionsPerWeek}
                sessionDuration={sessionDuration}
                colors={colors}
                onPlaceSession={handlePlaceSession}
                onRemoveSession={handleRemoveSession}
                onAutoPlace={handleAutoPlace}
                fitCheck={fitCheck}
              />
            </motion.div>
          )}

          {activeTab === 'sessions' && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SessionsTab
                safePreview={safePreview}
                sessionEdits={sessionEdits}
                onSessionEdit={handleSessionEdit}
                colors={colors}
              />
            </motion.div>
          )}

          {activeTab === 'milestones' && (
            <motion.div
              key="milestones"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <MilestonesTab
                milestones={data.milestones}
                totalWeeks={data.plan.total_weeks}
                colors={colors}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Request Changes */}
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 sm:mt-6 bg-blue-50 rounded-xl p-3 sm:p-4 border border-blue-200"
          >
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              <h4 className="font-bold text-blue-900 text-sm sm:text-base">Request Changes</h4>
            </div>
            <p className="text-xs sm:text-sm text-blue-700 mb-2 sm:mb-3">
              Tell me what&apos;s not quite right and I&apos;ll adjust the plan.
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe what you'd like changed..."
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none bg-white"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-2 sm:mt-3">
              <button
                onClick={() => { setShowFeedback(false); setFeedback(''); }}
                className="px-3 py-1.5 sm:py-2 text-gray-600 hover:bg-blue-100 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={!feedback.trim()}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                Send
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ============ FOOTER ============ */}
      <div className="p-3 sm:p-4 border-t bg-gray-50 space-y-2 sm:space-y-0 sm:flex sm:flex-row sm:items-center sm:gap-3">
        {/* Mobile: Stack buttons vertically */}
        <div className="flex gap-2 sm:contents">
          <button
            onClick={onCancel}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-1 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Start Over</span>
            <span className="sm:hidden">Back</span>
          </button>

          {!showFeedback && (
            <button
              onClick={() => setShowFeedback(true)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 hover:bg-white rounded-xl font-medium transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Something&apos;s Wrong</span>
              <span className="sm:hidden">Edit</span>
            </button>
          )}
        </div>

        <div className="hidden sm:block sm:flex-1" />

        {/* Session placement status - visible on mobile too */}
        <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left pb-1 sm:pb-0">
          {placedSessions.length}/{sessionsPerWeek} sessions placed
        </div>

        <button
          onClick={handleConfirm}
          disabled={!canConfirm || isLoading}
          className={`w-full sm:w-auto px-4 sm:px-6 py-3 bg-gradient-to-r ${colors.gradient} text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base`}
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>Creating...</span>
            </>
          ) : !canConfirm ? (
            <>
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Place {sessionsPerWeek - placedSessions.length} More</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Create Plan</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}