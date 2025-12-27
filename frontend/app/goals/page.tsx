'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { 
  Target, 
  Plus, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Trash2, 
  Briefcase, 
  Car, 
  CalendarDays, 
  Dumbbell,
  Loader2,
  ChevronRight
} from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import GoalDetailView from '@/components/goals/GoalDetailView';
import type { Goal } from '@/lib/api';
import {
  GlassCard,
  GlassButton,
  GlassIconBox,
  GlassBadge,
  GlassProgress,
  GlassStat,
  WallpaperBackground,
} from '@/components/ui/GlassUI';

export default function GoalsPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  // FIXED: Only fetch when userId exists
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', userId],
    queryFn: () => goalsAPI.getGoals(userId),
    enabled: !!userId,
  });

  const { data: progressData } = useQuery({
    queryKey: ['goals-progress', userId],
    queryFn: () => goalsAPI.getAllProgress(userId),
    enabled: !!userId && goals.length > 0,
  });

  const { data: timeBudget } = useQuery({
    queryKey: ['time-budget', userId],
    queryFn: () => goalsAPI.getTimeBudget(userId),
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: (goalId: string) => goalsAPI.deleteGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-progress'] });
      queryClient.invalidateQueries({ queryKey: ['time-budget'] });
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

  const hasPlan = (goal: Goal): boolean => {
    const planMicroGoals = goal.plan?.micro_goals;
    const microGoals = goal.micro_goals;
    return (Array.isArray(planMicroGoals) && planMicroGoals.length > 0) || 
           (Array.isArray(microGoals) && microGoals.length > 0);
  };

  const getRealProgress = (goal: Goal): { percent: number; hoursLogged: number; targetHours: number } => {
    const targetHours = goal.plan?.total_estimated_hours || 0;
    const goalProgress = progressData?.progress?.[goal.id];
    const hoursLogged = goalProgress?.total_hours || 0;
    const percent = targetHours > 0 ? Math.min(100, Math.round((hoursLogged / targetHours) * 100)) : 0;
    return { percent, hoursLogged, targetHours };
  };

  const goalsWithPlans = goals.filter(g => g.plan?.weekly_hours > 0);

  if (selectedGoal) {
    return <GoalDetailView goal={selectedGoal} onBack={() => setSelectedGoal(null)} />;
  }

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <WallpaperBackground>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
        </div>
      </WallpaperBackground>
    );
  }

  return (
    <WallpaperBackground>
      <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8 md:pt-20">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-700 mb-1">Your Goals</h1>
              <p className="text-slate-500 text-sm md:text-base">Track your progress and reach your summits</p>
            </div>
            
            <GlassButton onClick={() => setShowAddGoal(true)}>
              <Plus className="w-5 h-5" />
              <span>Add Goal</span>
            </GlassButton>
          </div>

          {/* Time Budget Dashboard */}
          <GlassCard className="mb-6 p-5" hover={false}>
            <div className="flex items-center gap-3 mb-4">
              <GlassIconBox>
                <Clock className="w-5 h-5 text-slate-500" />
              </GlassIconBox>
              <h2 className="text-lg font-semibold text-slate-700">Weekly Time Budget</h2>
            </div>
            
            {/* Time Categories */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <GlassStat 
                icon={<Briefcase className="w-4 h-4" />}
                value={`${timeBudget?.work_hours || 0}h`}
                label="Work"
              />
              <GlassStat 
                icon={<Car className="w-4 h-4" />}
                value={`${timeBudget?.commute_hours || 0}h`}
                label="Commute"
              />
              <GlassStat 
                icon={<CalendarDays className="w-4 h-4" />}
                value={`${timeBudget?.event_hours || 0}h`}
                label="Events"
              />
              <GlassStat 
                icon={<Dumbbell className="w-4 h-4" />}
                value={`${timeBudget?.training_hours || 0}h`}
                label="Training"
              />
              <GlassStat 
                value={`${timeBudget?.free_hours || 0}h`}
                label="Free Time"
                className="col-span-2 md:col-span-1"
              />
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">Time committed</span>
                <span className="font-medium text-slate-700">
                  {timeBudget?.committed_hours || 0}h / {timeBudget?.awake_hours || 112}h awake
                </span>
              </div>
              <div className="w-full h-2.5 bg-white/40 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div 
                    className="bg-slate-400 transition-all" 
                    style={{ width: `${((timeBudget?.work_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                  />
                  <div 
                    className="bg-slate-500 transition-all" 
                    style={{ width: `${((timeBudget?.commute_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                  />
                  <div 
                    className="bg-slate-600 transition-all" 
                    style={{ width: `${((timeBudget?.event_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                  />
                  <div 
                    className="bg-slate-700 transition-all" 
                    style={{ width: `${((timeBudget?.training_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Goal Breakdown */}
            {goalsWithPlans.length > 0 && (
              <div className="pt-3 border-t border-white/40">
                <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">Training Breakdown</p>
                <div className="space-y-1.5">
                  {goalsWithPlans.map(goal => (
                    <div
                      key={goal.id}
                      className="flex items-center justify-between py-2 px-3 bg-white/30 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                        <span className="text-sm text-slate-600">{goal.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{goal.plan?.weekly_hours}h/wk</span>
                    </div>
                  ))}
                </div>
                {goals.filter(g => !g.plan?.weekly_hours).length > 0 && (
                  <p className="text-xs text-slate-400 text-center pt-2">
                    + {goals.filter(g => !g.plan?.weekly_hours).length} goals without training plans
                  </p>
                )}
              </div>
            )}
          </GlassCard>

          {/* Add Goal Modal */}
          <AddGoalModal
            isOpen={showAddGoal}
            onClose={() => setShowAddGoal(false)}
            onGoalCreated={() => {
              queryClient.invalidateQueries({ queryKey: ['goals'] });
              queryClient.invalidateQueries({ queryKey: ['time-budget'] });
              setShowAddGoal(false);
            }}
            userId={userId}
          />

          {/* Goals Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
            </div>
          ) : goals.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {goals.map((goal) => {
                const isDeleting = deletingGoalId === goal.id;
                const { percent: realProgressPercent, hoursLogged, targetHours } = getRealProgress(goal);
                const sessionsCount = progressData?.progress?.[goal.id]?.total_sessions || 0;
                
                return (
                  <GlassCard
                    key={goal.id}
                    className="p-5 group relative"
                    onClick={() => setSelectedGoal(goal)}
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteGoal(e, goal.id, goal.name)}
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

                    <div className="flex items-start justify-between mb-3">
                      <GlassIconBox size="lg">
                        <Target className="w-5 h-5 text-slate-500" />
                      </GlassIconBox>
                      <ChevronRight className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    <h3 className="text-lg font-semibold text-slate-700 mb-2 pr-8">{goal.name}</h3>
                    
                    <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
                      <GlassBadge>{goal.category}</GlassBadge>
                      {goal.target_date && (
                        <span className="flex items-center gap-1 text-slate-400 text-xs">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(goal.target_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Progress section */}
                    {hasPlan(goal) ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500">Progress</span>
                          <span className="text-sm font-semibold text-slate-600">
                            {realProgressPercent}%
                          </span>
                        </div>
                        <GlassProgress value={realProgressPercent} />
                        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                          <span>{hoursLogged}h / {targetHours}h</span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {sessionsCount} sessions
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-slate-400 bg-white/30 rounded-xl">
                        Click to create training plan
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </WallpaperBackground>
  );
}