'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { X, Send, AlertTriangle, ChevronLeft } from 'lucide-react';
import { goalsAPI } from '@/lib/api';
import { useNavigation } from '@/components/NavigationContext';
import GoalPlanHeroCard from './GoalPlanHeroCard';
import PlanCreationLoader from './PlanCreationLoader';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
  userId: string;
}

// Response types from /goals/conversation
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

interface ConversationMilestone {
  name: string;
  hours?: number;
  week?: number;
  target_week?: number;
  criteria?: string;
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
  milestones?: ConversationMilestone[];
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

// View states for the modal
type ModalView = 'chat' | 'plan_card' | 'creating';

export default function AddGoalModal({
  isOpen,
  onClose,
  onGoalCreated,
  userId,
}: AddGoalModalProps) {
  // ============================================================
  // STATE
  // ============================================================
  
  // Navigation context - hide bottom nav when modal is open
  const { hideNav, showNav } = useNavigation();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `🎯 Hey! I'm your Elite Performance Coach.

Tell me what you want to achieve. Be as specific or vague as you like - I'll ask the right questions to build your plan.

Examples:
• "I want to get more sleep"
• "I want to learn the drums"
• "I want to build a side project that makes £500/month"
• "I want to get more organised"

What's your goal?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<any | null>(null);
  
  // View state
  const [view, setView] = useState<ModalView>('chat');
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  
  // Store goal name for loading screen
  const [creatingGoalName, setCreatingGoalName] = useState<string>('');
  
  // Data for the merged GoalPlanHeroCard
  const [planCardData, setPlanCardData] = useState<{
    goal: ConversationGoal;
    milestones: ConversationMilestone[];
    preview: PreviewData;
    weekly_hours: number;
    sessions_per_week: number;
    session_duration_mins: number;
    total_hours: number;
    total_weeks: number;
    preferred_days: string[];
    preferred_time: 'morning' | 'afternoon' | 'evening' | 'any';
    plan_edits?: { editInstructions: string };
  } | null>(null);
  
  // Fit check data for schedule picker
  const [fitCheckData, setFitCheckData] = useState<ConversationResponse['fit_check'] | null>(null);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide/show bottom nav when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      hideNav();
    } else {
      showNav();
    }
    
    // Cleanup: show nav when component unmounts
    return () => {
      showNav();
    };
  }, [isOpen, hideNav, showNav]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle close with confirmation if in progress
  const handleClose = () => {
    if (isCreatingPlan) {
      // Don't allow closing while creating
      return;
    }
    
    if (messages.length > 1 || planCardData) {
      if (confirm('Are you sure you want to leave? Your progress will be lost.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Prevent accidental back navigation on mobile
  useEffect(() => {
    if (!isOpen) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (messages.length > 1 || planCardData) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (messages.length > 1 || planCardData) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        if (confirm('Are you sure you want to leave? Your progress will be lost.')) {
          onClose();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, messages.length, planCardData, onClose]);

  if (!isOpen) return null;

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleSend = async () => {
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
        const sessionsPerWeek = data.sessions_per_week ?? 3;
        const sessionDurationMins = Math.round((weeklyHours * 60) / sessionsPerWeek);
        
        setPlanCardData({
          goal: data.goal,
          milestones: data.milestones,
          preview: data.preview || {
            week1: { week_number: 1, focus: 'Foundation', sessions: [] },
            midWeek: { week_number: Math.ceil(totalWeeks / 2), focus: 'Development', sessions: [] },
            finalWeek: { week_number: totalWeeks, focus: 'Peak', sessions: [] },
          },
          weekly_hours: weeklyHours,
          sessions_per_week: sessionsPerWeek,
          session_duration_mins: sessionDurationMins,
          total_hours: data.total_hours ?? data.goal.total_hours ?? 50,
          total_weeks: totalWeeks,
          preferred_days: goalPreferredDays,
          preferred_time: goalPreferredTime,
          plan_edits: data.plan_edits,
        });
        
        // Fetch or use provided fit check data
        if (data.fit_check) {
          setFitCheckData(data.fit_check);
        } else {
          try {
            const fitResponse = await goalsAPI.checkFit(userId, weeklyHours, sessionsPerWeek);
            setFitCheckData(fitResponse);
          } catch (fitErr) {
            console.error('Failed to fetch fit check:', fitErr);
            setFitCheckData({
              fits: true,
              available_hours: 40,
              needed_hours: weeklyHours,
              message: 'Schedule check unavailable',
              availability: {
                wake_time: '07:00',
                sleep_time: '23:00',
              },
              existing_blocks: [],
            });
          }
        }
        
        setView('plan_card');
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

  // Handle confirmation from GoalPlanHeroCard
  const handlePlanCardConfirm = async (result: {
    placedSessions: Array<{
      day: string;
      hour: number;
      minute: number;
      duration_mins: number;
      session_name: string;
    }>;
    preferredDays: string[];
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
    sessionEdits: Record<string, any>;
  }) => {
    if (!planCardData) return;
    
    setCreatingGoalName(planCardData.goal.name);
    setView('creating');
    setIsCreatingPlan(true);
    
    const planEdits = planCardData.plan_edits || { editInstructions: '' };
    if (Object.keys(result.sessionEdits).length > 0) {
      planEdits.editInstructions += '\nSession customizations applied by user.';
    }
    
    await createGoalAndPlan(
      planCardData.goal,
      planCardData.milestones,
      [],
      planCardData.weekly_hours,
      planCardData.total_hours,
      planCardData.sessions_per_week,
      planEdits,
      result.preferredDays,
      result.preferredTime,
      result.placedSessions,
      planCardData.preview
    );
  };

  // Handle request changes from GoalPlanHeroCard - go back to chat
  const handleRequestChanges = async (feedback: string) => {
    setView('chat');
    
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
        const sessionsPerWeek = data.sessions_per_week ?? 3;
        
        setPlanCardData({
          goal: data.goal,
          milestones: data.milestones,
          preview: data.preview,
          weekly_hours: weeklyHours,
          sessions_per_week: sessionsPerWeek,
          session_duration_mins: Math.round((weeklyHours * 60) / sessionsPerWeek),
          total_hours: data.total_hours ?? 50,
          total_weeks: totalWeeks,
          preferred_days: goalPreferredDays,
          preferred_time: goalPreferredTime,
          plan_edits: data.plan_edits,
        });
        
        if (data.fit_check) {
          setFitCheckData(data.fit_check);
        }
        
        setView('plan_card');
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel from GoalPlanHeroCard - go back to chat
  const handleCancelPlanCard = () => {
    setView('chat');
    setPlanCardData(null);
    setFitCheckData(null);
    
    const assistantMessage: Message = {
      role: 'assistant',
      content: "No problem! Let's start fresh. What goal would you like to work on?",
      timestamp: new Date(),
    };
    setMessages([assistantMessage]);
    setConversationState(null);
  };

  const createGoalAndPlan = async (
    goalData: ConversationGoal,
    milestones: ConversationMilestone[],
    trackingCriteria: string[],
    weeklyHours: number,
    totalHours: number,
    sessionsPerWeek: number,
    planEdits?: { editInstructions: string },
    preferredDays?: string[],
    preferredTime?: 'morning' | 'afternoon' | 'evening' | 'any',
    placedSessions?: Array<{
      day: string;
      hour: number;
      minute: number;
      duration_mins: number;
      session_name: string;
    }>,
    preview?: PreviewData
  ) => {
    try {
      const safeWeeklyHours = weeklyHours ?? 3;
      const safeTotalHours = totalHours ?? 20;
      const safeSessionsPerWeek = sessionsPerWeek ?? 3;

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
      const normalisedMilestones = milestones.map(m => ({
        name: m.name,
        hours: m.hours ?? 0,
        week: m.week ?? m.target_week,
        criteria: m.criteria,
      }));

      // 2️⃣ Attach training plan
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
        preview: preview,
      } as any);

      const successMessage: Message = {
        role: 'assistant',
        content:
          '🎉 Your goal and training plan are ready! Closing this now...',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);

      setTimeout(() => {
        setIsCreatingPlan(false);
        onGoalCreated();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error creating goal/plan:', error);
      setIsCreatingPlan(false);
      setView('chat');
      const errorMessage: Message = {
        role: 'assistant',
        content:
          'Something went wrong saving your plan. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to render message content with markdown-like formatting
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      if (line.includes('├──') || line.includes('└──') || line.includes('│')) {
        return (
          <div
            key={i}
            className="font-mono text-sm"
            dangerouslySetInnerHTML={{ __html: processed }}
          />
        );
      }

      return (
        <div
          key={i}
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      );
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  // VIEW: CREATING - Show the beautiful 3D loading animation
  if (view === 'creating') {
    return (
      <PlanCreationLoader 
        isVisible={true}
        goalName={creatingGoalName || 'your plan'}
        estimatedSeconds={60}
      />
    );
  }

  // VIEW: PLAN_CARD - Show the merged GoalPlanHeroCard
  if (view === 'plan_card' && planCardData && fitCheckData) {
    return (
      <div className="fixed inset-0 bg-white z-[9999]">
        <GoalPlanHeroCard
            data={{
              goal: {
                name: planCardData.goal.name,
                category: planCardData.goal.category,
                target_date: planCardData.goal.target_date || 
                  new Date(Date.now() + planCardData.total_weeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                success_condition: planCardData.goal.success_condition,
              },
              plan: {
                weekly_hours: planCardData.weekly_hours,
                sessions_per_week: planCardData.sessions_per_week,
                session_duration_mins: planCardData.session_duration_mins,
                total_weeks: planCardData.total_weeks,
                total_hours: planCardData.total_hours,
              },
              preview: planCardData.preview,
              milestones: planCardData.milestones.map((m, i) => ({
                name: m.name,
                target_week: m.week ?? m.target_week ?? Math.round(((i + 1) * planCardData.total_weeks) / planCardData.milestones.length),
                criteria: m.criteria,
              })),
            }}
            fitCheck={fitCheckData}
            onConfirm={handlePlanCardConfirm}
            onRequestChanges={handleRequestChanges}
            onCancel={handleCancelPlanCard}
            isLoading={isCreatingPlan}
          />
      </div>
    );
  }

  // VIEW: CHAT - Show the conversation (Teams-style full screen)
  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col">
      {/* Header with back button - Teams style */}
      <div 
        className="flex items-center gap-3 px-2 py-3 border-b border-gray-200 bg-white flex-shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={handleClose}
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

      {/* Chat Messages - Scrollable middle */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-sm font-semibold">
                  {msg.role === 'user' ? 'You' : '🏆 Elite Coach'}
                </span>
                <span className="text-xs opacity-70">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - Fixed at bottom with safe area */}
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
            onClick={handleSend}
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