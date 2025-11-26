'use client';

import { useState } from 'react';
import { X, Send, Clock, CheckCircle } from 'lucide-react';
import { availabilityAPI } from '@/lib/api';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

export default function AvailabilityModal({ isOpen, onClose, onComplete, userId }: AvailabilityModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! Before I can schedule your goals, I need to understand your typical week. Tell me:\n\n1. What time do you wake up and go to sleep?\n2. Your work hours? (e.g., Mon-Fri 9am-6pm)\n3. Any commute or travel time?\n4. Fixed commitments? (classes, recurring meetings, sports, etc.)\n5. When do you prefer to work out? (morning/afternoon/evening/flexible)\n\nJust describe your week naturally!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [availabilitySummary, setAvailabilitySummary] = useState<any>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Extract availability from user's description
      const result = await availabilityAPI.extract(userId, input);

      // Save availability
      await availabilityAPI.save(userId, result.availability);

      setAvailabilitySummary(result.summary);

      const assistantMessage: Message = {
        role: 'assistant',
        content: `Perfect! I've analyzed your week:\n\n✅ Free time: ${result.summary.free_hours} hours/week\n⏰ Busy time: ${result.summary.busy_hours} hours/week\n\n${
          result.summary.is_feasible
            ? "Great! You have plenty of time to work on your goals. I'll use this to build your schedule!"
            : "⚠️ Heads up: You have limited free time. We'll need to prioritize your goals carefully."
        }`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Wait 2 seconds then close and complete
      setTimeout(() => {
        onComplete();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Error extracting availability:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "Hmm, I had trouble understanding that. Could you try again? For example:\n\n'I wake at 7am, sleep at 11pm. Work Mon-Fri 9am-6pm with 1 hour commute each way. Thursday evenings I play football 7-9pm. I prefer morning workouts.'",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Set Your Availability</h2>
            <p className="text-sm text-gray-600 mt-1">Tell me about your typical week</p>
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
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-sm font-semibold">
                    {msg.role === 'user' ? 'You' : '🤖 Pepzi'}
                  </span>
                  <span className="text-xs opacity-70">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          {availabilitySummary && (
            <div className="flex justify-center">
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-6 py-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Availability Saved!</p>
                  <p className="text-sm text-green-700">
                    {availabilitySummary.free_hours}h free per week
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {!availabilitySummary && (
          <div className="p-6 border-t border-gray-200">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Describe your typical week..."
                disabled={isProcessing}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

