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
  ExternalLink,
  Flame,
  Clock
} from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import GoalDetailView from '@/components/goals/GoalDetailView';
import type { Goal } from '@/lib/api';
import {
  GlassCard,
  GlassButton,
  GlassIconBox,
  GlassBadge,
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
  activityByDate: Record<string, number>; // date -> count
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Calculate streak from completed sessions
function calculateStreak(sessions: GoalSession[]): number {
  const completedDates = sessions
    .filter(s => s.status === 'completed' && s.completed_at)
    .map(s => {
      const date = new Date(s.completed_at!);
      return date.toISOString().split('T')[0];
    })
    .sort()
    .reverse(); // Most recent first

  if (completedDates.length === 0) return 0;

  const uniqueDates = [...new Set(completedDates)];
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Streak must include today or yesterday to be active
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return 0;
  }

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

// Build activity map for dot calendar (last 8 weeks = 56 days)
function buildActivityMap(sessions: GoalSession[]): Record<string, number> {
  const activityMap: Record<string, number> = {};
  
  sessions
    .filter(s => s.status === 'completed' && s.completed_at)
    .forEach(s => {
      const date = new Date(s.completed_at!).toISOString().split('T')[0];
      activityMap[date] = (activityMap[date] || 0) + 1;
    });

  return activityMap;
}

// Get category color
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    fitness: 'from-emerald-500 to-green-500',
    climbing: 'from-orange-500 to-amber-500',
    languages: 'from-blue-500 to-indigo-500',
    business: 'from-purple-500 to-violet-500',
    creative: 'from-pink-500 to-rose-500',
    mental_health: 'from-cyan-500 to-teal-500',
    music: 'from-fuchsia-500 to-pink-500',
    education: 'from-sky-500 to-blue-500',
    health: 'from-lime-500 to-green-500',
  };
  return colors[category?.toLowerCase()] || 'from-slate-500 to-gray-500';
}

// Get category icon background
function getCategoryBg(category: string): string {
  const colors: Record<string, string> = {
    fitness: 'bg-emerald-100',
    climbing: 'bg-orange-100',
    languages: 'bg-blue-100',
    business: 'bg-purple-100',
    creative: 'bg-pink-100',
    mental_health: 'bg-cyan-100',
    music: 'bg-fuchsia-100',
    education: 'bg-sky-100',
    health: 'bg-lime-100',
  };
  return colors[category?.toLowerCase()] || 'bg-slate-100';
}

// ============================================================
// DOT CALENDAR COMPONENT
// ============================================================

interface DotCalendarProps {
  activityMap: Record<string, number>;
  weeks?: number;
}

function DotCalendar({ activityMap, weeks = 8 }: DotCalendarProps) {
  // Generate last N weeks of dates
  const dates = useMemo(() => {
    const result: Date[] = [];
    const today = new Date();
    const totalDays = weeks * 7;
    
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      result.push(date);
    }
    
    return result;
  }, [weeks]);

  // Group by week
  const weekGroups = useMemo(() => {
    const groups: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      groups.push(dates.slice(i, i + 7));
    }
    return groups;
  }, [dates]);

  const getActivityLevel = (date: Date): number => {
    const dateStr = date.toISOString().split('T')[0];
    const count = activityMap[dateStr] || 0;
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    return 3; // 3+ sessions
  };

  const getActivityColor = (level: number): string => {
    switch (level) {
      case 0: return 'bg-slate-200/60';
      case 1: return 'bg-emerald-300';
      case 2: return 'bg-emerald-500';
      case 3: return 'bg-emerald-700';
      default: return 'bg-slate-200/60';
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex gap-[3px]">
      {weekGroups.map((week, weekIdx) => (
        <div key={weekIdx} className="flex flex-col gap-[3px]">
          {week.map((date, dayIdx) => {
            const dateStr = date.toISOString().split('T')[0];
            const level = getActivityLevel(date);
            const isToday = dateStr === today;
            
            return (
              <div
                key={dayIdx}
                className={`w-3 h-3 rounded-sm ${getActivityColor(level)} ${
                  isToday ? 'ring-1 ring-slate-400 ring-offset-1' : ''
                }`}
                title={`${dateStr}: ${activityMap[dateStr] || 0} sessions`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// GOAL CARD COMPONENT
// ============================================================

interface GoalCardProps {
  goal: Goal;
  activity: GoalActivity | null;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}

function GoalCard({ goal, activity, onSelect, onDelete, isDeleting }: GoalCardProps) {
  const completedCount = activity?.completedCount || 0;
  const totalCount = activity?.totalCount || 0;
  const currentStreak = activity?.currentStreak || 0;
  const activityMap = activity?.activityByDate || {};

  // Calculate progress percentage
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <GlassCard
      className="p-5 group relative"
      onClick={onSelect}
    >
      {/* Delete Button */}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="absolute top-3 right-3 z-10 w-8 h-8 bg-rose-500/80 hover:bg-rose-500 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title="Delete goal"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>

      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${getCategoryBg(goal.category)} rounded-xl flex items-center justify-center`}>
            <Target className="w-6 h-6 text-slate-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-700 truncate pr-8">{goal.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <GlassBadge>{goal.category}</GlassBadge>
              {goal.target_date && (
                <span className="flex items-center gap-1 text-slate-400 text-xs">
                  <Calendar className="w-3 h-3" />
                  {new Date(goal.target_date).toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'short' 
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {/* Session Progress */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">
            Session {completedCount} of {totalCount || '?'}
          </span>
          {progressPercent > 0 && (
            <span className="text-xs text-slate-400">({progressPercent}%)</span>
          )}
        </div>
        
        {/* Streak Badge */}
        {currentStreak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-600 rounded-full">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden mb-4">
        <div 
          className={`h-full bg-gradient-to-r ${getCategoryColor(goal.category)} transition-all duration-500`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Dot Calendar */}
      <div className="flex items-center justify-between">
        <DotCalendar activityMap={activityMap} weeks={8} />
        
        {/* Resource Link Button */}
        {goal.resource_link && (
          <a
            href={goal.resource_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {goal.resource_link_label || 'Open'}
          </a>
        )}
      </div>
    </GlassCard>
  );
}

// ============================================================
// MAIN GOALS PAGE
// ============================================================

export default function GoalsPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  // Fetch goals
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', userId],
    queryFn: () => goalsAPI.getGoals(userId),
    enabled: !!userId,
  });

  // Fetch sessions for each goal (for dot calendar + streaks)
  const { data: goalActivities } = useQuery({
    queryKey: ['goal-activities', userId, goals.map(g => g.id).join(',')],
    queryFn: async () => {
      const activities: Record<string, GoalActivity> = {};
      
      await Promise.all(
        goals.map(async (goal) => {
          try {
            // Fetch all sessions for this goal
            const scheduleData = await goalsAPI.getGoalSchedule(goal.id);
            const allSessions: GoalSession[] = [];
            
            // Flatten sessions from all weeks
            Object.values(scheduleData.sessions_by_week || {}).forEach((weekSessions: any) => {
              allSessions.push(...weekSessions);
            });
            
            const completedSessions = allSessions.filter(s => s.status === 'completed');
            
            activities[goal.id] = {
              sessions: allSessions,
              completedCount: completedSessions.length,
              totalCount: allSessions.length,
              currentStreak: calculateStreak(allSessions),
              activityByDate: buildActivityMap(allSessions),
            };
          } catch (error) {
            console.error(`Failed to fetch activity for goal ${goal.id}:`, error);
            activities[goal.id] = {
              sessions: [],
              completedCount: 0,
              totalCount: 0,
              currentStreak: 0,
              activityByDate: {},
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
    },
  });

  const handleDeleteGoal = async (e: React.MouseEvent, goalId: string, goalName: string) => {
    e.stopPropagation();
    
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

  // Show detail view if goal selected
  if (selectedGoal) {
    return <GoalDetailView goal={selectedGoal} onBack={() => setSelectedGoal(null)} />;
  }

  // Loading state - improved with text
  if (authLoading || isLoading) {
    return (
      <WallpaperBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto" />
            <p className="text-slate-500 mt-4 text-sm">Loading your goals...</p>
          </div>
        </div>
      </WallpaperBackground>
    );
  }

  // Calculate totals
  const totalCompleted = Object.values(goalActivities || {}).reduce(
    (sum, a) => sum + a.completedCount, 0
  );
  const longestStreak = Math.max(
    0,
    ...Object.values(goalActivities || {}).map(a => a.currentStreak)
  );

  return (
    <WallpaperBackground>
      <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8 md:pt-20">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-700 mb-1">Goals</h1>
              <p className="text-slate-500 text-sm">
                {goals.length} goal{goals.length !== 1 ? 's' : ''} • {totalCompleted} sessions completed
                {longestStreak > 0 && ` • 🔥 ${longestStreak} day streak`}
              </p>
            </div>
            
            <GlassButton onClick={() => setShowAddGoal(true)}>
              <Plus className="w-5 h-5" />
              <span>Add Goal</span>
            </GlassButton>
          </div>

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

          {/* Goals List */}
          {goals.length === 0 ? (
            <GlassCard className="p-12 text-center" hover={false}>
              <GlassIconBox size="lg" className="mx-auto mb-4">
                <Target className="w-8 h-8 text-slate-400" />
              </GlassIconBox>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No goals yet</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto text-sm">
                Start your journey by adding your first goal!
              </p>
              <GlassButton onClick={() => setShowAddGoal(true)}>
                <Plus className="w-5 h-5" />
                Add Your First Goal
              </GlassButton>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  activity={goalActivities?.[goal.id] || null}
                  onSelect={() => setSelectedGoal(goal)}
                  onDelete={(e) => handleDeleteGoal(e, goal.id, goal.name)}
                  isDeleting={deletingGoalId === goal.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </WallpaperBackground>
  );
}