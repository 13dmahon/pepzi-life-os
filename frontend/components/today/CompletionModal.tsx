'use client';

import { useState } from 'react';
import { X, CheckCircle, Clock, Camera, Loader2 } from 'lucide-react';
import { GlassButton, GlassTextarea } from '@/components/ui/GlassUI';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { 
    notes: string; 
    duration_seconds: number;
    photo?: File | null;
  }) => void;
  session: {
    id: string;
    name: string;
    goal_name: string;
    session_number?: number;
  };
  elapsedSeconds: number;
  isSubmitting?: boolean;
}

export default function CompletionModal({
  isOpen,
  onClose,
  onComplete,
  session,
  elapsedSeconds,
  isSubmitting = false,
}: CompletionModalProps) {
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = () => {
    onComplete({
      notes,
      duration_seconds: elapsedSeconds,
      photo,
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999]"
      onClick={onClose}
    >
      <div 
        className="absolute top-16 left-4 right-4 mx-auto max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Nice work! 🎉</h3>
              <p className="text-sm text-slate-500">
                {session.session_number 
                  ? `Session ${session.session_number} - ${session.goal_name}`
                  : session.name
                }
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/80 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        {/* Time Display */}
        <div className="px-4 pt-4">
          <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-center gap-3">
            <Clock className="w-5 h-5 text-slate-500" />
            <span className="text-2xl font-mono font-bold text-slate-700">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className="p-4">
          <label className="block text-sm font-medium text-slate-600 mb-2">
            How did it go? (optional)
          </label>
          <GlassTextarea
            value={notes}
            onChange={setNotes}
            placeholder="Any notes about this session..."
            rows={3}
          />
        </div>

        {/* Photo Upload */}
        <div className="px-4 pb-4">
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Add a photo (optional)
          </label>
          
          {photoPreview ? (
            <div className="relative">
              <img 
                src={photoPreview} 
                alt="Preview" 
                className="w-full h-40 object-cover rounded-xl"
              />
              <button
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/70 hover:bg-slate-900 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
              <Camera className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-sm text-slate-500">Tap to add photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}
          <p className="text-xs text-slate-400 mt-2 text-center">
            Photos can be shared to the community feed
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-3">
          <GlassButton
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </GlassButton>
          <GlassButton
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 !bg-gradient-to-r !from-emerald-500 !to-green-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Log Session
              </>
            )}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}