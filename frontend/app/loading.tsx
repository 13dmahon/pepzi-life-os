'use client';

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Mountain Background - Same as rest of app */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/50 to-white/80" />
      </div>

      <div className="relative z-10 text-center">
        <Loader2 className="w-10 h-10 text-slate-500 animate-spin mx-auto" />
        <p className="text-slate-400 mt-4">Loading...</p>
      </div>
    </div>
  );
}