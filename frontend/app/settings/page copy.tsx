'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { 
  ArrowLeft, 
  Loader2, 
  Sun, 
  Moon, 
  Briefcase, 
  Car, 
  Calendar,
  Plus,
  X,
  Save,
  Check,
  User,
  Mail,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Profile editing
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

  // Load profile data
  useEffect(() => {
    if (profile) {
      setNewName(profile.name || '');
      setWakeTime(profile.wake_time || '07:00');
      setSleepTime(profile.sleep_time || '23:00');
      setCommuteMins(profile.daily_commute_mins || 0);
      setCommitments(profile.fixed_commitments || []);
      
      // Parse work schedule
      if (profile.work_schedule) {
        const activeDays = Object.entries(profile.work_schedule)
          .filter(([_, schedule]) => schedule !== null)
          .map(([day, _]) => day);
        
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
    } catch (error) {
      console.error('Failed to update name:', error);
    } finally {
      setSavingName(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const toggleWorkDay = (day: string) => {
    setWorkDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
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
        if (works && workDays.includes(day)) {
          work_schedule[day] = { start: workStart, end: workEnd };
        } else {
          work_schedule[day] = null;
        }
      }

      const { error } = await updateProfile({
        wake_time: wakeTime,
        sleep_time: sleepTime,
        work_schedule,
        fixed_commitments: commitments,
        daily_commute_mins: commuteMins,
      });

      if (error) {
        alert('Failed to save settings');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* Header with Profile */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
          
          {/* Profile Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {getInitials()}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                      placeholder="Your name"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="px-3 py-1.5 bg-white text-purple-600 rounded-lg text-sm font-medium hover:bg-white/90 disabled:opacity-50"
                    >
                      {savingName ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setNewName(profile?.name || '');
                      }}
                      className="px-2 py-1.5 text-white/80 hover:text-white text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-left group"
                  >
                    <h2 className="text-xl font-semibold truncate group-hover:underline">
                      {profile?.name || 'Tap to add name'}
                    </h2>
                  </button>
                )}
                <p className="text-white/80 text-sm truncate mt-1">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* Save Button - Sticky */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
          <button
            onClick={handleSave}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-purple-500 text-white hover:bg-purple-600'
            } disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Sleep Schedule */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Sun className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Daily Rhythm</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Wake up</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bedtime</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
              />
            </div>
          </div>
        </div>

        {/* Work Schedule */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Work Schedule</h2>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setWorks(true)}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                works ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              I work
            </button>
            <button
              onClick={() => setWorks(false)}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                !works ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              I don't work
            </button>
          </div>

          {works && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work days</label>
                <div className="flex gap-2">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      onClick={() => toggleWorkDay(day)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        workDays.includes(day)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {DAY_LABELS[i]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start</label>
                  <input
                    type="time"
                    value={workStart}
                    onChange={(e) => setWorkStart(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End</label>
                  <input
                    type="time"
                    value={workEnd}
                    onChange={(e) => setWorkEnd(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Commute */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Car className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Commute</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              One-way commute time: <span className="text-orange-600">{commuteMins} minutes</span>
            </label>
            <input
              type="range"
              min="0"
              max="120"
              step="5"
              value={commuteMins}
              onChange={(e) => setCommuteMins(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>No commute</span>
              <span>2 hours</span>
            </div>
          </div>
        </div>

        {/* Fixed Commitments */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Fixed Commitments</h2>
          </div>

          {/* Existing Commitments */}
          {commitments.length > 0 && (
            <div className="space-y-2 mb-4">
              {commitments.map((c, i) => (
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
          {showAddCommitment ? (
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <input
                type="text"
                value={newCommitment.name}
                onChange={(e) => setNewCommitment(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Football training"
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
                  onClick={() => setShowAddCommitment(false)}
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
              onClick={() => setShowAddCommitment(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add commitment
            </button>
          )}
        </div>

        {/* Logout Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <div className="p-2 bg-red-100 rounded-lg">
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
            <span className="font-medium text-red-600">
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </span>
          </button>
        </div>

        {/* App Info */}
        <div className="text-center text-sm text-gray-400 py-4">
          <p>Pepzi v1.0.0</p>
          <p className="mt-1">Made with 💜 for your goals</p>
        </div>
      </div>
    </div>
  );
}