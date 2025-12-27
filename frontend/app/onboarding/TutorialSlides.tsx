'use client';

import { useState } from 'react';
import { 
  CheckCircle,
  MessageSquare,
  Target,
  Sparkles,
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  ListTodo,
  Check,
  Flame,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

interface TutorialSlidesProps {
  onComplete: () => void;
}

// Exact GlassCard from landing page
function GlassCard({ children, className = '', hover = false }: { 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`
      backdrop-blur-2xl bg-white/70 
      border border-white/80 
      shadow-[0_8px_32px_rgba(0,0,0,0.06)]
      rounded-3xl
      ${hover ? 'hover:bg-white/80 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

const slides = [
  {
    id: 'today',
    title: 'Today',
    subtitle: 'Your daily command center',
    description: 'See your tasks on the left, chat with Pepzi on the right. Reschedule anything with a quick message.',
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'Your summits to conquer',
    description: 'Create goals with our AI coach. We\'ll break them into a realistic training plan.',
  },
  {
    id: 'schedule',
    title: 'Schedule',
    subtitle: 'Your week at a glance',
    description: 'See your full calendar. Everything scheduled automatically around your life.',
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
      {/* Background - Exact same as landing page */}
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
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/80 rounded-full text-sm text-slate-600 mb-4">
              <Sparkles className="w-4 h-4 text-slate-500" />
              Quick Tour • {currentSlide + 1} of {slides.length}
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentSlide 
                    ? 'w-8 bg-slate-600' 
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          {/* Main Card */}
          <GlassCard className="p-6">
            {/* Slide Title */}
            <div className="text-center mb-4">
              <h2 className="text-3xl font-bold text-slate-800 mb-1">{slide.title}</h2>
              <p className="text-slate-500">{slide.subtitle}</p>
            </div>

            {/* Phone Mockup */}
            <div className="flex items-center justify-center py-4 min-h-[320px]">
              {currentSlide === 0 && <TodayMockup />}
              {currentSlide === 1 && <GoalsMockup />}
              {currentSlide === 2 && <ScheduleMockup />}
            </div>

            {/* Description */}
            <p className="text-center text-slate-600 mb-6 px-2">
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
                    Got it, let's go!
                    <CheckCircle className="w-4 h-4" />
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
// TODAY PAGE MOCKUP - Shows BOTH task list AND chat
// ============================================================
function TodayMockup() {
  return (
    <div className="w-full max-w-sm">
      <div className="flex gap-2">
        {/* LEFT: Task List */}
        <GlassCard className="flex-1 overflow-hidden" hover={false}>
          {/* Header */}
          <div className="p-2 border-b border-white/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-700">Today</p>
                <p className="text-[8px] text-slate-400">Tuesday, Dec 23</p>
              </div>
              <div className="flex items-center gap-1 text-[9px]">
                <span className="text-slate-600 font-bold">2</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-600 font-bold">1</span>
              </div>
            </div>
            <div className="h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full w-1/3 bg-emerald-500 rounded-full" />
            </div>
          </div>

          {/* Task cards */}
          <div className="p-2 space-y-1.5">
            <div className="bg-white/50 rounded-lg p-2 border border-white/60 flex items-center gap-1.5">
              <div className="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-medium text-slate-400 line-through">Morning Run</p>
                <p className="text-[7px] text-slate-300">6:30am</p>
              </div>
            </div>

            <div className="bg-white/50 rounded-lg p-2 border-2 border-slate-300 flex items-center gap-1.5">
              <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center">
                <span className="text-[10px]">🏋️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-medium text-slate-700">Strength</p>
                <p className="text-[7px] text-slate-400">7:00pm</p>
              </div>
            </div>

            <div className="bg-white/50 rounded-lg p-2 border border-white/60 flex items-center gap-1.5">
              <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center">
                <span className="text-[10px]">🇪🇸</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-medium text-slate-700">Spanish</p>
                <p className="text-[7px] text-slate-400">8:00pm</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* RIGHT: Chat */}
        <GlassCard className="flex-1 overflow-hidden" hover={false}>
          {/* Chat Header */}
          <div className="p-2 border-b border-white/40 flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-slate-500" />
            </div>
            <div>
              <p className="text-[9px] font-semibold text-slate-700">Pepzi</p>
              <p className="text-[7px] text-slate-400">Your AI PA</p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-2 space-y-1.5">
            {/* AI asks about task */}
            <div className="bg-white/60 rounded-lg p-1.5 border border-white/60">
              <p className="text-[8px] text-slate-600">Did you do "Strength"?</p>
              <div className="flex gap-1 mt-1">
                <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[7px] rounded">Done ✓</span>
                <span className="px-1.5 py-0.5 bg-white/80 text-slate-500 text-[7px] rounded border">Skip</span>
              </div>
            </div>

            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-slate-700 text-white text-[8px] p-1.5 rounded-lg max-w-[90%]">
                Move it, I'm out with friends 🍻
              </div>
            </div>

            {/* AI response */}
            <div className="bg-white/60 rounded-lg p-1.5 border border-white/60">
              <p className="text-[8px] text-slate-600">Done! Moved to tomorrow 7pm 🎉</p>
              <div className="flex items-center gap-1 mt-1 p-1 bg-slate-50 rounded text-[7px] text-slate-400">
                <Clock className="w-2.5 h-2.5" />
                Wed → Thu
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="p-1.5 border-t border-white/40">
            <div className="flex items-center bg-white/50 rounded-lg p-1.5 border border-white/60">
              <span className="text-[7px] text-slate-400 flex-1">Chat with Pepzi...</span>
              <div className="w-4 h-4 bg-slate-700 rounded flex items-center justify-center">
                <ChevronRight className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ============================================================
// GOALS PAGE MOCKUP
// ============================================================
function GoalsMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3 space-y-2" hover={false}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-slate-700">Your Goals</h4>
          <button className="p-1.5 bg-slate-800 rounded-lg">
            <span className="text-white text-xs">+</span>
          </button>
        </div>

        {/* Goal cards */}
        <div className="space-y-2">
          <div className="bg-white/50 rounded-xl p-3 border border-white/60">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg">🏔️</div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-700">Summit Kilimanjaro</p>
                <p className="text-[10px] text-slate-400">Adventure • Aug 15</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-slate-500 rounded-full" />
              </div>
              <span className="text-[10px] font-semibold text-slate-600">67%</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
              <span>48h logged</span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                24 sessions
              </span>
            </div>
          </div>

          <div className="bg-white/50 rounded-xl p-3 border border-white/60">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg">🇪🇸</div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-700">Spanish Fluency</p>
                <p className="text-[10px] text-slate-400">Languages • Jul 15</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-slate-500 rounded-full" />
              </div>
              <span className="text-[10px] font-semibold text-slate-600">32%</span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Flame className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] text-slate-500 font-medium">18 day streak!</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SCHEDULE PAGE MOCKUP
// ============================================================
function ScheduleMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3" hover={false}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {['Week', 'Month', 'Year'].map((tab, i) => (
              <button 
                key={tab}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${
                  i === 0 ? 'bg-white/80 text-slate-700 shadow-sm' : 'text-slate-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="p-1.5 bg-white/50 rounded-lg">
            <RefreshCw className="w-3 h-3 text-slate-500" />
          </button>
        </div>

        {/* Mini calendar */}
        <div className="space-y-1">
          {/* Days header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <span key={i} className="text-[9px] text-slate-400 font-medium">{day}</span>
            ))}
          </div>

          {/* Time slots */}
          {[
            { time: '6am', blocks: [1, 0, 1, 0, 1, 2, 0] },
            { time: '9am', blocks: [3, 3, 3, 3, 3, 0, 0] },
            { time: '12pm', blocks: [0, 0, 0, 0, 0, 0, 0] },
            { time: '6pm', blocks: [0, 1, 0, 1, 0, 0, 0] },
            { time: '8pm', blocks: [4, 0, 4, 0, 4, 0, 0] },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-[8px] text-slate-400 w-6">{row.time}</span>
              <div className="flex-1 grid grid-cols-7 gap-0.5">
                {row.blocks.map((block, j) => (
                  <div 
                    key={j} 
                    className={`h-3.5 rounded-sm ${
                      block === 0 ? 'bg-white/40' :
                      block === 1 ? 'bg-emerald-200' :
                      block === 2 ? 'bg-amber-200' :
                      block === 3 ? 'bg-slate-300' :
                      'bg-blue-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-white/40">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-emerald-200 rounded-sm" />
            <span className="text-[9px] text-slate-400">Training</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-300 rounded-sm" />
            <span className="text-[9px] text-slate-400">Work</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-200 rounded-sm" />
            <span className="text-[9px] text-slate-400">Learning</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}