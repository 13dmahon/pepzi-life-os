'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Clock, Calendar, MessageCircle, Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

// ============================================================
// SCHEDULE SLOT ANIMATION - The "Time Tetris" Hero
// ============================================================

interface Session {
  id: number;
  day: number;
  hour: number;
  label: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [7, 8, 9, 17, 18, 19, 20]; // Morning + Evening slots

// Busy slots (work, existing commitments)
const BUSY_SLOTS = [
  { day: 0, hour: 9 }, { day: 1, hour: 9 }, { day: 2, hour: 9 }, { day: 3, hour: 9 }, { day: 4, hour: 9 }, // Work
  { day: 0, hour: 17 }, { day: 1, hour: 17 }, { day: 2, hour: 17 }, { day: 3, hour: 17 }, { day: 4, hour: 17 }, // Work
  { day: 2, hour: 19 }, // Wednesday evening busy
  { day: 5, hour: 8 }, // Saturday morning busy
];

const GOALS = [
  { name: 'Learn guitar', icon: '🎸', totalHours: 50, sessionsPerWeek: 4, sessionMins: 30, color: 'from-amber-400 to-orange-500' },
  { name: 'Get fit', icon: '💪', totalHours: 40, sessionsPerWeek: 3, sessionMins: 45, color: 'from-emerald-400 to-teal-500' },
  { name: 'Learn Spanish', icon: '🇪🇸', totalHours: 60, sessionsPerWeek: 5, sessionMins: 20, color: 'from-red-400 to-rose-500' },
  { name: 'Read more', icon: '📚', totalHours: 30, sessionsPerWeek: 7, sessionMins: 15, color: 'from-blue-400 to-indigo-500' },
];

type AnimationPhase = 'typing' | 'analyzing' | 'block' | 'chopping' | 'calendar' | 'slotting' | 'complete' | 'reschedule' | 'reslotting' | 'done';

export default function ScheduleSlotAnimation() {
  const [phase, setPhase] = useState<AnimationPhase>('typing');
  const [goalIndex, setGoalIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [slottedSessions, setSlottedSessions] = useState<Session[]>([]);
  const [showReschedule, setShowReschedule] = useState(false);
  
  const currentGoal = GOALS[goalIndex];
  const totalWeeks = Math.ceil(currentGoal.totalHours / (currentGoal.sessionsPerWeek * currentGoal.sessionMins / 60));

  // Reset and start animation cycle
  useEffect(() => {
    setPhase('typing');
    setTypedText('');
    setSessions([]);
    setSlottedSessions([]);
    setShowReschedule(false);
  }, [goalIndex]);

  // Typing animation
  useEffect(() => {
    if (phase !== 'typing') return;
    
    const text = currentGoal.name;
    if (typedText.length < text.length) {
      const timeout = setTimeout(() => {
        setTypedText(text.slice(0, typedText.length + 1));
      }, 80);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => setPhase('analyzing'), 500);
      return () => clearTimeout(timeout);
    }
  }, [phase, typedText, currentGoal.name]);

  // Phase transitions
  useEffect(() => {
    if (phase === 'analyzing') {
      const timeout = setTimeout(() => setPhase('block'), 1200);
      return () => clearTimeout(timeout);
    }
    if (phase === 'block') {
      const timeout = setTimeout(() => setPhase('chopping'), 1500);
      return () => clearTimeout(timeout);
    }
    if (phase === 'chopping') {
      // Generate session pieces
      const newSessions = Array.from({ length: currentGoal.sessionsPerWeek }, (_, i) => ({
        id: i,
        day: -1,
        hour: -1,
        label: `${currentGoal.sessionMins}m`,
      }));
      setSessions(newSessions);
      const timeout = setTimeout(() => setPhase('calendar'), 1500);
      return () => clearTimeout(timeout);
    }
    if (phase === 'calendar') {
      const timeout = setTimeout(() => setPhase('slotting'), 800);
      return () => clearTimeout(timeout);
    }
    if (phase === 'slotting') {
      // Find free slots and assign sessions
      const freeSlots: { day: number; hour: number }[] = [];
      DAYS.forEach((_, dayIndex) => {
        HOURS.forEach(hour => {
          const isBusy = BUSY_SLOTS.some(b => b.day === dayIndex && b.hour === hour);
          if (!isBusy) {
            freeSlots.push({ day: dayIndex, hour });
          }
        });
      });
      
      // Distribute sessions across the week
      const distributed = sessions.map((s, i) => ({
        ...s,
        day: freeSlots[i % freeSlots.length].day,
        hour: freeSlots[i % freeSlots.length].hour,
      }));
      
      // Animate them slotting in one by one
      distributed.forEach((session, i) => {
        setTimeout(() => {
          setSlottedSessions(prev => [...prev, session]);
        }, i * 400);
      });
      
      const timeout = setTimeout(() => setPhase('complete'), sessions.length * 400 + 800);
      return () => clearTimeout(timeout);
    }
    if (phase === 'complete') {
      const timeout = setTimeout(() => setPhase('reschedule'), 2000);
      return () => clearTimeout(timeout);
    }
    if (phase === 'reschedule') {
      setShowReschedule(true);
      const timeout = setTimeout(() => setPhase('reslotting'), 2500);
      return () => clearTimeout(timeout);
    }
    if (phase === 'reslotting') {
      // Move the conflicting session
      setSlottedSessions(prev => prev.map((s, i) => 
        i === 2 ? { ...s, day: 6, hour: 18 } : s // Move to Sunday evening
      ));
      const timeout = setTimeout(() => setPhase('done'), 1500);
      return () => clearTimeout(timeout);
    }
    if (phase === 'done') {
      const timeout = setTimeout(() => {
        setGoalIndex(prev => (prev + 1) % GOALS.length);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [phase, sessions, currentGoal]);

  const isSlotBusy = (day: number, hour: number) => {
    return BUSY_SLOTS.some(b => b.day === day && b.hour === hour);
  };

  const getSessionAtSlot = (day: number, hour: number) => {
    return slottedSessions.find(s => s.day === day && s.hour === hour);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Chat Input */}
      <div className="backdrop-blur-2xl bg-white/70 border border-white/80 shadow-lg rounded-2xl p-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3">
            <div className="flex items-center">
              <span className="text-slate-600">{typedText}</span>
              {phase === 'typing' && (
                <span className="w-0.5 h-5 bg-slate-400 ml-1 animate-pulse" />
              )}
            </div>
          </div>
          <motion.div 
            className={`p-3 rounded-xl bg-gradient-to-r ${currentGoal.color} text-white`}
            animate={{ scale: phase === 'analyzing' ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 0.3, repeat: phase === 'analyzing' ? Infinity : 0 }}
          >
            <Send className="w-5 h-5" />
          </motion.div>
        </div>
      </div>

      {/* Animation Stage */}
      <div className="relative min-h-[320px]">
        
        {/* Analyzing State */}
        <AnimatePresence>
          {phase === 'analyzing' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex items-center gap-3 text-slate-500">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
                <span>Analyzing your schedule...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time Block */}
        <AnimatePresence>
          {(phase === 'block' || phase === 'chopping') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <div className="text-center mb-4">
                <span className="text-4xl mb-2 block">{currentGoal.icon}</span>
                <p className="text-slate-600 font-medium">{currentGoal.name}</p>
              </div>
              
              {/* The big block that gets chopped */}
              <div className="relative">
                <motion.div
                  className={`h-16 bg-gradient-to-r ${currentGoal.color} rounded-xl flex items-center justify-center text-white font-bold shadow-lg`}
                  initial={{ width: 280 }}
                  animate={{ 
                    width: phase === 'chopping' ? 0 : 280,
                  }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                >
                  {phase === 'block' && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      {currentGoal.totalHours} hours total
                    </span>
                  )}
                </motion.div>
                
                {/* Chopped pieces */}
                {phase === 'chopping' && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2">
                    {Array.from({ length: currentGoal.sessionsPerWeek }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0, x: -100 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
                        className={`w-14 h-14 bg-gradient-to-r ${currentGoal.color} rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md`}
                      >
                        {currentGoal.sessionMins}m
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              
              <motion.p 
                className="text-slate-400 text-sm mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: phase === 'chopping' ? 1 : 0 }}
              >
                {currentGoal.sessionsPerWeek} sessions per week × {totalWeeks} weeks
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calendar Grid */}
        <AnimatePresence>
          {['calendar', 'slotting', 'complete', 'reschedule', 'reslotting', 'done'].includes(phase) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0"
            >
              {/* Floating session pieces waiting to be slotted */}
              {phase === 'calendar' && (
                <div className="flex justify-center gap-2 mb-4">
                  {sessions.map((session, i) => (
                    <motion.div
                      key={session.id}
                      initial={{ y: -50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className={`w-12 h-12 bg-gradient-to-r ${currentGoal.color} rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md`}
                    >
                      {session.label}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Week grid */}
              <div className="backdrop-blur-xl bg-white/60 border border-white/80 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Your Week</span>
                  </div>
                  {['complete', 'reschedule', 'reslotting', 'done'].includes(phase) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1 text-green-600 text-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Scheduled</span>
                    </motion.div>
                  )}
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-slate-400 py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Time slots */}
                <div className="space-y-1">
                  {[7, 18, 19].map(hour => (
                    <div key={hour} className="grid grid-cols-7 gap-1">
                      {DAYS.map((_, dayIndex) => {
                        const isBusy = isSlotBusy(dayIndex, hour);
                        const session = getSessionAtSlot(dayIndex, hour);
                        
                        return (
                          <div
                            key={`${dayIndex}-${hour}`}
                            className={`h-10 rounded-lg flex items-center justify-center text-xs transition-all ${
                              isBusy 
                                ? 'bg-slate-200 text-slate-400' 
                                : session 
                                  ? '' 
                                  : 'bg-slate-50 border border-dashed border-slate-200'
                            }`}
                          >
                            {isBusy && !session && (
                              <span className="text-[10px]">Busy</span>
                            )}
                            {session && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className={`w-full h-full bg-gradient-to-r ${currentGoal.color} rounded-lg flex items-center justify-center text-white font-bold shadow-sm`}
                              >
                                {session.label}
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Hour labels */}
                <div className="flex justify-between mt-2 text-[10px] text-slate-300 px-1">
                  <span>7am</span>
                  <span>6pm</span>
                  <span>7pm</span>
                </div>
              </div>

              {/* Reschedule chat bubble */}
              <AnimatePresence>
                {showReschedule && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mt-4"
                  >
                    <div className="flex items-start gap-2 justify-end mb-2">
                      <div className="bg-slate-700 text-white text-sm px-4 py-2 rounded-2xl rounded-br-md max-w-[200px]">
                        I can't do Thursday evening
                      </div>
                    </div>
                    
                    {phase === 'reslotting' || phase === 'done' ? (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-white/60 border border-white/80 flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="bg-white/60 border border-white/80 text-slate-600 text-sm px-4 py-2 rounded-2xl rounded-bl-md">
                          Done! Moved to Sunday evening ✓
                        </div>
                      </motion.div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <motion.div 
        className="text-center mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: ['complete', 'reschedule', 'reslotting', 'done'].includes(phase) ? 1 : 0 }}
      >
        <Link
          href="/signup"
          className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${currentGoal.color} rounded-xl text-white font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105`}
        >
          Try with your goal
          <Send className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}