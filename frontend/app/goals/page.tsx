'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { 
  Target, 
  Plus, 
  Calendar, 
  Trash2, 
  Loader2,
  ChevronRight,
  CheckCircle2,
  Play,
  Lock,
  Trophy,
  Flame,
  X,
} from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import GoalDetailView from '@/components/goals/GoalDetailView';
import type { Goal } from '@/lib/api';
import {
  GlassCard,
  GlassButton,
  GlassIconBox,
  WallpaperBackground,
} from '@/components/ui/GlassUI';

// ============================================================
// TYPES
// ============================================================

interface GoalSession {
  id: string;
  scheduled_start: string;
  completed_at?: string;
  status: string;
  duration_mins: number;
}

interface GoalActivity {
  sessions: GoalSession[];
  completedCount: number;
  totalCount: number;
  currentStreak: number;
}

// ============================================================
// CATEGORY EMOJI MAPPING
// ============================================================

const categoryEmojis: Record<string, string> = {
  fitness: '🏃',
  climbing: '🧗',
  languages: '🌍',
  business: '💼',
  creative: '🎨',
  mental_health: '🧘',
  skill: '🎯',
  education: '📚',
  health: '❤️',
  music: '🎸',
  cooking: '👨‍🍳',
  writing: '✍️',
  coding: '💻',
  photography: '📷',
  travel: '✈️',
  finance: '💰',
  social: '🤝',
  sports: '⚽',
  gaming: '🎮',
  art: '🖼️',
  dance: '💃',
  meditation: '🧘‍♂️',
  yoga: '🧘‍♀️',
  swimming: '🏊',
  cycling: '🚴',
  running: '🏃‍♂️',
  weightlifting: '🏋️',
  martial_arts: '🥋',
  default: '⭐',
};

const categoryColors: Record<string, { bg: string; ring: string; text: string }> = {
  fitness: { bg: 'bg-emerald-100', ring: 'ring-emerald-500', text: 'text-emerald-600' },
  climbing: { bg: 'bg-orange-100', ring: 'ring-orange-500', text: 'text-orange-600' },
  languages: { bg: 'bg-blue-100', ring: 'ring-blue-500', text: 'text-blue-600' },
  business: { bg: 'bg-purple-100', ring: 'ring-purple-500', text: 'text-purple-600' },
  creative: { bg: 'bg-pink-100', ring: 'ring-pink-500', text: 'text-pink-600' },
  mental_health: { bg: 'bg-cyan-100', ring: 'ring-cyan-500', text: 'text-cyan-600' },
  skill: { bg: 'bg-indigo-100', ring: 'ring-indigo-500', text: 'text-indigo-600' },
  education: { bg: 'bg-sky-100', ring: 'ring-sky-500', text: 'text-sky-600' },
  health: { bg: 'bg-red-100', ring: 'ring-red-500', text: 'text-red-600' },
  music: { bg: 'bg-fuchsia-100', ring: 'ring-fuchsia-500', text: 'text-fuchsia-600' },
  default: { bg: 'bg-slate-100', ring: 'ring-slate-500', text: 'text-slate-600' },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function calculateStreak(sessions: GoalSession[]): number {
  const completedDates = sessions
    .filter(s => s.status === 'completed' && s.completed_at)
    .map(s => new Date(s.completed_at!).toISOString().split('T')[0])
    .sort()
    .reverse();

  if (completedDates.length === 0) return 0;

  const uniqueDates = [...new Set(completedDates)];
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  let streak = 1;
  let currentDate = new Date(uniqueDates[0]);

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const expectedDate = prevDate.toISOString().split('T')[0];

    if (uniqueDates[i] === expectedDate) {
      streak++;
      currentDate = prevDate;
    } else {
      break;
    }
  }

  return streak;
}

function getGoalStatus(goal: Goal, activity: GoalActivity | null): 'completed' | 'in_progress' | 'not_started' {
  if (goal.status === 'completed') return 'completed';
  if (!activity) return 'not_started';
  if (activity.completedCount > 0) return 'in_progress';
  return 'not_started';
}

// ============================================================
// PROGRESS RING COMPONENT
// ============================================================

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
}

function ProgressRing({ progress, size = 100, strokeWidth = 8, color = '#10b981' }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-200"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

// ============================================================
// GOAL BADGE COMPONENT (Pokédex style)
// ============================================================

interface GoalBadgeProps {
  goal: Goal;
  activity: GoalActivity | null;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}

function GoalBadge({ goal, activity, onSelect, onDelete, isDeleting }: GoalBadgeProps) {
  const status = getGoalStatus(goal, activity);
  const completedCount = activity?.completedCount || 0;
  const totalCount = activity?.totalCount || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const streak = activity?.currentStreak || 0;
  
  const emoji = categoryEmojis[goal.category?.toLowerCase()] || categoryEmojis.default;
  const colors = categoryColors[goal.category?.toLowerCase()] || categoryColors.default;

  // Format target date
  const targetDate = goal.target_date 
    ? new Date(goal.target_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;

  return (
    <div
      onClick={onSelect}
      className={`
        relative group cursor-pointer transition-all duration-300
        ${status === 'not_started' ? 'opacity-50 grayscale hover:opacity-70 hover:grayscale-0' : ''}
        ${status === 'completed' ? 'scale-100' : 'hover:scale-105'}
      `}
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(e);
        }}
        disabled={isDeleting}
        className="absolute -top-2 -right-2 z-20 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg disabled:opacity-50"
      >
        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
      </button>

      {/* Badge Container */}
      <div className="flex flex-col items-center">
        {/* Progress Ring + Emoji */}
        <div className="relative">
          {/* Progress ring for in-progress goals */}
          {status === 'in_progress' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ProgressRing 
                progress={progressPercent} 
                size={88} 
                strokeWidth={4}
                color={colors.ring.replace('ring-', '#').replace('-500', '')}
              />
            </div>
          )}
          
          {/* Completed checkmark ring */}
          {status === 'completed' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[88px] h-[88px] rounded-full ring-4 ring-emerald-500 bg-emerald-50" />
            </div>
          )}

          {/* Emoji container */}
          <div 
            className={`
              w-20 h-20 rounded-2xl flex items-center justify-center text-4xl
              ${status === 'completed' ? 'bg-gradient-to-br from-emerald-100 to-green-100' : colors.bg}
              ${status === 'not_started' ? 'bg-slate-200' : ''}
              shadow-lg transition-all
              ${status === 'in_progress' ? 'ring-2 ' + colors.ring : ''}
            `}
          >
            {status === 'not_started' ? (
              <span className="opacity-30 blur-[1px]">{emoji}</span>
            ) : (
              <span>{emoji}</span>
            )}
          </div>

          {/* Completed badge overlay */}
          {status === 'completed' && (
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          )}

          {/* Streak badge */}
          {streak > 0 && status !== 'completed' && (
            <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-orange-500 rounded-full flex items-center gap-0.5 shadow-lg">
              <Flame className="w-3 h-3 text-white" />
              <span className="text-[10px] font-bold text-white">{streak}</span>
            </div>
          )}
        </div>

        {/* Goal name */}
        <p className={`
          mt-2 text-sm font-medium text-center max-w-[100px] truncate
          ${status === 'not_started' ? 'text-slate-400' : 'text-slate-700'}
        `}>
          {goal.name}
        </p>

        {/* Progress or target date */}
        {status === 'in_progress' && (
          <p className="text-xs text-slate-500 mt-0.5">
            {completedCount}/{totalCount} ({progressPercent}%)
          </p>
        )}
        {status === 'completed' && (
          <p className="text-xs text-emerald-600 font-medium mt-0.5">
            Completed! 🎉
          </p>
        )}
        {status === 'not_started' && targetDate && (
          <p className="text-xs text-slate-400 mt-0.5">
            Coming {targetDate}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// GOAL DETAIL MODAL (Quick view)
// ============================================================

interface GoalQuickViewProps {
  goal: Goal;
  activity: GoalActivity | null;
  onClose: () => void;
  onViewFull: () => void;
  onDelete: () => void;
}

function GoalQuickView({ goal, activity, onClose, onViewFull, onDelete }: GoalQuickViewProps) {
  const status = getGoalStatus(goal, activity);
  const completedCount = activity?.completedCount || 0;
  const totalCount = activity?.totalCount || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const emoji = categoryEmojis[goal.category?.toLowerCase()] || categoryEmojis.default;
  const colors = categoryColors[goal.category?.toLowerCase()] || categoryColors.default;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with emoji */}
        <div className={`p-6 ${colors.bg} flex flex-col items-center`}>
          <div className="text-6xl mb-3">{emoji}</div>
          <h2 className="text-xl font-bold text-slate-800 text-center">{goal.name}</h2>
          <span className={`text-sm ${colors.text} capitalize mt-1`}>{goal.category}</span>
        </div>

        {/* Stats */}
        <div className="p-6 space-y-4">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Progress</span>
              <span className="font-medium text-slate-700">{completedCount} / {totalCount} sessions</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${
                  status === 'completed' 
                    ? 'from-emerald-500 to-green-500' 
                    : 'from-blue-500 to-indigo-500'
                } transition-all duration-500`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-right text-sm text-slate-500 mt-1">{progressPercent}% complete</p>
          </div>

          {/* Target date */}
          {goal.target_date && (
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <span className="text-slate-500 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Target
              </span>
              <span className="font-medium text-slate-700">
                {new Date(goal.target_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
          )}

          {/* Status badge */}
          <div className="flex items-center justify-center">
            {status === 'completed' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full">
                <Trophy className="w-4 h-4" />
                <span className="font-medium">Goal Achieved!</span>
              </div>
            )}
            {status === 'in_progress' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full">
                <Play className="w-4 h-4" />
                <span className="font-medium">In Progress</span>
              </div>
            )}
            {status === 'not_started' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-full">
                <Lock className="w-4 h-4" />
                <span className="font-medium">Not Started</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onDelete}
            className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-sm"
          >
            Delete
          </button>
          <button
            onClick={onViewFull}
            className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            View Details
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN GOALS PAGE (Pokédex Style)
// ============================================================

export default function GoalsPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [quickViewGoal, setQuickViewGoal] = useState<Goal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  // Fetch goals
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', userId],
    queryFn: () => goalsAPI.getGoals(userId),
    enabled: !!userId,
  });

  // Fetch sessions for each goal
  const { data: goalActivities } = useQuery({
    queryKey: ['goal-activities', userId, goals.map(g => g.id).join(',')],
    queryFn: async () => {
      const activities: Record<string, GoalActivity> = {};
      
      await Promise.all(
        goals.map(async (goal) => {
          try {
            const scheduleData = await goalsAPI.getGoalSchedule(goal.id);
            const allSessions: GoalSession[] = [];
            
            Object.values(scheduleData.sessions_by_week || {}).forEach((weekSessions: any) => {
              allSessions.push(...weekSessions);
            });
            
            const completedSessions = allSessions.filter(s => s.status === 'completed');
            
            activities[goal.id] = {
              sessions: allSessions,
              completedCount: completedSessions.length,
              totalCount: allSessions.length,
              currentStreak: calculateStreak(allSessions),
            };
          } catch (error) {
            activities[goal.id] = {
              sessions: [],
              completedCount: 0,
              totalCount: 0,
              currentStreak: 0,
            };
          }
        })
      );
      
      return activities;
    },
    enabled: !!userId && goals.length > 0,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (goalId: string) => goalsAPI.deleteGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal-activities'] });
      setQuickViewGoal(null);
    },
  });

  const handleDeleteGoal = async (e: React.MouseEvent | null, goalId: string, goalName: string) => {
    if (e) e.stopPropagation();
    
    const confirmed = window.confirm(
      `Are you sure you want to delete "${goalName}"?\n\nThis will permanently delete the goal and all its training plan data.`
    );

    if (!confirmed) return;

    setDeletingGoalId(goalId);
    try {
      await deleteMutation.mutateAsync(goalId);
    } catch (error) {
      console.error('Failed to delete goal:', error);
    } finally {
      setDeletingGoalId(null);
    }
  };

  // Categorize goals
  const categorizedGoals = useMemo(() => {
    const completed: Goal[] = [];
    const inProgress: Goal[] = [];
    const notStarted: Goal[] = [];

    goals.forEach(goal => {
      const status = getGoalStatus(goal, goalActivities?.[goal.id] || null);
      if (status === 'completed') completed.push(goal);
      else if (status === 'in_progress') inProgress.push(goal);
      else notStarted.push(goal);
    });

    return { completed, inProgress, notStarted };
  }, [goals, goalActivities]);

  // Show detail view if goal selected
  if (selectedGoal) {
    return <GoalDetailView goal={selectedGoal} onBack={() => setSelectedGoal(null)} />;
  }

  // Loading state
  if (authLoading || isLoading) {
    return (
      <WallpaperBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto" />
            <p className="text-slate-500 mt-4 text-sm">Loading your achievements...</p>
          </div>
        </div>
      </WallpaperBackground>
    );
  }

  // Calculate totals
  const totalCompleted = categorizedGoals.completed.length;
  const totalGoals = goals.length;

  return (
    <WallpaperBackground>
      <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8 md:pt-20">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <GlassCard className="p-6 mb-6" hover={false}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-700 mb-1 flex items-center gap-3">
                  <span>🏆</span>
                  <span>Goal Collection</span>
                </h1>
                <p className="text-slate-500 text-sm">
                  {totalCompleted} of {totalGoals} goals achieved
                </p>
              </div>
              
              <GlassButton onClick={() => setShowAddGoal(true)}>
                <Plus className="w-5 h-5" />
                <span>New Goal</span>
              </GlassButton>
            </div>

            {/* Overall progress bar */}
            {totalGoals > 0 && (
              <div className="mt-4">
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500"
                    style={{ width: `${(totalCompleted / totalGoals) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1 text-right">
                  {Math.round((totalCompleted / totalGoals) * 100)}% complete
                </p>
              </div>
            )}
          </GlassCard>

          {/* Add Goal Modal */}
          <AddGoalModal
            isOpen={showAddGoal}
            onClose={() => setShowAddGoal(false)}
            onGoalCreated={() => {
              queryClient.invalidateQueries({ queryKey: ['goals'] });
              queryClient.invalidateQueries({ queryKey: ['goal-activities'] });
              setShowAddGoal(false);
            }}
            userId={userId}
          />

          {/* Quick View Modal */}
          {quickViewGoal && (
            <GoalQuickView
              goal={quickViewGoal}
              activity={goalActivities?.[quickViewGoal.id] || null}
              onClose={() => setQuickViewGoal(null)}
              onViewFull={() => {
                setSelectedGoal(quickViewGoal);
                setQuickViewGoal(null);
              }}
              onDelete={() => handleDeleteGoal(null, quickViewGoal.id, quickViewGoal.name)}
            />
          )}

          {/* Empty state */}
          {goals.length === 0 ? (
            <GlassCard className="p-12 text-center" hover={false}>
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Start Your Collection</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto text-sm">
                Add your first goal and begin your journey to greatness!
              </p>
              <GlassButton onClick={() => setShowAddGoal(true)}>
                <Plus className="w-5 h-5" />
                Add Your First Goal
              </GlassButton>
            </GlassCard>
          ) : (
            <div className="space-y-8">
              
              {/* In Progress Goals */}
              {categorizedGoals.inProgress.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-600 mb-4 flex items-center gap-2">
                    <Play className="w-5 h-5 text-blue-500" />
                    In Progress ({categorizedGoals.inProgress.length})
                  </h2>
                  <GlassCard className="p-6" hover={false}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                      {categorizedGoals.inProgress.map((goal) => (
                        <GoalBadge
                          key={goal.id}
                          goal={goal}
                          activity={goalActivities?.[goal.id] || null}
                          onSelect={() => setQuickViewGoal(goal)}
                          onDelete={(e) => handleDeleteGoal(e, goal.id, goal.name)}
                          isDeleting={deletingGoalId === goal.id}
                        />
                      ))}
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* Not Started Goals */}
              {categorizedGoals.notStarted.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-600 mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-slate-400" />
                    Coming Soon ({categorizedGoals.notStarted.length})
                  </h2>
                  <GlassCard className="p-6 bg-slate-50/50" hover={false}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                      {categorizedGoals.notStarted.map((goal) => (
                        <GoalBadge
                          key={goal.id}
                          goal={goal}
                          activity={goalActivities?.[goal.id] || null}
                          onSelect={() => setQuickViewGoal(goal)}
                          onDelete={(e) => handleDeleteGoal(e, goal.id, goal.name)}
                          isDeleting={deletingGoalId === goal.id}
                        />
                      ))}
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* Completed Goals */}
              {categorizedGoals.completed.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-600 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-emerald-500" />
                    Achieved ({categorizedGoals.completed.length})
                  </h2>
                  <GlassCard className="p-6 bg-gradient-to-br from-emerald-50/50 to-green-50/50" hover={false}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                      {categorizedGoals.completed.map((goal) => (
                        <GoalBadge
                          key={goal.id}
                          goal={goal}
                          activity={goalActivities?.[goal.id] || null}
                          onSelect={() => setQuickViewGoal(goal)}
                          onDelete={(e) => handleDeleteGoal(e, goal.id, goal.name)}
                          isDeleting={deletingGoalId === goal.id}
                        />
                      ))}
                    </div>
                  </GlassCard>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </WallpaperBackground>
  );
}