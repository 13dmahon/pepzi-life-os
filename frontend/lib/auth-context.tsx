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
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Added '/' to public routes so landing page is visible to logged-out users
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/auth/callback', '/forgot-password'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (userId: string, retries = 3): Promise<UserProfile | null> => {
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

        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = PUBLIC_ROUTES.some(route => 
      route === '/' ? pathname === '/' : pathname?.startsWith(route)
    );

    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user && profile && !profile.onboarding_complete && pathname !== '/onboarding') {
      router.push('/onboarding');
    } else if (user && profile?.onboarding_complete && (pathname === '/login' || pathname === '/signup')) {
      router.push('/');
    }
  }, [user, profile, loading, pathname]);

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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    router.push('/login');
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