'use client';

import { ReactNode } from 'react';

// Simple className merge utility (if you don't have cn from @/lib/utils)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ============================================================
// GLASS CARD - Main container component
// ============================================================
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, hover = true, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'backdrop-blur-xl bg-white/70 border border-white/80 rounded-2xl shadow-sm',
        hover && 'hover:bg-white/80 hover:shadow-md transition-all',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================
// GLASS BUTTON - Primary action button
// ============================================================
interface GlassButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function GlassButton({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  onClick, 
  disabled,
  type = 'button'
}: GlassButtonProps) {
  const baseStyles = 'font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-slate-800 text-white hover:bg-slate-700 hover:shadow-lg active:scale-95 shadow-md',
    secondary: 'backdrop-blur-xl bg-white/70 border border-white/80 text-slate-700 hover:bg-white/90 shadow-sm',
    ghost: 'text-slate-600 hover:text-slate-800 hover:bg-white/50',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-xl',
    md: 'px-5 py-2.5 text-sm rounded-2xl',
    lg: 'px-8 py-4 text-base rounded-2xl',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
}

// ============================================================
// GLASS INPUT - Text input with glassy style
// ============================================================
interface GlassInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  type?: 'text' | 'email' | 'password' | 'number';
}

export function GlassInput({ 
  value, 
  onChange, 
  placeholder, 
  className,
  disabled,
  type = 'text'
}: GlassInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full px-4 py-3 backdrop-blur-xl bg-white/50 border border-white/60 rounded-2xl',
        'text-slate-700 placeholder-slate-400',
        'focus:bg-white/70 focus:border-white/80 focus:outline-none focus:ring-2 focus:ring-slate-200',
        'transition-all disabled:opacity-50',
        className
      )}
    />
  );
}

// ============================================================
// GLASS TEXTAREA - Multiline input
// ============================================================
interface GlassTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
}

export function GlassTextarea({ 
  value, 
  onChange, 
  placeholder, 
  className,
  rows = 3,
  disabled
}: GlassTextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={cn(
        'w-full px-4 py-3 backdrop-blur-xl bg-white/50 border border-white/60 rounded-2xl',
        'text-slate-700 placeholder-slate-400 resize-none',
        'focus:bg-white/70 focus:border-white/80 focus:outline-none focus:ring-2 focus:ring-slate-200',
        'transition-all disabled:opacity-50',
        className
      )}
    />
  );
}

// ============================================================
// GLASS BADGE - Status/category indicator
// ============================================================
interface GlassBadgeProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function GlassBadge({ children, className, variant = 'default' }: GlassBadgeProps) {
  const variants = {
    default: 'bg-white/50 text-slate-600 border-white/60',
    success: 'bg-emerald-50/80 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50/80 text-amber-700 border-amber-100',
    error: 'bg-rose-50/80 text-rose-700 border-rose-100',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

// ============================================================
// GLASS ICON BOX - Icon container
// ============================================================
interface GlassIconBoxProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function GlassIconBox({ children, className, size = 'md' }: GlassIconBoxProps) {
  const sizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
  };

  return (
    <div className={cn(
      'bg-white/50 border border-white/60 flex items-center justify-center flex-shrink-0',
      sizes[size],
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================
// GLASS PROGRESS - Progress bar
// ============================================================
interface GlassProgressProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
}

export function GlassProgress({ value, className, showLabel = false }: GlassProgressProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 bg-white/40 rounded-full overflow-hidden">
        <div 
          className="h-full bg-slate-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>{value}%</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// GLASS TABS - Tab switcher
// ============================================================
interface GlassTabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function GlassTabs({ tabs, activeTab, onChange, className }: GlassTabsProps) {
  return (
    <div className={cn('backdrop-blur-xl bg-white/50 border border-white/60 rounded-2xl p-1', className)}>
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-xl transition-all',
              activeTab === tab.id
                ? 'bg-white/80 shadow-sm text-slate-700'
                : 'text-slate-500 hover:text-slate-600'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GLASS MODAL - Modal/dialog container
// ============================================================
interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function GlassModal({ isOpen, onClose, children, title, subtitle }: GlassModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full md:max-w-lg bg-white/90 backdrop-blur-xl rounded-t-3xl md:rounded-3xl shadow-2xl border border-white/80 max-h-[85vh] overflow-hidden">
        {(title || subtitle) && (
          <div className="p-5 border-b border-slate-100">
            {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        )}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WALLPAPER BACKGROUND - Themeable background
// ============================================================
interface WallpaperBackgroundProps {
  children: ReactNode;
  className?: string;
  // Future: wallpaper?: 'mountains' | 'ocean' | 'forest' | 'minimal' | 'custom';
}

export function WallpaperBackground({ children, className }: WallpaperBackgroundProps) {
  return (
    <div className={cn('min-h-screen relative', className)}>
      {/* Background Image - Mountain theme (default) */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/70 to-white/90" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// ============================================================
// GLASS DIVIDER - Subtle separator
// ============================================================
export function GlassDivider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-white/40', className)} />;
}

// ============================================================
// GLASS STAT - Stat display box
// ============================================================
interface GlassStatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
}

export function GlassStat({ label, value, icon, className }: GlassStatProps) {
  return (
    <div className={cn('bg-white/40 backdrop-blur-sm rounded-xl p-3 text-center', className)}>
      {icon && <div className="flex justify-center mb-1 text-slate-500">{icon}</div>}
      <div className="text-xl font-bold text-slate-700">{value}</div>
      <div className="text-xs text-slate-500 font-medium">{label}</div>
    </div>
  );
}