'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsAPI } from '@/lib/api';
import { useUserStore } from '@/lib/store';
import { Target, Plus, MessageCircle, TrendingUp, Calendar, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import GoalDetailView from '@/components/goals/GoalDetailView';
import AvailabilityModal from '@/components/AvailabilityModal';
import FeasibilityWidget from '@/components/FeasibilityWidget';
import type { Goal } from '@/lib/api';

export default function GoalsPage() {
  const userId = useUserStore((state) => state.userId);
  const queryClient = useQueryClient();
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showExtract, setShowExtract] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [dreamsText, setDreamsText] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', userId],
    queryFn: () => goalsAPI.getGoals(userId),
  });

  const extractMutation = useMutation({
    mutationFn: (text: string) => goalsAPI.extractFromDreams(userId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowExtract(false);
      setDreamsText('');
    },
  });

  const toggleExpand = (goalId: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
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
    };
    return colors[category] || 'from-gray-500 to-slate-500';
  };

  if (selectedGoal) {
    return <GoalDetailView goal={selectedGoal} onBack={() => setSelectedGoal(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-8 pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🎯 Your Goals</h1>
            <p className="text-gray-600">Track your progress and achieve your dreams</p>
          </div>
          
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShowAvailability(true)}
              className="px-6 py-3 bg-gradient-to-br from-green-500 to-teal-500 text-white rounded-full font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Clock className="w-5 h-5" />
              <span className="hidden md:inline">Set Availability</span>
            </button>
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

        {/* Feasibility Widget */}
        {goals.length > 0 && (
          <div className="mb-8">
            <FeasibilityWidget userId={userId} />
          </div>
        )}

        {/* Availability Modal */}
        <AvailabilityModal
          isOpen={showAvailability}
          onClose={() => setShowAvailability(false)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['feasibility'] });
          }}
          userId={userId}
        />

        {/* Add Goal Modal */}
        <AddGoalModal
          isOpen={showAddGoal}
          onClose={() => setShowAddGoal(false)}
          onGoalCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            queryClient.invalidateQueries({ queryKey: ['feasibility'] });
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
              Start by setting your availability, then add goals!
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => setShowAvailability(true)}
                className="px-8 py-3 bg-gradient-to-br from-green-500 to-teal-500 text-white rounded-full font-medium hover:shadow-lg transition-all"
              >
                ⏰ Set Availability
              </button>
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
              const isExpanded = expandedGoals.has(goal.id);
              const progressPercent = goal.progress?.percent_complete || 0;
              
              return (
                <div
                  key={goal.id}
                  className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => setSelectedGoal(goal)}
                >
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

                  {goal.progress ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-lg font-bold text-purple-600">
                          {progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full bg-gradient-to-r ${getCategoryColor(goal.category)} transition-all duration-500`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {goal.progress.completed_micro_goals} / {goal.progress.total_micro_goals} milestones
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          On track
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