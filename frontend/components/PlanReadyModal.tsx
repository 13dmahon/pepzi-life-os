'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Check,
  Sparkles,
  ArrowRight,
  Flame,
} from 'lucide-react';

interface PlanReadyModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalName: string;
  goalIcon: string;
  firstSessionDay: string; // "Today" or "Tomorrow" or "Monday"
  firstSessionTime: string; // "7:00 PM"
  sessionDuration: number;
  totalWeeks: number;
  sessionsPerWeek: number;
}

export default function PlanReadyModal({
  isOpen,
  onClose,
  goalName,
  goalIcon,
  firstSessionDay,
  firstSessionTime,
  sessionDuration,
  totalWeeks,
  sessionsPerWeek,
}: PlanReadyModalProps) {
  if (!isOpen) return null;

  const isToday = firstSessionDay.toLowerCase() === 'today';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden"
        >
          {/* Confetti/celebration background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  y: -20, 
                  x: Math.random() * 100 + '%',
                  rotate: 0,
                  opacity: 1 
                }}
                animate={{ 
                  y: '120%',
                  rotate: Math.random() * 360,
                  opacity: 0 
                }}
                transition={{ 
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: 'easeOut'
                }}
                className={`absolute w-2 h-2 rounded-sm ${
                  ['bg-emerald-400', 'bg-blue-400', 'bg-amber-400', 'bg-pink-400', 'bg-purple-400'][i % 5]
                }`}
                style={{ left: `${Math.random() * 100}%` }}
              />
            ))}
          </div>

          {/* Header */}
          <div className="relative bg-gradient-to-r from-emerald-500 to-green-500 p-6 text-white text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', damping: 15 }}
              className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"
            >
              <span className="text-4xl">{goalIcon}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-medium text-emerald-100">Your plan is ready!</span>
              </div>
              <h2 className="text-xl font-bold">{goalName}</h2>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* First Session Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`p-4 rounded-2xl mb-4 ${
                isToday 
                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100' 
                  : 'bg-slate-50 border border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Calendar className={`w-4 h-4 ${isToday ? 'text-amber-600' : 'text-slate-500'}`} />
                <span className={`text-sm font-medium ${isToday ? 'text-amber-700' : 'text-slate-600'}`}>
                  First session
                </span>
                {isToday && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                    TODAY
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-800">
                    {firstSessionDay} at {firstSessionTime}
                  </p>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {sessionDuration} minutes
                  </p>
                </div>
                {isToday && (
                  <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                    <Flame className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-2 gap-3 mb-6"
            >
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{totalWeeks}</p>
                <p className="text-xs text-slate-500">weeks to goal</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{sessionsPerWeek}x</p>
                <p className="text-xs text-slate-500">per week</p>
              </div>
            </motion.div>

            {/* CTA */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={onClose}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              {isToday ? "Let's go!" : "Got it"}
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <p className="text-xs text-slate-400 text-center mt-3">
              You can always reschedule from your calendar
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}