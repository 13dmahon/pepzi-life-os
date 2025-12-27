'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Home, Calendar, Target, MessageCircle, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useNavigation } from '@/components/NavigationContext';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/today', icon: MessageCircle, label: 'Today' },
  { href: '/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/goals', icon: Target, label: 'Goals' },
];

export default function TopNav() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { isNavHidden } = useNavigation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleLogout = async () => {
    setShowDropdown(false);
    await signOut();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Pepzi
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-purple-100 text-purple-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                {getInitials()}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                  {profile?.name || 'User'}
                </div>
                <div className="text-xs text-gray-500 truncate max-w-[120px]">
                  {user?.email}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <div className="font-medium text-gray-900 truncate">{profile?.name || 'User'}</div>
                  <div className="text-sm text-gray-500 truncate">{user?.email}</div>
                </div>
                
                <Link
                  href="/settings"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}