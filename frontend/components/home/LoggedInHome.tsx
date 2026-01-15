"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  MessageCircle,
  Target,
  Calendar,
  Flame,
  Heart,
  Plus,
  Flag,
  Loader2,
  Sparkles,
} from "lucide-react";
import { API_BASE, Post, GlassCard, getTimeAgo } from "./shared";

// ============================================================
// FEED POST CARD (for logged-in users with real data)
// ============================================================

function FeedPostCard({
  post,
  onLike,
  userName,
}: {
  post: Post;
  onLike: (postId: string) => void;
  userName: string;
}) {
  const timeAgo = getTimeAgo(post.created_at);
  const initial = userName?.charAt(0)?.toUpperCase() || "U";

  return (
    <GlassCard className="p-4">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center font-bold text-white text-sm shadow-lg flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">{userName}</span>
            <span className="text-slate-400 text-sm">· {timeAgo}</span>
          </div>

          {post.caption && (
            <p className="mt-1.5 text-slate-600 text-sm leading-relaxed">
              {post.caption}
            </p>
          )}

          {post.photo_url && (
            <div className="mt-3 rounded-2xl overflow-hidden">
              <img
                src={post.photo_url}
                alt=""
                className="w-full h-48 object-cover"
              />
            </div>
          )}

          {/* Stats Preview */}
          <div className="mt-3 bg-slate-100/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{post.goal_emoji}</span>
              <span className="font-medium text-slate-700 text-sm">
                {post.goal_name}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {post.session_number && post.total_sessions && (
                <span>
                  Session {post.session_number}/{post.total_sessions}
                </span>
              )}
              {post.duration_mins && <span>{post.duration_mins}m</span>}
              <span>{post.progress_percent}% complete</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/80 rounded-full text-xs font-medium text-slate-500">
              {post.goal_emoji} {post.goal_name}
              {post.streak_days > 0 && (
                <Flame className="w-3 h-3 text-orange-500" />
              )}
            </span>
            <button
              onClick={() => onLike(post.id)}
              className={`flex items-center gap-1 text-sm ${
                post.user_has_liked ? "text-rose-500" : "text-slate-400"
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  post.user_has_liked ? "fill-current" : ""
                }`}
              />
              {post.likes_count}
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================
// EMPTY FEED STATE
// ============================================================

function EmptyFeedState() {
  return (
    <GlassCard className="p-8 text-center" hover={false}>
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">
        Your feed is empty
      </h3>
      <p className="text-slate-500 text-sm mb-4">
        Complete a session and share your progress to see it here!
      </p>
      <Link
        href="/today"
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
      >
        <Target className="w-4 h-4" />
        Go to Today
      </Link>
    </GlassCard>
  );
}

// ============================================================
// LOGGED IN HOME COMPONENT
// ============================================================

export default function LoggedInHome() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const firstName = profile?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Fetch user's posts
  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ["feed", user?.id],
    queryFn: async () => {
      if (!user?.id) return { posts: [] };
      const response = await fetch(
        `${API_BASE}/api/posts/feed?user_id=${user.id}`
      );
      if (!response.ok) throw new Error("Failed to fetch feed");
      return response.json() as Promise<{ posts: Post[] }>;
    },
    enabled: !!user?.id,
  });

  // Fetch today's progress
  const { data: todayData } = useQuery({
    queryKey: ["today-progress", user?.id],
    queryFn: async () => {
      if (!user?.id) return { completed: 0, total: 0, streak: 0 };
      const response = await fetch(
        `${API_BASE}/api/schedule/today?user_id=${user.id}`
      );
      if (!response.ok) return { completed: 0, total: 0, streak: 0 };
      const data = await response.json();
      const sessions = data.sessions || [];
      const completed = sessions.filter(
        (s: any) => s.status === "completed"
      ).length;
      return {
        completed,
        total: sessions.length,
        streak: data.streak || 0,
      };
    },
    enabled: !!user?.id,
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async ({
      postId,
      liked,
    }: {
      postId: string;
      liked: boolean;
    }) => {
      const method = liked ? "DELETE" : "POST";
      const url = liked
        ? `${API_BASE}/api/posts/${postId}/like?user_id=${user?.id}`
        : `${API_BASE}/api/posts/${postId}/like`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: liked ? undefined : JSON.stringify({ user_id: user?.id }),
      });

      if (!response.ok) throw new Error("Failed to toggle like");
      return response.json();
    },
    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", user?.id] });

      const previousData = queryClient.getQueryData(["feed", user?.id]);

      queryClient.setQueryData(["feed", user?.id], (old: any) => {
        if (!old?.posts) return old;
        return {
          ...old,
          posts: old.posts.map((post: Post) =>
            post.id === postId
              ? {
                  ...post,
                  user_has_liked: !liked,
                  likes_count: liked
                    ? post.likes_count - 1
                    : post.likes_count + 1,
                }
              : post
          ),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["feed", user?.id], context.previousData);
      }
    },
  });

  const handleLike = (postId: string) => {
    const post = feedData?.posts.find((p) => p.id === postId);
    if (post) {
      likeMutation.mutate({ postId, liked: post.user_has_liked });
    }
  };

  const posts = feedData?.posts || [];
  const progress = todayData || { completed: 0, total: 0, streak: 0 };
  const progressPercent =
    progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="min-h-screen relative pb-24 md:pb-8 md:pt-16">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/70 to-white/90" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="pt-4 pb-6">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-700">
                  {greeting}, {firstName}
                </h1>
                <p className="text-sm text-slate-400">
                  What would you like to work on?
                </p>
              </div>
              <Link
                href="/goals"
                className="p-3 bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl hover:bg-slate-700 transition-all"
              >
                <Plus className="w-5 h-5 text-white" />
              </Link>
            </div>
          </GlassCard>
        </div>

        {/* Today's Progress */}
        <GlassCard className="p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 rounded-2xl">
                <Target className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">
                  Today&apos;s Progress
                </p>
                <p className="text-sm text-slate-400">
                  {progress.completed} of {progress.total} sessions
                </p>
              </div>
            </div>
            {progress.streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-slate-600">
                  {progress.streak} days
                </span>
              </div>
            )}
          </div>
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-slate-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </GlassCard>

        {/* Feed */}
        <div className="space-y-3 mb-8">
          {feedLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                userName={profile?.name || "You"}
              />
            ))
          ) : (
            <EmptyFeedState />
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { href: "/today", icon: MessageCircle, label: "Today" },
            { href: "/goals", icon: Flag, label: "Goals" },
            { href: "/schedule", icon: Calendar, label: "Schedule" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <GlassCard className="p-4 flex flex-col items-center gap-2">
                <div className="p-2.5 bg-slate-100 rounded-2xl">
                  <item.icon className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {item.label}
                </span>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}