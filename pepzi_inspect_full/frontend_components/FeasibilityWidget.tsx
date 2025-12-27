'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { availabilityAPI, scheduleAPI } from '@/lib/api';
import { AlertCircle, CheckCircle, TrendingUp, Calendar } from 'lucide-react';
import { useState } from 'react';

interface FeasibilityWidgetProps {
  userId: string;
}

export default function FeasibilityWidget({ userId }: FeasibilityWidgetProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string>('');

  const { data: feasibility, isLoading } = useQuery({
    queryKey: ['feasibility', userId],
    queryFn: () => availabilityAPI.checkFeasibility(userId),
  });

  const generateScheduleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/schedule/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate schedule');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setMessage(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      
      // Redirect to schedule page after 2 seconds
      setTimeout(() => {
        window.location.href = '/schedule';
      }, 2000);
    },
    onError: (error: any) => {
      setMessage(`❌ ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!feasibility?.has_availability) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 shadow-lg border-2 border-yellow-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-yellow-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              ⚠️ Set Your Availability First
            </h3>
            <p className="text-gray-700 text-sm mb-4">
              Before I can generate your schedule, I need to know your weekly availability.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-yellow-500 text-white rounded-full font-medium hover:bg-yellow-600 transition-all text-sm"
            >
              Set Availability
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { free_hours, hours_needed, buffer_hours, is_feasible, suggestion, goal_breakdown } = feasibility;

  return (
    <div className={`rounded-2xl p-6 shadow-lg border-2 ${
      is_feasible 
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
        : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          is_feasible ? 'bg-green-200' : 'bg-red-200'
        }`}>
          {is_feasible ? (
            <CheckCircle className="w-6 h-6 text-green-700" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-700" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            {is_feasible ? '✅ Schedule Feasible!' : '⚠️ Schedule Conflict'}
          </h3>
          <p className="text-sm text-gray-700">{suggestion}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{hours_needed}h</div>
          <div className="text-xs text-gray-600 mt-1">Goals Need</div>
        </div>
        <div className="bg-white/50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{free_hours}h</div>
          <div className="text-xs text-gray-600 mt-1">You Have Free</div>
        </div>
        <div className={`bg-white/50 rounded-xl p-4 text-center ${
          buffer_hours < 0 ? 'ring-2 ring-red-400' : ''
        }`}>
          <div className={`text-3xl font-bold ${
            buffer_hours < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {buffer_hours > 0 ? '+' : ''}{buffer_hours}h
          </div>
          <div className="text-xs text-gray-600 mt-1">Buffer</div>
        </div>
      </div>

      {/* Goal Breakdown */}
      {goal_breakdown && goal_breakdown.length > 0 && (
        <div className="bg-white/50 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Hours per Goal
          </h4>
          <div className="space-y-2">
            {goal_breakdown.map((goal: any) => (
              <div key={goal.goal_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{goal.goal_name}</span>
                <span className="font-semibold text-gray-900">{goal.weekly_hours}h/week</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success/Error Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm text-center ${
          message.startsWith('✅') 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => generateScheduleMutation.mutate()}
        disabled={!is_feasible || generateScheduleMutation.isPending}
        className={`w-full py-3 rounded-full font-semibold text-white transition-all flex items-center justify-center gap-2 ${
          is_feasible && !generateScheduleMutation.isPending
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg'
            : 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed'
        }`}
      >
        <Calendar className="w-5 h-5" />
        {generateScheduleMutation.isPending 
          ? 'Generating Schedule...' 
          : is_feasible 
            ? 'Generate Weekly Schedule' 
            : 'Fix Conflicts First'
        }
      </button>

      {!is_feasible && (
        <p className="text-xs text-gray-600 text-center mt-2">
          Adjust goal deadlines or reduce hours to enable scheduling
        </p>
      )}
    </div>
  );
}