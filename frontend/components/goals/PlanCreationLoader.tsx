// components/goals/PlanCreationLoader.tsx
// Full-screen loading overlay with 3D rotating spheres and progress bar
// Shows while AI is generating the training plan (~60 seconds)
// Matches website aesthetic - mountain bg + glass cards + slate colors
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface PlanCreationLoaderProps {
  isVisible: boolean;
  goalName?: string;
  estimatedSeconds?: number;
}

const LOADING_MESSAGES = [
  "Analyzing your goal...",
  "Designing your training structure...",
  "Calculating optimal session lengths...",
  "Building your weekly schedule...",
  "Creating milestone checkpoints...",
  "Personalizing difficulty progression...",
  "Optimizing for your available time...",
  "Adding finishing touches...",
  "Almost there...",
];

export default function PlanCreationLoader({ 
  isVisible, 
  goalName = "your plan",
  estimatedSeconds = 60 
}: PlanCreationLoaderProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Timer for progress
  useEffect(() => {
    if (!isVisible) {
      setElapsedSeconds(0);
      setMessageIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  // Rotate through messages
  useEffect(() => {
    if (!isVisible) return;

    const messageTimer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 4000);

    return () => clearInterval(messageTimer);
  }, [isVisible]);

  // Calculate progress (cap at 95% until actually done)
  const progress = Math.min(95, (elapsedSeconds / estimatedSeconds) * 100);
  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        >
          {/* Mountain Background - Same as website */}
          <div className="absolute inset-0 z-0">
            <div 
              className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
              }}
            />
            {/* Slightly darker overlay for focus during loading */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-800/30 to-slate-900/50" />
          </div>

          {/* Subtle floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white/30 rounded-full"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                }}
                animate={{ 
                  y: [0, -20, 0],
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ 
                  duration: Math.random() * 4 + 4, 
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          {/* Content Container */}
          <div className="relative z-10 flex flex-col items-center px-6">
            
            {/* 3D Sphere Loader */}
            <div className="relative w-[180px] h-[180px] sm:w-[240px] sm:h-[240px] mb-8">
              <div className="sphere-loader">
                {Array.from({ length: 9 }).map((_, sphereIndex) => (
                  <div 
                    key={sphereIndex} 
                    className={`sphere sphere-${sphereIndex + 1}`}
                    style={{ '--rot': sphereIndex } as React.CSSProperties}
                  >
                    {Array.from({ length: 9 }).map((_, itemIndex) => (
                      <div 
                        key={itemIndex} 
                        className="sphere-item"
                        style={{ '--rot-y': itemIndex + 1 } as React.CSSProperties}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Glass Card with Text Content - Matching website style */}
            <div className="backdrop-blur-2xl bg-white/70 border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 mb-3"
              >
                <Sparkles className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                  Creating Your Plan
                </span>
                <Sparkles className="w-4 h-4 text-slate-400" />
              </motion.div>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-700 mb-2">
                {goalName}
              </h2>

              {/* Rotating message */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-slate-400 text-sm mb-6 h-5"
                >
                  {LOADING_MESSAGES[messageIndex]}
                </motion.p>
              </AnimatePresence>

              {/* Progress Bar */}
              <div className="w-full">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-slate-400 via-slate-500 to-slate-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s linear infinite',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300 mt-2">
                  <span>{formatTime(elapsedSeconds)} elapsed</span>
                  <span>~{formatTime(remainingSeconds)} remaining</span>
                </div>
              </div>

              {/* Warning */}
              <p className="text-slate-300 text-xs mt-6">
                Please don&apos;t close this page
              </p>
            </div>
          </div>

          {/* Inline Styles for 3D Animation */}
          <style jsx>{`
            .sphere-loader {
              position: relative;
              width: 100%;
              height: 100%;
              animation: rotate3d 8s linear infinite;
              transform-style: preserve-3d;
              perspective: 1000px;
            }

            .sphere {
              position: absolute;
              width: 100%;
              height: 100%;
              transform-style: preserve-3d;
              transform: rotate(calc(var(--rot) * 20deg));
            }

            /* Softer, more muted colors to match slate aesthetic */
            .sphere-1 { --bg: rgba(255, 120, 120, 0.45); }
            .sphere-2 { --bg: rgba(255, 120, 220, 0.45); }
            .sphere-3 { --bg: rgba(255, 220, 120, 0.45); }
            .sphere-4 { --bg: rgba(120, 255, 150, 0.45); }
            .sphere-5 { --bg: rgba(120, 220, 255, 0.45); }
            .sphere-6 { --bg: rgba(120, 150, 255, 0.45); }
            .sphere-7 { --bg: rgba(180, 120, 220, 0.45); }
            .sphere-8 { --bg: rgba(255, 180, 120, 0.45); }
            .sphere-9 { --bg: rgba(200, 180, 200, 0.45); }

            .sphere-item {
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: var(--bg);
              transform: rotateY(calc(var(--rot-y) * 40deg));
              backface-visibility: visible;
            }

            @keyframes rotate3d {
              0% {
                transform: rotateX(0deg) rotateY(0deg);
              }
              100% {
                transform: rotateX(360deg) rotateY(360deg);
              }
            }

            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}