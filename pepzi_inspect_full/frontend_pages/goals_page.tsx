'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Target, Plus, TrendingUp, Calendar, Clock, Trash2, Briefcase, Car, CalendarDays, Dumbbell } from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import GoalDetailView from '@/components/goals/GoalDetailView';
import type { Goal } from '@/lib/api';

export default function GoalsPage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', userId],
    queryFn: () => goalsAPI.getGoals(userId),
  });

  // Fetch real progress for all goals
  const { data: progressData } = useQuery({
    queryKey: ['goals-progress', userId],
    queryFn: () => goalsAPI.getAllProgress(userId),
    enabled: goals.length > 0,
  });

  // Fetch time budget
  const { data: timeBudget } = useQuery({
    queryKey: ['time-budget', userId],
    queryFn: () => goalsAPI.getTimeBudget(userId),
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
      alert(`✅ Deleted "${goalName}" successfully!`);
    } catch (error) {
      console.error('Failed to delete goal:', error);
      alert('❌ Failed to delete goal. Please try again.');
    } finally {
      setDeletingGoalId(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      fitness: 'from-green-500 to-emerald-500',
      money: 'from-yellow-500 to-orange-500',
      skill: 'from-blue-500 to-indigo-500',
      social: 'from-pink-500 to-rose-500',
      travel: 'from-purple-500 to-violet-500',
      habit: 'from-cyan-500 to-teal-500',
      business: 'from-orange-500 to-red-500',
      experience: 'from-indigo-500 to-purple-500',
      climbing: 'from-orange-500 to-amber-500',
      languages: 'from-blue-500 to-indigo-500',
      creative: 'from-pink-500 to-rose-500',
      mental_health: 'from-cyan-500 to-teal-500',
    };
    return colors[category] || 'from-gray-500 to-slate-500';
  };

  // Helper to check if goal has a plan
  const hasPlan = (goal: Goal): boolean => {
    const planMicroGoals = goal.plan?.micro_goals;
    const microGoals = goal.micro_goals;
    return (Array.isArray(planMicroGoals) && planMicroGoals.length > 0) || 
           (Array.isArray(microGoals) && microGoals.length > 0);
  };

  // Calculate real progress percent
  const getRealProgress = (goal: Goal): { percent: number; hoursLogged: number; targetHours: number } => {
    const targetHours = goal.plan?.total_estimated_hours || 0;
    const goalProgress = progressData?.progress?.[goal.id];
    const hoursLogged = goalProgress?.total_hours || 0;
    const percent = targetHours > 0 ? Math.min(100, Math.round((hoursLogged / targetHours) * 100)) : 0;
    return { percent, hoursLogged, targetHours };
  };

  // Calculate goal breakdown for time budget
  const goalsWithPlans = goals.filter(g => g.plan?.weekly_hours > 0);

  if (selectedGoal) {
    return <GoalDetailView goal={selectedGoal} onBack={() => setSelectedGoal(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8 pb-24 md:pb-8 md:pt-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">🎯 Your Goals</h1>
            <p className="text-gray-600 text-sm md:text-base">Track your progress and achieve your dreams</p>
          </div>
          
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShowAddGoal(true)}
              className="px-5 py-2.5 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add Goal</span>
            </button>
          </div>
        </div>

        {/* Time Budget Dashboard */}
        <div className="mb-6 bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Weekly Time Budget</h2>
          </div>
          
          {/* Time Categories */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <Briefcase className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <div className="text-2xl font-bold text-blue-600">{timeBudget?.work_hours || 0}h</div>
              <div className="text-xs text-blue-600/70 font-medium">Work</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <Car className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <div className="text-2xl font-bold text-orange-600">{timeBudget?.commute_hours || 0}h</div>
              <div className="text-xs text-orange-600/70 font-medium">Commute</div>
            </div>
            <div className="bg-pink-50 rounded-xl p-3 text-center">
              <CalendarDays className="w-5 h-5 text-pink-500 mx-auto mb-1" />
              <div className="text-2xl font-bold text-pink-600">{timeBudget?.event_hours || 0}h</div>
              <div className="text-xs text-pink-600/70 font-medium">Events</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <Dumbbell className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <div className="text-2xl font-bold text-purple-600">{timeBudget?.training_hours || 0}h</div>
              <div className="text-xs text-purple-600/70 font-medium">Training</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center col-span-2 md:col-span-1">
              <div className="text-2xl font-bold text-green-600">{timeBudget?.free_hours || 0}h</div>
              <div className="text-xs text-green-600/70 font-medium">Free Time</div>
            </div>
          </div>

          {/* Progress bar showing committed vs awake hours */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Time committed</span>
              <span className="font-medium text-gray-900">
                {timeBudget?.committed_hours || 0}h / {timeBudget?.awake_hours || 112}h awake
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div 
                  className="bg-blue-500 transition-all" 
                  style={{ width: `${((timeBudget?.work_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                />
                <div 
                  className="bg-orange-500 transition-all" 
                  style={{ width: `${((timeBudget?.commute_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                />
                <div 
                  className="bg-pink-500 transition-all" 
                  style={{ width: `${((timeBudget?.event_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                />
                <div 
                  className="bg-purple-500 transition-all" 
                  style={{ width: `${((timeBudget?.training_hours || 0) / (timeBudget?.awake_hours || 112)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Goal Breakdown */}
          {goalsWithPlans.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-2">TRAINING BREAKDOWN</p>
              <div className="space-y-1">
                {goalsWithPlans.map(goal => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${getCategoryColor(goal.category)}`} />
                      <span className="text-sm text-gray-700">{goal.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{goal.plan?.weekly_hours}h/wk</span>
                  </div>
                ))}
              </div>
              {goals.filter(g => !g.plan?.weekly_hours).length > 0 && (
                <p className="text-xs text-gray-400 text-center pt-2">
                  + {goals.filter(g => !g.plan?.weekly_hours).length} goals without training plans
                </p>
              )}
            </div>
          )}
        </div>

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
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No goals yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm">
              Start your journey by adding your first goal!
            </p>
            <button
              onClick={() => setShowAddGoal(true)}
              className="px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
            >
              <Plus className="w-5 h-5" />
              Add Your First Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {goals.map((goal) => {
              const isDeleting = deletingGoalId === goal.id;
              const { percent: realProgressPercent, hoursLogged, targetHours } = getRealProgress(goal);
              const sessionsCount = progressData?.progress?.[goal.id]?.total_sessions || 0;
              
              return (
                <div
                  key={goal.id}
                  className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-xl transition-all cursor-pointer group relative"
                  onClick={() => setSelectedGoal(goal)}
                >
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteGoal(e, goal.id, goal.name)}
                    disabled={isDeleting}
                    className="absolute top-3 right-3 z-10 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete goal"
                  >
                    {isDeleting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>

                  <div className={`w-12 h-12 bg-gradient-to-br ${getCategoryColor(goal.category)} rounded-xl flex items-center justify-center mb-3`}>
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2 pr-8">{goal.name}</h3>
                  
                  <div className="flex items-center gap-2 text-sm mb-3 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium text-xs">
                      {goal.category}
                    </span>
                    {goal.target_date && (
                      <span className="flex items-center gap-1 text-gray-500 text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(goal.target_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Progress section */}
                  {hasPlan(goal) ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-600">Progress</span>
                        <span className="text-sm font-bold text-purple-600">
                          {realProgressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full bg-gradient-to-r ${getCategoryColor(goal.category)} transition-all duration-500`}
                          style={{ width: `${realProgressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {hoursLogged}h / {targetHours}h
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {sessionsCount} sessions
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-xs text-gray-500">
                      Click to create training plan
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}