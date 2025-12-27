'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Check, Clock, Calendar, RotateCcw, Loader2, X } from 'lucide-react';
import { scheduleAPI } from '@/lib/api';

interface Message {
  id: string;
  type: 'assistant' | 'user' | 'missed_session' | 'daily_summary' | 'action' | 'error';
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://pepzi-backend-1029121217006.europe-west2.run.app';

export default function TodayChat({ userId, tasks: allTasks, onActivityLogged, onTaskComplete }: TodayChatProps) {
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

  const addErrorMessage = (content: string) => {
    const newMsg: Message = {
      id: `error-${Date.now()}`,
      type: 'error',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMsg]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

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
        const errorText = await response.text();
        console.error(`API Error ${response.status}:`, errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.response) {
        addAssistantMessage(data.response, data.actions);
      } else if (data.error) {
        addErrorMessage(data.error);
      } else {
        addAssistantMessage("Done! ✓");
      }
      
      if (data.actions && data.actions.length > 0) {
        onActivityLogged?.();
      }
      
    } catch (error: any) {
      console.error('AI Chat error:', error);
      const errorDetails = error.message || 'Unknown error';
      addErrorMessage(`Connection issue: ${errorDetails}. Try using the buttons on task cards instead.`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Inline styles for modal overlay
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99999,
  };

  // Inline styles for modal card - ABSOLUTE with TOP
  const modalCardStyle: React.CSSProperties = {
    position: 'absolute',
    top: '80px',
    left: '16px',
    right: '16px',
    maxWidth: '400px',
    margin: '0 auto',
    backgroundColor: 'white',
    borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="backdrop-blur-xl bg-white/60 border-b border-white/40 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/50 border border-white/60 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-700">Pepzi</h2>
            <p className="text-xs text-slate-400">Your AI PA</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {message.type === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-slate-700 text-white rounded-2xl rounded-br-md px-4 py-2">
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs text-white/60 mt-1">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            )}

            {(message.type === 'assistant' || message.type === 'daily_summary' || message.type === 'action') && (
              <div className="flex justify-start">
                <div className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2 backdrop-blur-sm ${
                  message.type === 'action' 
                    ? 'bg-emerald-50/80 border border-emerald-200/50' 
                    : 'bg-white/70 border border-white/60'
                }`}>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{message.content}</p>
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-emerald-200/50">
                      <p className="text-xs text-emerald-600 font-medium">
                        ✓ {message.actions.length} action{message.actions.length > 1 ? 's' : ''} completed
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            )}

            {message.type === 'error' && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2 backdrop-blur-sm bg-rose-50/80 border border-rose-200/50">
                  <p className="text-sm text-rose-700 whitespace-pre-line">{message.content}</p>
                  <p className="text-xs text-rose-400 mt-1">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            )}

            {message.type === 'missed_session' && (
              <div className="flex justify-start">
                <div className="max-w-[90%] backdrop-blur-sm bg-amber-50/80 border border-amber-200/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-start gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-500 mt-0.5" />
                    <p className="text-sm text-slate-700">{message.content}</p>
                  </div>
                  {message.buttons && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.buttons.map((btn, i) => (
                        <button
                          key={i}
                          onClick={() => handleSessionAction(btn.action, message.sessionId!, message.sessionName!)}
                          disabled={isLoading}
                          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                            btn.variant === 'primary' 
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                              : btn.variant === 'danger' 
                                ? 'bg-white/60 text-slate-500 hover:bg-rose-100 hover:text-rose-600 border border-white/60' 
                                : 'bg-white/60 border border-white/60 text-slate-600 hover:bg-white/80'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="backdrop-blur-sm bg-white/70 border border-white/60 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                <span className="text-sm text-slate-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="backdrop-blur-xl bg-white/60 border-t border-white/40 px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chat with Pepzi..."
            className="flex-1 px-4 py-2.5 rounded-2xl border border-white/60 bg-white/50 focus:bg-white/70 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-slate-700 text-white rounded-2xl hover:bg-slate-600 hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* ============================================================ */}
      {/* NOTES MODAL - Card has absolute positioning with top: 80px */}
      {/* ============================================================ */}
      {showNotesModal && activeTask && (
        <div 
          style={overlayStyle}
          onClick={() => { setShowNotesModal(false); setActiveTask(null); }}
        >
          <div 
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#334155', margin: 0 }}>Nice work! 🎉</h3>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>{activeTask.name}</p>
                </div>
                <button 
                  onClick={() => { setShowNotesModal(false); setActiveTask(null); }}
                  style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <X style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
                </button>
              </div>
            </div>
            
            {/* Notes input */}
            <div style={{ padding: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#475569', marginBottom: '8px' }}>
                How did it go? (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this session..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  fontSize: '14px',
                  color: '#334155',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                rows={2}
                autoFocus
              />
            </div>
            
            {/* Buttons */}
            <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => { setShowNotesModal(false); setActiveTask(null); }} 
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#475569',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleCompleteWithNotes} 
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <Check style={{ width: '20px', height: '20px' }} />
                Log It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* RESCHEDULE MODAL */}
      {/* ============================================================ */}
      {showRescheduleOptions && (
        <div 
          style={overlayStyle}
          onClick={() => { setShowRescheduleOptions(false); setRescheduleTaskId(null); }}
        >
          <div 
            style={{...modalCardStyle, maxWidth: '360px'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#334155', margin: 0 }}>When works better?</h3>
                <button 
                  onClick={() => { setShowRescheduleOptions(false); setRescheduleTaskId(null); }}
                  style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <X style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
                </button>
              </div>
            </div>
            <div style={{ padding: '12px' }}>
              {[
                { option: 'later_today' as const, icon: Clock, label: 'Later today' },
                { option: 'tomorrow' as const, icon: Calendar, label: 'Tomorrow' },
                { option: 'pick' as const, icon: RotateCcw, label: 'Tell me when...' },
              ].map(({ option, icon: Icon, label }) => (
                <button 
                  key={option}
                  onClick={() => handleReschedule(option)} 
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    marginBottom: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'left',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  <Icon style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}