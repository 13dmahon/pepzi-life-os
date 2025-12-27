'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  Mountain, 
  Sun, 
  Moon, 
  Briefcase, 
  Calendar, 
  ChevronRight, 
  ChevronLeft,
  Clock,
  Plus,
  X,
  Car,
  Check,
  Target,
  Sparkles,
  Send
} from 'lucide-react';
import AddGoalModal from '@/components/goals/AddGoalModal';

// Step components
type OnboardingData = {
  wake_time: string;
  sleep_time: string;
  works: boolean;
  work_days: string[];
  work_start: string;
  work_end: string;
  has_commute: boolean;
  commute_mins: number;
  commitments: Array<{ day: string; start: string; end: string; name: string }>;
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ============================================================
// GLASS CARD COMPONENT
// ============================================================

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-2xl bg-white/70 border border-white/80 shadow-xl rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const { profile, updateProfile } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<OnboardingData>({
    wake_time: '07:00',
    sleep_time: '23:00',
    works: true,
    work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    work_start: '09:00',
    work_end: '17:00',
    has_commute: false,
    commute_mins: 30,
    commitments: [],
  });

  const totalSteps = 5; // Added one more step for the goal

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSaveProfile = async () => {
    try {
      // Build work schedule
      const work_schedule: Record<string, { start: string; end: string } | null> = {};
      for (const day of DAYS) {
        if (data.works && data.work_days.includes(day)) {
          work_schedule[day] = { start: data.work_start, end: data.work_end };
        } else {
          work_schedule[day] = null;
        }
      }

      await updateProfile({
        wake_time: data.wake_time,
        sleep_time: data.sleep_time,
        work_schedule,
        fixed_commitments: data.commitments,
        daily_commute_mins: data.has_commute ? data.commute_mins : 0,
        onboarding_complete: true,
      });
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await handleSaveProfile();
      router.push('/today');
    } catch (err) {
      console.error('Onboarding error:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoalCreated = async () => {
    setShowGoalModal(false);
    setLoading(true);
    try {
      await handleSaveProfile();
      router.push('/today');
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Mountain Background */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/50 to-white/80" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 backdrop-blur-xl bg-white/70 rounded-2xl border border-white/80 shadow-lg mb-3">
            <Mountain className="w-7 h-7 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-700">Let's set you up</h1>
          <p className="text-slate-400 mt-1">This helps us schedule around your life</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Step {step + 1} of {totalSteps}</span>
            <span className="text-sm text-slate-400">{Math.round(((step + 1) / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 bg-white/50 rounded-full overflow-hidden backdrop-blur-xl">
            <div 
              className="h-full bg-slate-600 rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <GlassCard className="p-6 min-h-[420px] flex flex-col">
          {/* Step Content */}
          <div className="flex-1">
            {step === 0 && (
              <SleepScheduleStep data={data} updateData={updateData} />
            )}
            {step === 1 && (
              <WorkScheduleStep data={data} updateData={updateData} />
            )}
            {step === 2 && (
              <CommuteStep data={data} updateData={updateData} />
            )}
            {step === 3 && (
              <CommitmentsStep data={data} updateData={updateData} />
            )}
            {step === 4 && (
              <FirstGoalStep onOpenModal={() => setShowGoalModal(true)} />
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            {step > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:bg-white/50 rounded-xl font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            
            <div className="flex-1" />

            {step < totalSteps - 1 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-all"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Complete Setup
                  </>
                )}
              </button>
            )}
          </div>
        </GlassCard>

        {/* Skip Option */}
        <button
          onClick={handleComplete}
          className="w-full text-center text-slate-400 text-sm mt-4 hover:text-slate-600 transition-colors"
        >
          Skip for now
        </button>
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

// Step 1: Sleep Schedule
function SleepScheduleStep({ 
  data, 
  updateData 
}: { 
  data: OnboardingData; 
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
          <Sun className="w-6 h-6 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Your daily rhythm</h2>
        <p className="text-slate-400 mt-1">When do you typically wake up and go to sleep?</p>
      </div>

      <div className="space-y-4">
        {/* Wake Time */}
        <div className="bg-white/50 rounded-2xl p-4 border border-white/80">
          <div className="flex items-center gap-3 mb-3">
            <Sun className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-700">Wake up time</span>
          </div>
          <input
            type="time"
            value={data.wake_time}
            onChange={(e) => updateData({ wake_time: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700 text-lg"
          />
        </div>

        {/* Sleep Time */}
        <div className="bg-white/50 rounded-2xl p-4 border border-white/80">
          <div className="flex items-center gap-3 mb-3">
            <Moon className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-700">Bedtime</span>
          </div>
          <input
            type="time"
            value={data.sleep_time}
            onChange={(e) => updateData({ sleep_time: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700 text-lg"
          />
        </div>
      </div>

      <p className="text-sm text-slate-400 text-center">
        We'll avoid scheduling anything during your sleep hours
      </p>
    </div>
  );
}

// Step 2: Work Schedule
function WorkScheduleStep({ 
  data, 
  updateData 
}: { 
  data: OnboardingData; 
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  const toggleWorkDay = (day: string) => {
    const newDays = data.work_days.includes(day)
      ? data.work_days.filter(d => d !== day)
      : [...data.work_days, day];
    updateData({ work_days: newDays });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
          <Briefcase className="w-6 h-6 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Work schedule</h2>
        <p className="text-slate-400 mt-1">Do you have regular work hours?</p>
      </div>

      {/* Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => updateData({ works: true })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            data.works 
              ? 'bg-slate-800 text-white' 
              : 'bg-white/50 text-slate-500 hover:bg-white/70 border border-white/80'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => updateData({ works: false })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            !data.works 
              ? 'bg-slate-800 text-white' 
              : 'bg-white/50 text-slate-500 hover:bg-white/70 border border-white/80'
          }`}
        >
          No
        </button>
      </div>

      {data.works && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Work Days */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Work days</label>
            <div className="flex gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => toggleWorkDay(day)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    data.work_days.includes(day)
                      ? 'bg-slate-800 text-white'
                      : 'bg-white/50 text-slate-400 hover:bg-white/70 border border-white/80'
                  }`}
                >
                  {DAY_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Work Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Start time</label>
              <input
                type="time"
                value={data.work_start}
                onChange={(e) => updateData({ work_start: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">End time</label>
              <input
                type="time"
                value={data.work_end}
                onChange={(e) => updateData({ work_end: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Step 3: Commute
function CommuteStep({ 
  data, 
  updateData 
}: { 
  data: OnboardingData; 
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
          <Car className="w-6 h-6 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Commute</h2>
        <p className="text-slate-400 mt-1">Do you commute to work?</p>
      </div>

      {/* Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => updateData({ has_commute: true })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            data.has_commute 
              ? 'bg-slate-800 text-white' 
              : 'bg-white/50 text-slate-500 hover:bg-white/70 border border-white/80'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => updateData({ has_commute: false })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            !data.has_commute 
              ? 'bg-slate-800 text-white' 
              : 'bg-white/50 text-slate-500 hover:bg-white/70 border border-white/80'
          }`}
        >
          No / Remote
        </button>
      </div>

      {data.has_commute && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              One-way commute time
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={data.commute_mins}
                onChange={(e) => updateData({ commute_mins: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
              />
              <div className="w-20 text-center py-2 bg-slate-100 rounded-lg text-slate-700 font-medium">
                {data.commute_mins} min
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-400 text-center">
            We'll block {data.commute_mins} minutes before and after work
          </p>
        </div>
      )}

      {!data.has_commute && (
        <div className="bg-white/50 rounded-xl p-4 text-center border border-white/80">
          <p className="text-slate-600">
            Nice! Working from home gives you extra flexibility 🏠
          </p>
        </div>
      )}
    </div>
  );
}

// Step 4: Fixed Commitments
function CommitmentsStep({ 
  data, 
  updateData 
}: { 
  data: OnboardingData; 
  updateData: (updates: Partial<OnboardingData>) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newCommitment, setNewCommitment] = useState({
    name: '',
    day: 'monday',
    start: '18:00',
    end: '19:00',
  });

  const addCommitment = () => {
    if (newCommitment.name.trim()) {
      updateData({
        commitments: [...data.commitments, { ...newCommitment }],
      });
      setNewCommitment({ name: '', day: 'monday', start: '18:00', end: '19:00' });
      setShowAdd(false);
    }
  };

  const removeCommitment = (index: number) => {
    updateData({
      commitments: data.commitments.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
          <Calendar className="w-6 h-6 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Fixed commitments</h2>
        <p className="text-slate-400 mt-1">Any regular weekly events?</p>
      </div>

      {/* Existing Commitments */}
      {data.commitments.length > 0 && (
        <div className="space-y-2">
          {data.commitments.map((c, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/50 rounded-xl p-3 border border-white/80">
              <div className="flex-1">
                <div className="font-medium text-slate-700">{c.name}</div>
                <div className="text-sm text-slate-400 capitalize">
                  {c.day} · {c.start} - {c.end}
                </div>
              </div>
              <button
                onClick={() => removeCommitment(i)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showAdd ? (
        <div className="bg-white/50 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200 border border-white/80">
          <input
            type="text"
            value={newCommitment.name}
            onChange={(e) => setNewCommitment(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Football training, Therapy, Date night"
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
            autoFocus
          />
          
          <div className="grid grid-cols-3 gap-2">
            <select
              value={newCommitment.day}
              onChange={(e) => setNewCommitment(prev => ({ ...prev, day: e.target.value }))}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700 capitalize"
            >
              {DAYS.map(day => (
                <option key={day} value={day} className="capitalize">{day}</option>
              ))}
            </select>
            <input
              type="time"
              value={newCommitment.start}
              onChange={(e) => setNewCommitment(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
            />
            <input
              type="time"
              value={newCommitment.end}
              onChange={(e) => setNewCommitment(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 py-2 text-slate-500 hover:bg-white/50 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              onClick={addCommitment}
              disabled={!newCommitment.name.trim()}
              className="flex-1 py-2 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:bg-white/30 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add commitment
        </button>
      )}

      {data.commitments.length === 0 && !showAdd && (
        <p className="text-sm text-slate-400 text-center">
          Things like gym classes, therapy sessions, or weekly socials
        </p>
      )}
    </div>
  );
}

// Step 5: First Goal
function FirstGoalStep({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">What's your first summit?</h2>
        <p className="text-slate-400 mt-1">Set your first goal and we'll help you reach it</p>
      </div>

      <button
        onClick={onOpenModal}
        className="w-full p-5 bg-white/50 border-2 border-dashed border-slate-300 rounded-2xl hover:border-slate-400 hover:bg-white/70 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
            <Target className="w-6 h-6 text-slate-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-slate-700">Add your first goal</p>
            <p className="text-sm text-slate-400">e.g., Run a marathon, Learn Spanish, Lose 10kg</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </div>
      </button>

      <div className="bg-white/50 rounded-xl p-4 border border-white/80">
        <p className="text-sm text-slate-500 text-center">
          💡 You can also add goals later from the Goals page
        </p>
      </div>
    </div>
  );
}