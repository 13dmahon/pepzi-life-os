'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { 
  X, 
  ChevronLeft, 
  Zap, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink,
  Plus,
  Minus,
  Calendar,
  Clock,
  Target,
  Trophy,
  ArrowRight,
  MessageSquare,
  Link2,
  Send
} from 'lucide-react';
import { goalsAPI } from '@/lib/api';
import { useNavigation } from '@/components/NavigationContext';
import GoalPlanHeroCard from './GoalPlanHeroCard';
import PlanCreationLoader from './PlanCreationLoader';

// ============================================================
// TYPES
// ============================================================

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
  userId: string;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface Milestone {
  name: string;
  target_week: number;
  hours?: number;
  week?: number;
  criteria?: string;
}

interface ConversationGoal {
  name: string;
  category: string;
  target_date?: string | null;
  description?: string | null;
  weekly_hours?: number;
  total_hours?: number;
  success_condition?: string;
  current_level?: string;
  preferred_days?: string[];
  preferred_time?: 'morning' | 'afternoon' | 'evening' | 'any';
}

interface WeekPreview {
  week_number: number;
  focus: string;
  sessions: Array<{
    id?: string;
    name: string;
    description: string;
    duration_mins: number;
    notes?: string;
  }>;
}

interface PreviewData {
  week1: WeekPreview;
  midWeek: WeekPreview;
  finalWeek: WeekPreview;
}

interface ConversationResponse {
  message: string;
  state?: any;
  complete?: boolean;
  goal?: ConversationGoal;
  milestones?: Milestone[];
  tracking_criteria?: string[];
  weekly_hours?: number;
  total_hours?: number;
  sessions_per_week?: number;
  plan_edits?: { editInstructions: string };
  preview?: PreviewData;
  preferred_days?: string[];
  preferred_time?: 'morning' | 'afternoon' | 'evening' | 'any';
  show_schedule_picker?: boolean;
  fit_check?: {
    fits: boolean;
    available_hours: number;
    needed_hours: number;
    existing_goal_hours?: number;
    message: string;
    availability: {
      wake_time: string;
      sleep_time: string;
      work_schedule?: Record<string, { start: string; end: string }>;
      daily_commute_mins?: number;
    };
    existing_blocks: Array<{
      id: string;
      goal_id?: string;
      goal_name?: string;
      type: string;
      scheduled_start: string;
      duration_mins: number;
    }>;
  };
}

type ModalView = 'choose_mode' | 'basic_form' | 'chatgpt_prompt' | 'chatgpt_import' | 'ai_coach' | 'schedule_picker' | 'creating';

// ============================================================
// CONSTANTS
// ============================================================

const CATEGORIES = [
  { value: 'fitness', label: '🏃 Fitness', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'health', label: '❤️ Health', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'languages', label: '🌍 Languages', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'music', label: '🎸 Music', color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  { value: 'skill', label: '🎯 Skill', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'business', label: '💼 Business', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'creative', label: '🎨 Creative', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'education', label: '📚 Education', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'mental_health', label: '🧘 Wellness', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
];

// ============================================================
// CHATGPT PROMPT GENERATOR
// ============================================================

function generateChatGPTPrompt(goalName: string, sessionsPerWeek: number, sessionDuration: number): string {
  return `I want to achieve this goal: "${goalName}"

Please create a detailed training plan for me with the following constraints:
- ${sessionsPerWeek} sessions per week
- Each session is ${sessionDuration} minutes long

Please respond in this EXACT format so I can import it into my app:

---
GOAL: [Goal name]
TOTAL_SESSIONS: [Number - how many sessions until completion]
SESSIONS_PER_WEEK: ${sessionsPerWeek}
SESSION_DURATION: ${sessionDuration} minutes

MILESTONES:
1. [Week X] [Milestone name] - [Success criteria]
2. [Week X] [Milestone name] - [Success criteria]
3. [Week X] [Milestone name] - [Success criteria]
(add more if needed)

ESTIMATED_COMPLETION: [X weeks/months]
---

Then below that, give me a brief overview of the training approach and what each phase will focus on.`;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AddGoalModal({
  isOpen,
  onClose,
  onGoalCreated,
  userId,
}: AddGoalModalProps) {
  const { hideNav, showNav } = useNavigation();
  
  // View state
  const [view, setView] = useState<ModalView>('choose_mode');
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  
  // Basic form state
  const [goalName, setGoalName] = useState('');
  const [category, setCategory] = useState('skill');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [totalSessions, setTotalSessions] = useState(24);
  const [resourceLink, setResourceLink] = useState('');
  const [resourceLinkLabel, setResourceLinkLabel] = useState('');
  
  // ChatGPT import state
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [copied, setCopied] = useState(false);
  
  // AI Coach chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `🎯 Hey! I'm your Elite Performance Coach.

Tell me what you want to achieve. Be as specific or vague as you like - I'll ask the right questions to build your plan.

Examples:
- "I want to get more sleep"
- "I want to learn the drums"
- "I want to build a side project that makes £500/month"
- "I want to get more organised"

What's your goal?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<any | null>(null);
  
  // Schedule picker data
  const [planCardData, setPlanCardData] = useState<any>(null);
  const [fitCheckData, setFitCheckData] = useState<any>(null);
  const [creatingGoalName, setCreatingGoalName] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide/show nav
  useEffect(() => {
    if (isOpen) {
      hideNav();
    } else {
      showNav();
    }
    return () => showNav();
  }, [isOpen, hideNav, showNav]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when entering AI coach view
  useEffect(() => {
    if (view === 'ai_coach') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [view]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setView('choose_mode');
      setGoalName('');
      setCategory('skill');
      setSessionsPerWeek(3);
      setSessionDuration(60);
      setTotalSessions(24);
      setResourceLink('');
      setResourceLinkLabel('');
      setMilestones([]);
      setCopied(false);
      setPlanCardData(null);
      setFitCheckData(null);
      setIsCreatingPlan(false);
      setMessages([{
        role: 'assistant',
        content: `🎯 Hey! I'm your Elite Performance Coach.

Tell me what you want to achieve. Be as specific or vague as you like - I'll ask the right questions to build your plan.

Examples:
- "I want to get more sleep"
- "I want to learn the drums"
- "I want to build a side project that makes £500/month"
- "I want to get more organised"

What's your goal?`,
        timestamp: new Date(),
      }]);
      setInput('');
      setConversationState(null);
      setCreatingGoalName('');
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isCreatingPlan) return;
    if ((view !== 'choose_mode' && goalName) || messages.length > 1 || planCardData) {
      if (confirm('Are you sure you want to leave? Your progress will be lost.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (view === 'ai_coach' && messages.length > 1) {
      if (confirm('Go back? Your conversation will be lost.')) {
        setView('choose_mode');
        setMessages([{
          role: 'assistant',
          content: `🎯 Hey! I'm your Elite Performance Coach.

Tell me what you want to achieve. Be as specific or vague as you like - I'll ask the right questions to build your plan.

Examples:
- "I want to get more sleep"
- "I want to learn the drums"
- "I want to build a side project that makes £500/month"
- "I want to get more organised"

What's your goal?`,
          timestamp: new Date(),
        }]);
        setConversationState(null);
      }
    } else {
      setView('choose_mode');
    }
  };

  // Copy ChatGPT prompt
  const handleCopyPrompt = async () => {
    const prompt = generateChatGPTPrompt(goalName, sessionsPerWeek, sessionDuration);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add milestone
  const addMilestone = () => {
    const totalWeeks = Math.ceil(totalSessions / sessionsPerWeek);
    const nextWeek = milestones.length > 0 
      ? Math.min(milestones[milestones.length - 1].target_week + Math.floor(totalWeeks / 4), totalWeeks)
      : Math.floor(totalWeeks / 4);
    setMilestones([...milestones, { name: '', target_week: nextWeek }]);
  };

  // Remove milestone
  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  // Update milestone
  const updateMilestone = (index: number, updates: Partial<Milestone>) => {
    setMilestones(milestones.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  // Proceed to schedule picker (Quick Add flow)
  const handleProceedToScheduler = async () => {
    const totalWeeks = Math.ceil(totalSessions / sessionsPerWeek);
    const weeklyHours = (sessionsPerWeek * sessionDuration) / 60;
    
    // Build plan card data
    setPlanCardData({
      goal: {
        name: goalName,
        category,
        target_date: new Date(Date.now() + totalWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      plan: {
        weekly_hours: weeklyHours,
        sessions_per_week: sessionsPerWeek,
        session_duration_mins: sessionDuration,
        total_weeks: totalWeeks,
        total_hours: (totalSessions * sessionDuration) / 60,
      },
      preview: {
        week1: {
          week_number: 1,
          focus: 'Foundation',
          sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
            name: `Session ${i + 1}`,
            description: 'Follow your training plan',
            duration_mins: sessionDuration,
          })),
        },
        midWeek: {
          week_number: Math.ceil(totalWeeks / 2),
          focus: 'Development',
          sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
            name: `Session ${Math.ceil(totalSessions / 2) + i + 1}`,
            description: 'Building on your progress',
            duration_mins: sessionDuration,
          })),
        },
        finalWeek: {
          week_number: totalWeeks,
          focus: 'Peak Performance',
          sessions: Array.from({ length: sessionsPerWeek }, (_, i) => ({
            name: `Session ${totalSessions - sessionsPerWeek + i + 1}`,
            description: 'Final push to your goal',
            duration_mins: sessionDuration,
          })),
        },
      },
      milestones: milestones.length > 0 ? milestones : [
        { name: 'Foundation Complete', target_week: Math.ceil(totalWeeks * 0.25) },
        { name: 'Halfway Point', target_week: Math.ceil(totalWeeks * 0.5) },
        { name: 'Final Stretch', target_week: Math.ceil(totalWeeks * 0.75) },
      ],
      resource_link: resourceLink,
      resource_link_label: resourceLinkLabel,
      simple_sessions: true,
    });
    
    // Fetch fit check
    try {
      const fitResponse = await goalsAPI.checkFit(userId, weeklyHours, sessionsPerWeek);
      setFitCheckData(fitResponse);
    } catch (err) {
      console.error('Failed to fetch fit check:', err);
      setFitCheckData({
        fits: true,
        available_hours: 40,
        needed_hours: weeklyHours,
        message: 'Schedule check unavailable',
        availability: { wake_time: '07:00', sleep_time: '23:00' },
        existing_blocks: [],
      });
    }
    
    setView('schedule_picker');
  };

  // Create goal from schedule picker (Quick Add flow) - FIXED: Added sessionEdits parameter
  const handleScheduleConfirm = async (result: {
    placedSessions: Array<{ day: string; hour: number; minute: number; duration_mins: number; session_name: string }>;
    preferredDays: string[];
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
    sessionEdits?: Record<string, any>;
  }) => {
    console.log('🚀 handleScheduleConfirm called with:', result);
    
    if (!planCardData) {
      console.error('❌ No planCardData available');
      return;
    }
    
    setCreatingGoalName(planCardData.goal?.name || goalName);
    setView('creating');
    setIsCreatingPlan(true);
    
    try {
      const totalWeeks = Math.ceil(totalSessions / sessionsPerWeek);
      
      console.log('📝 Creating goal...');
      // Create goal
      const goal = await goalsAPI.createGoal({
        user_id: userId,
        name: planCardData.goal?.name || goalName,
        category: planCardData.goal?.category || category,
        target_date: new Date(Date.now() + totalWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        preferred_days: result.preferredDays,
        preferred_time: result.preferredTime,
        resource_link: resourceLink || undefined,
        resource_link_label: resourceLinkLabel || undefined,
      });
      
      console.log('✅ Goal created:', goal.id);
      console.log('📅 Creating plan with milestones...');
      
      // Create plan with simple sessions
      await goalsAPI.createPlanWithMilestones(goal.id, {
        milestones: planCardData.milestones,
        weekly_hours: planCardData.plan.weekly_hours,
        sessions_per_week: sessionsPerWeek,
        total_hours: planCardData.plan.total_hours,
        total_sessions: totalSessions,
        preferred_days: result.preferredDays,
        preferred_time: result.preferredTime,
        placed_sessions: result.placedSessions,
        simple_sessions: planCardData.simple_sessions || true,
      });
      
      console.log('✅ Plan created with schedule blocks');
      
      setTimeout(() => {
        onGoalCreated();
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error creating goal:', error);
      setView('schedule_picker');
      alert('Failed to create goal. Please try again.');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  // ============================================================
  // AI COACH HANDLERS
  // ============================================================

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const currentInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const data = (await goalsAPI.conversation(
        userId,
        currentInput,
        conversationState || undefined
      )) as ConversationResponse;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.state) {
        setConversationState(data.state);
      }

      // Extract prefs from either top-level or goal object
      const goalPreferredDays =
        data.preferred_days ??
        data.goal?.preferred_days ??
        data.state?.preferred_days ??
        ['monday', 'wednesday', 'friday'];

      const goalPreferredTime =
        data.preferred_time ??
        data.goal?.preferred_time ??
        data.state?.preferred_time ??
        'any';

      // CHECK FOR SCHEDULE PICKER / PLAN CARD
      if ((data.preview || data.show_schedule_picker) && data.goal && data.milestones) {
        console.log('📊 Plan data received, switching to GoalPlanHeroCard');
        
        const totalWeeks = data.state?.total_weeks || 
          Math.ceil((data.total_hours || 50) / (data.weekly_hours || 5));
        
        const weeklyHours = data.weekly_hours ?? data.goal.weekly_hours ?? 5;
        const sessPerWeek = data.sessions_per_week ?? 3;
        const sessionDurationMins = Math.round((weeklyHours * 60) / sessPerWeek);
        
        setPlanCardData({
          goal: data.goal,
          milestones: data.milestones,
          preview: data.preview || {
            week1: { week_number: 1, focus: 'Foundation', sessions: [] },
            midWeek: { week_number: Math.ceil(totalWeeks / 2), focus: 'Development', sessions: [] },
            finalWeek: { week_number: totalWeeks, focus: 'Peak', sessions: [] },
          },
          plan: {
            weekly_hours: weeklyHours,
            sessions_per_week: sessPerWeek,
            session_duration_mins: sessionDurationMins,
            total_weeks: totalWeeks,
            total_hours: data.total_hours ?? data.goal.total_hours ?? 50,
          },
          preferred_days: goalPreferredDays,
          preferred_time: goalPreferredTime,
          plan_edits: data.plan_edits,
          simple_sessions: false,
        });
        
        // Fetch or use provided fit check data
        if (data.fit_check) {
          setFitCheckData(data.fit_check);
        } else {
          try {
            const fitResponse = await goalsAPI.checkFit(userId, weeklyHours, sessPerWeek);
            setFitCheckData(fitResponse);
          } catch (fitErr) {
            console.error('Failed to fetch fit check:', fitErr);
            setFitCheckData({
              fits: true,
              available_hours: 40,
              needed_hours: weeklyHours,
              message: 'Schedule check unavailable',
              availability: { wake_time: '07:00', sleep_time: '23:00' },
              existing_blocks: [],
            });
          }
        }
        
        setView('schedule_picker');
        return;
      }

      // If complete (user approved via chat), create goal + plan
      if (data.complete && data.goal && data.milestones) {
        setCreatingGoalName(data.goal.name);
        setView('creating');
        setIsCreatingPlan(true);
        await createGoalAndPlan(
          data.goal,
          data.milestones,
          data.tracking_criteria ?? [],
          data.weekly_hours ?? data.goal.weekly_hours ?? 3,
          data.total_hours ?? data.goal.total_hours ?? 20,
          data.sessions_per_week ?? 3,
          data.plan_edits,
          goalPreferredDays,
          goalPreferredTime,
          undefined,
          data.preview
        );
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Can you try again?',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle confirmation from GoalPlanHeroCard (AI Coach flow)
  const handlePlanCardConfirm = async (result: {
    placedSessions: Array<{ day: string; hour: number; minute: number; duration_mins: number; session_name: string }>;
    preferredDays: string[];
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
    sessionEdits?: Record<string, any>;
  }) => {
    if (!planCardData) return;
    
    setCreatingGoalName(planCardData.goal?.name || 'your goal');
    setView('creating');
    setIsCreatingPlan(true);
    
    const planEdits = planCardData.plan_edits || { editInstructions: '' };
    if (result.sessionEdits && Object.keys(result.sessionEdits).length > 0) {
      planEdits.editInstructions += '\nSession customizations applied by user.';
    }
    
    await createGoalAndPlan(
      planCardData.goal,
      planCardData.milestones,
      [],
      planCardData.plan?.weekly_hours || 5,
      planCardData.plan?.total_hours || 50,
      planCardData.plan?.sessions_per_week || 3,
      planEdits,
      result.preferredDays,
      result.preferredTime,
      result.placedSessions,
      planCardData.preview
    );
  };

  // Handle request changes from GoalPlanHeroCard - go back to chat
  const handleRequestChanges = async (feedback: string) => {
    setView('ai_coach');
    
    const userMessage: Message = {
      role: 'user',
      content: feedback,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      const data = await goalsAPI.conversation(
        userId,
        feedback,
        conversationState || undefined
      ) as ConversationResponse;
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.state) {
        setConversationState(data.state);
      }
      
      if (data.preview && data.goal && data.milestones) {
        const goalPreferredDays =
          data.preferred_days ?? data.goal?.preferred_days ?? ['monday', 'wednesday', 'friday'];
        const goalPreferredTime =
          data.preferred_time ?? data.goal?.preferred_time ?? 'any';
        
        const totalWeeks = data.state?.total_weeks || 
          Math.ceil((data.total_hours || 50) / (data.weekly_hours || 5));
        
        const weeklyHours = data.weekly_hours ?? 5;
        const sessPerWeek = data.sessions_per_week ?? 3;
        
        setPlanCardData({
          goal: data.goal,
          milestones: data.milestones,
          preview: data.preview,
          plan: {
            weekly_hours: weeklyHours,
            sessions_per_week: sessPerWeek,
            session_duration_mins: Math.round((weeklyHours * 60) / sessPerWeek),
            total_weeks: totalWeeks,
            total_hours: data.total_hours ?? 50,
          },
          preferred_days: goalPreferredDays,
          preferred_time: goalPreferredTime,
          plan_edits: data.plan_edits,
          simple_sessions: false,
        });
        
        if (data.fit_check) {
          setFitCheckData(data.fit_check);
        }
        
        setView('schedule_picker');
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel from GoalPlanHeroCard
  const handleCancelPlanCard = () => {
    if (planCardData?.simple_sessions) {
      // Quick Add flow - go back to form
      setView('basic_form');
    } else {
      // AI Coach flow - go back to chat
      setView('ai_coach');
    }
    setPlanCardData(null);
    setFitCheckData(null);
  };

  const createGoalAndPlan = async (
    goalData: ConversationGoal,
    milestonesData: Milestone[],
    trackingCriteria: string[],
    weeklyHours: number,
    totalHours: number,
    sessPerWeek: number,
    planEdits?: { editInstructions: string },
    preferredDays?: string[],
    preferredTime?: 'morning' | 'afternoon' | 'evening' | 'any',
    placedSessions?: Array<{ day: string; hour: number; minute: number; duration_mins: number; session_name: string }>,
    preview?: PreviewData
  ) => {
    try {
      const safeWeeklyHours = weeklyHours ?? 3;
      const safeTotalHours = totalHours ?? 20;
      const safeSessionsPerWeek = sessPerWeek ?? 3;

      const finalPreferredDays =
        preferredDays ?? goalData.preferred_days ?? ['monday', 'wednesday', 'friday'];
      const finalPreferredTime =
        preferredTime ?? goalData.preferred_time ?? 'any';

      // 1️⃣ Create the goal
      const goal = await goalsAPI.createGoal({
        user_id: userId,
        name: goalData.name,
        category: goalData.category,
        target_date: goalData.target_date || undefined,
        description: goalData.description ?? undefined,
        preferred_days: finalPreferredDays,
        preferred_time: finalPreferredTime,
      });

      // Normalise milestones
      const normalisedMilestones = milestonesData.map(m => ({
        name: m.name,
        hours: m.hours ?? 0,
        week: m.week ?? m.target_week,
        criteria: m.criteria,
      }));

      // 2️⃣ Attach training plan - INCLUDE PREVIEW!
      await goalsAPI.createPlanWithMilestones(goal.id, {
        milestones: normalisedMilestones,
        weekly_hours: safeWeeklyHours,
        sessions_per_week: safeSessionsPerWeek,
        total_hours: safeTotalHours,
        tracking_criteria: trackingCriteria,
        plan_edits: planEdits,
        preferred_days: finalPreferredDays,
        preferred_time: finalPreferredTime,
        placed_sessions: placedSessions,
        simple_sessions: false,
        preview: preview,  // 🔧 FIX: Send the approved preview to backend!
      } as any);

      setTimeout(() => {
        onGoalCreated();
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('Error creating goal/plan:', error);
      setView('ai_coach');
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Something went wrong saving your plan. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render message content with markdown-like formatting
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      const processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if (line.includes('├──') || line.includes('└──') || line.includes('│')) {
        return <div key={i} className="font-mono text-sm" dangerouslySetInnerHTML={{ __html: processed }} />;
      }
      return <div key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  if (!isOpen) return null;

  // ============================================================
  // RENDER: CREATING
  // ============================================================
  if (view === 'creating') {
    return (
      <PlanCreationLoader 
        isVisible={true}
        goalName={creatingGoalName || 'your plan'}
        estimatedSeconds={60}
      />
    );
  }

  // ============================================================
  // RENDER: SCHEDULE PICKER
  // ============================================================
  if (view === 'schedule_picker' && planCardData && fitCheckData) {
    return (
      <div className="fixed inset-0 bg-white z-[9999]">
        <GoalPlanHeroCard
          data={{
            goal: {
              name: planCardData.goal?.name || goalName,
              category: planCardData.goal?.category || category,
              target_date: planCardData.goal?.target_date || 
                new Date(Date.now() + (planCardData.plan?.total_weeks || 12) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              success_condition: planCardData.goal?.success_condition,
            },
            plan: planCardData.plan,
            preview: planCardData.preview,
            milestones: planCardData.milestones?.map((m: any, i: number) => ({
              name: m.name,
              target_week: m.week ?? m.target_week ?? Math.round(((i + 1) * (planCardData.plan?.total_weeks || 12)) / (planCardData.milestones?.length || 3)),
              criteria: m.criteria,
            })),
          }}
          fitCheck={fitCheckData}
          onConfirm={planCardData.simple_sessions ? handleScheduleConfirm : handlePlanCardConfirm}
          onRequestChanges={planCardData.simple_sessions ? () => setView('chatgpt_import') : handleRequestChanges}
          onCancel={handleCancelPlanCard}
          isLoading={isCreatingPlan}
        />
      </div>
    );
  }

  // ============================================================
  // RENDER: AI COACH CHAT
  // ============================================================
  if (view === 'ai_coach') {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex flex-col">
        {/* Header */}
        <div 
          className="flex items-center gap-3 px-2 py-3 border-b border-gray-200 bg-white flex-shrink-0"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          <button
            onClick={handleBack}
            className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">New Goal</h2>
            <p className="text-xs text-gray-500">Chat with Elite Coach</p>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-sm font-semibold">
                    {msg.role === 'user' ? 'You' : '🏆 Elite Coach'}
                  </span>
                  <span className="text-xs opacity-70">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap space-y-1">
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div 
          className="p-4 border-t border-gray-200 bg-white flex-shrink-0"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isProcessing}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none disabled:opacity-50 bg-white text-gray-900 placeholder:text-gray-400 text-base"
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="send"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isProcessing}
              className="px-5 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: MODAL CONTENT (choose_mode, basic_form, chatgpt_prompt, chatgpt_import)
  // ============================================================
  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col">
      {/* Header */}
      <div 
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={view === 'choose_mode' ? handleClose : handleBack}
          className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">
            {view === 'choose_mode' && 'New Goal'}
            {view === 'basic_form' && 'Quick Add'}
            {view === 'chatgpt_prompt' && 'ChatGPT Prompt'}
            {view === 'chatgpt_import' && 'Import Plan'}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        
        {/* ============ CHOOSE MODE ============ */}
        {view === 'choose_mode' && (
          <div className="max-w-md mx-auto space-y-4 pt-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">How do you want to create your goal?</h3>
              <p className="text-gray-500 text-sm">Choose the method that works best for you</p>
            </div>

            {/* Quick Add Option */}
            <button
              onClick={() => setView('basic_form')}
              className="w-full p-5 bg-white border-2 border-gray-200 hover:border-purple-400 rounded-2xl text-left transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Quick Add</h4>
                  <p className="text-sm text-gray-500 mb-2">
                    I already have a plan from ChatGPT, YouTube, or a course
                  </p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>30 seconds • Generic sessions</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
              </div>
            </button>

            {/* AI Coach Option - NOW OPENS CHAT VIEW */}
            <button
              onClick={() => setView('ai_coach')}
              className="w-full p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl text-left transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                  <Sparkles className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Chat with AI Coach</h4>
                  <p className="text-sm text-gray-500 mb-2">
                    Get a personalized plan built by our AI coach
                  </p>
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>2-3 minutes • Custom sessions</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
              </div>
            </button>
          </div>
        )}

        {/* ============ BASIC FORM ============ */}
        {view === 'basic_form' && (
          <div className="max-w-md mx-auto space-y-6">
            {/* Goal Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What&apos;s your goal?
              </label>
              <input
                type="text"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="e.g., Learn Spanish, Run a marathon, Learn guitar"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-gray-900"
                autoFocus
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      category === cat.value
                        ? cat.color + ' border-current'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sessions Per Week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sessions per week
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSessionsPerWeek(Math.max(1, sessionsPerWeek - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-2xl font-bold text-gray-900 w-12 text-center">{sessionsPerWeek}</span>
                <button
                  onClick={() => setSessionsPerWeek(Math.min(7, sessionsPerWeek + 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <span className="text-gray-500 text-sm">per week</span>
              </div>
            </div>

            {/* Session Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session duration: {sessionDuration} mins
              </label>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>15m</span>
                <span>1h</span>
                <span>2h</span>
                <span>3h</span>
              </div>
            </div>

            {/* Total Sessions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total sessions until completion
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTotalSessions(Math.max(sessionsPerWeek, totalSessions - sessionsPerWeek))}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <span className="text-2xl font-bold text-gray-900">{totalSessions}</span>
                  <p className="text-xs text-gray-400">
                    ≈ {Math.ceil(totalSessions / sessionsPerWeek)} weeks
                  </p>
                </div>
                <button
                  onClick={() => setTotalSessions(totalSessions + sessionsPerWeek)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Resource Link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resource Link <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={resourceLink}
                onChange={(e) => setResourceLink(e.target.value)}
                placeholder="https://chat.openai.com/c/... or YouTube link"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-gray-900 text-sm"
              />
              {resourceLink && (
                <input
                  type="text"
                  value={resourceLinkLabel}
                  onChange={(e) => setResourceLinkLabel(e.target.value)}
                  placeholder="Button label (e.g., 'Open ChatGPT Plan')"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-gray-900 text-sm mt-2"
                />
              )}
              <p className="text-xs text-gray-400 mt-1">
                Link to your ChatGPT plan, YouTube tutorial, or course
              </p>
            </div>

            {/* Get ChatGPT Prompt Helper */}
            {goalName && (
              <button
                onClick={() => setView('chatgpt_prompt')}
                className="w-full p-4 bg-emerald-50 border border-emerald-200 hover:border-emerald-400 rounded-xl text-left transition-all flex items-center gap-3"
              >
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-medium text-emerald-700 text-sm">Need a plan from ChatGPT?</p>
                  <p className="text-xs text-emerald-600">Get a prompt to copy into ChatGPT</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            {/* Summary */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h4 className="font-medium text-purple-900 mb-2">Plan Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-purple-600">Sessions:</div>
                <div className="text-purple-900 font-medium">{totalSessions} total</div>
                <div className="text-purple-600">Duration:</div>
                <div className="text-purple-900 font-medium">{Math.ceil(totalSessions / sessionsPerWeek)} weeks</div>
                <div className="text-purple-600">Weekly time:</div>
                <div className="text-purple-900 font-medium">{(sessionsPerWeek * sessionDuration / 60).toFixed(1)}h</div>
              </div>
            </div>
          </div>
        )}

        {/* ============ CHATGPT PROMPT ============ */}
        {view === 'chatgpt_prompt' && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Get Your Custom Plan</h3>
              <p className="text-gray-500 text-sm">Copy this prompt to ChatGPT, then come back with your plan</p>
            </div>

            {/* Prompt Box */}
            <div className="relative">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                {generateChatGPTPrompt(goalName, sessionsPerWeek, sessionDuration)}
              </div>
              <button
                onClick={handleCopyPrompt}
                className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${
                  copied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Open ChatGPT */}
            <a
              href="https://chat.openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-5 py-3 bg-[#10a37f] hover:bg-[#0e8f6f] text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              Open ChatGPT
            </a>

            <div className="text-center">
              <button
                onClick={() => setView('chatgpt_import')}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                I have my plan ready →
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={() => setView('basic_form')}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Back to form
              </button>
            </div>
          </div>
        )}

        {/* ============ CHATGPT IMPORT ============ */}
        {view === 'chatgpt_import' && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Enter Your Plan Details</h3>
              <p className="text-gray-500 text-sm">Fill in the details from your ChatGPT plan</p>
            </div>

            {/* Total Sessions from ChatGPT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total sessions (from ChatGPT)
              </label>
              <input
                type="number"
                value={totalSessions}
                onChange={(e) => setTotalSessions(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1">
                ≈ {Math.ceil(totalSessions / sessionsPerWeek)} weeks at {sessionsPerWeek} sessions/week
              </p>
            </div>

            {/* Milestones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Milestones <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <button
                  onClick={addMilestone}
                  className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              
              {milestones.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-2">
                  No milestones yet. Click &quot;Add&quot; to add milestones from your ChatGPT plan.
                </p>
              ) : (
                <div className="space-y-3">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={milestone.name}
                          onChange={(e) => updateMilestone(index, { name: e.target.value })}
                          placeholder="Milestone name"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Week</span>
                          <input
                            type="number"
                            value={milestone.target_week}
                            onChange={(e) => updateMilestone(index, { target_week: parseInt(e.target.value) || 1 })}
                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeMilestone(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ChatGPT Link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Link2 className="w-4 h-4 inline mr-1" />
                Link to your ChatGPT conversation
              </label>
              <input
                type="url"
                value={resourceLink}
                onChange={(e) => setResourceLink(e.target.value)}
                placeholder="https://chat.openai.com/c/..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-gray-900 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Save your ChatGPT link so you can reference it during sessions
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {(view === 'basic_form' || view === 'chatgpt_import') && (
        <div 
          className="p-4 border-t border-gray-200 bg-white flex-shrink-0"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleProceedToScheduler}
            disabled={!goalName.trim()}
            className="w-full px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
          >
            <Calendar className="w-5 h-5" />
            Choose Your Schedule
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}