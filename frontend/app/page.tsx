'use client';

import { useAuth } from '@/lib/auth-context';
import LoggedInHome from '@/components/home/LoggedInHome';
import LandingPage from '@/components/home/LandingPage';

export default function HomePage() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }
  
  return user ? <LoggedInHome /> : <LandingPage />;
}