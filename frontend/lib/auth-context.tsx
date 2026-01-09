'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
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

// Only public routes - everything else requires auth
const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/signup',
  '/auth/callback',
  '/forgot-password',
]);

// ============================================================
// STABILITY CONSTANTS — Session 2 Fixes
// ============================================================
const AUTH_INIT_TIMEOUT_MS = 8000;      // AuthInitGuard_v1: Max time for entire auth init
const PROFILE_FETCH_TIMEOUT_MS = 5000;  // ProfileFetchTimeout_v1: Max time for profile fetch
const SESSION_FETCH_TIMEOUT_MS = 6000;  // Max time for getSession()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authCheckedOnce, setAuthCheckedOnce] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // Init guards
  const initStarted = useRef(false);
  const initCompleted = useRef(false);

  // Profile safeguards
  const profileFetchPromise = useRef<Promise<UserProfile | null> | null>(null); // ProfileFetchSingleFlight_v1
  const profileCheckedOnce = useRef(false);

  // ============================================================
  // ProfileFetchSingleFlight_v1 + ProfileFetchTimeout_v1
  // - Reuse in-flight promise (no duplicate fetches)
  // - Hard timeout prevents indefinite hang
  // ============================================================
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    if (profileFetchPromise.current) {
      console.log('[Auth] ProfileFetchSingleFlight_v1: Awaiting existing fetch');
      return profileFetchPromise.current;
    }

    setProfileLoading(true);

    const run = async (): Promise<UserProfile | null> => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.error('[Auth] Profile fetch error:', error.message);
          return null;
        }

        console.log('[Auth] Profile fetched successfully');
        return (data as UserProfile) ?? null;
      } catch (err) {
        console.error('[Auth] Profile fetch exception:', err);
        return null;
      } finally {
        profileCheckedOnce.current = true;
        setProfileLoading(false);
        profileFetchPromise.current = null;
      }
    };

    // Clear timeout when run() finishes to avoid false timeout logs
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    profileFetchPromise.current = Promise.race([
      run().finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      }),
      new Promise<UserProfile | null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.error('[Auth] ProfileFetchTimeout_v1: Timed out after', PROFILE_FETCH_TIMEOUT_MS, 'ms');
          profileCheckedOnce.current = true;
          resolve(null);
        }, PROFILE_FETCH_TIMEOUT_MS);
      }),
    ]);

    return profileFetchPromise.current;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    // ============================================================
    // AuthInitGuard_v1 — Hard timeout for auth init
    // No code path may leave loading=true forever.
    // ============================================================
    const initTimeoutId = setTimeout(() => {
      if (!initCompleted.current) {
        console.error(
          '[Auth] AuthInitGuard_v1: Init timed out after',
          AUTH_INIT_TIMEOUT_MS,
          'ms — forcing completion'
        );
        setLoading(false);
        setAuthCheckedOnce(true);
        initCompleted.current = true;
      }
    }, AUTH_INIT_TIMEOUT_MS);

    const initAuth = async () => {
      console.log('[Auth] Initializing...');

      try {
        let initialSession: Session | null = null;

        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('getSession timeout')), SESSION_FETCH_TIMEOUT_MS)
            ),
          ]);

          if (result.error) {
            console.error('[Auth] Session error:', result.error.message);
          } else {
            initialSession = result.data.session;
          }
        } catch {
          console.warn('[Auth] AuthInitGuard_v1: getSession() timed out after', SESSION_FETCH_TIMEOUT_MS, 'ms');
        }

        console.log('[Auth] Session result:', initialSession ? 'Found session' : 'No session');

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);

          const profileData = await fetchProfile(initialSession.user.id);
          setProfile(profileData);
          console.log('[Auth] Profile loaded:', profileData ? 'Success' : 'Not found/timeout');
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          profileCheckedOnce.current = true;
        }
      } catch (error) {
        console.error('[Auth] Init error:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        profileCheckedOnce.current = true;
      } finally {
        clearTimeout(initTimeoutId);
        console.log('[Auth] Init complete');
        setLoading(false);
        setAuthCheckedOnce(true);
        initCompleted.current = true;
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[Auth] State change:', event);

        // Always update auth truth immediately
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          if (event === 'SIGNED_IN') {
            await new Promise(resolve => setTimeout(resolve, 300));
            const profileData = await fetchProfile(currentSession.user.id);
            setProfile(profileData);
          }

          // IMPORTANT: don't reference `profile` state here (stale in this effect)
          if (event === 'TOKEN_REFRESHED' && !profileCheckedOnce.current) {
            console.log('[Auth] TOKEN_REFRESHED and profile not checked — fetching');
            const profileData = await fetchProfile(currentSession.user.id);
            setProfile(profileData);
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          profileCheckedOnce.current = false;
        }

        setAuthCheckedOnce(true);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(initTimeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // ============================================================
  // Redirect logic with ProfileNullNoInfiniteWait_v1
  // FIX: /login and /signup must redirect even though they are "public"
  // ============================================================
  useEffect(() => {
    if (loading) return;
    if (profileLoading) return;

    const path = pathname || '';
    const isPublicRoute = PUBLIC_ROUTES.has(path);

    // ✅ If logged in, redirect away from /login or /signup to /today
    if (path === '/login' || path === '/signup') {
      if (user) {
        router.replace('/today');
      }
      return;
    }

    // Public pages: do nothing (includes Home/Feed)
    if (isPublicRoute) return;

    // Protected pages: require auth
    if (!user) {
      if (!authCheckedOnce) return;
      router.replace('/login');
      return;
    }

    // No onboarding gate - users go straight to the app
  }, [user, profile, loading, profileLoading, pathname, router, authCheckedOnce]);

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
    setUser(null);
    setSession(null);
    setProfile(null);
    setAuthCheckedOnce(false);
    profileCheckedOnce.current = false;

    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
    }

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[Auth] SignOut error:', error);
    }

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