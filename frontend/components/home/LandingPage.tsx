'use client';

import { useState, useEffect, Fragment, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QuickSchedulePicker from '@/components/QuickSchedulePicker';
import { 
  MessageCircle, 
  Calendar, 
  Flame,
  ArrowRight,
  Heart,
  Check,
  Clock,
  Lock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  API_BASE,
  MIN_GOAL_LENGTH,
  MAX_GOAL_LENGTH,
  DEMO_GOALS,
  categoryIcons,
  FeedItemType,
  PreviewData,
  ScheduleSelection,
  GlassCard,
  generateFeedItems,
} from './shared';

// ============================================================
// SIMPLE FEED CARD (for landing page demo)
// ============================================================

function SimpleFeedCard({ item, onLike }: { item: FeedItemType; onLike: (id: number) => void }) {
  return (
    <GlassCard className="p-4">
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.user.color} flex items-center justify-center font-bold text-white text-sm shadow-lg flex-shrink-0`}>
          {item.user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">{item.user.name}</span>
            <span className="text-slate-400 text-sm">· {item.timeAgo}</span>
          </div>
          <p className="mt-1.5 text-slate-600 text-sm leading-relaxed">{item.content}</p>
          
          {item.image && (
            <div className="mt-3 rounded-2xl overflow-hidden">
              <img 
                src={item.image} 
                alt="" 
                className="w-full h-48 object-cover"
              />
            </div>
          )}
          
          <div className="mt-3 flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/80 rounded-full text-xs font-medium text-slate-500">
              {categoryIcons[item.category] || '🎯'} {item.goal}
              {item.streak && <Flame className="w-3 h-3 text-orange-500" />}
            </span>
            <button 
              onClick={() => onLike(item.id)}
              className={`flex items-center gap-1 text-sm ${item.liked ? 'text-rose-500' : 'text-slate-400'}`}
            >
              <Heart className={`w-3.5 h-3.5 ${item.liked ? 'fill-current' : ''}`} />
              {item.likes}
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================
// PLAN PREVIEW DISPLAY (shown after user submits)
// ============================================================

function PlanPreviewDisplay({ preview, onSignup }: { preview: PreviewData; onSignup: (schedule?: ScheduleSelection) => void }) {
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  
  const sessionsPerWeek = preview.plan.sessions_per_week;
  
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[today.getDay()];
  
  const getDefaultDays = () => {
    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIndex = allDays.indexOf(todayName);
    if (todayIndex === -1) return ['Monday', 'Wednesday', 'Friday'].slice(0, sessionsPerWeek);
    
    const reordered = [...allDays.slice(todayIndex), ...allDays.slice(0, todayIndex)];
    const spacing = Math.floor(7 / sessionsPerWeek);
    const selected: string[] = [];
    
    for (let i = 0; i < sessionsPerWeek; i++) {
      selected.push(reordered[(i * spacing) % 7]);
    }
    
    if (!selected.includes(todayName)) {
      selected[0] = todayName;
    }
    
    return selected;
  };
  
  const selectedDays = getDefaultDays();
  const eveningTimes = ['6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'];
  const firstSessionIsToday = selectedDays[0] === todayName;

  const handleScheduleConfirm = (schedule: ScheduleSelection) => {
    setShowSchedulePicker(false);
    onSignup(schedule);
  };

  const handleSkipSchedule = () => {
    const autoSchedule: ScheduleSelection = {
      days: selectedDays.map(d => d.toLowerCase()),
      preferredTime: 'evening',
      specificTimes: {},
    };
    selectedDays.forEach(day => {
      autoSchedule.specificTimes[day.toLowerCase()] = '18:30';
    });
    onSignup(autoSchedule);
  };

  if (showSchedulePicker) {
    return (
      <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <QuickSchedulePicker
          sessionsPerWeek={sessionsPerWeek}
          sessionDurationMins={preview.plan.session_length_mins}
          goalName={preview.goal.name}
          onConfirm={handleScheduleConfirm}
          onSkip={handleSkipSchedule}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <GlassCard className="p-5" hover={false}>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">{categoryIcons[preview.goal.category] || '🎯'}</div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{preview.goal.name}</h3>
            <p className="text-slate-500 text-sm">Your {preview.plan.total_weeks}-week starter plan</p>
          </div>
        </div>
        
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
          <p className="text-emerald-800 text-sm text-center">
            <span className="font-semibold">🎯 We think this goal will take {preview.plan.total_weeks} weeks</span>
            <br />
            <span className="text-emerald-600 text-xs">if you complete all {preview.plan.total_weeks * preview.plan.sessions_per_week} sessions</span>
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-slate-800">{preview.plan.total_weeks}</div>
            <div className="text-xs text-slate-500">weeks</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-slate-800">{preview.plan.sessions_per_week}x</div>
            <div className="text-xs text-slate-500">per week</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-slate-800">{preview.plan.session_length_mins}m</div>
            <div className="text-xs text-slate-500">sessions</div>
          </div>
        </div>
        
        <p className="text-xs text-slate-400 text-center">
          💡 {preview.reasoning.session_length_reason}
        </p>
      </GlassCard>

      <GlassCard className="p-5" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800">Week 1 Schedule</h4>
              <p className="text-xs text-slate-500">{preview.preview.week1.focus}</p>
            </div>
          </div>
          <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
            Preview
          </span>
        </div>
        
        <div className="space-y-3">
          {preview.preview.week1.sessions.map((session, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-slate-800 text-white text-xs font-medium px-2 py-1 rounded-md">
                  {selectedDays[idx % selectedDays.length]}
                </div>
                <span className="text-slate-500 text-xs">
                  {eveningTimes[idx % eveningTimes.length]}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {session.duration_mins}m
                </span>
              </div>
              
              <h5 className="font-medium text-slate-800 text-sm mb-1">{session.name}</h5>
              <p className="text-xs text-slate-600 mb-2">{session.description}</p>
              {session.notes && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {session.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="relative">
        <GlassCard className="p-5 opacity-60" hover={false}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-500">Weeks 2-{preview.plan.total_weeks}</h4>
                <p className="text-xs text-slate-400">
                  {preview.preview.locked_weeks} more weeks of scheduled sessions
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </GlassCard>
        
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-transparent flex flex-col items-center justify-end pb-6">
          <p className="text-sm text-slate-600 font-medium mb-4">When do you want to train?</p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md px-4">
            <button
              onClick={handleSkipSchedule}
              className="flex-1 px-5 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-semibold shadow-xl transition-all hover:scale-[1.02] flex flex-col items-center gap-1"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span>{firstSessionIsToday ? 'Start today' : 'Auto-schedule'}</span>
              </div>
              <span className="text-xs text-slate-300 font-normal">
                We&apos;ll pick the best times
              </span>
            </button>
            
            <button
              onClick={() => setShowSchedulePicker(true)}
              className="flex-1 px-5 py-4 bg-white hover:bg-slate-50 text-slate-800 rounded-2xl font-semibold shadow-xl border-2 border-slate-200 transition-all hover:scale-[1.02] hover:border-slate-300 flex flex-col items-center gap-1"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>Choose my times</span>
              </div>
              <span className="text-xs text-slate-500 font-normal">
                Pick days & times that work
              </span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="text-center pt-2">
        <p className="text-sm text-slate-400">
          Free · No credit card required
        </p>
      </div>
    </div>
  );
}

// ============================================================
// CINEMATIC SCHEDULE ANIMATION - GOALS DATA
// ============================================================

const GOALS = [
  { 
    name: 'Learn guitar', 
    icon: '🎸', 
    months: 3, 
    hours: 100, 
    mins: 30,
    finishDate: 'March 15, 2025',
    sessions: [
      { 
        title: 'Chord Foundations', 
        warmup: '5 min finger stretches & chromatic exercise',
        main: [
          'Learn G, C, D major chord shapes',
          'Practice Em and Am minor chords', 
          'Chord transition drill: G→C→D (2 min each)',
          'Strumming pattern: D DU UD U'
        ],
        cooldown: 'Slow chord changes with metronome at 60 BPM'
      },
      { 
        title: 'Scale Mastery', 
        warmup: '5 min spider crawl exercise all frets',
        main: [
          'E minor pentatonic - Position 1',
          'Ascending/descending 4 notes per beat',
          'Speed drill: 60 → 80 → 100 BPM',
          'Connect scale to backing track in Am'
        ],
        cooldown: 'Free improvisation over looped chord progression'
      },
      { 
        title: 'Rhythm Training', 
        warmup: '5 min palm muting on open strings',
        main: [
          'Eighth note strumming with accents',
          'Syncopation: emphasize off-beats',
          'Chunk strumming technique',
          "Play along: \"Knockin' on Heaven's Door\""
        ],
        cooldown: 'Record yourself and listen back for timing'
      },
      { 
        title: 'Song Practice', 
        warmup: '5 min review of chords from previous sessions',
        main: [
          'Learn verse: 4 chord progression',
          'Learn chorus: add dynamics',
          'Bridge section with chord variations',
          'Full play-through with backing track'
        ],
        cooldown: 'Perform complete song start to finish'
      }
    ]
  },
  { 
    name: 'Get fit', 
    icon: '💪', 
    months: 2, 
    hours: 60, 
    mins: 45,
    finishDate: 'February 28, 2025',
    sessions: [
      { 
        title: 'Upper Body Power', 
        warmup: '5 min arm circles, band pull-aparts',
        main: [
          'Bench Press: 4 sets × 8 reps @ RPE 7',
          'Bent Over Rows: 4 × 10 each arm',
          'Overhead Press: 3 × 12',
          'Bicep Curls superset Tricep Dips: 3 × 15'
        ],
        cooldown: 'Chest & shoulder stretches, foam roll lats'
      },
      { 
        title: 'Lower Body Strength', 
        warmup: '5 min hip circles, bodyweight squats',
        main: [
          'Back Squats: 4 sets × 8 reps @ RPE 8',
          'Romanian Deadlifts: 3 × 10',
          'Walking Lunges: 3 × 12 each leg',
          'Leg Press: 3 × 15 (controlled tempo)'
        ],
        cooldown: 'Hip flexor stretch, quad stretch, foam roll'
      },
      { 
        title: 'Cardio Conditioning', 
        warmup: '5 min light jog, dynamic stretches',
        main: [
          'HIIT: 30s sprint / 30s rest × 10 rounds',
          'Rest 3 minutes',
          'Steady state Zone 2: 20 min (conversational pace)',
          'Burpee finisher: 3 × 10'
        ],
        cooldown: 'Walk 5 min, full body stretch routine'
      },
      { 
        title: 'Core & Stability', 
        warmup: '5 min cat-cow, bird-dogs',
        main: [
          'Plank holds: 3 × 45 seconds',
          'Dead Bugs: 3 × 12 each side',
          'Pallof Press: 3 × 10 each side',
          'Russian Twists: 3 × 20 total'
        ],
        cooldown: "Child's pose, supine twist, deep breathing"
      }
    ]
  },
  { 
    name: 'Learn Spanish', 
    icon: '🇪🇸', 
    months: 4, 
    hours: 120, 
    mins: 20,
    finishDate: 'April 20, 2025',
    sessions: [
      { 
        title: 'Vocabulary Builder', 
        warmup: "2 min review yesterday's words aloud",
        main: [
          'Learn 15 new words with flashcards (SRS)',
          'Write each word in a sentence',
          'Record yourself pronouncing each word',
          'Quiz: cover English, recall Spanish'
        ],
        cooldown: 'Listen to Spanish music, identify known words'
      },
      { 
        title: 'Grammar Foundations', 
        warmup: '2 min conjugate 3 verbs you know',
        main: [
          'Present tense: -AR, -ER, -IR endings',
          'Practice Ser vs Estar with 10 examples',
          'Write 5 sentences using new grammar',
          'Translate 5 English sentences to Spanish'
        ],
        cooldown: 'Read grammar notes aloud for retention'
      },
      { 
        title: 'Listening Practice', 
        warmup: '2 min listen to Spanish radio passively',
        main: [
          'Watch 5 min video (Spanish subs)',
          'Transcribe 30 seconds of native speech',
          'Shadowing: repeat after native speaker',
          'Comprehension quiz on video content'
        ],
        cooldown: 'Note 3 new words/phrases you heard'
      },
      { 
        title: 'Speaking Drills', 
        warmup: '2 min tongue twisters for pronunciation',
        main: [
          'Describe your day in Spanish (2 min)',
          'Role-play: ordering at restaurant',
          'Record 1 min speaking on any topic',
          'Listen back, note areas to improve'
        ],
        cooldown: 'Think in Spanish for 5 min (no English!)'
      }
    ]
  },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night'];
const GRID_TARGETS: [number, number][] = [[0, 1], [2, 2], [4, 1], [5, 0]];

type Phase = 
  | 'loading'
  | 'heroReveal'
  | 'sessionsIntro'
  | 'sessions'
  | 'findingTime'
  | 'dropping'
  | 'scheduled'
  | 'calendarFly'
  | 'notification'
  | 'userResponse'
  | 'onTrack'
  | 'celebration'
  | 'restart';

// ============================================================
// SCHEDULE ANIMATION COMPONENT
// ============================================================

function ScheduleAnimation({ currentGoalIndex, onCycleComplete }: { currentGoalIndex: number; onCycleComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentSession, setCurrentSession] = useState(0);
  const [dropIndex, setDropIndex] = useState(-1);
  const [responseTyped, setResponseTyped] = useState('');
  const [confetti, setConfetti] = useState<{id: number, x: number, delay: number, color: string}[]>([]);
  
  const goal = GOALS[currentGoalIndex];
  const responseText = "Yes, done! ✓";

  useEffect(() => {
    setPhase('loading');
    setCurrentSession(0);
    setDropIndex(-1);
    setResponseTyped('');
    setConfetti([]);
  }, [currentGoalIndex]);

  useEffect(() => {
    if (phase !== 'sessions') return;
    if (currentSession < 3) {
      const t = setTimeout(() => setCurrentSession(prev => prev + 1), 2500);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase('findingTime'), 2000);
      return () => clearTimeout(t);
    }
  }, [phase, currentSession]);

  useEffect(() => {
    if (phase !== 'dropping') return;
    if (dropIndex < 3) {
      const t = setTimeout(() => setDropIndex(prev => prev + 1), 300);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase('scheduled'), 400);
      return () => clearTimeout(t);
    }
  }, [phase, dropIndex]);

  useEffect(() => {
    if (phase === 'dropping' && dropIndex === -1) setDropIndex(0);
  }, [phase, dropIndex]);

  useEffect(() => {
    if (phase !== 'userResponse') return;
    if (responseTyped.length < responseText.length) {
      const t = setTimeout(() => setResponseTyped(responseText.slice(0, responseTyped.length + 1)), 80);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase('onTrack'), 1000);
      return () => clearTimeout(t);
    }
  }, [phase, responseTyped]);

  useEffect(() => {
    if (phase === 'celebration' && confetti.length === 0) {
      const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];
      const newConfetti = Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setConfetti(newConfetti);
    }
  }, [phase, confetti.length]);

  useEffect(() => {
    const timings: Partial<Record<Phase, number>> = {
      loading: 2500,
      heroReveal: 3000,
      sessionsIntro: 2500,
      findingTime: 2000,
      scheduled: 1200,
      calendarFly: 800,
      notification: 3500,
      onTrack: 2500,
      celebration: 3500,
      restart: 2000,
    };
    
    const nextPhase: Partial<Record<Phase, Phase>> = {
      loading: 'heroReveal',
      heroReveal: 'sessionsIntro',
      sessionsIntro: 'sessions',
      findingTime: 'dropping',
      scheduled: 'calendarFly',
      calendarFly: 'notification',
      notification: 'userResponse',
      onTrack: 'celebration',
      celebration: 'restart',
    };

    if (phase in nextPhase) {
      const t = setTimeout(() => setPhase(nextPhase[phase]!), timings[phase]!);
      return () => clearTimeout(t);
    }
    
    if (phase === 'restart') {
      const t = setTimeout(() => onCycleComplete(), timings.restart!);
      return () => clearTimeout(t);
    }
  }, [phase, onCycleComplete]);

  return (
    <div className="w-full flex flex-col" style={{ minHeight: '480px' }}>
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .book-wrapper { perspective: 2000px; perspective-origin: center center; }
        .book-3d { width: 320px; height: 380px; position: relative; transform-style: preserve-3d; transform: rotateX(5deg); }
        .book-page { position: absolute; width: 100%; height: 100%; transform-style: preserve-3d; transform-origin: left center; transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .book-page.flipped { transform: rotateY(-180deg); }
        .page-front, .page-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; border-radius: 2px 12px 12px 2px; overflow: hidden; }
        .page-front { background: linear-gradient(to right, #f9fafb, #ffffff); box-shadow: 4px 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05); }
        .page-content { padding: 16px 18px; height: 100%; overflow: hidden; }
        .page-back { background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); transform: rotateY(180deg); box-shadow: -4px 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05); }
        .book-back { position: absolute; width: 100%; height: 100%; background: linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%); border-radius: 2px 12px 12px 2px; box-shadow: 0 15px 50px rgba(0,0,0,0.2); }
        .book-page::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(to right, #e2e8f0, transparent); }

        @keyframes heroReveal { 0% { transform: scale(0.9) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        .hero-card { animation: heroReveal 0.5s ease-out forwards; }

        @keyframes introReveal { 0% { transform: translateY(30px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .intro-card { animation: introReveal 0.5s ease-out forwards; }

        @keyframes calendarSlide { 0% { transform: translateY(30px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes scanLine { 0% { top: 15%; } 100% { top: 85%; } }
        @keyframes calendarFly { 0% { transform: perspective(500px) rotateX(0) scale(1); opacity: 1; } 100% { transform: perspective(500px) rotateX(-40deg) translateY(-150px) scale(0.5); opacity: 0; } }
        .calendar-slide { animation: calendarSlide 0.4s ease-out forwards; }
        .scan-line { animation: scanLine 1.5s ease-in-out infinite; }
        .calendar-fly { animation: calendarFly 0.6s ease-in forwards; }

        @keyframes blockFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes blockDrop { 0% { opacity: 1; } 100% { opacity: 0; transform: translateY(15px); } }
        @keyframes slotFill { 0% { transform: scale(0); } 60% { transform: scale(1.1); } 100% { transform: scale(1); } }
        .block-float { animation: blockFloat 1.5s ease-in-out infinite; }
        .block-drop { animation: blockDrop 0.25s ease-in forwards; }
        .slot-fill { animation: slotFill 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        @keyframes notifDrop { 0% { transform: translateY(-40px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .notif-drop { animation: notifDrop 0.4s ease-out forwards; }

        @keyframes trackPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .track-pop { animation: trackPop 0.4s ease-out forwards; }

        @keyframes celebPop { 0% { transform: scale(0) rotate(-5deg); } 70% { transform: scale(1.05) rotate(2deg); } 100% { transform: scale(1) rotate(0); } }
        @keyframes confettiFall { 0% { transform: translateY(-50px) rotate(0); opacity: 1; } 100% { transform: translateY(350px) rotate(720deg); opacity: 0; } }
        .celeb-pop { animation: celebPop 0.5s ease-out forwards; }
        .confetti { animation: confettiFall 2.5s ease-out forwards; }

        .block-3d { background: linear-gradient(145deg, #475569 0%, #1e293b 100%); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); border-radius: 10px; }
      `}</style>

      <div className="flex-1 relative overflow-hidden">
        
        {phase === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-transparent border-t-slate-600 rounded-full animate-spin" />
            </div>
            <p className="text-slate-500 text-sm mt-6">Analyzing your goal...</p>
          </div>
        )}

        {phase === 'heroReveal' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <div className="hero-card bg-white rounded-3xl p-8 shadow-xl border border-slate-100 w-full max-w-xs">
              <div className="text-center">
                <div className="text-5xl mb-4">{goal.icon}</div>
                <h2 className="text-lg font-semibold text-slate-800 mb-2">{goal.name}</h2>
                
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
                  <Check className="w-4 h-4" />
                  Done by {goal.finishDate}
                </div>
                
                <div className="bg-slate-50 rounded-2xl p-6 mb-6">
                  <div className="text-5xl font-bold text-slate-800">{goal.months}</div>
                  <div className="text-slate-500 text-sm mt-1">months</div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-700">{goal.hours}h</div>
                    <div className="text-xs text-slate-400">total</div>
                  </div>
                  <div className="text-center border-x border-slate-100">
                    <div className="text-lg font-bold text-slate-700">4x</div>
                    <div className="text-xs text-slate-400">weekly</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-700">{goal.mins}m</div>
                    <div className="text-xs text-slate-400">sessions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'sessionsIntro' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <div className="intro-card bg-white rounded-3xl p-6 shadow-xl border border-slate-100 w-full max-w-sm text-center">
              <div className="text-5xl mb-3">{goal.icon}</div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{goal.name}</h3>
              <p className="text-slate-500 text-sm mb-2">Your scheduled training plan</p>
              
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium mb-4">
                <Check className="w-3 h-3" />
                Complete by {goal.finishDate}
              </div>
              
              <div className="grid grid-cols-4 gap-2 mb-4">
                {goal.sessions.map((s, i) => (
                  <div key={i} className="bg-slate-800 text-white rounded-xl py-2 px-1 shadow-lg">
                    <p className="text-[8px] text-slate-400 mb-0.5">{['Mon', 'Wed', 'Fri', 'Sat'][i]}</p>
                    <span className="font-bold text-sm">{goal.mins}m</span>
                    <p className="text-[8px] text-slate-300 mt-0.5 leading-tight">{s.title}</p>
                  </div>
                ))}
              </div>
              
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">4 scheduled sessions</span> per week
              </p>
              <p className="text-slate-400 text-xs mt-2">Each session includes warm-up, main work & cool-down</p>
            </div>
          </div>
        )}

        {phase === 'sessions' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-full text-sm font-medium mb-2">
                <Calendar className="w-4 h-4" />
                {['Monday 7:00 PM', 'Wednesday 7:00 PM', 'Friday 6:30 PM', 'Saturday 10:00 AM'][currentSession]}
              </div>
              <p className="text-slate-600 text-sm font-medium">Session {currentSession + 1} of 4</p>
              <p className="text-emerald-600 text-xs mt-1">🎯 Goal complete by: {goal.finishDate}</p>
            </div>
            
            <div className="book-wrapper">
              <div className="book-3d">
                {[0, 1, 2, 3].map((pageNum) => {
                  const isFlipped = pageNum < currentSession;
                  const session = goal.sessions[pageNum];
                  
                  return (
                    <div 
                      key={pageNum}
                      className={`book-page ${isFlipped ? 'flipped' : ''}`}
                      style={{ zIndex: 4 - pageNum }}
                    >
                      <div className="page-front">
                        <div className="page-content">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                              Week {pageNum + 1}
                            </p>
                            <div className="flex items-center gap-1 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" />
                              {goal.mins}m
                            </div>
                          </div>
                          
                          <h3 className="text-xl font-bold text-slate-800 mb-3">{session.title}</h3>
                          
                          <div className="mb-3">
                            <p className="text-[9px] text-amber-600 uppercase tracking-wider font-semibold mb-1">🔥 Warm-up</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{session.warmup}</p>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-[9px] text-blue-600 uppercase tracking-wider font-semibold mb-1">💪 Main Work</p>
                            <ul className="text-[11px] text-slate-700 space-y-1">
                              {session.main.map((item, i) => (
                                <li key={i} className="flex gap-1.5 leading-relaxed">
                                  <span className="text-blue-400 mt-0.5">▸</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div>
                            <p className="text-[9px] text-emerald-600 uppercase tracking-wider font-semibold mb-1">🧘 Cool-down</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{session.cooldown}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="page-back">
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-5xl opacity-30 mb-2">{goal.icon}</div>
                            <p className="text-xs text-slate-500 font-medium">Session {pageNum + 1}</p>
                            <p className="text-[10px] text-emerald-500">✓ Complete</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="book-back">
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="text-5xl opacity-30 mb-3">{goal.icon}</div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Your Elite Coach</p>
                    <p className="text-sm font-semibold text-slate-600">Training Plan</p>
                    <p className="text-[9px] text-slate-400 mt-auto">pepzi.app</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center gap-2 mt-5">
                {[0, 1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className={`w-2 h-2 rounded-full transition-all duration-500 ${
                      i === currentSession 
                        ? 'bg-slate-800 scale-125' 
                        : i < currentSession 
                          ? 'bg-emerald-500' 
                          : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {['findingTime', 'dropping', 'scheduled'].includes(phase) && (
          <div className="absolute inset-0 flex flex-col items-center pt-4 px-4">
            <div className="text-center mb-3">
              <p className="text-slate-800 font-semibold">
                {phase === 'findingTime' && "Now let's find time in your week"}
                {phase === 'dropping' && 'Scheduling your sessions...'}
                {phase === 'scheduled' && "You're all set! ✓"}
              </p>
            </div>

            {(phase === 'findingTime' || phase === 'dropping') && (
              <div className="flex gap-2 mb-3">
                {[0,1,2,3].map(i => {
                  const isDropped = phase === 'dropping' && i <= dropIndex;
                  return (
                    <div
                      key={i}
                      className={`block-3d w-12 h-14 flex flex-col items-center justify-center text-white text-xs font-bold
                        ${phase === 'findingTime' ? 'block-float' : ''}
                        ${isDropped ? 'block-drop' : ''}
                      `}
                      style={{ animationDelay: `${i * 0.08}s` }}
                    >
                      <span>{goal.mins}m</span>
                      <span className="text-[7px] text-slate-300 mt-0.5">{goal.sessions[i].title.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="calendar-slide bg-white rounded-2xl p-4 shadow-xl border border-slate-100 w-full max-w-md relative overflow-hidden">
              {phase === 'findingTime' && (
                <div className="scan-line absolute left-0 right-0 h-0.5 bg-blue-400/60 z-10" />
              )}
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-800">Your Week</span>
                </div>
                {phase === 'scheduled' && (
                  <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1 rounded-full">
                    <Check className="w-3 h-3" />
                    Scheduled
                  </div>
                )}
              </div>

              <div className="grid grid-cols-8 gap-1">
                <div></div>
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-semibold text-slate-500 py-1">{d}</div>
                ))}
                
                {TIME_SLOTS.map((time, row) => (
                  <Fragment key={time}>
                    <div className="flex items-center justify-end pr-1 text-[8px] text-slate-400">{time.slice(0,4)}</div>
                    {DAYS.map((_, day) => {
                      const targetIdx = GRID_TARGETS.findIndex(([d, r]) => d === day && r === row);
                      const isTarget = targetIdx !== -1;
                      const isFilled = isTarget && targetIdx <= dropIndex;
                      const isBusy = !isTarget;

                      return (
                        <div
                          key={`${day}-${row}`}
                          className={`h-8 rounded-lg flex items-center justify-center relative
                            ${isTarget && !isFilled ? 'bg-blue-50 border-2 border-dashed border-blue-200' : ''}
                            ${isBusy ? 'bg-slate-100' : ''}
                          `}
                        >
                          {isBusy && <span className="text-slate-400 text-[7px]">busy</span>}
                          {isFilled && (
                            <div className="slot-fill absolute inset-1 block-3d rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-[8px]">{goal.mins}m</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === 'calendarFly' && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="calendar-fly bg-white rounded-xl p-3 shadow-lg w-full max-w-md text-center">
              <p className="text-slate-400 text-sm">Saved ✓</p>
            </div>
          </div>
        )}

        {(phase === 'notification' || phase === 'userResponse') && (
          <div className="absolute inset-0 flex flex-col items-center pt-6 px-4">
            <div className="notif-drop w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-800">P</span>
                  </div>
                  <span className="text-sm font-medium">Pepzi</span>
                </div>
                <span className="text-slate-400 text-xs">Monday · 7:00 PM</span>
              </div>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">Time for {goal.name}! {goal.icon}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{goal.sessions[0].title} · {goal.mins} min</p>
                    <p className="text-sm text-slate-700 font-medium mt-3">Did you complete this session?</p>
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 px-4 py-2 bg-slate-800 text-white text-sm rounded-xl font-medium">Yes, done! ✓</button>
                      <button className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-xl">Reschedule</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {phase === 'userResponse' && responseTyped && (
              <div className="mt-4 flex justify-end w-full max-w-sm">
                <div className="bg-slate-800 text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-sm shadow-lg">
                  {responseTyped}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'onTrack' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <div className="track-pop bg-white rounded-3xl p-8 shadow-xl border border-slate-100 w-full max-w-xs text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Nice work! 🎉</h3>
              <p className="text-slate-500 text-sm mt-2">You&apos;re on track to finish</p>
              <p className="text-slate-800 font-semibold">{goal.name}</p>
              <p className="text-sm text-slate-400 mt-1">by</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{goal.finishDate}</p>
            </div>
          </div>
        )}

        {phase === 'celebration' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-4">
            {confetti.map(c => (
              <div
                key={c.id}
                className="confetti absolute w-2.5 h-2.5 rounded-sm"
                style={{
                  left: `${c.x}%`,
                  top: '-10px',
                  backgroundColor: c.color,
                  animationDelay: `${c.delay}s`,
                }}
              />
            ))}
            
            <div className="celeb-pop bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center z-10 w-full max-w-xs">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-slate-800">Goal Achieved!</h2>
              <p className="text-slate-500 mt-1">{goal.name}</p>
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800">{goal.months}</div>
                  <div className="text-xs text-slate-400">months</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800">48</div>
                  <div className="text-xs text-slate-400">sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800">{goal.hours}h</div>
                  <div className="text-xs text-slate-400">invested</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'restart' && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="text-slate-400 text-sm">Loading next example...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LANDING PAGE COMPONENT
// ============================================================

export default function LandingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [demoGoalIndex, setDemoGoalIndex] = useState(0);
  const [demoTypedText, setDemoTypedText] = useState('');
  const [isDemoTyping, setIsDemoTyping] = useState(true);
  
  const [userInput, setUserInput] = useState('');
  const [userHasFocused, setUserHasFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [feedItems, setFeedItems] = useState<FeedItemType[]>(() => generateFeedItems());

  useEffect(() => {
    if (!isDemoTyping || userHasFocused) return;
    
    const currentGoal = DEMO_GOALS[demoGoalIndex];
    
    if (demoTypedText.length < currentGoal.length) {
      const t = setTimeout(() => {
        setDemoTypedText(currentGoal.slice(0, demoTypedText.length + 1));
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isDemoTyping, demoTypedText, demoGoalIndex, userHasFocused]);

  const handleAnimationCycleComplete = () => {
    if (!userHasFocused) {
      setDemoGoalIndex(prev => (prev + 1) % DEMO_GOALS.length);
      setDemoTypedText('');
    }
  };

  const handleFocus = () => {
    if (!userHasFocused) {
      setUserHasFocused(true);
      setIsDemoTyping(false);
      setUserInput('');
    }
  };

  const displayValue = userHasFocused ? userInput : demoTypedText;

  const validateInput = (input: string): { valid: boolean; error?: string } => {
    const trimmed = input.trim();
    if (trimmed.length < MIN_GOAL_LENGTH) {
      return { valid: false, error: 'Please enter a more descriptive goal.' };
    }
    if (trimmed.length > MAX_GOAL_LENGTH) {
      return { valid: false, error: `Goal must be under ${MAX_GOAL_LENGTH} characters.` };
    }
    return { valid: true };
  };

  const handleSubmit = async () => {
    const inputToSubmit = userHasFocused ? userInput : demoTypedText;
    if (!inputToSubmit.trim() || isLoading) return;
    
    const validation = validateInput(inputToSubmit);
    if (!validation.valid) {
      setError(validation.error || 'Invalid input');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/goals/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_name: inputToSubmit.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.blocked) {
          setError(data.error || "Can't help with that — try a different goal.");
        } else {
          setError(data.error || 'Failed to generate preview');
        }
        return;
      }
      
      setPreview(data);
      setUserHasFocused(true);
    } catch (err) {
      console.error('Preview error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSignupClick = (schedule?: ScheduleSelection) => {
    if (preview) {
      sessionStorage.setItem('pendingGoal', JSON.stringify({
        name: preview.goal.name,
        category: preview.goal.category,
        plan: preview.plan,
        schedule: schedule,
        preview: preview.preview,
      }));
      console.log('📦 Saved pendingGoal with preview:', preview.preview.week1.sessions.map(s => s.name));
    }
    router.push('/signup');
  };

  const handleLike = (id: number) => {
    setFeedItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, liked: !item.liked, likes: item.liked ? item.likes - 1 : item.likes + 1 }
        : item
    ));
  };

  const isInputValid = displayValue.trim().length >= MIN_GOAL_LENGTH && displayValue.trim().length <= MAX_GOAL_LENGTH;
  const remainingChars = MAX_GOAL_LENGTH - displayValue.length;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/65 to-white/85" />
      </div>

      <div className="relative z-10">
        <nav className="flex items-center justify-between px-5 py-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 backdrop-blur-xl bg-white/70 rounded-xl flex items-center justify-center border border-white/80 shadow-sm overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-slate-200/30" />
              <svg viewBox="0 0 40 40" className="w-6 h-6 relative z-10">
                <path d="M6 32 L16 16 L26 32 Z" className="fill-slate-300/80" />
                <path d="M16 16 L13 22 L16 20 L19 22 Z" className="fill-white/90" />
                <path d="M12 32 L24 12 L36 32 Z" className="fill-slate-500" />
                <path d="M24 12 L20 20 L24 17 L28 20 Z" className="fill-white" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-slate-700">Pepzi</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">
              Log in
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-slate-800 rounded-xl text-white text-sm font-medium hover:bg-slate-700 shadow-md">
              Get Started
            </Link>
          </div>
        </nav>

        <section className="px-4 pt-8 md:pt-12 pb-6 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold leading-snug mb-3 text-slate-800 max-w-2xl mx-auto">
              Turn goals into scheduled sessions. Stay on track when life gets in the way.
            </h1>
            <p className="text-base text-slate-400 max-w-md mx-auto">
              {preview ? 'Your personalized plan is ready.' : 'Most plans break when real life shows up.'}
            </p>
          </div>

          <div className="w-full max-w-xl mx-auto mb-6">
            <p className="text-sm text-slate-500 mb-2 text-center font-medium">
              {userHasFocused ? 'Enter your goal' : '✨ Try it yourself'}
            </p>
            
            <GlassCard className="p-2" hover={false}>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-3 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                      if (userHasFocused) {
                        setUserInput(e.target.value);
                        setError(null);
                      }
                    }}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={userHasFocused ? "Type a goal you want to achieve..." : ""}
                    maxLength={MAX_GOAL_LENGTH}
                    className="w-full bg-transparent text-slate-700 text-lg font-medium placeholder:text-slate-400 outline-none"
                    disabled={isLoading}
                  />
                  {!userHasFocused && isDemoTyping && demoTypedText.length < DEMO_GOALS[demoGoalIndex].length && (
                    <span className="inline-block w-0.5 h-6 bg-slate-700 ml-0.5 animate-pulse" />
                  )}
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={!isInputValid || isLoading}
                  className="px-4 py-3 bg-slate-800 rounded-xl text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-all flex items-center gap-2 font-medium whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      <span>Get my plan</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </GlassCard>
            
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-xs text-slate-400">
                {userHasFocused ? 'Real goals work best (fitness, skills, projects)' : 'Click to enter your own goal'}
              </p>
              {userHasFocused && userInput.length > 0 && (
                <p className={`text-xs ${remainingChars < 20 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {remainingChars} left
                </p>
              )}
            </div>
            
            {error && (
              <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
            )}
          </div>

          {preview ? (
            <div className="w-full max-w-xl mx-auto">
              <PlanPreviewDisplay preview={preview} onSignup={handleSignupClick} />
            </div>
          ) : (
            <>
              <div className="w-full max-w-xl mx-auto">
                <ScheduleAnimation 
                  currentGoalIndex={demoGoalIndex} 
                  onCycleComplete={handleAnimationCycleComplete}
                />
              </div>
              
              {!userHasFocused && (
                <div className="text-center mt-4">
                  <p className="text-sm text-slate-400 mb-3">Or try:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Learn guitar', 'Run a 5K', 'Learn Spanish', 'Read more books'].map((example) => (
                      <button
                        key={example}
                        onClick={() => {
                          setUserHasFocused(true);
                          setIsDemoTyping(false);
                          setUserInput(example);
                          inputRef.current?.focus();
                        }}
                        className="px-3 py-1.5 bg-white/50 hover:bg-white/70 border border-slate-200 rounded-full text-sm text-slate-600 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <div className="grid md:grid-cols-3 gap-4">
              <GlassCard className="p-5 text-center" hover={false}>
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">Know your time</h3>
                <p className="text-sm text-slate-400">See exactly how many hours you need</p>
              </GlassCard>
              
              <GlassCard className="p-5 text-center" hover={false}>
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">Auto-schedule</h3>
                <p className="text-sm text-slate-400">Sessions fit around your life</p>
              </GlassCard>
              
              <GlassCard className="p-5 text-center" hover={false}>
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-6 h-6 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-700 mb-1">Just ask</h3>
                <p className="text-sm text-slate-400">Reschedule by chatting naturally</p>
              </GlassCard>
            </div>
          </div>
        </section>

        <section className="px-4 py-8">
          <div className="max-w-xl mx-auto">
            <p className="text-center text-sm text-slate-400 mb-4">People making progress</p>
            <div className="space-y-3">
              {feedItems.map((item) => (
                <SimpleFeedCard key={item.id} item={item} onLike={handleLike} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <Link 
              href="/signup" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 rounded-2xl font-semibold text-white hover:bg-slate-700 shadow-lg w-full justify-center"
            >
              Start with your first goal
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-sm text-slate-400 mt-3">Free · Takes 30 seconds</p>
          </div>
        </section>

        <footer className="px-6 py-6 text-center">
          <p className="text-slate-400 text-sm">© 2025 Pepzi</p>
        </footer>
      </div>
    </div>
  );
}