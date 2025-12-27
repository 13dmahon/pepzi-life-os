'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Mountain, Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Completing sign in...');

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
          setStatus('Setting up your account...');
          
          // Check if user profile exists
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id, onboarding_complete')
            .eq('id', session.user.id)
            .single();

          // If no profile exists, create one (new user)
          if (profileError && profileError.code === 'PGRST116') {
            setStatus('Creating your profile...');
            
            // Create new user profile
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'User',
                onboarding_complete: false,
              });

            if (insertError) {
              console.error('Failed to create profile:', insertError);
              // Still redirect to onboarding, profile might be created by trigger
            }

            router.push('/onboarding');
            return;
          }

          if (profileError) {
            console.error('Profile fetch error:', profileError);
            // Default to onboarding if we can't determine status
            router.push('/onboarding');
            return;
          }

          // Existing user - check onboarding status
          if (profile?.onboarding_complete) {
            setStatus('Welcome back!');
            router.push('/today');
          } else {
            setStatus('Continuing setup...');
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
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Mountain Background */}
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
        <div className="inline-flex items-center justify-center w-16 h-16 backdrop-blur-xl bg-white/70 rounded-2xl border border-white/80 shadow-lg mb-6">
          <Mountain className="w-8 h-8 text-slate-600" />
        </div>
        <Loader2 className="w-8 h-8 text-slate-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">{status}</p>
      </div>
    </div>
  );
}