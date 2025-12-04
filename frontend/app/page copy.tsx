'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { 
  MessageCircle, 
  Target, 
  Calendar, 
  Sparkles, 
  Trophy,
  Flame,
  Star,
  ChevronRight,
  Zap,
  ArrowRight,
  TrendingUp,
  Heart,
  MessageSquare,
  Share2,
  MoreHorizontal,
  Plus,
  Users,
  Rocket,
  ArrowUp,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface FeedItemType {
  id: number;
  type: 'goal_complete' | 'milestone' | 'streak' | 'started';
  user: { name: string; avatar: string; color: string };
  content: string;
  goal: string;
  category: string;
  timeAgo: string;
  likes: number;
  comments: number;
  liked: boolean;
  milestone?: string;
  streak?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const avatarColors = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-orange-500 to-yellow-500',
  'from-red-500 to-pink-500',
  'from-indigo-500 to-purple-500',
  'from-teal-500 to-green-500',
];

const generateFeedItems = (): FeedItemType[] => [
  {
    id: 1,
    type: 'goal_complete',
    user: { name: 'Sarah Mitchell', avatar: 'S', color: avatarColors[0] },
    content: 'Just completed my marathon goal! 🏃‍♀️ 26.2 miles done!',
    goal: 'Run a Marathon',
    category: 'fitness',
    timeAgo: '2 min ago',
    likes: 47,
    comments: 12,
    liked: false,
  },
  {
    id: 2,
    type: 'milestone',
    user: { name: 'James Chen', avatar: 'J', color: avatarColors[1] },
    content: 'Reached 50% on my Spanish journey! Halfway to B2 level 🇪🇸',
    goal: 'Learn Spanish to B2',
    category: 'languages',
    milestone: '50%',
    timeAgo: '5 min ago',
    likes: 23,
    comments: 5,
    liked: true,
  },
  {
    id: 3,
    type: 'streak',
    user: { name: 'Emily Rodriguez', avatar: 'E', color: avatarColors[2] },
    content: '30 day streak! Haven\'t missed a single workout 💪',
    goal: 'Daily Gym Routine',
    category: 'fitness',
    streak: 30,
    timeAgo: '12 min ago',
    likes: 89,
    comments: 21,
    liked: false,
  },
  {
    id: 4,
    type: 'goal_complete',
    user: { name: 'Mike Davidson', avatar: 'M', color: avatarColors[3] },
    content: 'AWS Solutions Architect - PASSED! 🎉 3 months of studying paid off!',
    goal: 'Get AWS Certified',
    category: 'career',
    timeAgo: '18 min ago',
    likes: 156,
    comments: 34,
    liked: false,
  },
  {
    id: 5,
    type: 'started',
    user: { name: 'Lisa Thompson', avatar: 'L', color: avatarColors[4] },
    content: 'Starting my novel writing journey today. Goal: 80,000 words by June! ✍️',
    goal: 'Write a Novel',
    category: 'creative',
    timeAgo: '25 min ago',
    likes: 31,
    comments: 8,
    liked: false,
  },
  {
    id: 6,
    type: 'milestone',
    user: { name: 'Alex Park', avatar: 'A', color: avatarColors[5] },
    content: 'Lost my first 10kg! 20 more to go but feeling amazing 🔥',
    goal: 'Lose 30kg',
    category: 'fitness',
    milestone: '33%',
    timeAgo: '32 min ago',
    likes: 72,
    comments: 15,
    liked: true,
  },
  {
    id: 7,
    type: 'goal_complete',
    user: { name: 'Nina Williams', avatar: 'N', color: avatarColors[6] },
    content: 'Grade 8 Piano - DISTINCTION! Years of practice finally paying off 🎹',
    goal: 'Master Piano Grade 8',
    category: 'skill',
    timeAgo: '45 min ago',
    likes: 203,
    comments: 45,
    liked: false,
  },
  {
    id: 8,
    type: 'streak',
    user: { name: 'Tom Harris', avatar: 'T', color: avatarColors[0] },
    content: 'Day 100 of meditation! My mind has never been clearer 🧘',
    goal: 'Daily Meditation',
    category: 'mental_health',
    streak: 100,
    timeAgo: '1 hour ago',
    likes: 312,
    comments: 67,
    liked: false,
  },
];

const trendingGoals = [
  { name: 'Run a 5K', count: 2341, category: 'fitness' },
  { name: 'Learn Python', count: 1892, category: 'skill' },
  { name: 'Read 12 Books', count: 1654, category: 'education' },
  { name: 'Lose 10kg', count: 1432, category: 'fitness' },
  { name: 'Start a Side Hustle', count: 1201, category: 'business' },
];

const categoryIcons: Record<string, string> = {
  fitness: '💪',
  languages: '🌍',
  career: '💼',
  creative: '🎨',
  skill: '🎯',
  business: '🚀',
  education: '📚',
  mental_health: '🧘',
};

const categoryColors: Record<string, string> = {
  fitness: 'bg-green-500/20 text-green-400 border-green-500/30',
  languages: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  career: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  creative: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  skill: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  business: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  education: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  mental_health: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

const stats = [
  { value: '50K+', label: 'Goals Achieved', icon: Trophy },
  { value: '120K+', label: 'Active Users', icon: Flame },
  { value: '4.9', label: 'App Rating', icon: Star },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function HomePage() {
  const { user, loading } = useAuth();
  
  // Show loading spinner while auth initializes
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show social feed for logged in users
  if (user) {
    return <SocialFeedHome />;
  }

  // Show landing page for logged out users
  return <LandingPage />;
}

// ============================================================
// SOCIAL FEED HOME (Logged In)
// ============================================================

function SocialFeedHome() {
  const { profile } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItemType[]>(generateFeedItems());
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [showNewPosts, setShowNewPosts] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  
  const firstName = profile?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Simulate new posts coming in
  useEffect(() => {
    const interval = setInterval(() => {
      setShowNewPosts(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLike = (id: number) => {
    setFeedItems(prev => prev.map(feedItem => 
      feedItem.id === id 
        ? { ...feedItem, liked: !feedItem.liked, likes: feedItem.liked ? feedItem.likes - 1 : feedItem.likes + 1 }
        : feedItem
    ));
  };

  const loadNewPosts = () => {
    const newPost: FeedItemType = {
      id: Date.now(),
      type: 'goal_complete',
      user: { 
        name: 'New User', 
        avatar: 'N', 
        color: avatarColors[Math.floor(Math.random() * avatarColors.length)] 
      },
      content: 'Just crushed another goal! The Pepzi community is amazing! 🎉',
      goal: 'Weekly Challenge',
      category: 'fitness',
      timeAgo: 'Just now',
      likes: 0,
      comments: 0,
      liked: false,
    };
    setFeedItems(prev => [newPost, ...prev]);
    setShowNewPosts(false);
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-8 md:pt-16">
      {/* Subtle animated background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-gray-800">
          {/* Greeting Row */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{greeting}, {firstName}! 👋</h1>
              <p className="text-sm text-gray-500">See what the community is achieving</p>
            </div>
            <Link 
              href="/today"
              className="p-2.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
            </Link>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('foryou')}
              className={`flex-1 py-3 text-sm font-semibold relative transition-colors ${
                activeTab === 'foryou' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              For You
              {activeTab === 'foryou' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-purple-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-3 text-sm font-semibold relative transition-colors ${
                activeTab === 'following' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Following
              {activeTab === 'following' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-purple-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* New Posts Button */}
        {showNewPosts && (
          <div className="flex justify-center">
            <button
              onClick={loadNewPosts}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-full text-sm font-medium shadow-lg hover:bg-purple-600 transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
              New achievements
            </button>
          </div>
        )}

        {/* Your Progress Card */}
        <div className="mx-4 mt-4 mb-2">
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <span className="font-semibold">Your Progress Today</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded-full">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-orange-400">5 days</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">2 of 5 sessions</span>
                  <span className="text-purple-400 font-medium">40%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all" style={{ width: '40%' }} />
                </div>
              </div>
              <Link 
                href="/schedule"
                className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
              >
                Continue
              </Link>
            </div>
          </div>
        </div>

        {/* Feed */}
        <div ref={feedRef} className="divide-y divide-gray-800">
          {feedItems.map((feedItem) => (
            <FeedCard key={feedItem.id} item={feedItem} onLike={handleLike} />
          ))}
        </div>

        {/* Trending Section */}
        <div className="mx-4 my-6 bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold">Trending Goals</h3>
          </div>
          <div className="space-y-3">
            {trendingGoals.map((goal, idx) => (
              <div key={goal.name} className="flex items-center gap-3">
                <span className="text-gray-600 font-medium w-5">{idx + 1}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{goal.name}</div>
                  <div className="text-xs text-gray-500">{goal.count.toLocaleString()} people working on this</div>
                </div>
                <span className="text-lg">{categoryIcons[goal.category]}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-purple-400 text-sm font-medium hover:text-purple-300 transition-colors">
            Explore all goals →
          </button>
        </div>

        {/* Quick Actions Footer */}
        <div className="mx-4 mb-8 grid grid-cols-3 gap-3">
          <Link href="/today" className="flex flex-col items-center gap-2 p-4 bg-gray-900/80 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-colors">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageCircle className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-xs font-medium text-gray-400">Chat</span>
          </Link>
          <Link href="/goals" className="flex flex-col items-center gap-2 p-4 bg-gray-900/80 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-colors">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xs font-medium text-gray-400">Goals</span>
          </Link>
          <Link href="/schedule" className="flex flex-col items-center gap-2 p-4 bg-gray-900/80 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-colors">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-xs font-medium text-gray-400">Schedule</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FEED CARD COMPONENT
// ============================================================

function FeedCard({ item, onLike }: { item: FeedItemType; onLike: (id: number) => void }) {
  const getTypeIcon = () => {
    switch (item.type) {
      case 'goal_complete':
        return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 'milestone':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'streak':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'started':
        return <Rocket className="w-4 h-4 text-blue-400" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case 'goal_complete':
        return 'Completed a goal';
      case 'milestone':
        return `Reached ${item.milestone}`;
      case 'streak':
        return `${item.streak} day streak`;
      case 'started':
        return 'Started a new goal';
    }
  };

  return (
    <div className="px-4 py-4 hover:bg-gray-900/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${item.user.color} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
          {item.user.avatar}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name & Time */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold hover:underline cursor-pointer">{item.user.name}</span>
            <div className="flex items-center gap-1 text-gray-500">
              {getTypeIcon()}
              <span className="text-sm">{getTypeLabel()}</span>
            </div>
            <span className="text-gray-600 text-sm">· {item.timeAgo}</span>
          </div>

          {/* Post Content */}
          <p className="mt-2 text-[15px] leading-relaxed">{item.content}</p>

          {/* Goal Tag */}
          <div className="mt-3 inline-flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${categoryColors[item.category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
              {categoryIcons[item.category] || '🎯'} {item.goal}
            </span>
          </div>

          {/* Achievement Card (for completed goals) */}
          {item.type === 'goal_complete' && (
            <div className="mt-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <div className="font-semibold text-yellow-400">Goal Achieved! 🎉</div>
                <div className="text-sm text-gray-400">{item.goal}</div>
              </div>
            </div>
          )}

          {/* Streak Card */}
          {item.type === 'streak' && item.streak && (
            <div className="mt-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Flame className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="font-semibold text-orange-400">{item.streak} Day Streak! 🔥</div>
                <div className="text-sm text-gray-400">Incredible consistency</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-6 mt-3 -ml-2">
            <button 
              onClick={() => onLike(item.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-colors ${
                item.liked 
                  ? 'text-pink-500' 
                  : 'text-gray-500 hover:text-pink-500 hover:bg-pink-500/10'
              }`}
            >
              <Heart className={`w-[18px] h-[18px] ${item.liked ? 'fill-current' : ''}`} />
              <span className="text-sm">{item.likes}</span>
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
              <MessageSquare className="w-[18px] h-[18px]" />
              <span className="text-sm">{item.comments}</span>
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors">
              <Share2 className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* More Button */}
        <button className="p-1.5 text-gray-600 hover:text-gray-400 hover:bg-gray-800 rounded-full transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// LANDING PAGE (Logged Out)
// ============================================================

function LandingPage() {
  const [visibleCompletions, setVisibleCompletions] = useState<FeedItemType[]>(() => generateFeedItems().slice(0, 4));
  const [animatingId, setAnimatingId] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const items = generateFeedItems();
      const randomItem = items[Math.floor(Math.random() * items.length)];
      const newItem: FeedItemType = {
        ...randomItem,
        id: Date.now(),
        timeAgo: 'Just now',
      };
      setAnimatingId(newItem.id);
      setTimeout(() => setAnimatingId(null), 500);
      setVisibleCompletions(prev => [newItem, ...prev.slice(0, 3)]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black to-blue-900/30" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-4 md:px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">Pepzi</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/login" className="px-3 md:px-4 py-2 text-gray-300 hover:text-white transition-colors text-sm md:text-base">
              Log in
            </Link>
            <Link href="/signup" className="px-4 md:px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full font-medium hover:opacity-90 transition-opacity text-sm md:text-base">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-4 md:px-6 pt-12 md:pt-20 pb-20 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm mb-6">
                <Zap className="w-4 h-4" />
                <span>AI-Powered Goal Achievement</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-6">
                Turn your
                <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  dreams into
                </span>
                <span className="block">reality</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-lg mx-auto lg:mx-0">
                Join a community of achievers. Set goals, track progress, and celebrate wins together.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center lg:justify-start">
                <Link href="/signup" className="group flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full font-semibold text-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all">
                  Join the Community
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="flex justify-center lg:justify-start gap-6 md:gap-8">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xl md:text-2xl font-bold">
                      <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                      {stat.value}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Feed Preview */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-3xl blur-xl" />
              <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-gray-400">Live Community Feed</span>
                </div>
                
                <div className="divide-y divide-gray-800 max-h-[400px] overflow-hidden">
                  {visibleCompletions.map((feedItem) => (
                    <div 
                      key={feedItem.id}
                      className={`px-4 py-3 transition-all duration-500 ${
                        animatingId === feedItem.id ? 'bg-purple-500/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${feedItem.user.color} flex items-center justify-center font-bold text-xs`}>
                          {feedItem.user.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{feedItem.user.name}</span>
                            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-2 mt-0.5">{feedItem.content}</p>
                          <span className="text-xs text-gray-600 mt-1">{feedItem.timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-gray-800 text-center bg-gray-900/50">
                  <Link href="/signup" className="text-sm text-purple-400 font-medium hover:text-purple-300">
                    Join to see more →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 md:px-6 py-16 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                More than just goals
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> — a community</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: Users, title: 'Social Accountability', desc: 'Share progress with friends who cheer you on', color: 'from-purple-500 to-pink-500' },
                { icon: Flame, title: 'Streak Battles', desc: 'Compete with friends to maintain the longest streaks', color: 'from-orange-500 to-red-500' },
                { icon: Trophy, title: 'Celebrate Wins', desc: 'Get recognized when you hit milestones', color: 'from-yellow-500 to-orange-500' },
              ].map((f) => (
                <div key={f.title} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-colors">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                    <f.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-gray-400 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 md:px-6 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to start achieving?</h2>
            <p className="text-gray-400 mb-8">Join thousands of people crushing their goals together.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-100 transition-colors">
              Get Started Free
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 py-8 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-sm">© 2025 Pepzi. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}