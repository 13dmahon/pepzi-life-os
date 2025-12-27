'use client';

import { ArrowLeft, Target, Calendar, TrendingUp, Clock, CheckCircle2, Circle, Settings, Flame, ChevronDown, ChevronRight, Play, SkipForward, ArrowRight, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { goalsAPI, scheduleAPI } from '@/lib/api';
import type { Goal } from '@/lib/api';

interface GoalDetailViewProps {
  goal: Goal;
  onBack: () => void;
}

interface ScheduleSession {
  id: string;
  scheduled_start: string;
  duration_mins: number;
  status: string;
  completed_at?: string;
  notes?: string;
  parsed_name: string;
  parsed_description: string;
  parsed_tip: string;
  week_number: number;
  is_past: boolean;
  is_today: boolean;
}

interface SessionAggregates {
  total_sessions: number;
  total_hours: number;
  total_minutes: number;
  avg_effort: number | null;
  total_distance_km: number | null;
}

export default function GoalDetailView({ goal, onBack }: GoalDetailViewProps) {
  const queryClient = useQueryClient();
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [sessionsByWeek, setSessionsByWeek] = useState<Record<number, ScheduleSession[]>>({});
  const [aggregates, setAggregates] = useState<SessionAggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Preferences modal state
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferredDays, setPreferredDays] = useState<string[]>(goal.preferred_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  const [weeklyHours, setWeeklyHours] = useState(goal.plan?.weekly_hours || 5);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(goal.plan?.sessions_per_week || 3);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [activeSession, setActiveSession] = useState<ScheduleSession | null>(null);
  const [notes, setNotes] = useState('');

  // Confirmation popup state
  const [popup, setPopup] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // Intensify preview modal state
  const [showIntensifyPreview, setShowIntensifyPreview] = useState(false);
  const [intensifyPreview, setIntensifyPreview] = useState<Array<{
    id: string;
    before: { name: string; description: string; tip: string; duration_mins: number };
    after: { name: string; description: string; tip: string; duration_mins: number };
  }>>([]);
  const [intensifyTotalSessions, setIntensifyTotalSessions] = useState(0);
  const [loadingIntensify, setLoadingIntensify] = useState(false);
  const [applyingIntensify, setApplyingIntensify] = useState(false);

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Fetch schedule data
  useEffect(() => {
    fetchScheduleData();
  }, [goal.id]);

  const fetchScheduleData = async () => {
    try {
      setLoading(true);
      
      // Get full schedule
      const scheduleData = await goalsAPI.getGoalSchedule(goal.id);
      setSessionsByWeek(scheduleData.sessions_by_week);
      
      // Get aggregates from completed sessions
      const sessionsData = await goalsAPI.getGoalSessions(goal.id, 100);
      setAggregates(sessionsData.aggregates);

      // Auto-expand current week
      const today = new Date();
      const goalStart = new Date(goal.created_at || today);
      const currentWeek = Math.floor((today.getTime() - goalStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      setExpandedWeeks(new Set([currentWeek]));
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fitness: 'from-green-500 to-emerald-500',
      climbing: 'from-orange-500 to-amber-500',
      languages: 'from-blue-500 to-indigo-500',
      business: 'from-purple-500 to-violet-500',
      creative: 'from-pink-500 to-rose-500',
      mental_health: 'from-cyan-500 to-teal-500',
    };
    return colors[category] || 'from-gray-500 to-slate-500';
  };

  const toggleWeek = (weekNum: number) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekNum)) {
      newExpanded.delete(weekNum);
    } else {
      newExpanded.add(weekNum);
    }
    setExpandedWeeks(newExpanded);
  };

  // Calculate progress
  const targetHours = goal.plan?.total_estimated_hours || 0;
  const actualHours = aggregates?.total_hours || 0;
  const progressPercent = targetHours > 0 ? Math.min(100, Math.round((actualHours / targetHours) * 100)) : 0;

  // Get milestones
  const milestones = goal.plan?.weekly_plan?.milestones || goal.plan?.micro_goals || [];

  // Handle complete session
  const handleComplete = async (session: ScheduleSession) => {
    setActiveSession(session);
    setNotes('');
    setShowNotesModal(true);
  };

  const submitCompletion = async () => {
    if (!activeSession) return;
    
    setActionLoading(activeSession.id);
    try {
      const result = await scheduleAPI.completeBlockWithNotes(activeSession.id, notes);
      setShowNotesModal(false);
      setActiveSession(null);
      setNotes('');
      
      // Show success popup
      setPopup({
        message: result.message || 'Session completed! 🎉',
        type: 'success',
      });
      
      // Refresh data
      await fetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    } catch (error) {
      console.error('Complete error:', error);
      setPopup({ message: 'Failed to complete session', type: 'warning' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle skip session
  const handleSkip = async (session: ScheduleSession) => {
    if (!confirm(`Skip "${session.parsed_name}"?`)) return;
    
    setActionLoading(session.id);
    try {
      const result = await scheduleAPI.skipBlock(session.id);
      
      setPopup({
        message: result.deadline_impact 
          ? `Skipped. ${result.deadline_impact}`
          : 'Session skipped',
        type: result.deadline_impact ? 'warning' : 'info',
      });
      
      await fetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    } catch (error) {
      console.error('Skip error:', error);
      setPopup({ message: 'Failed to skip session', type: 'warning' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle push to next week
  const handlePushToNextWeek = async (session: ScheduleSession) => {
    if (!confirm(`Push "${session.parsed_name}" to next week? This may affect your deadline.`)) return;
    
    setActionLoading(session.id);
    try {
      const result = await scheduleAPI.pushToNextWeek(session.id);
      
      setPopup({
        message: result.deadline_impact 
          ? `Pushed to next week. ${result.deadline_impact}`
          : `Moved to ${new Date(result.new_date).toLocaleDateString()}`,
        type: result.deadline_impact ? 'warning' : 'info',
      });
      
      await fetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    } catch (error) {
      console.error('Push error:', error);
      setPopup({ message: 'Failed to push session', type: 'warning' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle intensify - show preview first
  const handleIntensify = async () => {
    setLoadingIntensify(true);
    try {
      const result = await goalsAPI.getIntensifyPreview(goal.id);
      
      if (!result.success || result.preview.length === 0) {
        setPopup({
          message: result.message || 'No future sessions to intensify',
          type: 'info',
        });
        return;
      }

      setIntensifyPreview(result.preview);
      setIntensifyTotalSessions(result.total_sessions);
      setShowIntensifyPreview(true);
    } catch (error) {
      console.error('Intensify preview error:', error);
      setPopup({ message: 'Failed to generate preview', type: 'warning' });
    } finally {
      setLoadingIntensify(false);
    }
  };

  // Apply intensification
  const applyIntensify = async () => {
    setApplyingIntensify(true);
    try {
      const result = await goalsAPI.applyIntensify(goal.id, intensifyPreview);
      
      setShowIntensifyPreview(false);
      setPopup({
        message: result.message || `🔥 ${result.sessions_updated} sessions intensified!`,
        type: 'success',
      });
      
      // Refresh data
      await fetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    } catch (error) {
      console.error('Apply intensify error:', error);
      setPopup({ message: 'Failed to apply changes', type: 'warning' });
    } finally {
      setApplyingIntensify(false);
    }
  };

  // Handle save preferences
  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      const result = await goalsAPI.updatePreferences(goal.id, {
        preferred_days: preferredDays,
        weekly_hours: weeklyHours,
        sessions_per_week: sessionsPerWeek,
      });
      
      setShowPreferences(false);
      setPopup({
        message: result.new_target_date 
          ? `Preferences saved. New target: ${new Date(result.new_target_date).toLocaleDateString()}`
          : 'Preferences saved!',
        type: 'success',
      });
      
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    } catch (error) {
      console.error('Preferences error:', error);
      setPopup({ message: 'Failed to save preferences', type: 'warning' });
    } finally {
      setSavingPreferences(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get sorted weeks
  const sortedWeeks = Object.keys(sessionsByWeek)
    .map(Number)
    .sort((a, b) => a - b);

  // Find milestone for a week
  const getMilestoneForWeek = (weekNum: number) => {
    return milestones.find((m: any) => (m.target_week || m.week) === weekNum);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Goals
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 bg-gradient-to-br ${getCategoryColor(goal.category)} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <Target className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{goal.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {goal.category}
                </span>
                {goal.target_date && (
                  <span className="flex items-center gap-1 text-gray-600 text-sm">
                    <Calendar className="w-4 h-4" />
                    Target: {new Date(goal.target_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreferences(true)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Edit preferences"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleIntensify}
                disabled={loadingIntensify}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loadingIntensify ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Flame className="w-4 h-4" />
                )}
                <span className="hidden md:inline">Intensify</span>
              </button>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Progress</h2>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-xl font-bold text-purple-600">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getCategoryColor(goal.category)} transition-all duration-500`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {targetHours > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                {actualHours}h logged of {targetHours}h target
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-gray-900">{aggregates?.total_sessions || 0}</div>
              <div className="text-xs text-gray-600">Sessions Done</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-gray-900">{actualHours}h</div>
              <div className="text-xs text-gray-600">Hours Logged</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-gray-900">{goal.plan?.weekly_hours || 0}h</div>
              <div className="text-xs text-gray-600">Per Week</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-gray-900">{goal.plan?.total_weeks || 0}</div>
              <div className="text-xs text-gray-600">Total Weeks</div>
            </div>
          </div>
        </div>

        {/* Timeline - Sessions by Week */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📅 Training Timeline</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500">Loading schedule...</p>
            </div>
          ) : sortedWeeks.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No sessions scheduled yet</p>
              <p className="text-sm text-gray-400">
                Generate a schedule from the Schedule page
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedWeeks.map((weekNum) => {
                const sessions = sessionsByWeek[weekNum] || [];
                const isExpanded = expandedWeeks.has(weekNum);
                const milestone = getMilestoneForWeek(weekNum);
                const completedInWeek = sessions.filter(s => s.status === 'completed').length;
                const totalInWeek = sessions.length;
                const weekPlan = goal.plan?.weekly_plan?.weeks?.find((w: any) => w.week_number === weekNum);

                return (
                  <div
                    key={weekNum}
                    className="border border-gray-200 rounded-xl overflow-hidden"
                  >
                    {/* Week Header */}
                    <button
                      onClick={() => toggleWeek(weekNum)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="font-bold text-gray-900">Week {weekNum}</span>
                        {weekPlan?.focus && (
                          <span className="text-sm text-gray-600 hidden md:inline">• {weekPlan.focus}</span>
                        )}
                        {milestone && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            🎯 {milestone.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {completedInWeek}/{totalInWeek} done
                        </span>
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${totalInWeek > 0 ? (completedInWeek / totalInWeek) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Week Sessions */}
                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-white">
                        {/* Milestone banner if exists */}
                        {milestone && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                            <div className="font-semibold text-green-900 mb-1">
                              🎯 Milestone: {milestone.name}
                            </div>
                            {milestone.criteria && (
                              <div className="text-sm text-green-700">{milestone.criteria}</div>
                            )}
                          </div>
                        )}

                        {sessions.length === 0 ? (
                          <p className="text-sm text-gray-500 italic py-4 text-center">
                            No sessions scheduled for this week
                          </p>
                        ) : (
                          sessions.map((session) => (
                            <div
                              key={session.id}
                              className={`border rounded-xl p-4 transition-all ${
                                session.status === 'completed'
                                  ? 'border-green-200 bg-green-50/50'
                                  : session.status === 'skipped'
                                  ? 'border-gray-200 bg-gray-50 opacity-60'
                                  : session.is_past
                                  ? 'border-orange-200 bg-orange-50/30'
                                  : 'border-gray-200 hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {session.status === 'completed' ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    ) : session.status === 'skipped' ? (
                                      <SkipForward className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                    )}
                                    <h4 className={`font-semibold ${
                                      session.status === 'completed' ? 'text-green-700 line-through' :
                                      session.status === 'skipped' ? 'text-gray-500 line-through' :
                                      'text-gray-900'
                                    }`}>
                                      {session.parsed_name}
                                    </h4>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                    <span>{formatDate(session.scheduled_start)}</span>
                                    <span>•</span>
                                    <span>{formatTime(session.scheduled_start)}</span>
                                    <span>•</span>
                                    <span>{session.duration_mins} min</span>
                                    {session.is_today && session.status === 'scheduled' && (
                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                        Today
                                      </span>
                                    )}
                                  </div>

                                  {session.parsed_description && session.status !== 'completed' && (
                                    <p className="text-sm text-gray-600 mb-2">{session.parsed_description}</p>
                                  )}

                                  {session.parsed_tip && session.status !== 'completed' && (
                                    <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded inline-block">
                                      💡 {session.parsed_tip}
                                    </p>
                                  )}
                                </div>

                                {/* Action buttons for scheduled sessions */}
                                {session.status === 'scheduled' && (
                                  <div className="flex flex-col gap-2">
                                    <button
                                      onClick={() => handleComplete(session)}
                                      disabled={actionLoading === session.id}
                                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      Done
                                    </button>
                                    {!session.is_past && (
                                      <>
                                        <button
                                          onClick={() => handlePushToNextWeek(session)}
                                          disabled={actionLoading === session.id}
                                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                                        >
                                          <ArrowRight className="w-4 h-4" />
                                          Push
                                        </button>
                                        <button
                                          onClick={() => handleSkip(session)}
                                          disabled={actionLoading === session.id}
                                          className="px-3 py-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                                        >
                                          <SkipForward className="w-4 h-4" />
                                          Skip
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notes Modal */}
      {showNotesModal && activeSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Nice work! 🎉</h3>
              <p className="text-sm text-gray-500">{activeSession.parsed_name}</p>
            </div>
            
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How'd it go? (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this session..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none text-sm"
                rows={3}
                autoFocus
              />
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setActiveSession(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={submitCompletion}
                disabled={actionLoading === activeSession.id}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Log It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit Preferences</h3>
              <button
                onClick={() => setShowPreferences(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Preferred Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Preferred Training Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        if (preferredDays.includes(day)) {
                          setPreferredDays(preferredDays.filter(d => d !== day));
                        } else {
                          setPreferredDays([...preferredDays, day]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        preferredDays.includes(day)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hours Per Week: {weeklyHours}h
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1h</span>
                  <span>20h</span>
                </div>
              </div>

              {/* Sessions Per Week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sessions Per Week: {sessionsPerWeek}
                </label>
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1</span>
                  <span>7</span>
                </div>
              </div>

              {/* Preview impact */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Impact Preview:</strong> At {weeklyHours}h/week, your {goal.plan?.total_estimated_hours || 50}h goal will take ~{Math.ceil((goal.plan?.total_estimated_hours || 50) / weeklyHours)} weeks.
                </p>
              </div>
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowPreferences(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                disabled={savingPreferences}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium disabled:opacity-50"
              >
                {savingPreferences ? 'Saving...' : 'Save & Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intensify Preview Modal */}
      {showIntensifyPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-orange-500 to-red-500">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5" />
                  Intensify Preview
                </h3>
                <p className="text-orange-100 text-sm">
                  {intensifyTotalSessions} sessions will be upgraded
                </p>
              </div>
              <button
                onClick={() => setShowIntensifyPreview(false)}
                className="p-1 hover:bg-white/20 rounded-lg"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-4">
                {intensifyPreview.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                      Session {index + 1}
                    </div>
                    
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                      {/* Before */}
                      <div className="p-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Before</div>
                        <h4 className="font-semibold text-gray-700 mb-1">{item.before.name}</h4>
                        <p className="text-sm text-gray-500 mb-2">{item.before.description || 'No description'}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                            {item.before.duration_mins} min
                          </span>
                        </div>
                      </div>
                      
                      {/* After */}
                      <div className="p-3 bg-orange-50/50">
                        <div className="text-xs text-orange-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          After
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{item.after.name}</h4>
                        <p className="text-sm text-gray-700 mb-2">{item.after.description}</p>
                        {item.after.tip && (
                          <p className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded mb-2">
                            💡 {item.after.tip}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 bg-orange-200 rounded text-orange-700 font-medium">
                            {item.after.duration_mins} min
                            {item.after.duration_mins > item.before.duration_mins && (
                              <span className="ml-1 text-orange-500">
                                (+{item.after.duration_mins - item.before.duration_mins})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {intensifyTotalSessions > intensifyPreview.length && (
                <p className="text-center text-sm text-gray-500 mt-4 py-2 bg-gray-50 rounded-lg">
                  + {intensifyTotalSessions - intensifyPreview.length} more sessions will also be intensified
                </p>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowIntensifyPreview(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-white font-medium"
              >
                Cancel
              </button>
              <button
                onClick={applyIntensify}
                disabled={applyingIntensify}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {applyingIntensify ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    Apply Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup notification */}
      {popup && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className={`px-6 py-3 rounded-xl shadow-lg ${
            popup.type === 'success' ? 'bg-green-500 text-white' :
            popup.type === 'warning' ? 'bg-orange-500 text-white' :
            'bg-gray-800 text-white'
          }`}>
            <p className="font-medium">{popup.message}</p>
          </div>
          <button
            onClick={() => setPopup(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}