'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatAPI } from '@/lib/api';
import { useUserStore } from '@/lib/store';
import { Message } from '@/types';
import { Send, Sparkles } from 'lucide-react';

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
  const userId = useUserStore((state) => state.userId);
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

      // Refresh goals or schedule if needed
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pepzi</h1>
            <p className="text-sm text-gray-500">Your AI Life Coach</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                    : 'bg-white shadow-md border border-gray-100'
                }`}
              >
                <p className={message.role === 'user' ? 'text-white' : 'text-gray-800'}>
                  {message.content}
                </p>
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <p className="text-xs text-purple-100 mb-2">Actions taken:</p>
                    {message.actions.map((action, idx) => (
                      <div key={idx} className="text-xs text-purple-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-300 rounded-full" />
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
              <div className="bg-white shadow-md border border-gray-100 rounded-2xl px-6 py-4">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white/80 backdrop-blur-sm px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what you did today, or what you want to achieve..."
              className="flex-1 px-6 py-4 rounded-full border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              disabled={sendMessageMutation.isPending}
            />
            <button
              type="submit"
              disabled={sendMessageMutation.isPending || !input.trim()}
              className="px-8 py-4 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
