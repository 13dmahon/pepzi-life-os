'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Target, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useNavigation } from '@/components/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { scheduleAPI } from '@/lib/api';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/today', icon: MessageCircle, label: 'Today' },
  { href: '/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/goals', icon: Target, label: 'Goals' },
  { href: '/settings', icon: null, label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const { isNavHidden } = useNavigation();

  // Fetch backlog count for badge
  const { data: backlogData } = useQuery({
    queryKey: ['backlog-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return { sessions: [], count: 0 };
      const data = await scheduleAPI.getBacklog(user.id);
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const backlogCount = backlogData?.sessions?.length || 0;

  // Hide nav when modal is open or on auth pages
  if (isNavHidden || !user || pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/onboarding')) {
    return null;
  }

  const getInitials = () => {
    if (profile?.name) {
      return profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.slice(0, 1).toUpperCase() || '?';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-2 max-w-lg mx-auto pb-safe">
        {navItems.map((item) => {
          const isActive = item.href === '/' 
            ? pathname === '/' 
            : pathname?.startsWith(item.href);
          const Icon = item.icon;
          const showBadge = item.href === '/today' && backlogCount > 0;

          if (item.href === '/settings') {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                  isActive ? 'text-purple-600' : 'text-gray-500'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {getInitials()}
                </div>
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                isActive ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="relative">
                {Icon && <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />}
                
                {/* Backlog Badge */}
                {showBadge && (
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {backlogCount > 9 ? '9+' : backlogCount}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}