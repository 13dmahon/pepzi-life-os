'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsAPI } from '@/lib/api';
import { useUserStore } from '@/lib/store';
import { Target, Plus, MessageCircle, TrendingUp, Calendar, Clock, Trash2 } from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import GoalDetailView from '@/components/goals/GoalDetailView';
import type { Goal } from '@/lib/api';

export default function GoalsPage() {
  const userId = useUserStore((state) => state.userId);
  const queryClient = useQueryClient();
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showExtract, setShowExtract] = useState(false);
  const [dreamsText, setDreamsText] = useState('');
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

  const extractMutation = useMutation({
    mutationFn: (text: string) => goalsAPI.extractFromDreams(userId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowExtract(false);
      setDreamsText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (goalId: string) => goalsAPI.deleteGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-progress'] });
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

  // Helper to check if goal has a plan (type-safe version)
  const hasPlan = (goal: Goal): boolean => {
    const planMicroGoals = goal.plan?.micro_goals;
    const microGoals = goal.micro_goals;
    return (Array.isArray(planMicroGoals) && planMicroGoals.length > 0) || 
           (Array.isArray(microGoals) && microGoals.length > 0);
  };

  // Calculate real progress percent (same formula as GoalDetailView)
  const getRealProgress = (goal: Goal): { percent: number; hoursLogged: number; targetHours: number } => {
    const targetHours = goal.plan?.total_estimated_hours || 0;
    const goalProgress = progressData?.progress?.[goal.id];
    const hoursLogged = goalProgress?.total_hours || 0;
    const percent = targetHours > 0 ? Math.min(100, Math.round((hoursLogged / targetHours) * 100)) : 0;
    return { percent, hoursLogged, targetHours };
  };

  // Calculate weekly hours stats
  const totalWeeklyHours = goals.reduce((sum, g) => sum + (g.plan?.weekly_hours || 0), 0);
  const totalSessions = goals.reduce((sum, g) => sum + (g.plan?.sessions_per_week || 0), 0);
  const goalsWithPlans = goals.filter(g => g.plan?.weekly_hours > 0);

  if (selectedGoal) {
    return <GoalDetailView goal={selectedGoal} onBack={() => setSelectedGoal(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-8 pb-24 md:pb-8 md:pt-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🎯 Your Goals</h1>
            <p className="text-gray-600">Track your progress and achieve your dreams</p>
          </div>
          
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShowAddGoal(true)}
              className="px-6 py-3 bg-white border-2 border-purple-500 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden md:inline">Add Goal</span>
            </button>
            <button
              onClick={() => setShowExtract(true)}
              className="px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="hidden md:inline">Import Dreams</span>
            </button>
          </div>
        </div>

        {/* Weekly Training Dashboard */}
        {goals.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Weekly Training Budget</h2>
            </div>
            
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{totalWeeklyHours}</div>
                <div className="text-xs text-purple-600/70 font-medium">Hours / Week</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{totalSessions}</div>
                <div className="text-xs text-blue-600/70 font-medium">Sessions / Week</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{goalsWithPlans.length}</div>
                <div className="text-xs text-green-600/70 font-medium">Active Plans</div>
              </div>
            </div>

            {/* Goal Breakdown */}
            {goalsWithPlans.length > 0 ? (
              <div className="space-y-2">
                {goalsWithPlans.map(goal => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getCategoryColor(goal.category)}`} />
                      <span className="text-sm font-medium text-gray-700">{goal.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{goal.plan?.weekly_hours}h/wk</span>
                  </div>
                ))}
                {goals.filter(g => !g.plan?.weekly_hours).length > 0 && (
                  <p className="text-xs text-gray-400 text-center pt-2">
                    + {goals.filter(g => !g.plan?.weekly_hours).length} goals without training plans
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-sm py-2">
                Create training plans for your goals to see your weekly commitment
              </div>
            )}
          </div>
        )}

        {/* Add Goal Modal */}
        <AddGoalModal
          isOpen={showAddGoal}
          onClose={() => setShowAddGoal(false)}
          onGoalCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            setShowAddGoal(false);
          }}
          userId={userId}
        />

        {/* Extract Modal */}
        {showExtract && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-3xl w-full">
              <h2 className="text-3xl font-bold mb-2">Import Multiple Goals</h2>
              <p className="text-gray-600 mb-6">
                Tell me about all the goals you'd like to add. Don't worry about structure—just brain dump!
              </p>
              <textarea
                value={dreamsText}
                onChange={(e) => setDreamsText(e.target.value)}
                placeholder="I want to run a sub-20 5K by June, learn conversational Spanish within 6 months, build a SaaS to £5K MRR by end of year, read 24 books this year, get stronger at gym and hit 100kg bench press, travel to Japan in October..."
                className="w-full h-48 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none resize-none"
              />
              <div className="text-sm text-gray-500 mb-4">{dreamsText.length} characters</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExtract(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-full font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => extractMutation.mutate(dreamsText)}
                  disabled={extractMutation.isPending || !dreamsText.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {extractMutation.isPending ? 'Extracting...' : '🚀 Extract Goals'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Goals Grid */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Target className="w-12 h-12 text-purple-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No goals yet</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start your journey by adding your first goal!
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => setShowAddGoal(true)}
                className="px-8 py-3 bg-white border-2 border-purple-500 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition-all"
              >
                + Add Goal
              </button>
              <button
                onClick={() => setShowExtract(true)}
                className="px-8 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all"
              >
                💬 Import Dreams
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map((goal) => {
              const isDeleting = deletingGoalId === goal.id;
              
              // Use real progress from sessions
              const { percent: realProgressPercent, hoursLogged, targetHours } = getRealProgress(goal);
              const sessionsCount = progressData?.progress?.[goal.id]?.total_sessions || 0;
              
              return (
                <div
                  key={goal.id}
                  className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all cursor-pointer group relative"
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

                  <div className={`w-14 h-14 bg-gradient-to-br ${getCategoryColor(goal.category)} rounded-2xl flex items-center justify-center mb-4`}>
                    <Target className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{goal.name}</h3>
                  
                  <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                      {goal.category}
                    </span>
                    {goal.target_date && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(goal.target_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Progress section - now uses real session data */}
                  {hasPlan(goal) ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-lg font-bold text-purple-600">
                          {realProgressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full bg-gradient-to-r ${getCategoryColor(goal.category)} transition-all duration-500`}
                          style={{ width: `${realProgressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {hoursLogged}h / {targetHours}h logged
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {sessionsCount} sessions
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 text-sm text-gray-500">
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