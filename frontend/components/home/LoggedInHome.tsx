'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { 
  Plus, 
  Store, 
  Heart, 
  MessageCircle, 
  Clock, 
  X,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Trophy,
  Eye,
  Flame,
  Loader2,
  Calendar,
  Image as ImageIcon,
  Trash2,
  MoreVertical,
  Grid3X3,
  List,
  FileText,
  Table,
  ArrowLeft,
  Check,
  TrendingUp,
  BarChart3,
  StickyNote,
  Compass,
  Sparkles,
  Crown,
  Zap,
} from 'lucide-react';
import GoalCreationFlow from '../goals/GoalCreationFlow';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://pepzi-backend-1029121217006.europe-west1.run.app';

// ============================================
// TYPES
// ============================================

interface FeedPost {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    avatarUrl?: string;
  };
  book: {
    id: string;
    name: string;
    emoji: string;
    totalSessions: number;
    totalHours: number;
    completedDate: string;
    catalogueId?: string; // links to catalogue challenge
  };
  post: {
    caption?: string;
    image?: string;
    mediaUrls?: string[];
    timeAgo: string;
  };
  stats: {
    likes: number;
    comments: number;
    liked: boolean;
  };
  meta?: {
    sessionName?: string;
    sessionNumber?: number;
    progressPercent?: number;
    streakDays?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  };
}

interface JourneySession {
  id: string;
  session_number: number;
  scheduled_date: string;
  status: string;
  notes?: string;
  diary_notes?: string;
  duration_mins?: number;
  actual_duration_seconds?: number;
  tracked_data?: {
    media?: { url: string; type: string }[];
    notes?: string;
    metrics?: { name: string; value: number; unit: string }[];
    columnData?: Record<string, any>;
  };
}

type FlowStep = 'choose_type' | 'catalogue_browse' | 'catalogue_detail' | 'ai_chat' | 'manual_input' | 'session_preview' | 'day_drop' | 'creating';

// ============================================
// CONSTANTS
// ============================================

const AVATAR_GRADIENTS = [
  'from-rose-400 to-pink-500',
  'from-violet-400 to-purple-500',
  'from-sky-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-fuchsia-400 to-pink-500',
];

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Beginner', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  intermediate: { label: 'Intermediate', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  advanced: { label: 'Advanced', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  expert: { label: 'Expert', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
};

const CHART_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

// ============================================
// HELPER: Time formatting
// ============================================

function formatTimeAgo(timeAgo: string): string {
  return timeAgo;
}

function getAvatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

// ============================================
// SIMPLE LINE CHART COMPONENT
// ============================================

function SimpleLineChart({ 
  data, 
  metricName,
  unit,
  color = '#f59e0b' 
}: { 
  data: { session: number; value: number }[];
  metricName: string;
  unit?: string;
  color?: string;
}) {
  if (data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  const width = 280;
  const height = 80;
  const padding = 10;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((d.value - minValue) / range) * (height - padding * 2);
    return { x, y, ...d };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/60 capitalize">{metricName}</span>
        <span className="text-xs font-bold" style={{ color }}>
          Total: {Math.round(total)} {unit}
        </span>
      </div>
      <svg width={width} height={height} className="overflow-visible w-full">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#1a1510" stroke={color} strokeWidth="2" />
            <title>S{p.session}: {p.value}</title>
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-2 mt-1">
        <span className="text-[9px] text-white/40">S1</span>
        {data.length > 1 && <span className="text-[9px] text-white/40">S{data.length}</span>}
      </div>
    </div>
  );
}

// ============================================
// STATS SUMMARY COMPONENT
// ============================================

function JourneyStatsSummary({ sessions }: { sessions: JourneySession[] }) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const metricsData = useMemo(() => {
    const metricsByName: Record<string, { data: { session: number; value: number }[]; unit: string; total: number }> = {};
    
    sessions.forEach((s) => {
      const sessionNum = s.session_number;
      const metrics = s.tracked_data?.metrics || [];
      
      metrics.forEach(m => {
        if (!metricsByName[m.name]) {
          metricsByName[m.name] = { data: [], unit: m.unit || '', total: 0 };
        }
        metricsByName[m.name].data.push({ session: sessionNum, value: m.value });
        metricsByName[m.name].total += m.value;
      });
      
      const columnData = s.tracked_data?.columnData || {};
      Object.entries(columnData).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (!metricsByName[key]) {
            metricsByName[key] = { data: [], unit: '', total: 0 };
          }
          metricsByName[key].data.push({ session: sessionNum, value });
          metricsByName[key].total += value;
        }
      });
    });
    
    Object.values(metricsByName).forEach(m => {
      m.data.sort((a, b) => a.session - b.session);
    });
    
    return metricsByName;
  }, [sessions]);

  const totalDuration = sessions.reduce((sum, s) => {
    if (s.actual_duration_seconds) return sum + s.actual_duration_seconds;
    if (s.duration_mins) return sum + s.duration_mins * 60;
    return sum;
  }, 0);

  const totalHours = Math.floor(totalDuration / 3600);
  const totalMins = Math.floor((totalDuration % 3600) / 60);

  const sessionsWithNotes = sessions.filter(s => 
    s.tracked_data?.notes || s.diary_notes || s.notes
  ).length;

  const sessionsWithPhotos = sessions.filter(s => 
    s.tracked_data?.media && s.tracked_data.media.length > 0
  ).length;

  const metricNames = Object.keys(metricsData);

  useEffect(() => {
    if (metricNames.length > 0 && !selectedMetric) {
      setSelectedMetric(metricNames[0]);
    }
  }, [metricNames, selectedMetric]);

  return (
    <div className="p-4 border-b border-white/10">
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-white/5 rounded-lg">
          <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-white font-semibold text-sm">{totalHours > 0 ? `${totalHours}h` : ''} {totalMins}m</p>
          <p className="text-white/40 text-[10px]">Total Time</p>
        </div>
        <div className="text-center p-2 bg-white/5 rounded-lg">
          <Check className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-white font-semibold text-sm">{sessions.length}</p>
          <p className="text-white/40 text-[10px]">Sessions</p>
        </div>
        <div className="text-center p-2 bg-white/5 rounded-lg">
          <StickyNote className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <p className="text-white font-semibold text-sm">{sessionsWithNotes}</p>
          <p className="text-white/40 text-[10px]">Notes</p>
        </div>
        <div className="text-center p-2 bg-white/5 rounded-lg">
          <ImageIcon className="w-4 h-4 text-pink-400 mx-auto mb-1" />
          <p className="text-white font-semibold text-sm">{sessionsWithPhotos}</p>
          <p className="text-white/40 text-[10px]">Photos</p>
        </div>
      </div>

      {metricNames.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/50 text-xs font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Tracked Metrics
          </p>
          
          <div className="flex flex-wrap gap-2">
            {metricNames.map((name, idx) => {
              const isSelected = selectedMetric === name;
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              const total = Math.round(metricsData[name].total);
              const unit = metricsData[name].unit;
              
              return (
                <button
                  key={name}
                  onClick={() => setSelectedMetric(name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected ? 'ring-2 ring-offset-1 ring-offset-[#1a1510]' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ 
                    background: isSelected ? `${color}30` : 'rgba(255,255,255,0.1)',
                    color: isSelected ? color : 'rgba(255,255,255,0.7)',
                    '--tw-ring-color': isSelected ? color : undefined,
                  } as React.CSSProperties}
                >
                  <span className="capitalize">{name}</span>
                  <span className="ml-1 opacity-70">({total}{unit})</span>
                </button>
              );
            })}
          </div>

          {selectedMetric && metricsData[selectedMetric] && (
            <div className="bg-white/5 rounded-lg p-3">
              <SimpleLineChart 
                data={metricsData[selectedMetric].data} 
                metricName={selectedMetric}
                unit={metricsData[selectedMetric].unit}
                color={CHART_COLORS[metricNames.indexOf(selectedMetric) % CHART_COLORS.length]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SESSION DETAIL VIEW
// ============================================

function SessionDetailView({
  session,
  onBack,
  goalEmoji,
}: {
  session: JourneySession;
  onBack: () => void;
  goalEmoji: string;
}) {
  const media = session.tracked_data?.media || [];
  const notes = session.tracked_data?.notes || session.diary_notes || session.notes || '';
  const metrics = session.tracked_data?.metrics || [];
  const columnData = session.tracked_data?.columnData || {};
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds?: number, mins?: number) => {
    if (seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m ${s}s`;
    }
    if (mins) return `${mins}m`;
    return '-';
  };

  return (
    <div className="h-full flex flex-col max-h-[90vh]">
      <div className="p-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <p className="text-white font-semibold">Session {session.session_number}</p>
          <p className="text-white/50 text-xs">{formatDate(session.scheduled_date)}</p>
        </div>
        <span className="text-2xl">{goalEmoji}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {media.length > 0 && (
          <div className="relative bg-black">
            <div className="aspect-square">
              <img src={media[currentImageIndex]?.url} alt="" className="w-full h-full object-contain" />
            </div>
            {media.length > 1 && (
              <>
                {currentImageIndex > 0 && (
                  <button onClick={() => setCurrentImageIndex(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                )}
                {currentImageIndex < media.length - 1 && (
                  <button onClick={() => setCurrentImageIndex(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors">
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                )}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 rounded-full px-2 py-1">
                  {media.map((m, i) => (
                    <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-6 h-6 rounded overflow-hidden border-2 transition-all ${i === currentImageIndex ? 'border-amber-400 scale-110' : 'border-transparent opacity-60'}`}>
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-white/50 text-xs">Duration</p>
              <p className="text-white font-semibold">{formatDuration(session.actual_duration_seconds, session.duration_mins)}</p>
            </div>
          </div>

          {metrics.length > 0 && (
            <div>
              <p className="text-white/50 text-xs mb-2 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Tracked Metrics</p>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map((m, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <p className="text-white/50 text-xs">{m.name}</p>
                    <p className="text-white font-bold text-lg">{m.value} <span className="text-white/50 text-xs font-normal">{m.unit}</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(columnData).length > 0 && (
            <div>
              <p className="text-white/50 text-xs mb-2 flex items-center gap-1.5"><Table className="w-3.5 h-3.5" /> Custom Data</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(columnData).map(([key, value]) => (
                  <div key={key} className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <p className="text-white/50 text-xs capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="text-white font-semibold">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {notes && (
            <div>
              <p className="text-white/50 text-xs mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Session Notes</p>
              <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                <p className="text-white/90 text-sm whitespace-pre-wrap leading-relaxed">{notes}</p>
              </div>
            </div>
          )}

          {media.length === 0 && !notes && metrics.length === 0 && Object.keys(columnData).length === 0 && (
            <div className="text-center py-12 text-white/40">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No details recorded</p>
              <p className="text-xs mt-1">This session was completed without notes or tracked data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// JOURNEY VIEWER MODAL (kept mostly same)
// ============================================

function JourneyViewerModal({ isOpen, onClose, post, isOwnPost, onOpenLibrary }: { isOpen: boolean; onClose: () => void; post: FeedPost | null; isOwnPost?: boolean; onOpenLibrary?: () => void }) {
  const [sessions, setSessions] = useState<JourneySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<JourneySession | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showStats, setShowStats] = useState(true);

  useEffect(() => { if (!isOpen) { setSelectedSession(null); setSessions([]); } }, [isOpen]);

  useEffect(() => {
    if (isOpen && post?.book.id) {
      const fetchSessions = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`${API_BASE}/api/schedule/goal-sessions/${post.book.id}?user_id=${post.user.id}`);
          if (response.ok) {
            const data = await response.json();
            setSessions(data.sessions?.filter((s: JourneySession) => s.status === 'completed') || []);
          }
        } catch (error) { console.error('Failed to fetch sessions:', error); }
        finally { setIsLoading(false); }
      };
      fetchSessions();
    }
  }, [isOpen, post?.book.id, post?.user.id]);

  if (!isOpen || !post) return null;

  if (selectedSession) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(180deg, #2d2318 0%, #1a1510 100%)' }} onClick={e => e.stopPropagation()}>
          <SessionDetailView session={selectedSession} onBack={() => setSelectedSession(null)} goalEmoji={post.book.emoji} />
        </div>
      </div>
    );
  }

  const sessionPreviews = sessions.map(s => ({
    ...s,
    thumbnail: s.tracked_data?.media?.[0]?.url || null,
    hasNotes: !!(s.tracked_data?.notes || s.diary_notes || s.notes),
    hasMetrics: (s.tracked_data?.metrics?.length || 0) > 0 || Object.keys(s.tracked_data?.columnData || {}).length > 0,
  }));

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl flex flex-col" style={{ background: 'linear-gradient(180deg, #2d2318 0%, #1a1510 100%)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(post.user.name)} flex items-center justify-center font-bold text-white text-sm`}>{post.user.avatar}</div>
              <div><p className="font-semibold text-white text-sm">{post.user.name}</p><p className="text-xs text-white/50">Completed {post.post.timeAgo}</p></div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5 text-white/70" /></button>
          </div>
        </div>

        {/* Goal info */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{post.book.emoji}</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">{post.book.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-white/60 flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" />{post.book.totalSessions} sessions</span>
                <span className="text-xs text-white/60 flex items-center gap-1"><Clock className="w-3 h-3" />{post.book.totalHours}h</span>
                {post.meta?.streakDays && post.meta.streakDays > 0 && <span className="text-xs text-orange-400 flex items-center gap-1"><Flame className="w-3 h-3" />{post.meta.streakDays}d streak</span>}
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">✦ MASTERED</span>
          </div>
          {post.post.caption && <p className="mt-3 text-sm text-white/70 italic">&ldquo;{post.post.caption}&rdquo;</p>}
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-white/40"><Calendar className="w-10 h-10 mx-auto mb-2" /><p className="text-sm">No session data available</p></div>
          ) : (
            <>
              {showStats && <JourneyStatsSummary sessions={sessions} />}
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 sticky top-0 z-10" style={{ background: '#2d2318' }}>
                <p className="text-white/50 text-xs font-medium">Journey Timeline</p>
                <div className="flex gap-1">
                  <button onClick={() => setShowStats(!showStats)} className={`p-1.5 rounded ${showStats ? 'bg-white/20 text-white' : 'text-white/40'}`}><BarChart3 className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-white/40'}`}><Grid3X3 className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white/20 text-white' : 'text-white/40'}`}><List className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-4">
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-3 gap-2">
                    {sessionPreviews.map((session) => (
                      <button key={session.id} onClick={() => setSelectedSession(session)} className="relative aspect-square rounded-lg overflow-hidden bg-white/5 hover:ring-2 hover:ring-amber-500 transition-all group">
                        {session.thumbnail ? <img src={session.thumbnail} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5"><span className="text-2xl opacity-50">{post.book.emoji}</span></div>}
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">S{session.session_number}</div>
                        <div className="absolute top-1 right-1 flex gap-0.5">
                          {session.hasNotes && <div className="w-4 h-4 rounded bg-blue-500/80 flex items-center justify-center"><FileText className="w-2.5 h-2.5 text-white" /></div>}
                          {session.hasMetrics && <div className="w-4 h-4 rounded bg-emerald-500/80 flex items-center justify-center"><BarChart3 className="w-2.5 h-2.5 text-white" /></div>}
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5"><p className="text-white text-[10px] text-center">{formatDate(session.scheduled_date)}</p></div>
                        <div className="absolute inset-0 bg-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Eye className="w-5 h-5 text-white" /></div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessionPreviews.map((session) => {
                      const sessionNotes = session.tracked_data?.notes || session.diary_notes || session.notes || '';
                      return (
                        <button key={session.id} onClick={() => setSelectedSession(session)} className="w-full flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                            {session.thumbnail ? <img src={session.thumbnail} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-xl">{post.book.emoji}</span></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><p className="text-white font-medium text-sm">Session {session.session_number}</p>{session.hasNotes && <FileText className="w-3 h-3 text-blue-400" />}{session.hasMetrics && <BarChart3 className="w-3 h-3 text-emerald-400" />}</div>
                            <p className="text-white/50 text-xs">{formatDate(session.scheduled_date)}</p>
                            {sessionNotes && <p className="text-white/60 text-xs mt-1 line-clamp-2">{sessionNotes}</p>}
                            {session.tracked_data?.metrics?.[0] && <p className="text-amber-400 text-xs mt-1">{session.tracked_data.metrics[0].name}: {session.tracked_data.metrics[0].value} {session.tracked_data.metrics[0].unit}</p>}
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-1" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-white/70 text-sm"><Heart className="w-4 h-4" />{post.stats.likes}</span>
              <span className="flex items-center gap-1.5 text-white/70 text-sm"><MessageCircle className="w-4 h-4" />{post.stats.comments}</span>
            </div>
            <span className="text-xs text-white/40">{new Date(post.book.completedDate).toLocaleDateString()}</span>
          </div>
          {isOwnPost && onOpenLibrary && (
            <button onClick={onOpenLibrary} className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
              <BookOpen className="w-4 h-4" />Open in Library
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// DELETE CONFIRMATION MODAL
// ============================================

function DeleteConfirmModal({ isOpen, onClose, onConfirm, isDeleting }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; isDeleting: boolean }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Post?</h3>
        <p className="text-sm text-slate-600 mb-4">This will remove your achievement from the feed. This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting} className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-medium text-sm hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INSTAGRAM-STYLE FEED CARD
// ============================================

function FeedCard({ 
  post, 
  currentUserId, 
  onViewJourney, 
  onDelete,
  onLike,
}: { 
  post: FeedPost; 
  currentUserId?: string; 
  onViewJourney: () => void; 
  onDelete: () => void;
  onLike: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isLiked, setIsLiked] = useState(post.stats.liked);
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [imageIndex, setImageIndex] = useState(0);
  const isOwner = currentUserId === post.user.id;
  const avatarGradient = getAvatarGradient(post.user.name);
  const difficulty = post.meta?.difficulty;
  const diffConfig = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;
  const mediaUrls = post.post.mediaUrls || (post.post.image ? [post.post.image] : []);
  const hasMedia = mediaUrls.length > 0;

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    onLike();
  };

  return (
    <div className="bg-white rounded-none sm:rounded-2xl overflow-hidden border-b sm:border border-slate-100 sm:shadow-sm">
      {/* Card Header - User info */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {post.user.avatarUrl ? (
            <img src={post.user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/50 ring-offset-1" />
          ) : (
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center font-semibold text-white text-xs ring-2 ring-amber-400/50 ring-offset-1`}>
              {post.user.avatar}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-slate-900 text-sm">{post.user.name}</p>
              <Crown className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-[11px] text-slate-400">{post.post.timeAgo}</p>
          </div>
        </div>
        {isOwner && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[140px]">
                  <button onClick={() => { setShowMenu(false); onDelete(); }} className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4" />Delete post
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Challenge completion banner */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
          <span className="text-3xl">{post.book.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-[15px] truncate">{post.book.name}</h3>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">✦ CHALLENGE COMPLETE</span>
              {diffConfig && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${diffConfig.bg} ${diffConfig.color} border ${diffConfig.border}`}>
                  {diffConfig.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Media carousel */}
      {hasMedia && (
        <div className="relative">
          <div className="aspect-square bg-slate-100 overflow-hidden">
            <img 
              src={mediaUrls[imageIndex]} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
          {mediaUrls.length > 1 && (
            <>
              {imageIndex > 0 && (
                <button 
                  onClick={() => setImageIndex(i => i - 1)} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
              {imageIndex < mediaUrls.length - 1 && (
                <button 
                  onClick={() => setImageIndex(i => i + 1)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mediaUrls.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === imageIndex ? 'bg-white w-4' : 'bg-white/50'}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-semibold text-slate-700">{post.book.totalSessions}</span>
          <span className="text-[10px] text-slate-400">sessions</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">{post.book.totalHours}h</span>
          <span className="text-[10px] text-slate-400">total</span>
        </div>
        {post.meta?.streakDays && post.meta.streakDays > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-600">{post.meta.streakDays}</span>
            <span className="text-[10px] text-orange-400">streak</span>
          </div>
        )}
      </div>

      {/* Caption */}
      {post.post.caption && (
        <div className="px-4 pb-2">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900 mr-1.5">{post.user.name}</span>
            {post.post.caption}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2.5 flex items-center justify-between border-t border-slate-50">
        <div className="flex items-center gap-5">
          <button onClick={handleLike} className="flex items-center gap-1.5 group">
            <Heart className={`w-5 h-5 transition-all ${isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-slate-500 group-hover:text-red-400'}`} />
            <span className={`text-xs font-medium ${isLiked ? 'text-red-500' : 'text-slate-500'}`}>{likeCount}</span>
          </button>
          <button className="flex items-center gap-1.5 group">
            <MessageCircle className="w-5 h-5 text-slate-500 group-hover:text-slate-700 transition-colors" />
            <span className="text-xs font-medium text-slate-500">{post.stats.comments}</span>
          </button>
        </div>
        <button 
          onClick={onViewJourney} 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-white" />
          <span className="text-xs font-medium text-white">View Journey</span>
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN HOME PAGE
// ============================================

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showGoalCreation, setShowGoalCreation] = useState(false);
  const [goalCreationInitialStep, setGoalCreationInitialStep] = useState<FlowStep | undefined>(undefined);
  const [viewingPost, setViewingPost] = useState<FeedPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<FeedPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['feed-posts', user?.id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/posts?user_id=${user?.id || ''}&source=catalogue`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
    staleTime: 30000,
  });

  const feed: FeedPost[] = feedData?.posts || [];

  const openGoalCreation = (initialStep?: FlowStep) => {
    setGoalCreationInitialStep(initialStep);
    setShowGoalCreation(true);
  };

  const closeGoalCreation = () => {
    setShowGoalCreation(false);
    setGoalCreationInitialStep(undefined);
  };

  const handleViewJourney = (post: FeedPost) => {
    setViewingPost(post);
  };

  const handleOpenLibrary = () => {
    if (viewingPost?.book.id) {
      router.push(`/library?book=${viewingPost.book.id}`);
      setViewingPost(null);
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost || !user?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/api/posts/${deletingPost.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
        setDeletingPost(null);
      }
    } catch (error) { console.error('Failed to delete post:', error); }
    finally { setIsDeleting(false); }
  };

  const handleLikePost = async (postId: string) => {
    if (!user?.id) return;
    try {
      await fetch(`${API_BASE}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
    } catch (error) { console.error('Failed to like post:', error); }
  };

  const handleGoalCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    router.push('/goals');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = (user as any)?.display_name?.split(' ')[0] || (user as any)?.name?.split(' ')[0] || '';

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')" }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(248,245,240,0.78) 50%, rgba(255,255,255,0.92) 100%)' }} />
      </div>

      {/* Modals */}
      <JourneyViewerModal isOpen={!!viewingPost} onClose={() => setViewingPost(null)} post={viewingPost} isOwnPost={viewingPost?.user.id === user?.id} onOpenLibrary={handleOpenLibrary} />
      <DeleteConfirmModal isOpen={!!deletingPost} onClose={() => setDeletingPost(null)} onConfirm={handleDeletePost} isDeleting={isDeleting} />
      
      {user?.id && (
        <GoalCreationFlow
          isOpen={showGoalCreation}
          onClose={closeGoalCreation}
          onGoalCreated={handleGoalCreated}
          userId={user.id}
          initialStep={goalCreationInitialStep}
        />
      )}

      {/* Main Content */}
      <div className="relative z-10 min-h-screen pb-24">
        <div className="h-16" />
        <div className="max-w-xl mx-auto">
          
          {/* Header */}
          <div className="px-4 mb-5">
            <h1 className="text-2xl font-bold text-slate-800">
              {getGreeting()}{firstName ? `, ${firstName}` : ''} 👋
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Challenge completions from the community</p>
          </div>
          
          {/* Action Cards */}
          <div className="grid grid-cols-2 gap-3 px-4 mb-6">
            <button 
              onClick={() => openGoalCreation()} 
              className="group p-4 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]" 
              style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/30 transition-shadow">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm mb-0.5">Start a Book</h3>
              <p className="text-xs text-slate-400">Create your own goal</p>
            </button>
            
            <button 
              onClick={() => openGoalCreation('catalogue_browse')} 
              className="group p-4 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]" 
              style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-3 shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/30 transition-shadow">
                <Compass className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm mb-0.5">Quest Board</h3>
              <p className="text-xs text-slate-400">Browse challenges</p>
            </button>
          </div>
          
          {/* Feed Header */}
          <div className="flex items-center justify-between px-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-semibold text-slate-800">Challenge Feed</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">{feed.length} completion{feed.length !== 1 ? 's' : ''}</span>
          </div>
          
          {/* Feed */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm text-slate-400">Loading feed...</p>
            </div>
          ) : feed.length === 0 ? (
            <div className="text-center py-16 px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-10 h-10 text-amber-300" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">No challenges completed yet</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
                Be the first to complete a challenge from the Quest Board and share your journey!
              </p>
              <button 
                onClick={() => openGoalCreation('catalogue_browse')} 
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-shadow flex items-center gap-2 mx-auto"
              >
                <Compass className="w-4 h-4" />
                Browse Challenges
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:px-4">
              {feed.map(post => (
                <FeedCard 
                  key={post.id} 
                  post={post} 
                  currentUserId={user?.id} 
                  onViewJourney={() => handleViewJourney(post)} 
                  onDelete={() => setDeletingPost(post)} 
                  onLike={() => handleLikePost(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}