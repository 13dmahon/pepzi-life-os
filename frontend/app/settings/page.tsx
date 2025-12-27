'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { 
  ArrowLeft, 
  Loader2, 
  Sun, 
  Briefcase, 
  Car, 
  Calendar,
  Plus,
  X,
  Save,
  Check,
  LogOut,
  User,
  Settings,
} from 'lucide-react';
import Link from 'next/link';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Glass Card component matching website style
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-2xl bg-white/70 border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user, profile, updateProfile, signOut, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [works, setWorks] = useState(false);
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [commuteMins, setCommuteMins] = useState(0);
  const [commitments, setCommitments] = useState<Array<{ day: string; start: string; end: string; name: string }>>([]);
  
  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [newCommitment, setNewCommitment] = useState({
    name: '',
    day: 'monday',
    start: '18:00',
    end: '19:00',
  });

  useEffect(() => {
    if (profile) {
      setNewName(profile.name || '');
      setWakeTime(profile.wake_time || '07:00');
      setSleepTime(profile.sleep_time || '23:00');
      setCommuteMins(profile.daily_commute_mins || 0);
      setCommitments(profile.fixed_commitments || []);
      
      if (profile.work_schedule) {
        const activeDays = Object.entries(profile.work_schedule)
          .filter(([_, schedule]) => schedule !== null)
          .map(([day]) => day);
        
        setWorks(activeDays.length > 0);
        setWorkDays(activeDays);
        
        const firstSchedule = Object.values(profile.work_schedule).find(s => s !== null) as { start: string; end: string } | undefined;
        if (firstSchedule) {
          setWorkStart(firstSchedule.start);
          setWorkEnd(firstSchedule.end);
        }
      }
    }
  }, [profile]);

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen relative">
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
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = () => {
    if (profile?.name) {
      return profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || '??';
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSavingName(true);
    try {
      await updateProfile({ name: newName.trim() });
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      // Force redirect if signOut doesn't do it
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect anyway
      window.location.href = '/login';
    }
  };

  const toggleWorkDay = (day: string) => {
    setWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const addCommitment = () => {
    if (newCommitment.name.trim()) {
      setCommitments(prev => [...prev, { ...newCommitment }]);
      setNewCommitment({ name: '', day: 'monday', start: '18:00', end: '19:00' });
      setShowAddCommitment(false);
    }
  };

  const removeCommitment = (index: number) => {
    setCommitments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const work_schedule: Record<string, { start: string; end: string } | null> = {};
      for (const day of DAYS) {
        work_schedule[day] = works && workDays.includes(day) ? { start: workStart, end: workEnd } : null;
      }
      const { error } = await updateProfile({
        wake_time: wakeTime,
        sleep_time: sleepTime,
        work_schedule,
        fixed_commitments: commitments,
        daily_commute_mins: commuteMins,
      });
      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative pb-24 md:pb-8 md:pt-16">
      {/* Mountain Background */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/70 to-white/90" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="pt-4 pb-6">
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2.5 hover:bg-slate-100/50 rounded-xl transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-slate-700">Settings</h1>
                  <p className="text-xs text-slate-400">Customize your experience</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Profile Card */}
        <GlassCard className="p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Your name"
                    autoFocus
                  />
                  <button 
                    onClick={handleSaveName} 
                    disabled={savingName} 
                    className="px-3 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-600 transition-colors"
                  >
                    {savingName ? '...' : 'Save'}
                  </button>
                  <button 
                    onClick={() => setEditingName(false)} 
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditingName(true)} className="text-left group">
                  <h2 className="text-lg font-semibold text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                    {profile?.name || 'Tap to add name'}
                  </h2>
                </button>
              )}
              <p className="text-sm text-slate-400 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
        </GlassCard>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-medium transition-all mb-4 ${
            saved 
              ? 'bg-emerald-500 text-white shadow-lg' 
              : 'bg-slate-700 text-white hover:bg-slate-600 shadow-lg hover:shadow-xl'
          } disabled:opacity-50`}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
          ) : saved ? (
            <><Check className="w-4 h-4" />Saved!</>
          ) : (
            <><Save className="w-4 h-4" />Save Changes</>
          )}
        </button>

        <div className="space-y-4">
          {/* Daily Rhythm */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-100/80 rounded-xl">
                <Sun className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-700">Daily Rhythm</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-2">Wake up</label>
                <input 
                  type="time" 
                  value={wakeTime} 
                  onChange={(e) => setWakeTime(e.target.value)} 
                  className="w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-2">Bedtime</label>
                <input 
                  type="time" 
                  value={sleepTime} 
                  onChange={(e) => setSleepTime(e.target.value)} 
                  className="w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" 
                />
              </div>
            </div>
          </GlassCard>

          {/* Work Schedule */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-100/80 rounded-xl">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-700">Work Schedule</h2>
            </div>
            <div className="flex gap-3 mb-4">
              <button 
                onClick={() => setWorks(true)} 
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                  works 
                    ? 'bg-slate-700 text-white shadow-md' 
                    : 'bg-white/60 text-slate-500 border border-slate-200/80 hover:bg-white/80'
                }`}
              >
                I work
              </button>
              <button 
                onClick={() => setWorks(false)} 
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                  !works 
                    ? 'bg-slate-700 text-white shadow-md' 
                    : 'bg-white/60 text-slate-500 border border-slate-200/80 hover:bg-white/80'
                }`}
              >
                I don&apos;t work
              </button>
            </div>
            {works && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-2">Work days</label>
                  <div className="flex gap-1.5">
                    {DAYS.map((day, i) => (
                      <button 
                        key={day} 
                        onClick={() => toggleWorkDay(day)} 
                        className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                          workDays.includes(day) 
                            ? 'bg-slate-700 text-white shadow-md' 
                            : 'bg-white/60 text-slate-400 border border-slate-200/80 hover:bg-white/80'
                        }`}
                      >
                        {DAY_LABELS[i]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">Start</label>
                    <input 
                      type="time" 
                      value={workStart} 
                      onChange={(e) => setWorkStart(e.target.value)} 
                      className="w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">End</label>
                    <input 
                      type="time" 
                      value={workEnd} 
                      onChange={(e) => setWorkEnd(e.target.value)} 
                      className="w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" 
                    />
                  </div>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Commute */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-orange-100/80 rounded-xl">
                <Car className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-700">Commute</h2>
            </div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-500">One-way commute</label>
              <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                {commuteMins} min
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="120" 
              step="5" 
              value={commuteMins} 
              onChange={(e) => setCommuteMins(parseInt(e.target.value))} 
              className="w-full accent-slate-600 h-2 bg-slate-100 rounded-full appearance-none cursor-pointer" 
            />
            <div className="flex justify-between text-xs text-slate-300 mt-1">
              <span>0 min</span>
              <span>2 hrs</span>
            </div>
          </GlassCard>

          {/* Fixed Commitments */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-purple-100/80 rounded-xl">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-700">Fixed Commitments</h2>
            </div>
            
            {commitments.length > 0 && (
              <div className="space-y-2 mb-4">
                {commitments.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/50 rounded-xl p-3 border border-slate-100">
                    <div className="flex-1">
                      <div className="font-medium text-slate-700">{c.name}</div>
                      <div className="text-sm text-slate-400 capitalize">{c.day} · {c.start} - {c.end}</div>
                    </div>
                    <button 
                      onClick={() => removeCommitment(i)} 
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {showAddCommitment ? (
              <div className="bg-slate-50/80 rounded-2xl p-4 space-y-3 border border-slate-100">
                <input 
                  type="text" 
                  value={newCommitment.name} 
                  onChange={(e) => setNewCommitment(p => ({ ...p, name: e.target.value }))} 
                  placeholder="e.g., Football, Gym class, Kids pickup" 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 placeholder-slate-400" 
                  autoFocus 
                />
                <div className="grid grid-cols-3 gap-2">
                  <select 
                    value={newCommitment.day} 
                    onChange={(e) => setNewCommitment(p => ({ ...p, day: e.target.value }))} 
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 text-sm"
                  >
                    {DAYS.map(day => <option key={day} value={day} className="capitalize">{day}</option>)}
                  </select>
                  <input 
                    type="time" 
                    value={newCommitment.start} 
                    onChange={(e) => setNewCommitment(p => ({ ...p, start: e.target.value }))} 
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" 
                  />
                  <input 
                    type="time" 
                    value={newCommitment.end} 
                    onChange={(e) => setNewCommitment(p => ({ ...p, end: e.target.value }))} 
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700" 
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowAddCommitment(false)} 
                    className="flex-1 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={addCommitment} 
                    disabled={!newCommitment.name.trim()} 
                    className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-slate-600 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowAddCommitment(true)} 
                className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add commitment
              </button>
            )}
          </GlassCard>

          {/* Logout */}
          <GlassCard className="p-2">
            <button 
              onClick={handleLogout} 
              disabled={isLoggingOut} 
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-red-50/50 disabled:opacity-50 transition-colors"
            >
              <div className="p-2.5 bg-red-100/80 rounded-xl">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <span className="font-medium text-red-600">
                {isLoggingOut ? 'Logging out...' : 'Log Out'}
              </span>
              {isLoggingOut && <Loader2 className="w-4 h-4 animate-spin text-red-500 ml-auto" />}
            </button>
          </GlassCard>

          {/* Version */}
          <div className="text-center text-sm text-slate-300 py-6">
            <p>Pepzi v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}