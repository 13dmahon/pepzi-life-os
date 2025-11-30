'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Check, X } from 'lucide-react';
import { chatAPI } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConfirmationData {
  block_id: string;
  session_name: string;
  goal_name: string;
  tracked_data: Record<string, any>;
}

interface TodayChatProps {
  userId: string;
  onActivityLogged?: () => void;
  selectedTask?: { id: string; name: string } | null;
}

const TRACKING_LABELS: Record<string, string> = {
  duration_mins: 'Duration',
  effort_level: 'Effort (1-10)',
  distance_km: 'Distance',
  time_mins: 'Time',
  pace_min_km: 'Pace',
  heart_rate: 'Heart Rate',
  calories: 'Calories',
  weight_kg: 'Weight',
  reps: 'Reps',
  sets: 'Sets',
  completed: 'Completed',
  pain_notes: 'Pain/Notes',
  new_vocabulary_count: 'New Words',
  conversation_mins: 'Speaking Time',
  lessons_completed: 'Lessons',
  tasks_completed: 'Tasks Done',
  problems_sent: 'Problems Sent',
  words_written: 'Words Written',
};

export default function TodayChat({ userId, onActivityLogged, selectedTask }: TodayChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Pepzi 👋 I can see your schedule for today. Tell me what you've completed and I'll log it with your progress data!\n\nJust say something like \"I did my morning run\" or \"finished my bed making session\".",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationState, setConversationState] = useState<any>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedTask) {
      setInput(`I just completed "${selectedTask.name}"`);
      inputRef.current?.focus();
    }
  }, [selectedTask]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await chatAPI.smartMessage({
        user_id: userId,
        message: messageText,
        conversation_state: conversationState,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationState(data.state);

      if (data.show_confirmation && data.confirmation_data) {
        setConfirmation(data.confirmation_data);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I had trouble processing that. Could you try again?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleConfirm = async () => {
    if (!confirmation) return;
    
    setIsConfirming(true);

    try {
      const data = await chatAPI.confirmLog({
        user_id: userId,
        block_id: confirmation.block_id,
        tracked_data: confirmation.tracked_data,
      });

      if (data.success) {
        const successMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMessage]);
        setConfirmation(null);
        setConversationState(null);
        onActivityLogged?.();
      }
    } catch (error) {
      console.error('Confirm error:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setConfirmation(null);
    const cancelMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "No problem! Let me know if you'd like to change anything, or we can start over.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white/80 backdrop-blur-sm px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Pepzi</h2>
            <p className="text-sm text-gray-500">Your AI Life Coach</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-4 max-w-2xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                    : 'bg-white shadow-md border border-gray-100'
                }`}
              >
                <p className={`whitespace-pre-wrap text-sm leading-relaxed ${
                  message.role === 'user' ? 'text-white' : 'text-gray-800'
                }`}>
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-md border border-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {confirmation && (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-green-200 overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                <h3 className="font-bold text-green-800">✅ Ready to Log</h3>
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <p className="font-medium text-gray-900">{confirmation.session_name}</p>
                  <p className="text-sm text-gray-500">{confirmation.goal_name}</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Tracked Data:</p>
                  <div className="space-y-1">
                    {Object.entries(confirmation.tracked_data).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{TRACKING_LABELS[key] || key}</span>
                        <span className="font-medium text-gray-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {isConfirming ? 'Logging...' : 'Confirm & Log'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isConfirming}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t bg-white/80 backdrop-blur-sm px-6 py-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what you completed..."
              className="flex-1 px-4 py-3 rounded-full border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}