'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Check, Clock, Calendar, RotateCcw, Loader2 } from 'lucide-react';
import { scheduleAPI } from '@/lib/api';

interface Message {
  id: string;
  type: 'assistant' | 'user' | 'missed_session' | 'daily_summary' | 'action';
  content: string;
  timestamp: Date;
  sessionId?: string;
  sessionName?: string;
  actions?: any[];
  buttons?: Array<{
    label: string;
    action: 'did_it' | 'reschedule' | 'skip';
    variant: 'primary' | 'secondary' | 'danger';
  }>;
}

interface TodayTask {
  id: string;
  name: string;
  description?: string;
  tip?: string;
  goal_name: string;
  goal_id?: string;
  category?: string;
  type?: string;
  scheduled_time: string;
  duration_mins: number;
  status: string;
  completed_at?: string;
  notes?: string;
  previous_notes?: string;
}

interface TodayChatProps {
  userId: string;
  tasks: TodayTask[];
  onActivityLogged?: () => void;
  onTaskComplete?: (taskId: string, notes: string) => void;
}

const API_URL = 'https://pepzi-backend-1029121217006.europe-west2.run.app';

export default function TodayChat({ userId, tasks: allTasks, onActivityLogged, onTaskComplete }: TodayChatProps) {
  // Filter out non-training blocks
  const tasks = allTasks.filter((t) => 
    t.goal_id && !['work', 'commute', 'event', 'sleep', 'social'].includes(t.type || t.category || '')
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [activeTask, setActiveTask] = useState<TodayTask | null>(null);
  const [notes, setNotes] = useState('');
  const [showRescheduleOptions, setShowRescheduleOptions] = useState(false);
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{type: string; content: string}>>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    initializeChat();
  }, [tasks.length]);

  const initializeChat = () => {
    const newMessages: Message[] = [];
    const now = new Date();
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    const hour = now.getHours();
    let greeting = 'Hey!';
    if (hour < 12) greeting = 'Good morning!';
    else if (hour < 17) greeting = 'Hey!';
    else greeting = 'Evening!';

    // Daily summary
    let summaryText = `${greeting} I'm Pepzi, your AI assistant. `;
    
    if (pendingTasks.length === 0 && completedTasks.length > 0) {
      summaryText += `You've crushed all ${completedTasks.length} sessions today! 🎉`;
    } else if (pendingTasks.length > 0) {
      const totalHours = Math.round(pendingTasks.reduce((sum, t) => sum + t.duration_mins, 0) / 60 * 10) / 10;
      summaryText += `You have ${pendingTasks.length} session${pendingTasks.length > 1 ? 's' : ''} left (${totalHours}h).`;
    } else {
      summaryText += `No sessions scheduled for today.`;
    }
    
    summaryText += `\n\nI can help you:\n• Book events or block time\n• Reschedule or skip sessions\n• Log completed workouts\n• Check your schedule\n\nJust chat naturally! 💬`;

    newMessages.push({
      id: 'greeting',
      type: 'daily_summary',
      content: summaryText,
      timestamp: now,
    });

    // Check for missed sessions
    const missedSessions = pendingTasks.filter(task => {
      const scheduledTime = new Date(task.scheduled_time);
      const sessionEnd = new Date(scheduledTime.getTime() + task.duration_mins * 60000);
      return sessionEnd < now;
    });

    for (const missed of missedSessions) {
      const scheduledTime = new Date(missed.scheduled_time);
      const timeStr = scheduledTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      newMessages.push({
        id: `missed-${missed.id}`,
        type: 'missed_session',
        content: `Did you do "${missed.name}"? It was scheduled for ${timeStr}.`,
        timestamp: now,
        sessionId: missed.id,
        sessionName: missed.name,
        buttons: [
          { label: 'Yes, done! ✓', action: 'did_it', variant: 'primary' },
          { label: 'Reschedule', action: 'reschedule', variant: 'secondary' },
          { label: 'Skip', action: 'skip', variant: 'danger' },
        ],
      });
    }

    setMessages(newMessages);
  };

  // Handle button clicks on missed session cards
  const handleSessionAction = async (action: string, sessionId: string, sessionName: string) => {
    if (action === 'did_it') {
      const task = tasks.find(t => t.id === sessionId);
      if (task) {
        setActiveTask(task);
        setNotes('');
        setShowNotesModal(true);
      }
    } else if (action === 'reschedule') {
      setRescheduleTaskId(sessionId);
      setShowRescheduleOptions(true);
    } else if (action === 'skip') {
      await handleSkip(sessionId, sessionName);
    }
  };

  const handleSkip = async (sessionId: string, sessionName: string) => {
    try {
      setIsLoading(true);
      const result = await scheduleAPI.skipBlock(sessionId);
      setMessages(prev => prev.filter(m => m.sessionId !== sessionId));
      
      addAssistantMessage(
        result.deadline_impact 
          ? `Skipped "${sessionName}". ${result.deadline_impact}`
          : `Skipped "${sessionName}". No worries, we'll keep moving! 👍`
      );
      onActivityLogged?.();
    } catch (error) {
      console.error('Skip error:', error);
      addAssistantMessage("Had trouble skipping that. Try again?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReschedule = async (option: 'later_today' | 'tomorrow' | 'pick') => {
    if (!rescheduleTaskId) return;
    
    if (option === 'pick') {
      setShowRescheduleOptions(false);
      setRescheduleTaskId(null);
      addAssistantMessage("No problem! Just tell me when you'd like to do it, like 'move it to Thursday at 6pm'");
      return;
    }
    
    const task = tasks.find(t => t.id === rescheduleTaskId);
    if (!task) return;

    try {
      setIsLoading(true);
      setShowRescheduleOptions(false);
      
      const result = await scheduleAPI.rescheduleBlock(rescheduleTaskId, option);
      setMessages(prev => prev.filter(m => m.sessionId !== rescheduleTaskId));
      
      const newTime = result.new_time 
        ? new Date(result.new_time).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
        : option === 'tomorrow' ? 'tomorrow' : 'later';
      
      addAssistantMessage(`Done! Moved "${task.name}" to ${newTime}. 📅`);
      onActivityLogged?.();
    } catch (error) {
      console.error('Reschedule error:', error);
      addAssistantMessage("Had trouble rescheduling. Try again?");
    } finally {
      setIsLoading(false);
      setRescheduleTaskId(null);
    }
  };

  const handleCompleteWithNotes = async () => {
    if (!activeTask) return;

    try {
      setIsLoading(true);
      await scheduleAPI.completeBlockWithNotes(activeTask.id, notes);
      setShowNotesModal(false);
      setMessages(prev => prev.filter(m => m.sessionId !== activeTask.id));
      
      addAssistantMessage(`Awesome! "${activeTask.name}" logged! 🎉 Keep crushing it!`);
      
      onActivityLogged?.();
      onTaskComplete?.(activeTask.id, notes);
    } catch (error) {
      console.error('Complete error:', error);
      addAssistantMessage("Had trouble saving that. Try again?");
    } finally {
      setIsLoading(false);
      setActiveTask(null);
      setNotes('');
    }
  };

  const addAssistantMessage = (content: string, actions?: any[]) => {
    const newMsg: Message = {
      id: `assistant-${Date.now()}`,
      type: actions && actions.length > 0 ? 'action' : 'assistant',
      content,
      timestamp: new Date(),
      actions,
    };
    setMessages(prev => [...prev, newMsg]);
    setConversationHistory(prev => [...prev, { type: 'assistant', content }]);
  };

  // AI-powered chat submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to UI
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setConversationHistory(prev => [...prev, { type: 'user', content: userMessage }]);

    setIsLoading(true);

    try {
      // Call AI chat endpoint
      const response = await fetch(`${API_URL}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          message: userMessage,
          conversation_history: conversationHistory.slice(-10),
          today_tasks: tasks.map(t => ({
            id: t.id,
            name: t.name,
            goal_name: t.goal_name,
            scheduled_time: t.scheduled_time,
            duration_mins: t.duration_mins,
            status: t.status,
            description: t.description,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('AI request failed');
      }

      const data = await response.json();
      
      // Add AI response
      addAssistantMessage(data.response, data.actions);
      
      // If any actions were taken, refresh the task list
      if (data.actions && data.actions.length > 0) {
        onActivityLogged?.();
      }
      
    } catch (error) {
      console.error('AI Chat error:', error);
      // Fallback to simple response
      addAssistantMessage("I'm having trouble connecting right now. Try again in a moment, or use the buttons on your task cards.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Pepzi</h2>
            <p className="text-xs text-white/80">Your AI PA</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {/* User message */}
            {message.type === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2">
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs text-white/60 mt-1">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            )}

            {/* Assistant messages */}
            {(message.type === 'assistant' || message.type === 'daily_summary' || message.type === 'action') && (
              <div className="flex justify-start">
                <div className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2 ${
                  message.type === 'action' ? 'bg-green-50 border border-green-200' : 'bg-gray-100'
                }`}>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{message.content}</p>
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <p className="text-xs text-green-600 font-medium">
                        ✓ {message.actions.length} action{message.actions.length > 1 ? 's' : ''} completed
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            )}

            {/* Missed session nudge */}
            {message.type === 'missed_session' && (
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-orange-50 border border-orange-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-start gap-2 mb-2">
                    <Clock className="w-4 h-4 text-orange-500 mt-0.5" />
                    <p className="text-sm text-gray-800">{message.content}</p>
                  </div>
                  {message.buttons && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.buttons.map((btn, i) => (
                        <button
                          key={i}
                          onClick={() => handleSessionAction(btn.action, message.sessionId!, message.sessionName!)}
                          disabled={isLoading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                            btn.variant === 'primary' ? 'bg-green-500 text-white hover:bg-green-600' :
                            btn.variant === 'danger' ? 'bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600' :
                            'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chat with Pepzi..."
            className="flex-1 px-4 py-2 rounded-full border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-sm text-gray-900 placeholder:text-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Notes Modal */}
      {showNotesModal && activeTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Nice work! 🎉</h3>
              <p className="text-sm text-gray-500">{activeTask.name}</p>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">How did it go? (optional)</label>
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
                onClick={() => { setShowNotesModal(false); setActiveTask(null); }} 
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleCompleteWithNotes} 
                disabled={isLoading} 
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />Log It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Options Modal */}
      {showRescheduleOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">When works better?</h3>
            </div>
            <div className="p-4 space-y-2">
              <button onClick={() => handleReschedule('later_today')} disabled={isLoading} className="w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" /><span className="font-medium">Later today</span>
              </button>
              <button onClick={() => handleReschedule('tomorrow')} disabled={isLoading} className="w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" /><span className="font-medium">Tomorrow</span>
              </button>
              <button onClick={() => handleReschedule('pick')} disabled={isLoading} className="w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-gray-400" /><span className="font-medium">Tell me when...</span>
              </button>
            </div>
            <div className="p-4 border-t">
              <button onClick={() => { setShowRescheduleOptions(false); setRescheduleTaskId(null); }} className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}