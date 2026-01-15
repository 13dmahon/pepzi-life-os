'use client';

import { useState, useRef } from 'react';
import { 
  X, 
  Camera, 
  Image as ImageIcon,
  Flame,
  Target,
  Clock,
  TrendingUp,
  Send,
  Loader2,
  Check,
  Sparkles
} from 'lucide-react';

interface ShareProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (data: { caption: string; photoFile: File | null }) => Promise<void>;
  sessionData: {
    goalName: string;
    goalEmoji: string;
    sessionName: string;
    sessionNumber: number;
    totalSessions: number;
    durationMins: number;
    streak: number;
    progressPercent: number;
    diaryNotes?: string;
  };
}

export default function ShareProgressModal({
  isOpen,
  onClose,
  onShare,
  sessionData,
}: ShareProgressModalProps) {
  const [caption, setCaption] = useState(sessionData.diaryNotes || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await onShare({ caption, photoFile });
      setIsShared(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to share:', error);
      setIsSharing(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={handleSkip}
    >
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success State */}
        {isShared ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Posted! 🎉</h3>
            <p className="text-slate-500">Your progress has been shared to your feed.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-violet-500 to-purple-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Share Your Progress</h2>
                    <p className="text-violet-100 text-sm">Celebrate this win!</p>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Post Preview */}
            <div className="p-4">
              {/* Stats Card Preview */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 mb-4">
                {/* Goal Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                    {sessionData.goalEmoji}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">{sessionData.goalName}</p>
                    <p className="text-sm text-slate-500">{sessionData.sessionName}</p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <div className="bg-white rounded-xl p-2 text-center">
                    <Target className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Session</p>
                    <p className="text-sm font-bold text-slate-700">{sessionData.sessionNumber}/{sessionData.totalSessions}</p>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center">
                    <Clock className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Time</p>
                    <p className="text-sm font-bold text-slate-700">{sessionData.durationMins}m</p>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center">
                    <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Streak</p>
                    <p className="text-sm font-bold text-slate-700">{sessionData.streak} days</p>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center">
                    <TrendingUp className="w-4 h-4 text-violet-500 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Progress</p>
                    <p className="text-sm font-bold text-slate-700">{sessionData.progressPercent}%</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                      style={{ width: `${sessionData.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Photo Upload */}
              <div className="mb-4">
                {photoPreview ? (
                  <div className="relative">
                    <img 
                      src={photoPreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-2xl"
                    />
                    <button
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 p-2 bg-slate-900/70 hover:bg-slate-900 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-violet-300 transition-colors"
                  >
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                      <Camera className="w-5 h-5 text-violet-600" />
                    </div>
                    <span className="text-sm text-slate-500">Add a photo (optional)</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>

              {/* Caption Input */}
              <div className="mb-4">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption... How did it go?"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  rows={3}
                  maxLength={280}
                />
                <p className="text-xs text-slate-400 text-right mt-1">{caption.length}/280</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 py-3 text-slate-600 hover:bg-slate-100 font-medium rounded-xl transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}