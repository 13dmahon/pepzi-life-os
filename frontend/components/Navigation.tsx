'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Target, Calendar, Home, MessageCircle, User } from 'lucide-react';
import { createContext, useContext, useState, ReactNode } from 'react';

// ============================================================
// NAVIGATION CONTEXT - To hide nav from modals
// ============================================================

interface NavigationContextType {
  isNavHidden: boolean;
  hideNav: () => void;
  showNav: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isNavHidden: false,
  hideNav: () => {},
  showNav: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isNavHidden, setIsNavHidden] = useState(false);

  return (
    <NavigationContext.Provider
      value={{
        isNavHidden,
        hideNav: () => setIsNavHidden(true),
        showNav: () => setIsNavHidden(false),
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

// ============================================================
// NAVIGATION COMPONENT
// ============================================================

export default function Navigation() {
  const pathname = usePathname();
  const { isNavHidden } = useNavigation();

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/today', label: 'Today', icon: MessageCircle },
    { href: '/schedule', label: 'Schedule', icon: Calendar },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  // Hide nav when modal is open
  if (isNavHidden) {
    return null;
  }

  return (
    <>
      {/* Desktop Navigation - Top bar */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-200 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Pepzi
              </span>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-2">
              {links.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || 
                  (href !== '/' && pathname.startsWith(href));
                
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Profile */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              <span className="text-sm font-bold text-purple-600">H</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation - Bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 z-40 safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2 pb-safe">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || 
              (href !== '/' && pathname.startsWith(href));
            
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[60px] ${
                  isActive
                    ? 'text-purple-600'
                    : 'text-gray-400'
                }`}
              >
                <div className={`p-1.5 rounded-full transition-all ${
                  isActive ? 'bg-purple-100' : ''
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </div>
                <span className={`text-[10px] font-medium ${
                  isActive ? 'text-purple-600' : 'text-gray-500'
                }`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="hidden md:block h-16" />
      <div className="md:hidden h-20" />
    </>
  );
}