'use client';

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-white animate-spin mx-auto" />
        <p className="text-white/80 mt-4">Loading...</p>
      </div>
    </div>
  );
}