'use client';

import { ArrowLeft, Target, Calendar, TrendingUp, Clock, CheckCircle2, Circle, MessageCircle, BookOpen, Activity, Flame, Timer, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { goalsAPI } from '@/lib/api';
import type { Goal } from '@/lib/api';

interface GoalDetailViewProps {
  goal: Goal;
  onBack: () => void;
}

interface SessionData {
  id: string;
  name: string;
  scheduled_start: string;
  completed_at: string;
  duration_mins: number;
  tracked_data: Record<string, any>;
}

interface SessionAggregates {
  total_sessions: number;
  total_hours: number;
  total_minutes: number;
  avg_effort: number | null;
  total_distance_km: number | null;
}

export default function GoalDetailView({ goal, onBack }: GoalDetailViewProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [aggregates, setAggregates] = useState<SessionAggregates | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Fetch completed sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true);
        const data = await goalsAPI.getGoalSessions(goal.id, 50);
        setSessions(data.sessions);
        setAggregates(data.aggregates);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [goal.id]);

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
    };
    return colors[category] || 'from-gray-500 to-slate-500';
  };

  const microGoals = goal.micro_goals || [];
  const progressPercent = goal.progress?.percent_complete || 0;
  const completedMicroGoals = goal.progress?.completed_micro_goals || 0;
  const totalMicroGoals = goal.progress?.total_micro_goals || 0;
  const trackingCriteria = goal.plan?.tracking_criteria || [];
  const weeklyPlan = goal.plan?.weekly_plan;

  // Calculate real progress based on sessions
  const targetHours = goal.plan?.total_estimated_hours || 0;
  const actualHours = aggregates?.total_hours || 0;
  const realProgressPercent = targetHours > 0 ? Math.min(100, Math.round((actualHours / targetHours) * 100)) : 0;

  // Format tracked data key for display
  const formatTrackingKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/mins$/i, '(mins)')
      .replace(/km$/i, '(km)')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // Format tracked data value
  const formatTrackingValue = (key: string, value: any): string => {
    if (value === undefined || value === null) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key.includes('effort') || key.includes('level')) return `${value}/10`;
    if (key.includes('distance') || key.includes('km')) return `${value} km`;
    if (key.includes('mins') || key.includes('duration') || key.includes('time')) return `${value} mins`;
    return String(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-8 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Goals
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-6">
          <div className="flex items-start gap-6">
            <div className={`w-20 h-20 bg-gradient-to-br ${getCategoryColor(goal.category)} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <Target className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">{goal.name}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full font-medium">
                  {goal.category}
                </span>
                {goal.target_date && (
                  <span className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-5 h-5" />
                    Target: {new Date(goal.target_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Overview - Updated with real data */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Progress Overview</h2>
          
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-2xl font-bold text-purple-600">{realProgressPercent}%</span>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getCategoryColor(goal.category)} transition-all duration-500`}
                style={{ width: `${realProgressPercent}%` }}
              />
            </div>
            {targetHours > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                {actualHours}h logged of {targetHours}h target
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-3xl font-bold text-gray-900">{aggregates?.total_sessions || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Sessions</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-3xl font-bold text-gray-900">{actualHours}h</div>
              <div className="text-sm text-gray-600 mt-1">Logged</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-3xl font-bold text-gray-900">{goal.plan?.weekly_hours || 0}h</div>
              <div className="text-sm text-gray-600 mt-1">Per Week</div>
            </div>
            {aggregates?.avg_effort && (
              <div className="text-center p-4 bg-orange-50 rounded-xl">
                <div className="text-3xl font-bold text-orange-600">{aggregates.avg_effort}</div>
                <div className="text-sm text-gray-600 mt-1">Avg Effort</div>
              </div>
            )}
            {aggregates?.total_distance_km && (
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="text-3xl font-bold text-blue-600">{aggregates.total_distance_km}km</div>
                <div className="text-sm text-gray-600 mt-1">Total Distance</div>
              </div>
            )}
            {!aggregates?.avg_effort && !aggregates?.total_distance_km && (
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <div className="text-3xl font-bold text-green-600">{completedMicroGoals}/{totalMicroGoals}</div>
                <div className="text-sm text-gray-600 mt-1">Milestones</div>
              </div>
            )}
          </div>
        </div>

        {/* 📅 ACTIVITY LOG - NEW SECTION */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">📅 Activity Log</h2>
          </div>

          {loadingSessions ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No completed sessions yet</p>
              <p className="text-sm text-gray-400">
                Complete sessions from the Today page to see your progress here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{session.name}</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(session.completed_at).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Done</span>
                    </div>
                  </div>

                  {/* Tracked Data */}
                  {Object.keys(session.tracked_data).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                      {Object.entries(session.tracked_data).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm"
                        >
                          {key.includes('effort') && <Flame className="w-3.5 h-3.5" />}
                          {key.includes('duration') && <Timer className="w-3.5 h-3.5" />}
                          {key.includes('distance') && <MapPin className="w-3.5 h-3.5" />}
                          <span className="font-medium">{formatTrackingKey(key)}:</span>
                          <span>{formatTrackingValue(key, value)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {sessions.length >= 50 && (
                <p className="text-center text-sm text-gray-500 pt-2">
                  Showing last 50 sessions
                </p>
              )}
            </div>
          )}
        </div>

        {/* 📚 TRAINING CURRICULUM */}
        {weeklyPlan && weeklyPlan.weeks && weeklyPlan.weeks.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">📚 Training Curriculum</h2>
            </div>

            {weeklyPlan.summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">{weeklyPlan.summary}</p>
              </div>
            )}

            {weeklyPlan.realism_notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-900">
                  <strong>Note:</strong> {weeklyPlan.realism_notes}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {weeklyPlan.weeks.map((week: any, index: number) => {
                const isExpanded = expandedWeek === week.week_number;
                const relatedMilestone = weeklyPlan.milestones?.find(
                  (m: any) => m.target_week === week.week_number
                );

                return (
                  <div
                    key={week.week_number}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Week Header */}
                    <button
                      onClick={() => setExpandedWeek(isExpanded ? null : week.week_number)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">Week {week.week_number}</span>
                        <span className="text-sm text-gray-600">• {week.focus}</span>
                        {relatedMilestone && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            🎯 Milestone
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {week.sessions_per_week} sessions
                        </span>
                        <span className="text-gray-400">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </button>

                    {/* Week Sessions */}
                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-white">
                        {relatedMilestone && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                            <div className="font-semibold text-green-900 mb-1">
                              🎯 {relatedMilestone.name}
                            </div>
                            <div className="text-sm text-green-700">
                              {relatedMilestone.criteria}
                            </div>
                          </div>
                        )}

                        {week.sessions && week.sessions.length > 0 ? (
                          week.sessions.map((session: any, sessionIndex: number) => (
                            <div
                              key={sessionIndex}
                              className="border border-gray-200 rounded-lg p-3"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-gray-900">
                                  {session.name}
                                </h4>
                              </div>
                              <p className="text-sm text-gray-700 mb-2">
                                {session.description}
                              </p>
                              {session.notes && (
                                <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                                  💡 {session.notes}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No specific sessions defined for this week
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Micro Achievements */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">✅ Micro Achievements</h2>
            <button
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Refine Plan
            </button>
          </div>
          <div className="space-y-3">
            {microGoals.length > 0 ? (
              microGoals.map((mg: any) => (
                <div
                  key={mg.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {mg.completed_at ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className={`font-medium ${mg.completed_at ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {mg.name}
                    </h3>
                    {mg.completion_criteria && (
                      <p className="text-sm text-gray-500 mt-1">
                        {mg.completion_criteria.description}
                      </p>
                    )}
                    {mg.completed_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Completed {new Date(mg.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No plan yet. This goal was created without the conversational flow.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tracking Criteria */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Tracking Criteria</h2>
          <div className="space-y-3">
            {trackingCriteria.length > 0 ? (
              trackingCriteria.map((criteria: string, index: number) => (
                <div key={index} className="flex items-center gap-3 text-gray-700">
                  <TrendingUp className="w-5 h-5" />
                  <span>{formatTrackingKey(criteria)}</span>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center gap-3 text-gray-700">
                  <Clock className="w-5 h-5" />
                  <span>Weekly hours logged</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <TrendingUp className="w-5 h-5" />
                  <span>Progress towards milestones</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Calendar className="w-5 h-5" />
                  <span>Consistency (days active)</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}