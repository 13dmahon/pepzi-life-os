'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

const PUBLIC_ROUTES = ['/login', '/signup', '/auth/callback', '/forgot-password', '/onboarding'];

export default function AuthNavigation() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

  if (loading || isPublicRoute || !user) {
    return null;
  }

  return <Navigation />;
}

