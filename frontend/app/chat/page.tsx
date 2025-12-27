'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Message } from '@/types';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassIconBox,
  WallpaperBackground,
} from '@/components/ui/GlassUI';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m Pepzi, your AI life coach. Tell me what you\'d like to achieve, or just let me know what you did today!',
      timestamp: new Date(),
    }
  ]);
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => chatAPI.sendMessage({ user_id: userId, message }),
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        actions: data.actions_taken,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.ui_updates.goals_refresh) {
        queryClient.invalidateQueries({ queryKey: ['goals'] });
      }
      if (data.ui_updates.schedule_refresh) {
        queryClient.invalidateQueries({ queryKey: ['schedule'] });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(input);
    setInput('');
  };

  return (
    <WallpaperBackground>
      <div className="flex flex-col h-screen pb-16 md:pb-0 md:pt-16">
        
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <GlassIconBox>
                <Sparkles className="w-5 h-5 text-slate-500" />
              </GlassIconBox>
              <div>
                <h1 className="text-lg font-semibold text-slate-700">Pepzi</h1>
                <p className="text-xs text-slate-400">Your AI Life Coach</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-white/50 border border-white/60 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <Sparkles className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                    message.role === 'user'
                      ? 'bg-slate-700 text-white'
                      : 'backdrop-blur-xl bg-white/70 border border-white/80 shadow-sm'
                  }`}
                >
                  <p className={`text-sm leading-relaxed ${message.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                    {message.content}
                  </p>
                  
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/40">
                      <p className="text-xs text-slate-400 mb-2">Actions taken:</p>
                      {message.actions.map((action, idx) => (
                        <div key={idx} className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                          {action.type}: {action.data.log_id ? 'Logged' : 'Created'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {sendMessageMutation.isPending && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-white/50 border border-white/60 flex items-center justify-center flex-shrink-0 mr-2">
                  <Sparkles className="w-4 h-4 text-slate-400" />
                </div>
                <GlassCard className="px-5 py-3.5" hover={false}>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pb-4">
          <GlassCard className="p-2" hover={false}>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell me what you did today, or what you want to achieve..."
                className="flex-1 px-4 py-3 bg-transparent text-slate-700 placeholder-slate-400 outline-none text-sm"
                disabled={sendMessageMutation.isPending}
              />
              <GlassButton
                type="submit"
                disabled={sendMessageMutation.isPending || !input.trim()}
                size="md"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </GlassButton>
            </form>
          </GlassCard>
          
          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {['Log an activity', 'Create a goal', 'How am I doing?'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-white/40 hover:bg-white/60 border border-white/50 rounded-full transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </WallpaperBackground>
  );
}