'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { 
  Target,
  BookOpen,
  Calendar,
  ChevronRight,
  Loader2,
  Sparkles
} from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import TutorialSlides from './TutorialSlides';
import ScheduleSetup from './ScheduleSetup';

// Exact GlassCard from landing page
function GlassCard({ children, className = '', hover = true, onClick }: { 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`
        backdrop-blur-2xl bg-white/70 
        border border-white/80 
        shadow-[0_8px_32px_rgba(0,0,0,0.06)]
        rounded-3xl
        ${hover ? 'hover:bg-white/80 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const [currentView, setCurrentView] = useState<'welcome' | 'tutorial' | 'schedule' | 'goal'>('welcome');
  const [loading, setLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const { profile, updateProfile } = useAuth();
  const router = useRouter();

  const handleSkip = async () => {
    setLoading(true);
    try {
      await updateProfile({ onboarding_complete: true });
      router.push('/today');
    } catch (err) {
      console.error('Skip error:', err);
      alert('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleGoalCreated = async () => {
    setShowGoalModal(false);
    setLoading(true);
    try {
      await updateProfile({ onboarding_complete: true });
      router.push('/today');
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleTutorialComplete = () => {
    setCurrentView('welcome');
  };

  const handleScheduleComplete = () => {
    // ScheduleSetup handles saving and navigation directly
    // This is just a callback in case we need it
  };

  // Tutorial View
  if (currentView === 'tutorial') {
    return <TutorialSlides onComplete={handleTutorialComplete} />;
  }

  // Schedule Setup View
  if (currentView === 'schedule') {
    return <ScheduleSetup onComplete={handleScheduleComplete} onBack={() => setCurrentView('welcome')} />;
  }

  // Welcome View (default) - Matches landing page exactly
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

      {/* Skip Button - Top Right */}
      <button
        onClick={handleSkip}
        disabled={loading}
        className="fixed top-6 right-6 z-20 flex items-center gap-1 px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Skip for now
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Header - Matching landing page style */}
          <div className="text-center mb-8">
            {/* Logo matching nav */}
            <div className="inline-flex items-center gap-2.5 mb-6">
              <div className="w-11 h-11 backdrop-blur-xl bg-white/70 rounded-2xl flex items-center justify-center border border-white/80 shadow-sm overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-slate-200/30" />
                <svg viewBox="0 0 40 40" className="w-7 h-7 relative z-10">
                  <path d="M6 32 L16 16 L26 32 Z" className="fill-slate-300/80" />
                  <path d="M16 16 L13 22 L16 20 L19 22 Z" className="fill-white/90" />
                  <path d="M12 32 L24 12 L36 32 Z" className="fill-slate-500" />
                  <path d="M24 12 L20 20 L24 17 L28 20 Z" className="fill-white" />
                </svg>
              </div>
            </div>
            
            {/* Badge - Same as landing */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/80 rounded-full text-sm text-slate-600 mb-6">
              <Sparkles className="w-4 h-4 text-slate-500" />
              Welcome to Pepzi
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-3">
              How would you like to start?
            </h1>
            <p className="text-slate-500">
              Choose your path to get going
            </p>
          </div>

          {/* Options - Using landing page GlassCard */}
          <div className="space-y-4">
            {/* Option 1: Create First Goal */}
            <GlassCard 
              className="p-5"
              onClick={() => setShowGoalModal(true)}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Target className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800">Create my first goal</h3>
                  <p className="text-sm text-slate-500">Get a personalized training plan</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </GlassCard>

            {/* Option 2: Tutorial */}
            <GlassCard 
              className="p-5"
              onClick={() => setCurrentView('tutorial')}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800">Quick tutorial</h3>
                  <p className="text-sm text-slate-500">See how Pepzi works (30 sec)</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </GlassCard>

            {/* Option 3: Set Up Schedule */}
            <GlassCard 
              className="p-5"
              onClick={() => setCurrentView('schedule')}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800">Set up my schedule</h3>
                  <p className="text-sm text-slate-500">Work hours, sleep & commitments</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </GlassCard>
          </div>

          {/* Helper Text */}
          <p className="text-center text-sm text-slate-400 mt-8">
            You can always change these later in Settings
          </p>
        </div>
      </div>

      {/* Goal Modal */}
      <AddGoalModal 
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)} 
        onGoalCreated={handleGoalCreated}
        userId={profile?.id || ''}
      />
    </div>
  );
}