'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  Sparkles, 
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
  Target
} from 'lucide-react';

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

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
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

  const totalSteps = 4;

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

  const handleComplete = async () => {
    setLoading(true);

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

      const { error } = await updateProfile({
        wake_time: data.wake_time,
        sleep_time: data.sleep_time,
        work_schedule,
        fixed_commitments: data.commitments,
        daily_commute_mins: data.has_commute ? data.commute_mins : 0,
        onboarding_complete: true,
      });

      if (error) {
        console.error('Failed to save onboarding:', error);
        alert('Failed to save. Please try again.');
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3">
            <Sparkles className="w-7 h-7 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">Let's set you up</h1>
          <p className="text-white/80 mt-1">This helps us schedule around your life</p>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= step ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 min-h-[400px] flex flex-col">
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
          </div>

          {/* Navigation */}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            {step > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            
            <div className="flex-1" />

            {step < totalSteps - 1 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
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
        </div>

        {/* Skip Option */}
        <button
          onClick={handleComplete}
          className="w-full text-center text-white/60 text-sm mt-4 hover:text-white/80 transition-colors"
        >
          Skip for now - I'll set this up later
        </button>
      </div>
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
        <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-3">
          <Sun className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Your daily rhythm</h2>
        <p className="text-gray-500 mt-1">When do you typically wake up and go to sleep?</p>
      </div>

      <div className="space-y-4">
        {/* Wake Time */}
        <div className="bg-amber-50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Sun className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-gray-900">Wake up time</span>
          </div>
          <input
            type="time"
            value={data.wake_time}
            onChange={(e) => updateData({ wake_time: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-800 text-lg"
          />
        </div>

        {/* Sleep Time */}
        <div className="bg-indigo-50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Moon className="w-5 h-5 text-indigo-600" />
            <span className="font-medium text-gray-900">Bedtime</span>
          </div>
          <input
            type="time"
            value={data.sleep_time}
            onChange={(e) => updateData({ sleep_time: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 text-lg"
          />
        </div>
      </div>

      <p className="text-sm text-gray-400 text-center">
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
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
          <Briefcase className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Work schedule</h2>
        <p className="text-gray-500 mt-1">Do you have regular work hours?</p>
      </div>

      {/* Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => updateData({ works: true })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            data.works 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => updateData({ works: false })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            !data.works 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>

      {data.works && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Work Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work days</label>
            <div className="flex gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => toggleWorkDay(day)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    data.work_days.includes(day)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Start time</label>
              <input
                type="time"
                value={data.work_start}
                onChange={(e) => updateData({ work_start: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End time</label>
              <input
                type="time"
                value={data.work_end}
                onChange={(e) => updateData({ work_end: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
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
        <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-3">
          <Car className="w-6 h-6 text-orange-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Commute</h2>
        <p className="text-gray-500 mt-1">Do you commute to work?</p>
      </div>

      {/* Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => updateData({ has_commute: true })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            data.has_commute 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => updateData({ has_commute: false })}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            !data.has_commute 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          No / Remote
        </button>
      </div>

      {data.has_commute && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="w-20 text-center py-2 bg-orange-100 rounded-lg text-orange-700 font-medium">
                {data.commute_mins} min
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-400 text-center">
            We'll block {data.commute_mins} minutes before and after work
          </p>
        </div>
      )}

      {!data.has_commute && (
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-green-700">
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
        <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
          <Calendar className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Fixed commitments</h2>
        <p className="text-gray-500 mt-1">Any regular weekly events?</p>
      </div>

      {/* Existing Commitments */}
      {data.commitments.length > 0 && (
        <div className="space-y-2">
          {data.commitments.map((c, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{c.name}</div>
                <div className="text-sm text-gray-500 capitalize">
                  {c.day} · {c.start} - {c.end}
                </div>
              </div>
              <button
                onClick={() => removeCommitment(i)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showAdd ? (
        <div className="bg-purple-50 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
          <input
            type="text"
            value={newCommitment.name}
            onChange={(e) => setNewCommitment(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Football training, Therapy, Date night"
            className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
            autoFocus
          />
          
          <div className="grid grid-cols-3 gap-2">
            <select
              value={newCommitment.day}
              onChange={(e) => setNewCommitment(prev => ({ ...prev, day: e.target.value }))}
              className="px-3 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 capitalize"
            >
              {DAYS.map(day => (
                <option key={day} value={day} className="capitalize">{day}</option>
              ))}
            </select>
            <input
              type="time"
              value={newCommitment.start}
              onChange={(e) => setNewCommitment(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
            />
            <input
              type="time"
              value={newCommitment.end}
              onChange={(e) => setNewCommitment(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              onClick={addCommitment}
              disabled={!newCommitment.name.trim()}
              className="flex-1 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add commitment
        </button>
      )}

      {data.commitments.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 text-center">
          Things like gym classes, therapy sessions, or weekly socials
        </p>
      )}
    </div>
  );
}