"use client";

import { ReactNode } from "react";

// ============================================================
// TYPES
// ============================================================

export interface FeedItemType {
  id: number;
  user: { name: string; avatar: string; color: string };
  content: string;
  goal: string;
  category: string;
  timeAgo: string;
  likes: number;
  liked: boolean;
  streak?: number;
  image?: string;
}

export interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  photo_url: string | null;
  goal_name: string;
  goal_emoji: string;
  session_name: string | null;
  session_number: number | null;
  total_sessions: number | null;
  duration_mins: number | null;
  streak_days: number;
  progress_percent: number;
  is_public: boolean;
  likes_count: number;
  user_has_liked: boolean;
  created_at: string;
}

export interface TodayProgress {
  completed: number;
  total: number;
  streak: number;
}

export interface PreviewSession {
  name: string;
  description: string;
  duration_mins: number;
  notes?: string;
}

export interface PreviewData {
  goal: {
    name: string;
    category: string;
  };
  plan: {
    weekly_hours: number;
    sessions_per_week: number;
    session_length_mins: number;
    total_weeks: number;
    total_hours: number;
  };
  preview: {
    week1: {
      week_number: number;
      focus: string;
      sessions: PreviewSession[];
    };
    locked_weeks: number;
  };
  reasoning: {
    session_length_reason: string;
    hour_estimate_notes: string;
  };
}

export interface ScheduleSelection {
  days: string[];
  preferredTime: "morning" | "afternoon" | "evening";
  specificTimes: Record<string, string>;
}

// ============================================================
// CONSTANTS
// ============================================================

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const MIN_GOAL_LENGTH = 3;
export const MAX_GOAL_LENGTH = 150;

export const DEMO_GOALS = ["Learn guitar", "Get fit", "Learn Spanish"];

export const avatarColors = [
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-violet-400 to-violet-600",
];

export const categoryIcons: Record<string, string> = {
  fitness: "🏃",
  skill: "🎯",
  education: "📚",
  languages: "🌍",
  music: "🎸",
  business: "💼",
  creative: "🎨",
  health: "❤️",
  mental_health: "🧘",
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const generateFeedItems = (): FeedItemType[] => [
  {
    id: 1,
    user: { name: "Sarah M", avatar: "S", color: avatarColors[0] },
    content:
      '21 days of morning walks! 🚶‍♀️ Started with "just 3x a week" and now I actually look forward to it.',
    goal: "Morning Walks",
    category: "fitness",
    streak: 21,
    timeAgo: "2h",
    likes: 89,
    liked: false,
    image:
      "https://images.pexels.com/photos/3621182/pexels-photo-3621182.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 2,
    user: { name: "James K", avatar: "J", color: avatarColors[1] },
    content:
      "Week 4 of guitar practice ✓ Finally can play a full song! The daily reminders actually worked.",
    goal: "Learn Guitar",
    category: "skill",
    timeAgo: "5h",
    likes: 156,
    liked: true,
    image:
      "https://images.pexels.com/photos/1751731/pexels-photo-1751731.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 3,
    user: { name: "Lin C", avatar: "L", color: avatarColors[2] },
    content:
      'Finished my 12th book this year 📚 All from "read 15 mins before bed." Small habit, big results.',
    goal: "Reading Habit",
    category: "education",
    timeAgo: "1d",
    likes: 234,
    liked: false,
    image:
      "https://images.pexels.com/photos/3278768/pexels-photo-3278768.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];

// ============================================================
// SHARED COMPONENTS
// ============================================================

export function GlassCard({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`
      backdrop-blur-2xl bg-white/70 
      border border-white/80 
      shadow-[0_8px_32px_rgba(0,0,0,0.06)]
      rounded-3xl
      ${hover ? "hover:bg-white/80 transition-all duration-300" : ""}
      ${className}
    `}
    >
      {children}
    </div>
  );
}