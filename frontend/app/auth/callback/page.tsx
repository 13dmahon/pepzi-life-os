'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from URL hash (OAuth flow)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          router.push('/login?error=callback_failed');
          return;
        }

        if (session) {
          // Check if user has completed onboarding
          const { data: profile } = await supabase
            .from('users')
            .select('onboarding_complete')
            .eq('id', session.user.id)
            .single();

          if (profile?.onboarding_complete) {
            router.push('/');
          } else {
            router.push('/onboarding');
          }
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        router.push('/login?error=unexpected');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-white animate-spin mx-auto" />
        <p className="text-white/80 mt-4">Completing sign in...</p>
      </div>
    </div>
  );
}