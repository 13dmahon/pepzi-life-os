'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Target, Calendar, Home } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/today', label: 'Today', icon: Home },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/schedule', label: 'Schedule', icon: Calendar },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:top-0 md:bottom-auto z-50 pb-safe md:pb-0">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around md:justify-start md:gap-8 py-2 md:py-3">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 md:px-4 py-2 rounded-xl md:rounded-full transition-all min-w-[64px] md:min-w-0 ${
                  isActive
                    ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                }`}
              >
                <Icon className="w-5 h-5 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}