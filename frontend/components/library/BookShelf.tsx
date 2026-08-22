'use client';

import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface BookShelfProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  emptyMessage?: string;
  showViewAll?: boolean;
  onViewAll?: () => void;
  children: ReactNode;
  variant?: 'default' | 'today' | 'catchup';
}

export default function BookShelf({
  title,
  subtitle,
  icon,
  emptyMessage = 'No books on this shelf',
  showViewAll = false,
  onViewAll,
  children,
  variant = 'default',
}: BookShelfProps) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  const shelfStyles = {
    default: 'bg-slate-100/50',
    today: 'bg-violet-100/50',
    catchup: 'bg-amber-100/50',
  };

  const headerStyles = {
    default: 'text-slate-700',
    today: 'text-violet-700',
    catchup: 'text-amber-700',
  };

  return (
    <div className="mb-8">
      {/* Shelf header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          <div>
            <h2 className={`font-bold text-lg ${headerStyles[variant]}`}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
        </div>
        
        {showViewAll && onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Shelf surface */}
      <div className={`
        relative rounded-2xl p-4
        ${shelfStyles[variant]}
      `}>
        {/* Shelf edge shadow */}
        <div className="absolute bottom-0 left-4 right-4 h-2 bg-gradient-to-t from-slate-200/50 to-transparent rounded-b-2xl" />
        
        {isEmpty ? (
          <div className="py-8 text-center">
            <p className="text-slate-400 text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}