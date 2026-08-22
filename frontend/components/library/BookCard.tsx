'use client';

import { Flame } from 'lucide-react';

interface BookCardProps {
  id: string;
  name: string;
  emoji: string;
  category: string;
  progress: number;
  totalSessions: number;
  completedSessions: number;
  streak?: number;
  daysBehind?: number;
  nextSessionName?: string;
  isScheduledToday?: boolean;
  showContinueButton?: boolean;
  isCompleted?: boolean;
  onClick?: () => void;
}

// Richer color palettes for realistic book covers
const categoryColors: Record<string, { cover: string; spine: string; accent: string; text: string }> = {
  fitness: { cover: '#166534', spine: '#14532d', accent: '#22c55e', text: '#fff' },
  health: { cover: '#b91c1c', spine: '#991b1b', accent: '#f87171', text: '#fff' },
  languages: { cover: '#1e40af', spine: '#1e3a8a', accent: '#60a5fa', text: '#fff' },
  music: { cover: '#7e22ce', spine: '#6b21a8', accent: '#c084fc', text: '#fff' },
  skill: { cover: '#6d28d9', spine: '#5b21b6', accent: '#a78bfa', text: '#fff' },
  business: { cover: '#1f2937', spine: '#111827', accent: '#f59e0b', text: '#fff' },
  creative: { cover: '#be185d', spine: '#9d174d', accent: '#f472b6', text: '#fff' },
  education: { cover: '#b45309', spine: '#92400e', accent: '#fbbf24', text: '#fff' },
  mental_health: { cover: '#0e7490', spine: '#0c6982', accent: '#22d3ee', text: '#fff' },
  finance: { cover: '#065f46', spine: '#064e3b', accent: '#34d399', text: '#fff' },
  coding: { cover: '#334155', spine: '#1e293b', accent: '#38bdf8', text: '#fff' },
  reading: { cover: '#78350f', spine: '#5b270b', accent: '#d97706', text: '#fff' },
  default: { cover: '#4f46e5', spine: '#3730a3', accent: '#818cf8', text: '#fff' },
};

export default function BookCard({
  name,
  emoji,
  category,
  totalSessions,
  completedSessions,
  streak = 0,
  daysBehind = 0,
  isScheduledToday = false,
  showContinueButton = false,
  isCompleted = false,
  onClick,
}: BookCardProps) {
  const colors = categoryColors[category] || categoryColors.default;
  const progressPercent = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
  
  // Page count affects visible page thickness (20-50px based on sessions)
  const pageThickness = Math.min(50, Math.max(20, totalSessions * 1.5));
  
  // Determine progress color for the page edges
  const getProgressColor = () => {
    if (isCompleted) return '#fbbf24'; // gold
    if (progressPercent > 75) return '#22c55e'; // green
    if (progressPercent > 50) return '#3b82f6'; // blue
    if (progressPercent > 25) return '#f59e0b'; // amber
    return '#94a3b8'; // slate
  };

  return (
    <button
      onClick={onClick}
      className="group relative"
      style={{ perspective: '1000px' }}
    >
      {/* Main Book Container - Horizontal Layout */}
      <div 
        className="relative transition-all duration-500 ease-out"
        style={{ 
          width: '280px',
          height: '140px',
          transformStyle: 'preserve-3d',
          transform: `rotateX(10deg) rotateY(-5deg)`,
        }}
      >
        {/* Hover lift effect */}
        <div 
          className="absolute inset-0 transition-all duration-500 group-hover:-translate-y-2 group-hover:scale-[1.02]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          
          {/* === BOOK COVER (Top face) === */}
          <div 
            className="absolute rounded-sm overflow-hidden"
            style={{ 
              width: '280px',
              height: '140px',
              background: `linear-gradient(145deg, ${colors.cover} 0%, ${colors.spine} 100%)`,
              transform: `translateZ(${pageThickness}px)`,
              boxShadow: isScheduledToday 
                ? `0 8px 32px -4px rgba(0,0,0,0.4), 0 0 40px ${colors.accent}30`
                : '0 8px 24px -4px rgba(0,0,0,0.3)',
            }}
          >
            {/* Leather texture overlay */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />
            
            {/* Embossed border */}
            <div 
              className="absolute inset-2 border rounded-sm pointer-events-none"
              style={{ 
                borderColor: `${colors.accent}30`,
                boxShadow: `inset 0 0 20px ${colors.spine}40`,
              }}
            />
            
            {/* Gold foil accents for completed */}
            {isCompleted && (
              <>
                <div 
                  className="absolute top-3 left-3 right-3 h-[2px] rounded"
                  style={{ background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)' }}
                />
                <div 
                  className="absolute bottom-3 left-3 right-3 h-[2px] rounded"
                  style={{ background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)' }}
                />
              </>
            )}

            {/* Cover Content */}
            <div className="absolute inset-0 p-4 flex items-center gap-4">
              {/* Left: Emoji & Title */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <span className="text-3xl mb-1 drop-shadow-lg">{emoji}</span>
                <h3 
                  className="font-bold text-sm leading-tight line-clamp-2"
                  style={{ 
                    color: colors.text,
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }}
                >
                  {name}
                </h3>
                <p 
                  className="text-xs mt-1 opacity-80"
                  style={{ color: colors.text }}
                >
                  {completedSessions}/{totalSessions} pages
                </p>
              </div>

              {/* Right: Status & Progress */}
              <div className="flex flex-col items-end gap-2">
                {/* Status badges */}
                {isCompleted && (
                  <div className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">
                    ★ COMPLETE
                  </div>
                )}
                {!isCompleted && streak > 0 && (
                  <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">
                    <Flame className="w-3 h-3" />
                    {streak} streak
                  </div>
                )}
                {!isCompleted && daysBehind > 0 && (
                  <div className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">
                    {daysBehind} behind
                  </div>
                )}
                
                {/* Progress ring */}
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    {/* Background ring */}
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="4"
                      fill="none"
                    />
                    {/* Progress ring */}
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      stroke={getProgressColor()}
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(progressPercent / 100) * 113.1} 113.1`}
                      className="transition-all duration-700"
                      style={{
                        filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))',
                      }}
                    />
                  </svg>
                  <span 
                    className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ color: colors.text }}
                  >
                    {Math.round(progressPercent)}%
                  </span>
                </div>
              </div>
            </div>


          </div>

          {/* === PAGES (Right edge - the main realistic book pages) === */}
          <div 
            className="absolute overflow-hidden"
            style={{ 
              width: `${pageThickness}px`,
              height: '134px',
              top: '3px',
              right: '-2px',
              transform: `rotateY(90deg) translateZ(${280 - pageThickness/2}px) translateX(-${pageThickness/2}px)`,
              borderRadius: '0 2px 2px 0',
            }}
          >
            {/* Page stack gradient */}
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right,
                  #f5f5f0 0%,
                  #fafaf5 10%,
                  #f5f5f0 20%,
                  #fafaf5 30%,
                  #f5f5f0 40%,
                  #fafaf5 50%,
                  #f5f5f0 60%,
                  #fafaf5 70%,
                  #f5f5f0 80%,
                  #fafaf5 90%,
                  #ebe8e0 100%
                )`,
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
              }}
            />
            {/* Individual page lines */}
            {Array.from({ length: Math.floor(pageThickness / 3) }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${i * 3}px`,
                  width: '1px',
                  background: i % 2 === 0 ? '#e5e5dc' : '#d4d4c8',
                }}
              />
            ))}
            {/* Progress indicator on pages */}
            <div 
              className="absolute bottom-0 left-0 right-0 transition-all duration-500"
              style={{
                height: `${progressPercent}%`,
                background: `linear-gradient(to top, ${getProgressColor()}40, ${getProgressColor()}10)`,
              }}
            />
          </div>



          {/* === BOTTOM (under the pages) === */}
          <div 
            className="absolute"
            style={{ 
              width: '280px',
              height: `${pageThickness}px`,
              bottom: '0px',
              left: '0px',
              background: `linear-gradient(to bottom, #ebe8e0, #d4d4c8)`,
              transform: `rotateX(90deg) translateZ(${pageThickness/2}px) translateY(${pageThickness/2}px)`,
              borderRadius: '0 0 2px 2px',
            }}
          >
            {/* Bottom page lines */}
            <div 
              className="absolute inset-0"
              style={{
                background: `repeating-linear-gradient(
                  to bottom,
                  transparent 0px,
                  transparent 2px,
                  #ccc 2px,
                  #ccc 3px
                )`,
              }}
            />
          </div>

          {/* === BACK COVER === */}
          <div 
            className="absolute rounded-sm"
            style={{ 
              width: '280px',
              height: '140px',
              background: colors.spine,
              transform: `translateZ(0px)`,
            }}
          />
        </div>
      </div>

      {/* Shadow on surface */}
      <div 
        className="absolute -bottom-2 left-4 right-4 h-4 rounded-full opacity-20 blur-md transition-all duration-500 group-hover:opacity-30 group-hover:blur-lg"
        style={{ 
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)',
        }}
      />

      {/* Hover continue button */}
      {showContinueButton && !isCompleted && (
        <div 
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-hover:-bottom-10 transition-all duration-300"
        >
          <div className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-5 py-2 rounded-xl shadow-xl whitespace-nowrap">
            Continue Reading →
          </div>
        </div>
      )}
    </button>
  );
}