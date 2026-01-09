'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { 
  Target,
  BookOpen,
  ChevronRight,
  Loader2,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';
import TutorialSlides from './TutorialSlides';
import { goalsAPI, scheduleAPI } from '@/lib/api';

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

// Progress steps for pending goal creation
const CREATION_STEPS = [
  { id: 'goal', label: 'Creating goal' },
  { id: 'plan', label: 'Building training plan' },
  { id: 'schedule', label: 'Scheduling sessions' },
];

export default function OnboardingPage() {
  const [currentView, setCurrentView] = useState<'welcome' | 'tutorial'>('welcome');
  const [loading, setLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const { profile, updateProfile } = useAuth();
  const router = useRouter();

  // Pending goal creation state
  const [isCreatingPendingGoal, setIsCreatingPendingGoal] = useState(false);
  const [creationStep, setCreationStep] = useState(0);
  const [pendingGoalName, setPendingGoalName] = useState('');
  
  // IdempotentWrite_v1: Prevent duplicate submissions
  const creationInFlightRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);

  // Check for pending goal on mount
  useEffect(() => {
    const checkPendingGoal = async () => {
      const pendingGoalStr = sessionStorage.getItem('pendingGoal');
      if (!pendingGoalStr || !profile?.id) return;
      
      let pendingGoal;
      try {
        pendingGoal = JSON.parse(pendingGoalStr);
      } catch {
        sessionStorage.removeItem('pendingGoal');
        return;
      }

      setPendingGoalName(pendingGoal.name);
      setIsCreatingPendingGoal(true);
      
      // IdempotentWrite_v1: Prevent double-submission
      if (creationInFlightRef.current) {
        console.log('⚠️ Goal creation already in flight, skipping duplicate');
        return;
      }
      creationInFlightRef.current = true;
      
      // Generate idempotency key for this creation attempt
      if (!requestIdRef.current) {
        requestIdRef.current = crypto.randomUUID();
      }
      const clientRequestId = requestIdRef.current;
      
      try {
        // Step 1: Create the goal
        setCreationStep(0);
        const goal = await goalsAPI.createGoal({
          user_id: profile.id,
          name: pendingGoal.name,
          category: pendingGoal.category,
          client_request_id: clientRequestId, // IdempotentWrite_v1
        });
        
        // Small delay for UX
        await new Promise(r => setTimeout(r, 800));
        
        // Step 2: Create the plan AND schedule in one call
        // The backend handles both plan creation and scheduling
        setCreationStep(1);
        
        // Check if we have a preview from the landing page
        const hasPreview = pendingGoal.preview?.week1?.sessions?.length > 0;
        console.log('📋 Creating plan with preview:', hasPreview ? 'YES' : 'NO');
        if (hasPreview) {
          console.log('   Preview week1 sessions:', pendingGoal.preview.week1.sessions.map((s: any) => s.name));
        }
        
        await goalsAPI.createPlanWithMilestones(goal.id, {
          milestones: [],
          weekly_hours: pendingGoal.plan.weekly_hours,
          sessions_per_week: pendingGoal.plan.sessions_per_week,
          total_hours: pendingGoal.plan.total_hours,
          session_length_mins: pendingGoal.plan.session_length_mins,
          // Pass the preview if we have one from the landing page
          preview: hasPreview ? pendingGoal.preview : undefined,
          // Only use simple_sessions if we have NO preview
          simple_sessions: !hasPreview,
          // Total sessions for the ENTIRE plan
          total_sessions: pendingGoal.plan.sessions_per_week * pendingGoal.plan.total_weeks,
          preferred_days: pendingGoal.schedule?.days,
          preferred_time: pendingGoal.schedule?.preferredTime || 'evening',
        });
        
        await new Promise(r => setTimeout(r, 800));
        
        // Step 3: Schedule is already created by createPlanWithMilestones
        // Just show the progress step for UX
        setCreationStep(2);
        await new Promise(r => setTimeout(r, 400));
        
        // NOTE: Removed duplicate scheduleAPI.generateForGoal() call
        // The backend's create-plan-with-milestones endpoint already handles scheduling
        
        // Clear pending goal and mark onboarding complete
        sessionStorage.removeItem('pendingGoal');
        await updateProfile({ onboarding_complete: true });
        
        // IdempotentWrite_v1: Clear request ID on success
        requestIdRef.current = null;
        
        // Go straight to today
        router.push('/today');
        
      } catch (err) {
        console.error('Failed to create pending goal:', err);
        sessionStorage.removeItem('pendingGoal');
        setIsCreatingPendingGoal(false);
        // Fall back to normal onboarding
      } finally {
        // IdempotentWrite_v1: Always reset in-flight flag
        creationInFlightRef.current = false;
      }
    };
    
    checkPendingGoal();
  }, [profile?.id, router, updateProfile]);

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

  // Loading state while creating pending goal
  if (isCreatingPendingGoal) {
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
          <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/70 to-white/90" />
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <div className="w-full max-w-md">
            <GlassCard className="p-8" hover={false}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Setting up your goal</h2>
                <p className="text-slate-500">{pendingGoalName}</p>
              </div>

              {/* Progress steps */}
              <div className="space-y-4">
                {CREATION_STEPS.map((step, idx) => {
                  const isComplete = idx < creationStep;
                  const isCurrent = idx === creationStep;
                  
                  return (
                    <div 
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isCurrent ? 'bg-emerald-50' : isComplete ? 'bg-slate-50' : 'opacity-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isComplete 
                          ? 'bg-emerald-500' 
                          : isCurrent 
                            ? 'bg-emerald-100' 
                            : 'bg-slate-200'
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : isCurrent ? (
                          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                        ) : (
                          <span className="text-slate-400 text-sm font-medium">{idx + 1}</span>
                        )}
                      </div>
                      <span className={`font-medium ${
                        isCurrent ? 'text-emerald-700' : isComplete ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        {step.label}
                        {isCurrent && '...'}
                        {isComplete && ' ✓'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-sm text-slate-400 mt-6">
                This will just take a moment
              </p>
            </GlassCard>
          </div>
        </div>
      </div>
    );
  }

  // Tutorial View
  if (currentView === 'tutorial') {
    return <TutorialSlides onComplete={handleTutorialComplete} />;
  }

  // Welcome View (default)
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
          {/* Header */}
          <div className="text-center mb-8">
            {/* Logo */}
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
            
            {/* Badge */}
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

          {/* Options - Only 2 now */}
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