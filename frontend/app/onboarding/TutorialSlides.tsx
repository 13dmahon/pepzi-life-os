'use client';

import { useState } from 'react';
import { 
  CheckCircle,
  Target,
  Sparkles,
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check,
  Flame,
  TrendingUp,
  AlertCircle,
  Zap,
  BookOpen,
  ListTodo,
  BarChart3,
  Edit3,
  ArrowRight,
  Plus,
  Play,
  Trophy,
  Rocket
} from 'lucide-react';

interface TutorialSlidesProps {
  onComplete: () => void;
}

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
    id: 'problem',
    title: 'Sound familiar?',
    subtitle: 'The goal-setting struggle',
    description: 'You set goals, start strong... then life gets busy. Two weeks later, you\'ve forgotten all about it.',
  },
  {
    id: 'solution',
    title: 'Meet Pepzi',
    subtitle: 'Your AI training coach',
    description: 'Tell us your goal, we\'ll create a structured plan and show you exactly what to do each day.',
  },
  {
    id: 'two-ways',
    title: 'Two Ways to Start',
    subtitle: 'AI-assisted or bring your own plan',
    description: 'Let our AI create your training plan, or use Quick Add if you already have one from ChatGPT.',
  },
  {
    id: 'review-plan',
    title: 'Review Your Plan',
    subtitle: 'Sessions & milestones',
    description: 'See your sessions laid out week by week. Edit names, descriptions, or duration anytime.',
  },
  {
    id: 'schedule-it',
    title: 'Schedule It',
    subtitle: 'Fit training around your life',
    description: 'Auto-place sessions or pick your own times. Your calendar, your control.',
  },
  {
    id: 'today-page',
    title: 'Your Today Page',
    subtitle: 'Wake up knowing exactly what to do',
    description: 'See today\'s sessions, start the timer, mark complete. No more decision fatigue.',
  },
  {
    id: 'backlog',
    title: 'Life Happens',
    subtitle: 'Missed a session? No stress',
    description: 'Missed sessions go to your backlog. Catch up when you\'re ready - no guilt, just clarity.',
  },
  {
    id: 'get-ahead',
    title: 'Get Ahead',
    subtitle: 'Feeling motivated?',
    description: 'Done early? Do tomorrow\'s session today and finish your goal even faster.',
  },
  {
    id: 'edit-weeks',
    title: 'Edit Future Weeks',
    subtitle: 'Change your routine anytime',
    description: 'Don\'t like your current schedule? Redesign your weekly pattern for all future weeks.',
  },
  {
    id: 'track-progress',
    title: 'Track Your Progress',
    subtitle: 'See how far you\'ve come',
    description: 'View completion stats, session history, and time logged. Celebrate your wins! 🎉',
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
              {currentSlide === 0 && <ProblemMockup />}
              {currentSlide === 1 && <SolutionMockup />}
              {currentSlide === 2 && <TwoWaysMockup />}
              {currentSlide === 3 && <ReviewPlanMockup />}
              {currentSlide === 4 && <ScheduleMockup />}
              {currentSlide === 5 && <TodayMockup />}
              {currentSlide === 6 && <BacklogMockup />}
              {currentSlide === 7 && <GetAheadMockup />}
              {currentSlide === 8 && <EditWeeksMockup />}
              {currentSlide === 9 && <ProgressMockup />}
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
// SLIDE 1: THE PROBLEM
// ============================================================
function ProblemMockup() {
  return (
    <div className="w-full max-w-xs space-y-3">
      {/* Stressed person with abandoned goals */}
      <div className="text-center mb-4">
        <div className="text-5xl mb-2">😩</div>
      </div>
      
      <GlassCard className="p-3 opacity-60" hover={false}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-400 line-through">Learn Spanish</p>
            <p className="text-[10px] text-slate-300">Started 3 weeks ago...</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-3 opacity-60" hover={false}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-400 line-through">Get fit</p>
            <p className="text-[10px] text-slate-300">Last session: 2 weeks ago</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-3 opacity-60" hover={false}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-400 line-through">Side project</p>
            <p className="text-[10px] text-slate-300">Haven't touched it...</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 2: THE SOLUTION
// ============================================================
function SolutionMockup() {
  return (
    <div className="w-full max-w-xs">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </div>

      <GlassCard className="p-4" hover={false}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-700">Tell us your goal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-700">Get a structured plan</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-700">See daily sessions</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-700">Track your progress</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 3: TWO WAYS TO CREATE
// ============================================================
function TwoWaysMockup() {
  return (
    <div className="w-full max-w-xs space-y-3">
      {/* AI Assisted */}
      <GlassCard className="p-4 border-2 border-emerald-200" hover={false}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">AI-Assisted Plan</p>
            <p className="text-xs text-slate-500">We create your training plan</p>
          </div>
        </div>
      </GlassCard>

      <div className="text-center text-slate-400 text-sm">or</div>

      {/* Quick Add */}
      <GlassCard className="p-4 border-2 border-blue-200" hover={false}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Plus className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">Quick Add</p>
            <p className="text-xs text-slate-500">Already have a ChatGPT plan?</p>
          </div>
        </div>
      </GlassCard>

      <p className="text-center text-xs text-slate-400 mt-2">
        Both give you the same structured experience
      </p>
    </div>
  );
}

// ============================================================
// SLIDE 4: REVIEW PLAN
// ============================================================
function ReviewPlanMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3" hover={false}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/40">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">🇪🇸</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Learn Spanish</p>
            <p className="text-[10px] text-slate-400">12 weeks • 3x per week</p>
          </div>
        </div>

        {/* Sessions */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Week 1 • Foundation</p>
          
          <div className="bg-white/50 rounded-lg p-2 border border-white/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-700">Session 1</p>
                <p className="text-[10px] text-slate-400">Basic greetings</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3" />
                30m
              </div>
            </div>
          </div>

          <div className="bg-white/50 rounded-lg p-2 border border-white/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-700">Session 2</p>
                <p className="text-[10px] text-slate-400">Numbers 1-20</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3" />
                30m
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400 justify-center pt-1">
            <Edit3 className="w-3 h-3" />
            Tap any session to edit
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 5: SCHEDULE IT
// ============================================================
function ScheduleMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3" hover={false}>
        {/* Mini calendar header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-700">Schedule Sessions</p>
          <button className="px-2 py-1 bg-slate-800 text-white text-[10px] rounded-lg flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Auto-place
          </button>
        </div>

        {/* Calendar grid */}
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <span key={i} className="text-[9px] text-slate-400 font-medium">{day}</span>
            ))}
          </div>

          {/* Time slots with sessions */}
          {[
            { time: '7am', blocks: [0, 1, 0, 1, 0, 1, 0] },
            { time: '8am', blocks: [0, 0, 0, 0, 0, 0, 0] },
            { time: '6pm', blocks: [0, 0, 0, 0, 0, 0, 0] },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-[8px] text-slate-400 w-5">{row.time}</span>
              <div className="flex-1 grid grid-cols-7 gap-0.5">
                {row.blocks.map((block, j) => (
                  <div 
                    key={j} 
                    className={`h-5 rounded-sm flex items-center justify-center ${
                      block === 1 ? 'bg-emerald-200 border border-emerald-300' : 'bg-white/40 border border-dashed border-slate-200'
                    }`}
                  >
                    {block === 1 && <span className="text-[8px]">🇪🇸</span>}
                    {block === 0 && <Plus className="w-2 h-2 text-slate-300" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-3">
          Tap empty slots or use auto-place
        </p>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 6: TODAY PAGE
// ============================================================
function TodayMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3" hover={false}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/40">
          <div>
            <p className="text-sm font-semibold text-slate-700">Today</p>
            <p className="text-[10px] text-slate-400">Monday, Jan 5</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 font-bold">2</span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-600 font-bold">1</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
          <div className="h-full w-1/3 bg-emerald-500 rounded-full" />
        </div>

        {/* Sessions */}
        <div className="space-y-2">
          {/* Completed */}
          <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-400 line-through">Morning Run</p>
              <p className="text-[10px] text-slate-300">30 mins ✓</p>
            </div>
          </div>

          {/* Current */}
          <div className="bg-white/80 rounded-lg p-2 border-2 border-emerald-400 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <span className="text-sm">🇪🇸</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-700">Spanish Session 1</p>
              <p className="text-[10px] text-slate-400">30 mins</p>
            </div>
            <button className="px-2 py-1 bg-emerald-500 text-white text-[9px] rounded-lg flex items-center gap-1">
              <Play className="w-3 h-3" />
              Start
            </button>
          </div>

          {/* Upcoming */}
          <div className="bg-white/50 rounded-lg p-2 border border-white/60 flex items-center gap-2 opacity-60">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <span className="text-sm">💪</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-600">Gym</p>
              <p className="text-[10px] text-slate-400">60 mins</p>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 7: BACKLOG
// ============================================================
function BacklogMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3" hover={false}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Backlog</p>
            <p className="text-[10px] text-slate-400">2 sessions to catch up</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🇪🇸</span>
                <div>
                  <p className="text-xs font-medium text-slate-700">Spanish Session 3</p>
                  <p className="text-[10px] text-amber-600">1 day overdue</p>
                </div>
              </div>
              <button className="px-2 py-1 bg-amber-500 text-white text-[9px] rounded-lg">
                Do Now
              </button>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">💪</span>
                <div>
                  <p className="text-xs font-medium text-slate-700">Gym Session 2</p>
                  <p className="text-[10px] text-amber-600">2 days overdue</p>
                </div>
              </div>
              <button className="px-2 py-1 bg-amber-500 text-white text-[9px] rounded-lg">
                Do Now
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-3">
          No stress - do them when you're ready
        </p>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 8: GET AHEAD
// ============================================================
function GetAheadMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3 bg-gradient-to-br from-violet-50/80 to-purple-50/80" hover={false}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Rocket className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Get Ahead</p>
            <p className="text-[10px] text-slate-400">Do future sessions early</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-white/60 rounded-lg p-2 border border-white/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🇪🇸</span>
                <div>
                  <p className="text-xs font-medium text-slate-700">Spanish Session 5</p>
                  <p className="text-[10px] text-slate-400">Scheduled: Tomorrow</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Zap className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 font-medium">Finish 1 day earlier!</span>
            </div>
          </div>

          <div className="bg-white/60 rounded-lg p-2 border border-white/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">💪</span>
                <div>
                  <p className="text-xs font-medium text-slate-700">Gym Session 4</p>
                  <p className="text-[10px] text-slate-400">Scheduled: Wednesday</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Zap className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 font-medium">Finish 2 days earlier!</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 9: EDIT FUTURE WEEKS
// ============================================================
function EditWeeksMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3" hover={false}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">Weekly Schedule</p>
          <button className="px-2 py-1 bg-violet-500 text-white text-[10px] rounded-lg flex items-center gap-1">
            <Edit3 className="w-3 h-3" />
            Edit Future Weeks
          </button>
        </div>

        {/* Mini weekly view */}
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <span key={i} className="text-[9px] text-slate-400 font-medium">{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {[1, 0, 1, 0, 1, 0, 0].map((has, i) => (
              <div 
                key={i}
                className={`h-8 rounded flex items-center justify-center ${
                  has ? 'bg-emerald-100 border border-emerald-200' : 'bg-white/40'
                }`}
              >
                {has === 1 && <span className="text-xs">🇪🇸</span>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {[1, 1, 0, 1, 1, 0, 0].map((has, i) => (
              <div 
                key={i}
                className={`h-8 rounded flex items-center justify-center ${
                  has ? 'bg-blue-100 border border-blue-200' : 'bg-white/40'
                }`}
              >
                {has === 1 && <span className="text-xs">💪</span>}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-3">
          Changes apply to all future weeks
        </p>
      </GlassCard>
    </div>
  );
}

// ============================================================
// SLIDE 10: TRACK PROGRESS
// ============================================================
function ProgressMockup() {
  return (
    <div className="w-full max-w-xs">
      <GlassCard className="p-3" hover={false}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Learn Spanish</p>
            <p className="text-[10px] text-slate-400">67% complete</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
          <div className="h-full w-2/3 bg-emerald-500 rounded-full" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-slate-700">24</p>
            <p className="text-[9px] text-slate-400">Sessions Done</p>
          </div>
          <div className="bg-white/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-slate-700">12h</p>
            <p className="text-[9px] text-slate-400">Time Logged</p>
          </div>
          <div className="bg-white/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <p className="text-lg font-bold text-slate-700">18</p>
            </div>
            <p className="text-[9px] text-slate-400">Day Streak</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/40">
          <span className="text-xl">🎉</span>
          <p className="text-xs text-slate-600 font-medium">You're crushing it!</p>
        </div>
      </GlassCard>
    </div>
  );
}