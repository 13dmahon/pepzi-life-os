'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Sparkles,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Send,
  X,
  MessageCircle,
  Flame,
  Calendar,
  BarChart3,
  Settings,
  Link as LinkIcon,
  BookOpen,
  AlertCircle,
  Zap,
  Rocket,
  Camera,
  Video,
  Plus,
  Trash2,
  Table,
  TrendingUp,
  Share2,
  Trophy,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Supabase client for storage uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface ExtractedMetric {
  name: string;
  value: number;
  unit: string;
  type: string;
}

interface MediaItem {
  type: 'photo' | 'video';
  url: string;
  thumbnail?: string;
  uploadedAt?: string;
}

interface DataColumn {
  key: string;
  label: string;
  type: 'time' | 'rating' | 'number' | 'text';
  unit?: string;
}

interface ExtractedData {
  metrics: ExtractedMetric[];
  notes: string[];
  media?: MediaItem[];
  columnData?: Record<string, number | string>;
}

interface SessionData {
  id: string;
  goal_id?: string;
  goal_name?: string;
  name: string;
  description?: string;
  scheduled_date: string;
  scheduled_time?: string;
  duration_mins: number;
  status: string;
  diary_notes?: string;
  actual_duration_seconds?: number;
  completed_at?: string;
  tracked_data?: ExtractedData | null;
}

interface Book {
  id: string;
  name: string;
  emoji: string;
  category: string;
  progress: number;
  totalSessions: number;
  completedSessions: number;
  streak: number;
  daysBehind: number;
  resource_link?: string;
  resource_link_label?: string;
  source?: 'manual' | 'ai' | 'catalogue';
  plan?: {
    dataColumns?: DataColumn[];
  };
}

interface BookDiaryPageProps {
  book: Book;
  initialSession?: SessionData;
  userId: string;
  onClose: () => void;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getMetricIcon = (type: string) => {
  switch (type) {
    case 'money': return '💰';
    case 'weight': return '🏋️';
    case 'duration': return '⏱️';
    case 'distance': return '📏';
    case 'count': return '🔢';
    case 'reps': return '💪';
    case 'scale': return '📊';
    case 'rating': return '⭐';
    default: return '📈';
  }
};

const formatMetricValue = (metric: ExtractedMetric) => {
  if (metric.unit === '£' || metric.unit === '$') {
    return `${metric.unit}${metric.value}`;
  }
  return `${metric.value} ${metric.unit}`;
};

const formatTime = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
};

const isManualSession = (sessionName: string): boolean => {
  return /^Session \d+$/i.test(sessionName.trim());
};

const REASSURANCE_MESSAGES = [
  "Progress compounds. Start here.",
  "One session is enough today.",
  "Consistency beats intensity.",
  "Small steps, big results.",
  "You're building something great.",
  "Every page turns you forward.",
];

// ============================================================
// SUB-COMPONENT: Schedule Dots
// ============================================================

function ScheduleDots({ sessions }: { sessions: SessionData[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const days = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const session = sessions.find(s => s.scheduled_date.split('T')[0] === dateStr);
    const isCompleted = session?.status === 'completed';
    const hasSession = !!session;
    const isToday = i === 0;
    
    days.push({
      date,
      dayName: date.toLocaleDateString('en-GB', { weekday: 'short' }).charAt(0),
      hasSession,
      isCompleted,
      isToday,
    });
  }

  return (
    <div className="flex gap-1.5 justify-center">
      {days.map((day, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-stone-400 font-medium">{day.dayName}</span>
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              day.isToday ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-stone-100' : ''
            } ${
              day.isCompleted
                ? 'bg-emerald-500'
                : day.hasSession
                  ? 'bg-amber-400'
                  : 'bg-stone-300'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SUB-COMPONENT: Metric Stat Card
// ============================================================

function MetricStatCard({ stat }: { stat: { name: string; total: number; count: number; max: number; unit: string; type: string } }) {
  const isMoneyType = stat.type === 'money' || stat.unit === '£';
  const isMaxType = stat.type === 'weight';
  const displayValue = isMaxType ? stat.max : stat.total;
  
  return (
    <div className="bg-stone-100/80 rounded-lg p-2.5 border border-stone-200/50">
      <p className="text-[10px] text-stone-500 capitalize font-medium mb-0.5">{stat.name}</p>
      <p className="text-sm font-bold text-stone-700">
        {isMoneyType ? '£' : ''}{displayValue.toLocaleString()}
        {!isMoneyType && stat.unit ? ` ${stat.unit}` : ''}
      </p>
      <p className="text-[9px] text-stone-400">
        {isMaxType ? 'Best' : 'Total'} • {stat.count} sessions
      </p>
    </div>
  );
}

// ============================================================
// SUB-COMPONENT: Completion Confetti
// ============================================================

function CompletionConfetti({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes bounce-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-confetti { animation: confetti linear forwards; }
        .animate-bounce-in { animation: bounce-in 0.5s ease-out forwards; }
      `}} />
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          <div
            className="w-3 h-3 rotate-45"
            style={{
              backgroundColor: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'][Math.floor(Math.random() * 5)],
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        </div>
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-bounce-in bg-emerald-500 text-white rounded-full p-6 shadow-2xl">
          <Check className="w-12 h-12" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENT: Media Upload Section
// ============================================================

function MediaUploadSection({
  media,
  onAddMedia,
  onRemoveMedia,
  isCompleted,
  userId,
  goalId,
}: {
  media: MediaItem[];
  onAddMedia: (item: MediaItem) => void;
  onRemoveMedia: (index: number) => void;
  isCompleted: boolean;
  userId: string;
  goalId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/${goalId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      console.log('✅ Uploaded to:', publicUrl);

      onAddMedia({
        type: isVideo ? 'video' : 'photo',
        url: publicUrl,
        uploadedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {media.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {media.map((item, index) => (
            <div key={index} className="relative flex-shrink-0 group">
              <div 
                className="w-20 h-20 rounded-lg overflow-hidden bg-stone-200 cursor-pointer"
                onClick={() => setSelectedImage(item.url)}
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-stone-800">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              {!isCompleted && (
                <button
                  onClick={() => onRemoveMedia(index)}
                  className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!isCompleted && media.length < 6 && (
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1 py-2 flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs text-stone-600 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Add Photo/Video
              </>
            )}
          </button>
        </div>
      )}

      {selectedImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img src={selectedImage} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENT: Data Columns Section
// ============================================================

function DataColumnsSection({
  columns,
  data,
  onUpdateData,
  onAddColumn,
  onRemoveColumn,
  isCompleted,
}: {
  columns: DataColumn[];
  data: Record<string, number | string>;
  onUpdateData: (key: string, value: number | string) => void;
  onAddColumn: (column: DataColumn) => void;
  onRemoveColumn: (key: string) => void;
  isCompleted: boolean;
}) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnType, setNewColumnType] = useState<DataColumn['type']>('number');
  const [newColumnUnit, setNewColumnUnit] = useState('');

  const handleAddColumn = () => {
    if (!newColumnLabel.trim()) return;
    const key = newColumnLabel.toLowerCase().replace(/\s+/g, '_');
    onAddColumn({ key, label: newColumnLabel, type: newColumnType, unit: newColumnUnit || undefined });
    setNewColumnLabel('');
    setNewColumnUnit('');
    setShowAddColumn(false);
  };

  const renderInput = (column: DataColumn) => {
    const value = data[column.key] ?? '';
    const stringValue = String(value);
    
    if (isCompleted) {
      return (
        <span className="text-sm font-medium text-stone-700">
          {value}{column.unit ? ` ${column.unit}` : ''}
        </span>
      );
    }

    switch (column.type) {
      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onUpdateData(column.key, star)}
                className={`text-lg ${Number(value) >= star ? 'text-amber-400' : 'text-stone-300'}`}
              >
                ★
              </button>
            ))}
          </div>
        );
      case 'time':
        return (
          <input
            type="text"
            value={stringValue}
            onChange={(e) => onUpdateData(column.key, e.target.value)}
            placeholder="mm:ss"
            className="w-20 px-2 py-1 text-xs bg-white border border-stone-200 rounded text-center"
          />
        );
      default:
        return (
          <div className="flex items-center gap-1">
            <input
              type={column.type === 'number' ? 'number' : 'text'}
              value={stringValue}
              onChange={(e) => onUpdateData(column.key, column.type === 'number' ? Number(e.target.value) : e.target.value)}
              className="w-20 px-2 py-1 text-xs bg-white border border-stone-200 rounded text-center"
            />
            {column.unit && <span className="text-[10px] text-stone-400">{column.unit}</span>}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      {columns.length > 0 && (
        <div className="space-y-2">
          {columns.map((column) => (
            <div key={column.key} className="flex items-center justify-between p-2 bg-white/50 rounded-lg">
              <span className="text-xs text-stone-600">{column.label}</span>
              <div className="flex items-center gap-2">
                {renderInput(column)}
                {!isCompleted && (
                  <button
                    onClick={() => onRemoveColumn(column.key)}
                    className="p-1 text-stone-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isCompleted && !showAddColumn && (
        <button
          onClick={() => setShowAddColumn(true)}
          className="w-full py-2 flex items-center justify-center gap-2 border border-dashed border-stone-300 rounded-lg text-xs text-stone-500 hover:bg-stone-50 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add tracking column
        </button>
      )}

      {!isCompleted && showAddColumn && (
        <div className="p-3 bg-white/80 rounded-lg border border-stone-200 space-y-2">
          <input
            type="text"
            value={newColumnLabel}
            onChange={(e) => setNewColumnLabel(e.target.value)}
            placeholder="Column name (e.g., Temperature)"
            className="w-full px-2 py-1.5 text-xs bg-white border border-stone-200 rounded"
          />
          <div className="flex gap-2">
            <select
              value={newColumnType}
              onChange={(e) => setNewColumnType(e.target.value as DataColumn['type'])}
              className="flex-1 px-2 py-1.5 text-xs bg-white border border-stone-200 rounded"
            >
              <option value="number">Number</option>
              <option value="time">Time (mm:ss)</option>
              <option value="rating">Rating (1-5)</option>
              <option value="text">Text</option>
            </select>
            <input
              type="text"
              value={newColumnUnit}
              onChange={(e) => setNewColumnUnit(e.target.value)}
              placeholder="Unit"
              className="w-16 px-2 py-1.5 text-xs bg-white border border-stone-200 rounded"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddColumn} className="flex-1 py-1.5 text-xs bg-amber-500 text-white rounded">
              Add
            </button>
            <button onClick={() => setShowAddColumn(false)} className="flex-1 py-1.5 text-xs bg-stone-200 text-stone-600 rounded">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENT: Progress Charts Section
// ============================================================

function ProgressChartsSection({
  sessions,
  metricTotals,
}: {
  sessions: SessionData[];
  metricTotals: { name: string; total: number; count: number; max: number; unit: string; type: string; values: number[] }[];
}) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const chartData = useMemo(() => {
    const completed = sessions
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    
    if (!selectedMetric) return [];
    
    return completed.map((session, index) => {
      const metric = session.tracked_data?.metrics?.find(
        m => m.name.toLowerCase() === selectedMetric.toLowerCase()
      );
      
      let columnValue = 0;
      if (session.tracked_data?.columnData) {
        const entry = Object.entries(session.tracked_data.columnData).find(([key]) => {
          return key.toLowerCase() === selectedMetric.toLowerCase() ||
                 key.toLowerCase().replace(/_/g, ' ') === selectedMetric.toLowerCase();
        });
        if (entry && typeof entry[1] === 'number') {
          columnValue = entry[1];
        }
      }
      
      return {
        name: `S${index + 1}`,
        date: formatDate(session.scheduled_date),
        value: metric?.value ?? columnValue ?? 0,
        hasData: !!metric || columnValue > 0,
      };
    });
  }, [sessions, selectedMetric]);

  useEffect(() => {
    if (!selectedMetric && metricTotals.length > 0) {
      setSelectedMetric(metricTotals[0].name);
    }
  }, [metricTotals, selectedMetric]);

  if (metricTotals.length === 0) {
    return (
      <div className="text-center py-4">
        <TrendingUp className="w-8 h-8 text-stone-300 mx-auto mb-2" />
        <p className="text-xs text-stone-400">Track metrics to see charts</p>
      </div>
    );
  }

  const selectedMetricData = metricTotals.find(m => m.name === selectedMetric);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {metricTotals.map((metric) => (
          <button
            key={metric.name}
            onClick={() => setSelectedMetric(metric.name)}
            className={`px-2 py-1 text-[10px] rounded-full whitespace-nowrap transition-colors ${
              selectedMetric === metric.name
                ? 'bg-amber-500 text-white'
                : 'bg-stone-200 text-stone-600'
            }`}
          >
            {getMetricIcon(metric.type)} {metric.name}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-1">
        <button
          onClick={() => setChartType('line')}
          className={`p-1.5 rounded ${chartType === 'line' ? 'bg-stone-200' : ''}`}
        >
          <TrendingUp className="w-3 h-3 text-stone-600" />
        </button>
        <button
          onClick={() => setChartType('bar')}
          className={`p-1.5 rounded ${chartType === 'bar' ? 'bg-stone-200' : ''}`}
        >
          <BarChart3 className="w-3 h-3 text-stone-600" />
        </button>
      </div>

      {chartData.length > 0 ? (
        <div className="h-40 w-full" style={{ minHeight: '160px', minWidth: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#a8a29e" />
                <YAxis tick={{ fontSize: 10 }} stroke="#a8a29e" />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value) => [`${value} ${selectedMetricData?.unit || ''}`, selectedMetric]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#a8a29e" />
                <YAxis tick={{ fontSize: 10 }} stroke="#a8a29e" />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value) => [`${value} ${selectedMetricData?.unit || ''}`, selectedMetric]}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-stone-400 text-center py-4">
          No data yet for {selectedMetric}
        </p>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENT: Share to Feed Modal
// ============================================================

function ShareToFeedModal({
  isOpen,
  onClose,
  book,
  stats,
  sessions,
  userId,
  onShared,
}: {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  stats: {
    completed: number;
    total: number;
    progress: number;
    streak: number;
    metricTotals: { name: string; total: number; max: number; unit: string; type: string }[];
  };
  sessions: SessionData[];
  userId: string;
  onShared: () => void;
}) {
  const [caption, setCaption] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const allMedia = useMemo(() => {
    return sessions
      .filter(s => s.status === 'completed' && s.tracked_data?.media?.length)
      .flatMap(s => s.tracked_data!.media!)
      .filter(m => m.type === 'photo');
  }, [sessions]);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const mediaUrls = allMedia.map(m => m.url);
      
      const response = await fetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          goal_id: book.id,
          goal_name: book.name,
          goal_emoji: book.emoji,
          caption,
          photo_url: allMedia[selectedPhotoIndex]?.url || mediaUrls[0] || null,
          media_urls: mediaUrls,
          total_sessions: stats.total,
          progress_percent: 100,
          streak_days: stats.streak,
          is_public: true,
        }),
      });

      if (response.ok) {
        onShared();
        onClose();
      }
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              <span className="font-bold">Share Your Achievement</span>
            </div>
            <button onClick={onClose} className="p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
            <span className="text-4xl mb-2 block">{book.emoji}</span>
            <h3 className="font-bold text-stone-800">{book.name}</h3>
            <p className="text-xs text-amber-700 mt-1">✦ MASTERED ✦</p>
          </div>

          {allMedia.length > 0 && (
            <div>
              <p className="text-xs text-stone-500 mb-2">Cover photo</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allMedia.slice(0, 6).map((media, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPhotoIndex(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 ${
                      selectedPhotoIndex === i ? 'ring-2 ring-amber-500' : ''
                    }`}
                  >
                    <img src={media.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-stone-100 rounded-lg">
              <p className="text-lg font-bold text-stone-800">{stats.total}</p>
              <p className="text-[10px] text-stone-500">Sessions</p>
            </div>
            <div className="p-2 bg-stone-100 rounded-lg">
              <p className="text-lg font-bold text-stone-800">{stats.streak}</p>
              <p className="text-[10px] text-stone-500">Day Streak</p>
            </div>
            <div className="p-2 bg-stone-100 rounded-lg">
              <p className="text-lg font-bold text-emerald-600">100%</p>
              <p className="text-[10px] text-stone-500">Complete</p>
            </div>
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Share your journey..."
            className="w-full p-3 text-sm border border-stone-200 rounded-lg resize-none h-20"
          />

          <button
            onClick={handleShare}
            disabled={isSharing}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSharing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share to Feed
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function BookDiaryPage({ book, initialSession, userId, onClose }: BookDiaryPageProps) {
  const queryClient = useQueryClient();
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Page state
  const [currentPage, setCurrentPage] = useState(0);
  const [isPageTurning, setIsPageTurning] = useState(false);
  const [turnDirection, setTurnDirection] = useState<'next' | 'prev'>('next');
  
  // Timer state
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [durationMins, setDurationMins] = useState(30);
  
  // Tracked data state
  const [trackedMetrics, setTrackedMetrics] = useState<ExtractedMetric[]>([]);
  const [trackedNotes, setTrackedNotes] = useState<string[]>([]);
  const [trackedMedia, setTrackedMedia] = useState<MediaItem[]>([]);
  const [trackedColumnData, setTrackedColumnData] = useState<Record<string, number | string>>({});
  const [dataColumns, setDataColumns] = useState<DataColumn[]>(book.plan?.dataColumns || []);
  
  // UI state
  const [chatInput, setChatInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showDataColumns, setShowDataColumns] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [wantsToGetAhead, setWantsToGetAhead] = useState(false);
  
  // Settings state
  const [resourceLink, setResourceLink] = useState(book.resource_link || '');
  const [resourceLabel, setResourceLabel] = useState(book.resource_link_label || '');
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [reassurance] = useState(() => 
    REASSURANCE_MESSAGES[Math.floor(Math.random() * REASSURANCE_MESSAGES.length)]
  );

  // Fetch sessions
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['goal-sessions', book.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/schedule/goal/${book.id}/sessions?user_id=${userId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.sessions || []) as SessionData[];
    },
  });

  // Sort sessions
  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );
  }, [sessions]);

  // Session status logic
  const sessionStatus = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const incompleteSessions = sortedSessions.filter(s => s.status !== 'completed');
    
    const missedSessions = incompleteSessions.filter(s => {
      const sessionDate = new Date(s.scheduled_date);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate < today;
    });
    
    const todaySessions = incompleteSessions.filter(s => {
      const sessionDate = new Date(s.scheduled_date);
      return sessionDate.toDateString() === today.toDateString();
    });
    
    const futureSessions = incompleteSessions.filter(s => {
      const sessionDate = new Date(s.scheduled_date);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate > today;
    });
    
    const isBehind = missedSessions.length > 0;
    const hasSessionToday = todaySessions.length > 0;
    const isCaughtUp = !isBehind && !hasSessionToday;
    const canGetAhead = isCaughtUp && futureSessions.length > 0;
    
    let prioritySession: SessionData | null = null;
    let priorityType: 'catch-up' | 'today' | 'get-ahead' | 'all-done' = 'all-done';
    
    if (missedSessions.length > 0) {
      prioritySession = missedSessions[0];
      priorityType = 'catch-up';
    } else if (todaySessions.length > 0) {
      prioritySession = todaySessions[0];
      priorityType = 'today';
    } else if (futureSessions.length > 0) {
      prioritySession = futureSessions[0];
      priorityType = 'get-ahead';
    }
    
    return {
      isBehind,
      hasSessionToday,
      isCaughtUp,
      canGetAhead,
      missedCount: missedSessions.length,
      todayCount: todaySessions.length,
      futureCount: futureSessions.length,
      prioritySession,
      priorityType,
      nextFutureSession: futureSessions[0],
    };
  }, [sortedSessions]);

  // Default page index
  const defaultPageIndex = useMemo(() => {
    if (sessionStatus.prioritySession) {
      const idx = sortedSessions.findIndex(s => s.id === sessionStatus.prioritySession!.id);
      if (idx >= 0) return idx;
    }
    return Math.max(0, sortedSessions.length - 1);
  }, [sortedSessions, sessionStatus.prioritySession]);

  // Set initial page
  useEffect(() => {
    if (sortedSessions.length === 0) return;
    
    if (initialSession) {
      const idx = sortedSessions.findIndex((s) => s.id === initialSession.id);
      if (idx >= 0) {
        setCurrentPage(idx);
        return;
      }
    }
    
    setCurrentPage(defaultPageIndex);
  }, [initialSession, sortedSessions, defaultPageIndex]);

  const currentSession = sortedSessions[currentPage];

  // Update form state when session changes
  useEffect(() => {
    if (currentSession) {
      setDurationMins(currentSession.duration_mins || 30);
      setTrackedMetrics(currentSession.tracked_data?.metrics || []);
      setTrackedNotes(currentSession.tracked_data?.notes || []);
      setTrackedMedia(currentSession.tracked_data?.media || []);
      setTrackedColumnData(currentSession.tracked_data?.columnData || {});
      setStopwatchSeconds(0);
      setIsRunning(false);
      setWantsToGetAhead(false);
    }
  }, [currentSession?.id]);

  // Calculate stats
  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed');
    const progress = sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const hasCompletion = completed.some((s) => {
        const sDate = (s.completed_at || s.scheduled_date).split('T')[0];
        return sDate === dateStr;
      });
      
      if (hasCompletion) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    const remaining = sessions.length - completed.length;
    const avgPerWeek = completed.length > 0 
      ? Math.max(1, completed.length / Math.max(1, Math.ceil((Date.now() - new Date(completed[0]?.scheduled_date || Date.now()).getTime()) / (7 * 24 * 60 * 60 * 1000)))) 
      : 3;
    const weeksRemaining = Math.ceil(remaining / avgPerWeek);
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + (weeksRemaining * 7));

    const metricTotals = new Map<string, { total: number; count: number; max: number; unit: string; type: string; values: number[] }>();
    completed.forEach((s) => {
      if (s.tracked_data?.metrics) {
        s.tracked_data.metrics.forEach((m) => {
          const key = m.name.toLowerCase();
          if (!metricTotals.has(key)) {
            metricTotals.set(key, { total: 0, count: 0, max: 0, unit: m.unit, type: m.type, values: [] });
          }
          const stat = metricTotals.get(key)!;
          stat.total += m.value;
          stat.count++;
          stat.max = Math.max(stat.max, m.value);
          stat.values.push(m.value);
        });
      }
      
      if (s.tracked_data?.columnData) {
        Object.entries(s.tracked_data.columnData).forEach(([key, value]) => {
          if (typeof value === 'number' && value > 0) {
            const columnDef = dataColumns.find(c => c.key === key);
            const displayName = columnDef?.label || key;
            const unit = columnDef?.unit || '';
            const type = columnDef?.type || 'number';
            
            const mapKey = displayName.toLowerCase();
            if (!metricTotals.has(mapKey)) {
              metricTotals.set(mapKey, { total: 0, count: 0, max: 0, unit, type, values: [] });
            }
            const stat = metricTotals.get(mapKey)!;
            stat.total += value;
            stat.count++;
            stat.max = Math.max(stat.max, value);
            stat.values.push(value);
          }
        });
      }
    });

    const allNotes = completed
      .filter((s) => s.tracked_data?.notes?.length)
      .flatMap((s) =>
        s.tracked_data!.notes.map((note) => ({
          note,
          date: s.completed_at || s.scheduled_date,
          sessionName: s.name,
        }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return {
      completed: completed.length,
      total: sessions.length,
      progress,
      streak,
      estimatedCompletion,
      weeksRemaining,
      metricTotals: Array.from(metricTotals.entries()).map(([name, data]) => ({
        name,
        ...data,
      })),
      allNotes,
    };
  }, [sessions, dataColumns]);

  // Session helpers
  const sessionDay = useMemo(() => {
    if (!currentSession) return null;
    const d = new Date(currentSession.scheduled_date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentSession?.scheduled_date]);

  const todayDay = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const isCompleted = currentSession?.status === 'completed';
  const isToday = currentSession ? new Date(currentSession.scheduled_date).toDateString() === new Date().toDateString() : false;
  const isFuture = !!sessionDay && sessionDay > todayDay;
  const isMissed = !!sessionDay && currentSession?.status !== 'completed' && sessionDay < todayDay;
  
  const daysUntilSession = useMemo(() => {
    if (!sessionDay || !isFuture) return 0;
    return Math.ceil((sessionDay.getTime() - todayDay.getTime()) / (1000 * 60 * 60 * 24));
  }, [sessionDay, todayDay, isFuture]);
  
  const isManualGoal = useMemo(() => {
    if (book.source === 'manual') return true;
    if (book.source === 'ai' || book.source === 'catalogue') return false;
    if (currentSession) return isManualSession(currentSession.name);
    return false;
  }, [book.source, currentSession]);
  
  const isBookComplete = stats.progress >= 100;
  const isShareable = book.source === 'catalogue';
  const showActiveSessionUI = !isCompleted && (!isFuture || wantsToGetAhead);

  // AI Prompt
  const prompt = currentSession ? `I'm on Session ${currentPage + 1} of ${sortedSessions.length} for my goal "${book.name}".

Today I have ${durationMins} minutes.

This is part of a longer plan, so I want to make progress without overreaching.

Please:
1. Break this session into clear steps
2. Tell me what "good progress" looks like
3. Tell me when to stop` : '';

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setStopwatchSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Navigation
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (isPageTurning) return;
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = currentPage + delta;
    if (nextIndex < 0 || nextIndex >= sortedSessions.length) return;
    setTurnDirection(direction);
    setIsPageTurning(true);
    setTimeout(() => { setCurrentPage(nextIndex); }, 350);
    setTimeout(() => { setIsPageTurning(false); }, 600);
  };

  // Extract tracking data
  const handleSendChat = async () => {
    if (!chatInput.trim() || isExtracting) return;
    setIsExtracting(true);
    try {
      const response = await fetch(`${API_BASE}/api/schedule/tracking/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatInput, goal_name: book.name, category: book.category }),
      });
      if (response.ok) {
        const extracted: ExtractedData = await response.json();
        if (extracted.metrics?.length) {
          setTrackedMetrics(prev => {
            const newMetrics = [...prev];
            extracted.metrics.forEach(m => {
              const existingIdx = newMetrics.findIndex(e => e.name.toLowerCase() === m.name.toLowerCase());
              if (existingIdx >= 0) { newMetrics[existingIdx] = m; } else { newMetrics.push(m); }
            });
            return newMetrics;
          });
        }
        if (extracted.notes?.length) { setTrackedNotes(prev => [...prev, ...extracted.notes]); }
        setChatInput('');
      }
    } catch (error) {
      console.error('Failed to extract:', error);
      setTrackedNotes(prev => [...prev, chatInput]);
      setChatInput('');
    } finally { setIsExtracting(false); }
  };

  const removeMetric = (index: number) => { setTrackedMetrics(prev => prev.filter((_, i) => i !== index)); };
  const removeNote = (index: number) => { setTrackedNotes(prev => prev.filter((_, i) => i !== index)); };
  const handleAddMedia = (item: MediaItem) => { setTrackedMedia(prev => [...prev, item]); };
  const handleRemoveMedia = (index: number) => { setTrackedMedia(prev => prev.filter((_, i) => i !== index)); };
  const handleUpdateColumnData = (key: string, value: number | string) => { setTrackedColumnData(prev => ({ ...prev, [key]: value })); };
  const handleAddColumn = (column: DataColumn) => { setDataColumns(prev => [...prev, column]); };
  const handleRemoveColumn = (key: string) => {
    setDataColumns(prev => prev.filter(c => c.key !== key));
    setTrackedColumnData(prev => { const newData = { ...prev }; delete newData[key]; return newData; });
  };

  // Complete session mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!currentSession) throw new Error('No session');
      const isEarlyCompletion = isFuture && wantsToGetAhead;
      const metricsToSave = [...trackedMetrics];
      const hasDurationMetric = metricsToSave.some(
        m => m.name.toLowerCase().includes('duration') || m.name.toLowerCase().includes('time')
      );
      if (!hasDurationMetric && durationMins > 0) {
        metricsToSave.push({ name: 'Session Duration', value: durationMins, unit: 'mins', type: 'duration' });
      }
      const payload = {
        duration_seconds: durationMins * 60,
        diary_notes: trackedNotes.join('\n'),
        tracked_data: { metrics: metricsToSave, notes: trackedNotes, media: trackedMedia, columnData: trackedColumnData },
      };
      console.log('📝 Completing session with payload:', JSON.stringify(payload, null, 2));
      const response = await fetch(`${API_BASE}/api/schedule/${currentSession.id}/complete-session`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to complete session');
      const result = await response.json();
      if (isEarlyCompletion) {
        try {
          await fetch(`${API_BASE}/api/schedule/reshuffle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, goal_id: book.id, completed_session_id: currentSession.id }),
          });
        } catch (reshuffleError) { console.warn('Reshuffle failed:', reshuffleError); }
      }
      return result;
    },
    onSuccess: () => {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['goal-sessions', book.id] });
      queryClient.invalidateQueries({ queryKey: ['today-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['library-goals'] });
      refetch();
      setWantsToGetAhead(false);
      const newProgress = ((stats.completed + 1) / stats.total) * 100;
      if (newProgress >= 100 && book.source === 'catalogue') {
        setTimeout(() => setShowShareModal(true), 3500);
      }
    },
  });

  // Delete goal mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/goals/${book.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!response.ok) throw new Error('Failed to delete goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-goals'] });
      queryClient.invalidateQueries({ queryKey: ['library-session-stats'] });
      queryClient.invalidateQueries({ queryKey: ['library-today'] });
      queryClient.invalidateQueries({ queryKey: ['library-week-schedule'] });
      onClose();
    },
    onError: () => {
      alert('Failed to delete. Please try again.');
    },
  });

  // Save resource link
  const handleSaveLink = async () => {
    setIsSavingLink(true);
    try {
      await fetch(`${API_BASE}/api/goals/${book.id}/resource-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, resource_link: resourceLink, resource_link_label: resourceLabel }),
      });
    } catch (error) { console.error('Failed to save:', error); }
    finally { setIsSavingLink(false); }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <div className="relative text-center">
          <BookOpen className="w-12 h-12 text-amber-200 animate-pulse mx-auto mb-4" />
          <p className="text-amber-100 font-serif">Opening your journal...</p>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <div className="relative text-center">
          <BookOpen className="w-16 h-16 text-amber-200 mb-4 mx-auto" />
          <p className="text-amber-100 font-serif mb-4">No pages found in this journal</p>
          <button onClick={onClose} className="text-amber-300 font-serif hover:text-amber-200">Return to library</button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="fixed inset-0 z-50">
      <CompletionConfetti show={showConfetti} />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Delete Goal?</h3>
                  <p className="text-sm opacity-90">This cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center p-4 bg-red-50 rounded-xl border border-red-200">
                <span className="text-3xl mb-2 block">{book.emoji}</span>
                <h3 className="font-bold text-stone-800">{book.name}</h3>
                <p className="text-xs text-stone-500 mt-1">{stats.completed} of {stats.total} sessions completed</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-800">You will permanently lose:</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>All <strong>{stats.total} scheduled sessions</strong></span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>All <strong>diary notes and tracked metrics</strong></span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>All <strong>photos and videos</strong> uploaded</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>Your <strong>{stats.streak > 0 ? `${stats.streak}-day streak` : 'progress history'}</strong></span>
                  </div>
                  {stats.completed > 0 && (
                    <div className="flex items-start gap-2 text-sm text-stone-700">
                      <span className="text-red-500 mt-0.5">✕</span>
                      <span>Your <strong>{stats.completed} completed session{stats.completed > 1 ? 's' : ''}</strong> of work</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">
                  Type <strong className="text-red-600">DELETE</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-3 py-2.5 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-red-400 transition-colors"
                  autoFocus
                />
              </div>
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteConfirmText !== 'DELETE' || deleteMutation.isPending}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                  {deleteMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" />Permanently Delete Goal</>
                  )}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                  disabled={deleteMutation.isPending}
                  className="w-full py-2.5 text-stone-600 hover:text-stone-800 font-medium text-sm transition-colors"
                >
                  Cancel — keep my progress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <ShareToFeedModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        book={book}
        stats={stats}
        sessions={sortedSessions}
        userId={userId}
        onShared={() => { queryClient.invalidateQueries({ queryKey: ['feed'] }); }}
      />
      
      {/* Mountain Background */}
      <div className="absolute inset-0"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
      
      <button onClick={onClose}
        className="absolute right-4 z-50 p-2 bg-black/30 hover:bg-black/50 rounded-full backdrop-blur-sm transition-colors"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}>
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Book Container */}
      <div className="relative h-full flex items-center justify-center p-4 sm:p-8"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="w-full max-w-2xl h-full max-h-[800px] flex rounded-lg overflow-hidden"
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0,0,0,0.3)' }}>
          
          {/* Left Page - Info/Stats */}
          <div className="hidden sm:flex w-1/3 flex-col relative"
            style={{ background: 'linear-gradient(135deg, #f5f0e6 0%, #ebe5d9 50%, #e0d9cb 100%)', borderRight: '1px solid rgba(139, 115, 85, 0.2)' }}>
            <div className="absolute inset-0 opacity-40 pointer-events-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
            <div className="absolute top-0 bottom-0 right-0 w-6 pointer-events-none"
              style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.1) 0%, transparent 100%)' }} />
            <div className="relative p-4 flex-1 overflow-y-auto">
              <div className="text-center mb-4 pb-3 border-b border-stone-300/50">
                <span className="text-3xl mb-1 block">{book.emoji}</span>
                <h2 className="font-serif font-bold text-stone-700 text-sm leading-tight">{book.name}</h2>
              </div>
              {sessionStatus.isBehind && (
                <div className="mb-3 p-2 bg-amber-100 border border-amber-300 rounded-lg">
                  <p className="text-[10px] font-medium text-amber-800 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {sessionStatus.missedCount} session{sessionStatus.missedCount > 1 ? 's' : ''} to catch up
                  </p>
                </div>
              )}
              {sessionStatus.canGetAhead && (
                <div className="mb-3 p-2 bg-emerald-100 border border-emerald-300 rounded-lg">
                  <p className="text-[10px] font-medium text-emerald-800 flex items-center gap-1">
                    <Rocket className="w-3 h-3" />All caught up! Get ahead?
                  </p>
                </div>
              )}
              {isBookComplete && (
                <div className="mb-3 p-2 bg-gradient-to-br from-amber-100 to-yellow-100 border border-amber-300 rounded-lg">
                  <p className="text-[10px] font-medium text-amber-800 flex items-center gap-1 mb-2">
                    <Trophy className="w-3 h-3" />Book Complete! 🎉
                  </p>
                  {isShareable && (
                    <button onClick={() => setShowShareModal(true)}
                      className="w-full py-1.5 text-[10px] bg-amber-500 text-white rounded flex items-center justify-center gap-1">
                      <Share2 className="w-3 h-3" />Share to Feed
                    </button>
                  )}
                </div>
              )}
              <div className="mb-4">
                <div className="flex justify-between text-[10px] text-stone-500 mb-1">
                  <span>Progress</span><span>{Math.round(stats.progress)}%</span>
                </div>
                <div className="h-1.5 bg-stone-300/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all" style={{ width: `${stats.progress}%` }} />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">{stats.completed} of {stats.total} pages</p>
              </div>
              <div className="flex items-center justify-between mb-4 text-xs">
                {stats.streak > 0 && (
                  <div className="flex items-center gap-1 text-orange-600">
                    <Flame className="w-3 h-3" /><span className="font-medium">{stats.streak} day streak</span>
                  </div>
                )}
                {book.daysBehind > 0 && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="w-3 h-3" /><span>{book.daysBehind} behind</span>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <p className="text-[9px] text-stone-400 uppercase tracking-wider mb-2 text-center">Schedule</p>
                <ScheduleDots sessions={sortedSessions} />
              </div>
              <div className="text-center text-[10px] text-stone-500 mb-4">
                <Calendar className="w-3 h-3 inline mr-1" />
                Est. finish: {stats.estimatedCompletion.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </div>
              {stats.metricTotals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] text-stone-400 uppercase tracking-wider">Totals</p>
                  {stats.metricTotals.slice(0, 3).map((stat, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-stone-500">{stat.name}</span>
                      <span className="font-medium text-stone-700">
                        {stat.type === 'money' ? '£' : ''}{stat.type === 'weight' ? stat.max : stat.total}{stat.unit && stat.type !== 'money' ? ` ${stat.unit}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="absolute top-0 left-6 w-4 h-20"
              style={{ background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%)', boxShadow: '2px 2px 4px rgba(0,0,0,0.2)' }} />
          </div>

          {/* Center Binding */}
          <div className="w-3 sm:w-4 flex-shrink-0 relative"
            style={{ background: 'linear-gradient(to right, #8b7355 0%, #a08060 20%, #c9b896 50%, #a08060 80%, #8b7355 100%)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)' }}>
            <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-around items-center py-8">
              {[...Array(8)].map((_, i) => (<div key={i} className="w-1 h-1 rounded-full bg-amber-900/40" />))}
            </div>
          </div>

          {/* Right Page - Main Content */}
          <div className="flex-1 flex flex-col relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #faf6ee 0%, #f5f0e6 50%, #ebe5d9 100%)', perspective: '2000px', transformStyle: 'preserve-3d' }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes pageTurnNext { 0% { transform: rotateY(0deg); opacity: 1; } 45% { transform: rotateY(-110deg); opacity: 0.9; } 100% { transform: rotateY(-180deg); opacity: 0; } }
              @keyframes pageTurnPrev { 0% { transform: rotateY(0deg); opacity: 1; } 45% { transform: rotateY(110deg); opacity: 0.9; } 100% { transform: rotateY(180deg); opacity: 0; } }
              .animate-pageTurnNext { animation: pageTurnNext 600ms ease-in-out forwards; }
              .animate-pageTurnPrev { animation: pageTurnPrev 600ms ease-in-out forwards; }
              @keyframes contentSlideIn { 0% { opacity: 0.5; transform: translateX(10px); } 100% { opacity: 1; transform: translateX(0); } }
              .content-slide-in { animation: contentSlideIn 0.4s ease-out; }
            `}} />
            <div className={`absolute inset-0 z-50 pointer-events-none will-change-transform ${isPageTurning ? 'opacity-100' : 'opacity-0'} ${isPageTurning ? (turnDirection === 'next' ? 'animate-pageTurnNext' : 'animate-pageTurnPrev') : ''}`}
              style={{ background: 'linear-gradient(135deg, #faf6ee 0%, #f5f0e6 50%, #ebe5d9 100%)', transformOrigin: turnDirection === 'next' ? 'left center' : 'right center', backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}>
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
              <div className="absolute top-0 bottom-0 w-10" style={{ left: turnDirection === 'next' ? 0 : undefined, right: turnDirection === 'prev' ? 0 : undefined, background: turnDirection === 'next' ? 'linear-gradient(to right, rgba(0,0,0,0.18), transparent)' : 'linear-gradient(to left, rgba(0,0,0,0.18), transparent)' }} />
            </div>
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #5c4a38 28px)', backgroundSize: '100% 28px', marginTop: '60px' }} />
            <div className="absolute top-14 bottom-0 left-10 w-[1px] pointer-events-none opacity-20 hidden sm:block" style={{ background: '#c4646a' }} />
            <div className="absolute top-0 bottom-0 left-0 w-8 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 100%)' }} />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-stone-300/30">
              <button onClick={() => handleNavigate('prev')} disabled={currentPage === 0 || isPageTurning}
                className="p-1.5 rounded-lg hover:bg-stone-200/50 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4 text-stone-500" />
              </button>
              <div className="text-center">
                <p className="text-xs font-serif text-stone-600">Page {currentPage + 1} of {sortedSessions.length}</p>
                <p className="text-[10px] text-stone-400">{formatDate(currentSession.scheduled_date)}</p>
              </div>
              <button onClick={() => handleNavigate('next')} disabled={currentPage === sortedSessions.length - 1 || isPageTurning}
                className="p-1.5 rounded-lg hover:bg-stone-200/50 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4 text-stone-500" />
              </button>
            </div>

            {currentPage !== defaultPageIndex && sessionStatus.prioritySession && (
              <div className="relative z-10 text-center py-1">
                <button onClick={() => setCurrentPage(defaultPageIndex)} className="text-[10px] text-amber-700 hover:text-amber-800 underline">
                  ↩ Jump to {sessionStatus.priorityType === 'catch-up' ? 'catch-up' : sessionStatus.priorityType === 'get-ahead' ? 'next session' : 'today'}
                </button>
              </div>
            )}

            {/* Main Content Area */}
            <div className={`relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-4 ${!isPageTurning ? 'content-slide-in' : ''}`}>
              <div className="space-y-4" key={currentPage}>
                
                {/* Mobile Title */}
                <div className="sm:hidden text-center mb-2">
                  <span className="text-2xl">{book.emoji}</span>
                  <h2 className="font-serif font-bold text-stone-700 text-sm">{book.name}</h2>
                  <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-stone-500">
                    <span>{stats.completed}/{stats.total} pages</span>
                    {stats.streak > 0 && (<span className="flex items-center gap-0.5 text-orange-600"><Flame className="w-2.5 h-2.5" />{stats.streak}</span>)}
                  </div>
                </div>

                {/* Session Card */}
                <div className={`rounded-lg p-3 border ${isCompleted ? 'bg-emerald-50/80 border-emerald-200' : isMissed ? 'bg-orange-50/80 border-orange-200' : isToday ? 'bg-amber-50/80 border-amber-200' : isFuture && wantsToGetAhead ? 'bg-blue-50/80 border-blue-200' : isFuture ? 'bg-stone-100/80 border-stone-200' : 'bg-amber-50/80 border-amber-200'}`}>
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isMissed ? 'bg-orange-100 text-orange-700' : isToday ? 'bg-amber-100 text-amber-700' : isFuture && wantsToGetAhead ? 'bg-blue-100 text-blue-700' : isFuture ? 'bg-stone-200 text-stone-600' : 'bg-amber-100 text-amber-700'}`}>
                      {isCompleted ? '✓ Completed' : isMissed ? '⏰ Catch up' : isToday ? "Today's Session" : isFuture && wantsToGetAhead ? '🚀 Getting Ahead' : isFuture ? '🔒 Upcoming' : "Today's Session"}
                    </span>
                    {currentSession.scheduled_time && (<span className="text-[10px] text-stone-400">{currentSession.scheduled_time}</span>)}
                  </div>
                  {isManualGoal ? (
                    <h3 className="font-serif font-semibold text-stone-800 text-sm">Session {currentPage + 1}</h3>
                  ) : (
                    <>
                      <h3 className="font-serif font-semibold text-stone-800 text-sm">{currentSession.name}</h3>
                      {currentSession.description && (<p className="text-xs text-stone-600 mt-1 italic">"{currentSession.description}"</p>)}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Duration: {currentSession.duration_mins || 30} {currentSession.duration_mins === 1 ? 'minute' : 'minutes'}</span>
                </div>

                {/* Media Section */}
                <button onClick={() => setShowMedia(!showMedia)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                  <span className="flex items-center gap-2 text-xs text-stone-700">
                    <Camera className="w-4 h-4 text-blue-600" />Photos & Videos
                    {trackedMedia.length > 0 && (<span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{trackedMedia.length}</span>)}
                  </span>
                  {showMedia ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </button>
                {showMedia && (
                  <div className="p-3 bg-stone-100/80 rounded-lg">
                    <MediaUploadSection media={trackedMedia} onAddMedia={handleAddMedia} onRemoveMedia={handleRemoveMedia} isCompleted={isCompleted} userId={userId} goalId={book.id} />
                  </div>
                )}

                {/* Completed Session Details */}
                {isCompleted && (
                  <>
                    {currentSession.actual_duration_seconds && (<p className="text-xs text-stone-500"><Clock className="w-3 h-3 inline mr-1" />Actual duration: {formatDuration(currentSession.actual_duration_seconds)}</p>)}
                    {currentSession.tracked_data?.metrics && currentSession.tracked_data.metrics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {currentSession.tracked_data.metrics.map((m, i) => (
                          <span key={i} className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{getMetricIcon(m.type)} {m.name}: {formatMetricValue(m)}</span>
                        ))}
                      </div>
                    )}
                    {currentSession.tracked_data?.notes?.map((note, i) => (<p key={i} className="text-xs text-stone-600 italic">📝 {note}</p>))}
                  </>
                )}

                {/* Future Session - Get Ahead Option */}
                {isFuture && !wantsToGetAhead && (
                  <div className="text-center py-4 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-full">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      <span className="text-xs text-stone-600">Scheduled in {daysUntilSession} day{daysUntilSession > 1 ? 's' : ''}</span>
                    </div>
                    {sessionStatus.canGetAhead && currentSession.id === sessionStatus.nextFutureSession?.id ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Rocket className="w-5 h-5 text-blue-600" /><span className="font-semibold text-blue-800">Want to get ahead?</span>
                          </div>
                          <p className="text-xs text-blue-700 mb-3">Complete this session early. Your next session will move to tomorrow!</p>
                          <button onClick={() => setWantsToGetAhead(true)}
                            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-md flex items-center justify-center gap-2 transition-all">
                            <Zap className="w-4 h-4" />Do This Session Now
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-400">Schedule shifts forward after completion</p>
                      </div>
                    ) : sessionStatus.isBehind ? (
                      <div className="py-2">
                        <Lock className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                        <p className="text-xs text-stone-400 italic">Complete your catch-up sessions first</p>
                        <button onClick={() => setCurrentPage(defaultPageIndex)} className="mt-2 text-[10px] text-amber-700 underline">Go to catch-up session →</button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <Lock className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                        <p className="text-xs text-stone-400 italic">Complete the next session first</p>
                        {sessionStatus.nextFutureSession && (
                          <button onClick={() => { const idx = sortedSessions.findIndex(s => s.id === sessionStatus.nextFutureSession!.id); if (idx >= 0) setCurrentPage(idx); }}
                            className="mt-2 text-[10px] text-blue-700 underline">Go to next session →</button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Active Session Controls */}
                {showActiveSessionUI && (
                  <>
                    {isFuture && wantsToGetAhead && (
                      <div className="p-2 bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-between">
                        <span className="text-xs text-blue-800 flex items-center gap-1"><Rocket className="w-3.5 h-3.5" />Getting ahead by {daysUntilSession} day{daysUntilSession > 1 ? 's' : ''}!</span>
                        <button onClick={() => setWantsToGetAhead(false)} className="text-[10px] text-blue-600 hover:text-blue-800">Cancel</button>
                      </div>
                    )}
                    {isMissed && sessionStatus.missedCount > 1 && (
                      <div className="p-2 bg-amber-100 border border-amber-200 rounded-lg">
                        <span className="text-xs text-amber-800">{sessionStatus.missedCount - 1} more session{sessionStatus.missedCount - 1 > 1 ? 's' : ''} to catch up after this</span>
                      </div>
                    )}
                    <p className="text-center text-xs text-stone-500 italic">"{reassurance}"</p>

                    {/* AI Guide */}
                    <button onClick={() => setShowPrompt(!showPrompt)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                      <span className="flex items-center gap-2 text-xs text-amber-700"><Sparkles className="w-4 h-4" />{isManualGoal ? '✨ Get AI Session Plan' : 'Get AI session guide'}</span>
                      {showPrompt ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </button>
                    {showPrompt && (
                      <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-100">
                        <pre className="text-[11px] text-stone-600 whitespace-pre-wrap font-sans mb-2">{prompt}</pre>
                        <div className="flex gap-2">
                          <button onClick={handleCopyPrompt} className="flex-1 py-1.5 text-[10px] bg-white border border-amber-200 text-amber-700 rounded-lg flex items-center justify-center gap-1">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied!' : 'Copy'}
                          </button>
                          <button onClick={() => { navigator.clipboard.writeText(prompt); window.open('https://chat.openai.com/', '_blank'); }}
                            className="flex-1 py-1.5 text-[10px] bg-amber-600 text-white rounded-lg flex items-center justify-center gap-1">
                            <ExternalLink className="w-3 h-3" />ChatGPT
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Duration */}
                    <div className="flex items-center justify-between bg-stone-100/80 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-stone-400" />
                        <input type="number" value={durationMins} onChange={(e) => setDurationMins(Math.max(1, Number(e.target.value) || 1))}
                          className="w-12 px-2 py-1 bg-white border border-stone-200 rounded text-center text-sm font-medium" min="1" />
                        <span className="text-xs text-stone-500">mins</span>
                      </div>
                      <div className="flex gap-1">
                        {[15, 30, 45, 60].map((m) => (
                          <button key={m} onClick={() => setDurationMins(m)}
                            className={`px-2 py-1 text-[10px] rounded ${durationMins === m ? 'bg-amber-500 text-white' : 'bg-white text-stone-600'}`}>{m}</button>
                        ))}
                      </div>
                    </div>

                    {/* Data Columns */}
                    <button onClick={() => setShowDataColumns(!showDataColumns)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                      <span className="flex items-center gap-2 text-xs text-stone-700">
                        <Table className="w-4 h-4 text-purple-600" />Data Tracking
                        {Object.keys(trackedColumnData).length > 0 && (<span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{Object.keys(trackedColumnData).length}</span>)}
                      </span>
                      {showDataColumns ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </button>
                    {showDataColumns && (
                      <div className="p-3 bg-stone-100/80 rounded-lg">
                        <DataColumnsSection columns={dataColumns} data={trackedColumnData} onUpdateData={handleUpdateColumnData} onAddColumn={handleAddColumn} onRemoveColumn={handleRemoveColumn} isCompleted={isCompleted} />
                      </div>
                    )}

                    {/* Notes & Quick Log */}
                    <button onClick={() => setShowTracking(!showTracking)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                      <span className="flex items-center gap-2 text-xs text-stone-700">
                        <MessageCircle className="w-4 h-4 text-amber-600" />Notes & Quick Log
                        {(trackedMetrics.length > 0 || trackedNotes.length > 0) && (<span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{trackedMetrics.length + trackedNotes.length}</span>)}
                      </span>
                      {showTracking ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </button>
                    {showTracking && (
                      <div className="p-3 bg-stone-100/80 rounded-lg space-y-2">
                        {(trackedMetrics.length > 0 || trackedNotes.length > 0) && (
                          <div className="flex flex-wrap gap-1.5">
                            {trackedMetrics.map((m, i) => (
                              <span key={`m-${i}`} className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                                {getMetricIcon(m.type)} {m.name}: {formatMetricValue(m)}
                                <button onClick={() => removeMetric(i)} className="opacity-50 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                              </span>
                            ))}
                            {trackedNotes.map((n, i) => (
                              <span key={`n-${i}`} className="flex items-center gap-1 text-[10px] bg-stone-200 text-stone-700 px-2 py-1 rounded-full">
                                📝 {n.slice(0, 20)}{n.length > 20 ? '...' : ''}
                                <button onClick={() => removeNote(i)} className="opacity-50 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input ref={chatInputRef} type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} placeholder="e.g. 'Made £50, benched 60kg, felt great'"
                            className="flex-1 px-3 py-2 text-xs bg-white border border-stone-200 rounded-lg" disabled={isExtracting} />
                          <button onClick={handleSendChat} disabled={!chatInput.trim() || isExtracting} className="p-2 bg-amber-500 text-white rounded-lg disabled:opacity-50">
                            {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[9px] text-stone-400 text-center">AI extracts metrics automatically from your notes</p>
                      </div>
                    )}
                  </>
                )}

                {/* Stats & History */}
                <button onClick={() => setShowStats(!showStats)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                  <span className="flex items-center gap-2 text-xs text-stone-700"><BarChart3 className="w-4 h-4 text-emerald-600" />Stats & History</span>
                  {showStats ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </button>
                {showStats && (
                  <div className="p-3 bg-stone-100/80 rounded-lg space-y-3">
                    {stats.metricTotals.length > 0 && (
                      <div>
                        <p className="text-[9px] text-stone-400 uppercase mb-2">Tracked Metrics</p>
                        <div className="grid grid-cols-2 gap-2">
                          {stats.metricTotals.slice(0, 4).map((stat, i) => (<MetricStatCard key={i} stat={stat} />))}
                        </div>
                      </div>
                    )}
                    {stats.allNotes.length > 0 && (
                      <div>
                        <p className="text-[9px] text-stone-400 uppercase mb-2">Recent Notes</p>
                        {stats.allNotes.slice(0, 3).map((item, i) => (
                          <p key={i} className="text-[10px] text-stone-600 mb-1">📝 {item.note.slice(0, 50)}{item.note.length > 50 ? '...' : ''}</p>
                        ))}
                      </div>
                    )}
                    {stats.metricTotals.length === 0 && stats.allNotes.length === 0 && (
                      <p className="text-xs text-stone-400 text-center py-2">Track metrics to see stats here</p>
                    )}
                  </div>
                )}

                {/* Progress Charts */}
                <button onClick={() => setShowCharts(!showCharts)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                  <span className="flex items-center gap-2 text-xs text-stone-700"><TrendingUp className="w-4 h-4 text-indigo-600" />Progress Charts</span>
                  {showCharts ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </button>
                {showCharts && (
                  <div className="p-3 bg-stone-100/80 rounded-lg">
                    <ProgressChartsSection sessions={sortedSessions} metricTotals={stats.metricTotals} />
                  </div>
                )}

                {/* Settings */}
                <button onClick={() => setShowSettings(!showSettings)} className="w-full p-2.5 flex items-center justify-between bg-stone-100/80 hover:bg-stone-200/80 rounded-lg transition-colors">
                  <span className="flex items-center gap-2 text-xs text-stone-700"><Settings className="w-4 h-4 text-stone-400" />Settings & Links</span>
                  {showSettings ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </button>
                {showSettings && (
                  <div className="p-3 bg-stone-100/80 rounded-lg space-y-3">
                    <div>
                      <p className="text-[9px] text-stone-400 uppercase mb-2">Resource Link</p>
                      <input type="url" value={resourceLink} onChange={(e) => setResourceLink(e.target.value)} placeholder="https://..."
                        className="w-full px-2 py-1.5 text-xs bg-white border border-stone-200 rounded mb-1" />
                      <input type="text" value={resourceLabel} onChange={(e) => setResourceLabel(e.target.value)} placeholder="Label (optional)"
                        className="w-full px-2 py-1.5 text-xs bg-white border border-stone-200 rounded mb-2" />
                      <button onClick={handleSaveLink} disabled={isSavingLink}
                        className="w-full py-1.5 text-[10px] bg-amber-100 text-amber-700 rounded">
                        {isSavingLink ? 'Saving...' : 'Save Link'}
                      </button>
                      {resourceLink && (
                        <a href={resourceLink} target="_blank" rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1 text-[10px] text-amber-700">
                          <LinkIcon className="w-3 h-3" />{resourceLabel || 'Open resource'}
                        </a>
                      )}
                    </div>
                    {/* Danger Zone */}
                    <div className="pt-3 mt-3 border-t border-red-200">
                      <p className="text-[9px] text-red-400 uppercase mb-2 font-medium">Danger Zone</p>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full py-2 text-[11px] bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete this goal
                      </button>
                    </div>
                  </div>
                )}

                {showActiveSessionUI && <div className="h-16" />}
              </div>
            </div>

            {/* Complete Button */}
            {showActiveSessionUI && (
              <div className="relative z-10 p-3 border-t border-stone-200/50 bg-gradient-to-t from-stone-100 to-transparent flex-shrink-0"
                style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                <button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}
                  className={`w-full py-3 font-serif font-bold rounded-lg shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                    isFuture && wantsToGetAhead
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                      : isMissed
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                        : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white'
                  }`}>
                  {completeMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                  ) : isFuture && wantsToGetAhead ? (
                    <><Rocket className="w-4 h-4" />Complete & Get Ahead</>
                  ) : isMissed ? (
                    <><Check className="w-4 h-4" />Complete & Catch Up</>
                  ) : (
                    <><Check className="w-4 h-4" />Complete This Page</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}