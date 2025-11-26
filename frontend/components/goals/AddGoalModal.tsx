'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { X, Send } from 'lucide-react';
import { goalsAPI } from '@/lib/api';

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

// What we *expect* (optionally) back from /goals/conversation
interface ConversationGoal {
  name: string;
  category: string;
  target_date?: string | null;
  description?: string | null;
  weekly_hours?: number;
  total_hours?: number;
}

interface ConversationMilestone {
  name: string;
  hours?: number;
  week?: number;
  target_week?: number;
}

// 🆕 Plan edits for customized generation
interface PlanEdits {
  editInstructions: string;
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
  plan_edits?: PlanEdits; // 🆕 User customizations from plan preview phase
  preview?: any; // 🆕 Plan preview data
}

export default function AddGoalModal({
  isOpen,
  onClose,
  onGoalCreated,
  userId,
}: AddGoalModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `🎯 Hey! I'm your Elite Performance Coach.

Tell me what you want to achieve. Be as specific or vague as you like - I'll ask the right questions to build your plan.

Examples:
• "I want to run a sub-20 5K"
• "I want to learn conversational Spanish in 6 months"
• "I want to build a side project that makes £500/month"
• "I want to get stronger - maybe bench 100kg?"

What's your goal?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 🔁 full conversation_state that backend returns
  const [conversationState, setConversationState] = useState<any | null>(null);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

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
      // Type as ConversationResponse but allow unknown extra fields
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

      // ✅ If complete, create goal + plan with any customizations
      if (data.complete && data.goal && data.milestones) {
        await createGoalAndPlan(
          data.goal,
          data.milestones,
          data.tracking_criteria ?? [],
          data.weekly_hours ?? data.goal.weekly_hours ?? 3,
          data.total_hours ?? data.goal.total_hours ?? 20,
          data.sessions_per_week ?? 3,
          data.plan_edits // 🆕 Pass plan edits for customized generation
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

  const createGoalAndPlan = async (
    goalData: ConversationGoal,
    milestones: ConversationMilestone[],
    trackingCriteria: string[],
    weeklyHours: number,
    totalHours: number,
    sessionsPerWeek: number,
    planEdits?: PlanEdits // 🆕 User customizations
  ) => {
    try {
      // Safe defaults
      const safeWeeklyHours = weeklyHours ?? 3;
      const safeTotalHours = totalHours ?? 20;
      const safeSessionsPerWeek = sessionsPerWeek ?? 3;

      // 1️⃣ Create the goal
      const goal = await goalsAPI.createGoal({
        user_id: userId,
        name: goalData.name,
        category: goalData.category,
        target_date: goalData.target_date || undefined,
        description: goalData.description ?? undefined,
      });

      // Normalise milestones shape
      const normalisedMilestones = milestones.map(m => ({
        name: m.name,
        hours: m.hours ?? 0,
        week: m.week ?? m.target_week,
      }));

      // 2️⃣ Attach training plan with milestones + any customizations
      await goalsAPI.createPlanWithMilestones(goal.id, {
        milestones: normalisedMilestones,
        weekly_hours: safeWeeklyHours,
        sessions_per_week: safeSessionsPerWeek,
        total_hours: safeTotalHours,
        tracking_criteria: trackingCriteria,
        plan_edits: planEdits, // 🆕 Pass customizations to backend
      });

      const successMessage: Message = {
        role: 'assistant',
        content: '🎉 Your goal and training plan are ready! Closing this now...',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);

      setTimeout(() => {
        onGoalCreated();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error creating goal/plan:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Something went wrong saving your plan. Please try again.',
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

  // 🆕 Helper to render message content with markdown-like formatting
  const renderMessageContent = (content: string) => {
    // Split by lines and process
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Bold text: **text**
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      
      // Check if it's a tree line (├── or └──) for plan preview formatting
      if (line.includes('├──') || line.includes('└──') || line.includes('│')) {
        return (
          <div key={i} className="font-mono text-sm" dangerouslySetInnerHTML={{ __html: processed }} />
        );
      }
      
      return (
        <div key={i} dangerouslySetInnerHTML={{ __html: processed }} />
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add New Goal</h2>
            <p className="text-sm text-gray-500 mt-1">
              Chat with your Elite Coach to build a personalized plan
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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

        {/* Input */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isProcessing}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none disabled:opacity-50 bg-white"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Press Enter to send • The coach will help you refine your goal
          </p>
        </div>
      </div>
    </div>
  );
}