'use client';

import { useState } from 'react';
import { 
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Target,
  Clock,
  Check,
  Flame,
  Trophy,
  Calendar,
  Plus,
  MessageSquare,
  Share2,
  Rocket,
  Library,
  Timer,
  PenTool,
  Zap,
  Star,
  Users,
} from 'lucide-react';

interface TutorialSlidesProps {
  onComplete: () => void;
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-2xl bg-white/70 border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

const slides = [
  {
    id: 'welcome',
    title: 'Welcome to Pepzi',
    subtitle: 'Your personal training library',
    description: 'Turn any goal into a structured training plan. We break it down into sessions, remind you to practice, and celebrate when you master it.',
  },
  {
    id: 'three-ways',
    title: 'Three Ways to Start',
    subtitle: 'Pick your path',
    description: 'Browse our catalogue of pre-built challenges, let AI create a custom plan, or build your own from scratch.',
  },
  {
    id: 'library',
    title: 'Your Library',
    subtitle: 'Books on your shelf',
    description: 'Each goal becomes a "book" with pages (sessions) to complete. See all your active books, track progress, and watch your collection grow.',
  },
  {
    id: 'today',
    title: 'Today\'s Sessions',
    subtitle: 'Your daily cork board',
    description: 'Wake up knowing exactly what to do. Today\'s sessions are pinned to your board - just tap one to start.',
  },
  {
    id: 'session',
    title: 'During a Session',
    subtitle: 'Timer, prompts & tracking',
    description: 'Start the timer, get AI guidance via ChatGPT prompts, and log what you accomplished. Track metrics like time, reps, or earnings.',
  },
  {
    id: 'mastery',
    title: 'Finish & Celebrate',
    subtitle: 'Hall of Mastery',
    description: 'Complete all sessions and your book turns golden. It moves to your trophy cabinet and you can share your achievement to the community feed.',
  },
];

export default function TutorialSlides({ onComplete }: TutorialSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/50 to-white/80" />
      </div>

      {/* Skip Button */}
      <button
        onClick={onComplete}
        className="fixed top-6 right-6 z-20 flex items-center gap-1 px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
      >
        Skip
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/80 rounded-full text-sm text-slate-600 mb-4">
              <Sparkles className="w-4 h-4 text-slate-500" />
              Quick Tour • {currentSlide + 1} of {slides.length}
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentSlide 
                    ? 'w-6 bg-slate-600' 
                    : i < currentSlide
                    ? 'w-2 bg-slate-400'
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          {/* Main Card */}
          <GlassCard className="p-6">
            {/* Slide Title */}
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">{slide.title}</h2>
              <p className="text-slate-500 text-sm">{slide.subtitle}</p>
            </div>

            {/* Mockup Area */}
            <div className="flex items-center justify-center py-4 min-h-[280px]">
              {currentSlide === 0 && <WelcomeMockup />}
              {currentSlide === 1 && <ThreeWaysMockup />}
              {currentSlide === 2 && <LibraryMockup />}
              {currentSlide === 3 && <TodayMockup />}
              {currentSlide === 4 && <SessionMockup />}
              {currentSlide === 5 && <MasteryMockup />}
            </div>

            {/* Description */}
            <p className="text-center text-slate-600 text-sm mb-6 px-2">
              {slide.description}
            </p>

            {/* Navigation */}
            <div className="flex gap-3 pt-4 border-t border-white/40">
              {currentSlide > 0 ? (
                <button
                  onClick={prevSlide}
                  className="flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:bg-white/50 rounded-xl font-medium transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <div />
              )}
              
              <div className="flex-1" />

              <button
                onClick={nextSlide}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-2xl font-medium hover:bg-slate-700 transition-all shadow-lg"
              >
                {currentSlide === slides.length - 1 ? (
                  <>
                    Let's go!
                    <Rocket className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SLIDE 1: WELCOME
// ============================================================
function WelcomeMockup() {
  return (
    <div className="w-full max-w-xs">
      <div className="text-center mb-4">
        <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <BookOpen className="w-10 h-10 text-white" />
        </div>
      </div>

      <div className="space-y-2">
        {/* Mini book cards */}
        <div className="flex justify-center gap-3">
          {['🎸', '🏋️', '🇪🇸'].map((emoji, i) => (
            <div 
              key={i}
              className="w-14 h-20 rounded-lg flex items-center justify-center text-2xl shadow-md"
              style={{
                background: ['#4a3828', '#2d4a2d', '#15253d'][i],
                transform: `rotate(${[-3, 0, 3][i]}deg)`,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>
        
        <p className="text-center text-xs text-slate-400 mt-3">
          Your goals become books in your personal library
        </p>
      </div>
    </div>
  );
}

// ============================================================
// SLIDE 2: THREE WAYS TO START
// ============================================================
function ThreeWaysMockup() {
  return (
    <div className="w-full max-w-xs space-y-2.5">
      {/* Catalogue */}
      <GlassCard className="p-3 border-2 border-purple-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Library className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">Browse Catalogue</p>
            <p className="text-[10px] text-slate-500">Pre-built challenges ready to go</p>
          </div>
        </div>
      </GlassCard>

      {/* AI */}
      <GlassCard className="p-3 border-2 border-blue-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">AI Coach</p>
            <p className="text-[10px] text-slate-500">Tell us your goal, we build the plan</p>
          </div>
        </div>
      </GlassCard>

      {/* Custom */}
      <GlassCard className="p-3 border-2 border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <PenTool className="w-5 h-5 text-slate-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">Custom Goal</p>
            <p className="text-[10px] text-slate-500">Full control, build your own</p>
          </div>
        </div>
      </GlassCard>

      <p className="text-center text-[10px] text-slate-400 pt-1">
        All paths lead to your personalized training plan
      </p>
    </div>
  );
}

// ============================================================
// SLIDE 3: LIBRARY
// ============================================================
function LibraryMockup() {
  return (
    <div className="w-full max-w-xs">
      {/* Room tabs */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="px-3 py-1 text-[10px] rounded-full bg-slate-200 text-slate-600">Today</span>
        <span className="px-3 py-1 text-[10px] rounded-full bg-amber-500 text-white font-medium">Library</span>
        <span className="px-3 py-1 text-[10px] rounded-full bg-slate-200 text-slate-600">Mastered</span>
      </div>

      {/* Books grid */}
      <div 
        className="rounded-xl p-3"
        style={{ background: 'rgba(30, 22, 16, 0.75)' }}
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { emoji: '🎸', name: 'Guitar', progress: 45, color: '#4a2860' },
            { emoji: '🏋️', name: 'Gym', progress: 67, color: '#2d4a2d' },
            { emoji: '🇪🇸', name: 'Spanish', progress: 23, color: '#15253d' },
            { emoji: '📚', name: 'Reading', progress: 80, color: '#5a3525' },
            { emoji: '🧘', name: 'Meditate', progress: 12, color: '#102a2d' },
            { emoji: '💻', name: 'Coding', progress: 55, color: '#283848' },
          ].map((book, i) => (
            <div 
              key={i}
              className="rounded-lg p-2 text-center"
              style={{ background: book.color }}
            >
              <span className="text-lg block mb-1">{book.emoji}</span>
              <p className="text-[8px] text-white/80 truncate">{book.name}</p>
              <div className="h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${book.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-2">
        Each book shows your progress at a glance
      </p>
    </div>
  );
}

// ============================================================
// SLIDE 4: TODAY'S CORK BOARD
// ============================================================
function TodayMockup() {
  return (
    <div className="w-full max-w-xs">
      {/* Cork board */}
      <div 
        className="rounded-xl p-3 relative"
        style={{ 
          background: 'linear-gradient(135deg, #b8956e 0%, #a6845e 50%, #c9a678 100%)',
          boxShadow: 'inset 0 0 20px rgba(80, 50, 20, 0.3)',
        }}
      >
        {/* Wooden frame */}
        <div className="absolute inset-0 pointer-events-none" style={{ 
          boxShadow: 'inset 0 0 0 6px #5c4030, inset 0 0 0 8px #4a3425',
          borderRadius: '12px',
        }} />

        <p className="text-center text-[10px] font-medium text-white/90 mb-2 mt-1">Today's Sessions</p>

        <div className="grid grid-cols-2 gap-2">
          {[
            { emoji: '🎸', name: 'Guitar Practice', behind: 0 },
            { emoji: '🏋️', name: 'Gym Session', behind: 2 },
            { emoji: '🇪🇸', name: 'Spanish Lesson', behind: 0 },
          ].map((session, i) => (
            <div 
              key={i}
              className="relative bg-[#fffef8] p-2 rounded-sm shadow-md"
              style={{ transform: `rotate(${[-2, 1, -1][i]}deg)` }}
            >
              {/* Pin */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 shadow" />
              
              {session.behind > 0 && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-white px-1 rounded font-bold">
                  {session.behind}
                </span>
              )}
              
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-sm">{session.emoji}</span>
                <div>
                  <p className="text-[9px] font-medium text-slate-700 leading-tight">{session.name}</p>
                  <p className="text-[8px] text-slate-400">30 mins</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-2">
        Tap any note to start that session
      </p>
    </div>
  );
}

// ============================================================
// SLIDE 5: DURING A SESSION
// ============================================================
function SessionMockup() {
  return (
    <div className="w-full max-w-xs space-y-2">
      {/* Session header */}
      <GlassCard className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🎸</span>
          <div>
            <p className="text-sm font-semibold text-slate-700">Session 5: Basic Chords</p>
            <p className="text-[10px] text-slate-400">Page 5 of 36</p>
          </div>
        </div>
      </GlassCard>

      {/* Timer */}
      <div className="bg-slate-800 rounded-xl p-3 text-center">
        <p className="text-[9px] text-slate-400 mb-1">Session Timer</p>
        <div className="text-2xl font-mono font-bold text-white mb-2">12:34</div>
        <div className="flex justify-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Timer className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      {/* AI Prompt */}
      <GlassCard className="p-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span className="text-[10px] text-amber-700 font-medium">Get AI guidance via ChatGPT</span>
        </div>
      </GlassCard>

      {/* Tracking */}
      <GlassCard className="p-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span className="text-[10px] text-slate-600">Log: "Learned G chord, 20 mins practice"</span>
        </div>
      </GlassCard>

      <p className="text-center text-[10px] text-slate-400">
        Track time, metrics & notes each session
      </p>
    </div>
  );
}

// ============================================================
// SLIDE 6: MASTERY & FEED
// ============================================================
function MasteryMockup() {
  return (
    <div className="w-full max-w-xs space-y-3">
      {/* Golden book */}
      <div className="flex justify-center">
        <div 
          className="w-20 h-28 rounded-lg flex flex-col items-center justify-center text-center p-2 shadow-lg relative"
          style={{ 
            background: 'linear-gradient(165deg, #c9a227 0%, #a68523 50%, #8b7320 100%)',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
          }}
        >
          <span className="text-2xl mb-1">🎸</span>
          <p className="text-[8px] text-amber-100 font-medium">Learn Guitar</p>
          <span className="text-[7px] bg-amber-100/30 text-amber-50 px-1.5 py-0.5 rounded mt-1">✦ MASTERED</span>
        </div>
      </div>

      {/* Trophy cabinet label */}
      <div className="text-center">
        <span className="text-[9px] text-amber-600 tracking-wider">✦ HALL OF MASTERY ✦</span>
      </div>

      {/* Feed post preview */}
      <GlassCard className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">Y</div>
          <div>
            <p className="text-[10px] font-medium text-slate-700">You</p>
            <p className="text-[8px] text-slate-400">just now</p>
          </div>
          <Share2 className="w-3 h-3 text-slate-400 ml-auto" />
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-14 rounded flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(165deg, #c9a227 0%, #8b7320 100%)' }}
          >
            🎸
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-700">Completed: Learn Guitar</p>
            <p className="text-[9px] text-slate-500">36 sessions • 18 hours total</p>
            <p className="text-[9px] text-slate-400 italic">"Finally played my first song!"</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
          <span className="text-[9px] text-slate-400 flex items-center gap-1">❤️ 24</span>
          <span className="text-[9px] text-slate-400 flex items-center gap-1">💬 5</span>
        </div>
      </GlassCard>

      <p className="text-center text-[10px] text-slate-400">
        Share achievements with the community
      </p>
    </div>
  );
}