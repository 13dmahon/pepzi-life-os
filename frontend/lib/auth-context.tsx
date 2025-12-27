'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import { useRouter, usePathname } from 'next/navigation';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  onboarding_complete: boolean;
  wake_time?: string;
  sleep_time?: string;
  work_schedule?: Record<string, { start: string; end: string } | null>;
  fixed_commitments?: Array<{ day: string; start: string; end: string; name: string }>;
  daily_commute_mins?: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ['/login', '/signup', '/auth/callback', '/forgot-password', '/'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (userId: string, retries = 3): Promise<UserProfile | null> => {
    setProfileLoading(true);
    try {
      for (let i = 0; i < retries; i++) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (data) return data as UserProfile;

        if (error && i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const profileData = await fetchProfile(initialSession.user.id);
          setProfile(profileData);
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth event:', event);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          if (event === 'SIGNED_IN') {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          const profileData = await fetchProfile(currentSession.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }

        // Don't handle redirect here for SIGNED_OUT - handleSignOut does it
        // This prevents race conditions and double redirects
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Don't do anything while initial auth is loading
    if (loading) return;
    
    // Don't redirect while profile is still loading
    if (profileLoading) return;

    // Allow root path without checks
    if (pathname === '/' || pathname === '') return;

    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

    if (!user && !isPublicRoute) {
      // Not logged in and trying to hit a protected route → send to login
      router.push('/login');
    } else if (user && !profileLoading && profile !== null && profile.onboarding_complete === false && pathname !== '/onboarding') {
      // Only redirect to onboarding if we're CERTAIN onboarding is not complete
      // profile must be loaded (not null) and explicitly false
      router.push('/onboarding');
    } else if (user && (pathname === '/login' || pathname === '/signup')) {
      // Logged-in user on login/signup page
      if (profile === null) {
        // Profile still loading, wait
        return;
      }
      if (!profile.onboarding_complete) {
        router.push('/onboarding');
      } else {
        router.push('/today');
      }
    }
  }, [user, profile, loading, profileLoading, pathname, router]);

  const handleSignUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) return { error };

    if (data.user) {
      await new Promise(resolve => setTimeout(resolve, 800));
      await supabase.from('users').update({ name }).eq('id', data.user.id);
    }

    return { error: null };
  };

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const handleSignOut = async () => {
    // Clear state immediately - don't wait for Supabase
    setUser(null);
    setSession(null);
    setProfile(null);
    
    // Fire signOut but don't block on it
    // Use Promise.race with a timeout to prevent hanging
    const signOutPromise = supabase.auth.signOut();
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
    
    try {
      await Promise.race([signOutPromise, timeoutPromise]);
    } catch (error) {
      console.error('SignOut error (non-blocking):', error);
    }
    
    // Always redirect regardless of signOut result
    // Use window.location for a clean redirect that clears any cached state
    window.location.href = '/login';
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase.from('users').update(updates).eq('id', user.id);
    if (!error) await refreshProfile();
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        signUp: handleSignUp,
        signIn: handleSignIn,
        signOut: handleSignOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}