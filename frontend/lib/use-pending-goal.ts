'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';

// ============================================================
// TYPES
// ============================================================

interface ScheduleSelection {
  days: string[];
  preferredTime: 'morning' | 'afternoon' | 'evening';
  specificTimes: Record<string, string>;
}

interface PendingGoal {
  name: string;
  category: string;
  plan: {
    weekly_hours: number;
    sessions_per_week: number;
    session_length_mins: number;
    total_weeks: number;
    total_hours: number;
  };
  schedule?: ScheduleSelection; // Optional - if not provided, auto-schedule
}

export interface PlanReadyData {
  goalName: string;
  goalIcon: string;
  firstSessionDay: string;
  firstSessionTime: string;
  sessionDuration: number;
  totalWeeks: number;
  sessionsPerWeek: number;
}

// ============================================================
// CONSTANTS
// ============================================================

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  fitness: '💪',
  skill: '🎯',
  education: '📚',
  languages: '🌍',
  music: '🎸',
  business: '💼',
  creative: '🎨',
  health: '❤️',
  mental_health: '🧘',
  running: '🏃',
  climbing: '🧗',
  default: '🎯',
};

// Time preference to actual time
const TIME_PREFERENCE_MAP: Record<string, string> = {
  morning: '07:00',
  afternoon: '12:30',
  evening: '18:30',
};

// Day name to day index (0 = Sunday, 1 = Monday, etc.)
const DAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Generate session titles based on category and week
const generateSessionContent = (
  goalName: string, 
  category: string, 
  weekNumber: number, 
  sessionNumber: number
): { title: string; description: string } => {
  const weekPhase = weekNumber <= 2 ? 'Foundation' : weekNumber <= 4 ? 'Building' : weekNumber <= 8 ? 'Development' : 'Mastery';
  
  const titles: Record<string, string[]> = {
    fitness: ['Warm-up & Basics', 'Strength Building', 'Endurance Work', 'Active Recovery', 'Power Training', 'Flexibility Focus', 'Full Body Circuit'],
    skill: ['Core Concepts', 'Practice Drills', 'Applied Learning', 'Challenge Session', 'Review & Refine', 'Advanced Techniques', 'Free Practice'],
    education: ['Study Session', 'Deep Dive', 'Review & Notes', 'Practice Problems', 'Concept Mapping', 'Quiz Yourself', 'Application Work'],
    languages: ['Vocabulary Building', 'Grammar Practice', 'Listening Skills', 'Speaking Drills', 'Reading Comprehension', 'Writing Practice', 'Conversation Sim'],
    music: ['Technique Drills', 'New Material', 'Review & Polish', 'Ear Training', 'Theory Study', 'Performance Prep', 'Free Play'],
    running: ['Easy Run', 'Interval Training', 'Tempo Run', 'Long Run', 'Recovery Run', 'Hill Work', 'Speed Work'],
    default: ['Session Focus', 'Skill Building', 'Practice Time', 'Review Session', 'Challenge Work', 'Consolidation', 'Free Practice'],
  };

  const categoryTitles = titles[category] || titles.default;
  const titleIndex = (sessionNumber - 1) % categoryTitles.length;
  const title = categoryTitles[titleIndex];
  
  return {
    title: `${weekPhase}: ${title}`,
    description: `Week ${weekNumber} session focusing on ${title.toLowerCase()} for ${goalName}.`,
  };
};

// Format time for display (24h to 12h)
const formatTimeForDisplay = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Get day name for display
const getDayDisplayName = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  if (checkDate.getTime() === today.getTime()) return 'Today';
  if (checkDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
  
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

// Helper: Get default days starting from today
function getDefaultDaysStartingToday(sessionsPerWeek: number, todayName: string): string[] {
  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const todayIndex = allDays.indexOf(todayName);
  
  // Reorder days to start from today
  const reorderedDays = [...allDays.slice(todayIndex), ...allDays.slice(0, todayIndex)];
  
  // Space sessions evenly
  const spacing = Math.floor(7 / sessionsPerWeek);
  const selectedDays: string[] = [];
  
  for (let i = 0; i < sessionsPerWeek; i++) {
    const dayIndex = (i * spacing) % 7;
    selectedDays.push(reorderedDays[dayIndex]);
  }
  
  // Always include today as first session
  if (!selectedDays.includes(todayName)) {
    selectedDays[0] = todayName;
  }
  
  return selectedDays;
}

// ============================================================
// HOOK
// ============================================================

export function usePendingGoal() {
  const { user, profile } = useAuth();
  const processedRef = useRef(false);
  const [planReadyData, setPlanReadyData] = useState<PlanReadyData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const dismissPlanReady = useCallback(() => {
    setPlanReadyData(null);
  }, []);

  useEffect(() => {
    if (!user || !profile || processedRef.current || isProcessing) return;

    const processPendingGoal = async () => {
      const pendingGoalStr = sessionStorage.getItem('pendingGoal');
      if (!pendingGoalStr) return;

      try {
        const pendingGoal: PendingGoal = JSON.parse(pendingGoalStr);
        console.log('[PendingGoal] Found pending goal:', pendingGoal.name);

        processedRef.current = true;
        setIsProcessing(true);
        sessionStorage.removeItem('pendingGoal');

        // Determine schedule - use provided or auto-generate
        let scheduleDays: string[];
        let scheduleTime: string;

        if (pendingGoal.schedule) {
          // User selected schedule
          scheduleDays = pendingGoal.schedule.days;
          scheduleTime = TIME_PREFERENCE_MAP[pendingGoal.schedule.preferredTime] || '18:30';
        } else {
          // Auto-schedule: include today, spread across week
          const today = new Date();
          const todayDayIndex = today.getDay();
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const todayDayName = dayNames[todayDayIndex];
          
          // Generate default days starting from today
          const defaultDays = getDefaultDaysStartingToday(pendingGoal.plan.sessions_per_week, todayDayName);
          scheduleDays = defaultDays;
          scheduleTime = '18:30'; // Default to evening
        }

        // Calculate target completion date
        const startDate = new Date();
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + (pendingGoal.plan.total_weeks * 7));

        // Create the goal
        const { data: goalData, error: goalError } = await supabase
          .from('goals')
          .insert({
            user_id: user.id,
            name: pendingGoal.name,
            category: pendingGoal.category,
            icon: CATEGORY_ICONS[pendingGoal.category] || CATEGORY_ICONS.default,
            status: 'active',
            sessions_per_week: pendingGoal.plan.sessions_per_week,
            session_length_mins: pendingGoal.plan.session_length_mins,
            total_weeks: pendingGoal.plan.total_weeks,
            total_hours: pendingGoal.plan.total_hours,
            target_completion_date: targetDate.toISOString().split('T')[0],
            current_streak: 0,
            preferred_days: scheduleDays,
            preferred_time: scheduleTime,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (goalError) {
          console.error('[PendingGoal] Error creating goal:', goalError);
          setIsProcessing(false);
          return;
        }

        console.log('[PendingGoal] Goal created:', goalData.id);

        // Generate sessions for all weeks
        const sessions = [];
        let firstSessionDate: Date | null = null;
        let sessionCounter = 0;

        for (let week = 1; week <= pendingGoal.plan.total_weeks; week++) {
          const weekStartDate = new Date(startDate);
          weekStartDate.setDate(weekStartDate.getDate() + ((week - 1) * 7));

          for (let dayIndex = 0; dayIndex < scheduleDays.length; dayIndex++) {
            sessionCounter++;
            const dayName = scheduleDays[dayIndex];
            const targetDayIndex = DAY_TO_INDEX[dayName];
            
            // Find the next occurrence of this day
            const sessionDate = new Date(weekStartDate);
            const currentDayIndex = sessionDate.getDay();
            let daysUntilTarget = targetDayIndex - currentDayIndex;
            if (daysUntilTarget < 0) daysUntilTarget += 7;
            sessionDate.setDate(sessionDate.getDate() + daysUntilTarget);

            // For week 1, ensure we don't schedule in the past
            if (week === 1) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (sessionDate < today) {
                sessionDate.setDate(sessionDate.getDate() + 7);
              }
            }

            // Track first session
            if (!firstSessionDate || sessionDate < firstSessionDate) {
              firstSessionDate = new Date(sessionDate);
            }

            const { title, description } = generateSessionContent(
              pendingGoal.name,
              pendingGoal.category,
              week,
              dayIndex + 1
            );

            sessions.push({
              user_id: user.id,
              goal_id: goalData.id,
              title,
              description,
              duration_mins: pendingGoal.plan.session_length_mins,
              scheduled_date: sessionDate.toISOString().split('T')[0],
              scheduled_time: scheduleTime,
              status: 'pending',
              week_number: week,
              session_number: dayIndex + 1,
              created_at: new Date().toISOString(),
            });
          }
        }

        // Insert all sessions
        const { error: sessionsError } = await supabase
          .from('sessions')
          .insert(sessions);

        if (sessionsError) {
          console.error('[PendingGoal] Error creating sessions:', sessionsError);
          setIsProcessing(false);
          return;
        }

        console.log('[PendingGoal] Created', sessions.length, 'sessions');

        // Set the plan ready modal data
        if (firstSessionDate) {
          setPlanReadyData({
            goalName: pendingGoal.name,
            goalIcon: CATEGORY_ICONS[pendingGoal.category] || CATEGORY_ICONS.default,
            firstSessionDay: getDayDisplayName(firstSessionDate),
            firstSessionTime: formatTimeForDisplay(scheduleTime),
            sessionDuration: pendingGoal.plan.session_length_mins,
            totalWeeks: pendingGoal.plan.total_weeks,
            sessionsPerWeek: pendingGoal.plan.sessions_per_week,
          });
        }

        setIsProcessing(false);

      } catch (err) {
        console.error('[PendingGoal] Error processing pending goal:', err);
        sessionStorage.removeItem('pendingGoal');
        setIsProcessing(false);
      }
    };

    processPendingGoal();
  }, [user, profile, isProcessing]);

  return {
    planReadyData,
    dismissPlanReady,
    isProcessing,
  };
}