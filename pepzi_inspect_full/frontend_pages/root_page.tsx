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
  Mountain,
  Compass,
  Flag,
  Send,
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

const exampleGoals = [
  "I want to run a marathon by December...",
  "Help me learn Spanish in 6 months...",
  "I want to lose 10kg before summer...",
  "I want to read 24 books this year...",
  "Help me get AWS certified...",
  "I want to build a side project...",
  "I want to meditate daily for 30 days...",
  "Help me save £10,000 this year...",
];

const avatarColors = [
  'from-slate-400 to-slate-500',
  'from-gray-400 to-gray-500',
  'from-zinc-400 to-zinc-500',
  'from-stone-400 to-stone-500',
  'from-slate-300 to-slate-400',
  'from-gray-300 to-gray-400',
  'from-zinc-300 to-zinc-400',
];

const generateFeedItems = (): FeedItemType[] => [
  {
    id: 1,
    type: 'goal_complete',
    user: { name: 'Sarah Mitchell', avatar: 'S', color: avatarColors[0] },
    content: 'Summit reached! Completed my marathon goal 🏔️',
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
    content: 'Halfway up the mountain! B1 Spanish complete 🌄',
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
    content: '30 days strong. One step at a time 🚶',
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
    content: 'AWS Certified! The view from here is worth it ⛰️',
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
    content: 'Beginning my writing journey. 80,000 words await ✍️',
    goal: 'Write a Novel',
    category: 'creative',
    timeAgo: '25 min ago',
    likes: 31,
    comments: 8,
    liked: false,
  },
];

const trendingGoals = [
  { name: 'Run a 5K', count: 2341, category: 'fitness' },
  { name: 'Learn Python', count: 1892, category: 'skill' },
  { name: 'Read 12 Books', count: 1654, category: 'education' },
  { name: 'Lose 10kg', count: 1432, category: 'fitness' },
];

const categoryIcons: Record<string, string> = {
  fitness: '🏃',
  languages: '🌍',
  career: '💼',
  creative: '✨',
  skill: '🎯',
  business: '📈',
  education: '📚',
  mental_health: '🧘',
};

const stats = [
  { value: '50K+', label: 'Summits', icon: Mountain },
  { value: '120K+', label: 'Climbers', icon: Users },
  { value: '4.9', label: 'Rating', icon: Star },
];

// ============================================================
// TYPING ANIMATION HOOK
// ============================================================

function useTypingAnimation(texts: string[], typingSpeed = 80, pauseTime = 2000) {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const currentText = texts[textIndex];
    
    if (isTyping) {
      if (displayText.length < currentText.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, displayText.length + 1));
        }, typingSpeed);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, pauseTime);
        return () => clearTimeout(timeout);
      }
    } else {
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, typingSpeed / 2);
        return () => clearTimeout(timeout);
      } else {
        setTextIndex((prev) => (prev + 1) % texts.length);
        setIsTyping(true);
      }
    }
  }, [displayText, isTyping, textIndex, texts, typingSpeed, pauseTime]);

  return displayText;
}

// ============================================================
// GLASS CARD COMPONENT
// ============================================================

function GlassCard({ children, className = '', hover = true }: { 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`
      backdrop-blur-2xl bg-white/70 
      border border-white/80 
      shadow-[0_8px_32px_rgba(0,0,0,0.06)]
      rounded-3xl
      ${hover ? 'hover:bg-white/80 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function HomePage() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  
  if (user) {
    return <SocialFeedHome />;
  }

  return <LandingPage />;
}

// ============================================================
// SOCIAL FEED HOME (Logged In)
// ============================================================

function SocialFeedHome() {
  const { profile } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItemType[]>(generateFeedItems());
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const feedRef = useRef<HTMLDivElement>(null);
  
  const firstName = profile?.name?.split(' ')[0] || 'Explorer';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const handleLike = (id: number) => {
    setFeedItems(prev => prev.map(feedItem => 
      feedItem.id === id 
        ? { ...feedItem, liked: !feedItem.liked, likes: feedItem.liked ? feedItem.likes - 1 : feedItem.likes + 1 }
        : feedItem
    ));
  };

  return (
    <div className="min-h-screen relative pb-24 md:pb-8 md:pt-16">
      {/* White Mountain Background */}
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
                <h1 className="text-xl font-semibold text-slate-700">{greeting}, {firstName}</h1>
                <p className="text-sm text-slate-400">Continue your ascent</p>
              </div>
              <Link 
                href="/today"
                className="p-3 bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl hover:bg-slate-700 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5 text-white" />
              </Link>
            </div>
          </GlassCard>
        </div>

        {/* Progress Card */}
        <GlassCard className="p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 rounded-2xl">
                <Mountain className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Today's Climb</p>
                <p className="text-sm text-slate-400">2 of 5 checkpoints</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
              <Flame className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-600">5 days</span>
            </div>
          </div>
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-slate-500 rounded-full transition-all duration-500"
              style={{ width: '40%' }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>Base Camp</span>
            <span>Summit</span>
          </div>
        </GlassCard>

        {/* Tab Switcher */}
        <GlassCard className="p-1.5 mb-4" hover={false}>
          <div className="flex">
            {['foryou', 'following'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as 'foryou' | 'following')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-2xl transition-all ${
                  activeTab === tab 
                    ? 'bg-white shadow-md text-slate-700' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'foryou' ? 'For You' : 'Following'}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Feed */}
        <div ref={feedRef} className="space-y-3">
          {feedItems.map((feedItem) => (
            <FeedCard key={feedItem.id} item={feedItem} onLike={handleLike} />
          ))}
        </div>

        {/* Trending Section */}
        <GlassCard className="p-5 mt-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-700">Popular Routes</h3>
          </div>
          <div className="space-y-3">
            {trendingGoals.map((goal, idx) => (
              <div key={goal.name} className="flex items-center gap-3 p-3 bg-white/50 rounded-2xl">
                <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-full text-xs font-semibold text-slate-500">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-slate-700 text-sm">{goal.name}</p>
                  <p className="text-xs text-slate-400">{goal.count.toLocaleString()} climbers</p>
                </div>
                <span className="text-lg">{categoryIcons[goal.category]}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { href: '/today', icon: MessageCircle, label: 'Chat' },
            { href: '/goals', icon: Flag, label: 'Goals' },
            { href: '/schedule', icon: Calendar, label: 'Plan' },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <GlassCard className="p-4 flex flex-col items-center gap-2">
                <div className="p-2.5 bg-slate-100 rounded-2xl">
                  <item.icon className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-xs font-medium text-slate-500">{item.label}</span>
              </GlassCard>
            </Link>
          ))}
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
      case 'goal_complete': return <Flag className="w-3.5 h-3.5 text-slate-500" />;
      case 'milestone': return <TrendingUp className="w-3.5 h-3.5 text-slate-500" />;
      case 'streak': return <Flame className="w-3.5 h-3.5 text-slate-500" />;
      case 'started': return <Rocket className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case 'goal_complete': return 'Reached summit';
      case 'milestone': return `Checkpoint ${item.milestone}`;
      case 'streak': return `${item.streak} day streak`;
      case 'started': return 'Started climbing';
    }
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${item.user.color} flex items-center justify-center font-semibold text-white text-sm shadow-md flex-shrink-0`}>
          {item.user.avatar}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-700">{item.user.name}</span>
            <div className="flex items-center gap-1 text-slate-400">
              {getTypeIcon()}
              <span className="text-xs">{getTypeLabel()}</span>
            </div>
          </div>

          <p className="mt-2 text-slate-600 text-[15px] leading-relaxed">{item.content}</p>

          {/* Goal Tag */}
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium text-slate-500">
              {categoryIcons[item.category]} {item.goal}
            </span>
          </div>

          {/* Achievement Banner */}
          {item.type === 'goal_complete' && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Trophy className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-600 text-sm">Summit Reached!</p>
                <p className="text-xs text-slate-400">{item.goal}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-3">
            <button 
              onClick={() => onLike(item.id)}
              className={`flex items-center gap-1.5 text-sm transition-colors ${
                item.liked ? 'text-slate-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${item.liked ? 'fill-current' : ''}`} />
              <span>{item.likes}</span>
            </button>
            <button className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              <MessageSquare className="w-4 h-4" />
              <span>{item.comments}</span>
            </button>
            <button className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================
// LANDING PAGE (Logged Out)
// ============================================================

function LandingPage() {
  const typingText = useTypingAnimation(exampleGoals, 60, 2000);
  const [visibleCompletions, setVisibleCompletions] = useState<FeedItemType[]>(() => 
    generateFeedItems().slice(0, 4)
  );
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
    <div className="min-h-screen relative overflow-hidden">
      {/* White Mountain Background - Real mountain peaks */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        {/* White overlay for ethereal feel */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/50 to-white/80" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 backdrop-blur-xl bg-white/70 rounded-2xl flex items-center justify-center border border-white/80 shadow-sm">
              <Mountain className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-xl font-semibold text-slate-700">Pepzi</span>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/login" 
              className="px-5 py-2.5 text-slate-500 hover:text-slate-700 transition-colors text-sm font-medium"
            >
              Log in
            </Link>
            <Link 
              href="/signup" 
              className="px-5 py-2.5 backdrop-blur-xl bg-white/70 border border-white/80 rounded-2xl text-slate-700 text-sm font-medium hover:bg-white/90 transition-all shadow-sm"
            >
              Start Climbing
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="px-4 md:px-6 pt-8 md:pt-16 pb-12 max-w-4xl mx-auto">
          {/* Main Heading */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 text-slate-700">
              What's your next
              <span className="block text-slate-500">summit?</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-lg mx-auto">
              Tell us your goal. We'll help you reach it.
            </p>
          </div>

          {/* ChatGPT-style Prompt Box */}
          <div className="max-w-2xl mx-auto mb-12">
            <GlassCard className="p-2" hover={false}>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-4">
                  <div className="flex items-center">
                    <span className="text-slate-600 text-lg">{typingText}</span>
                    <span className="w-0.5 h-6 bg-slate-400 ml-1 animate-pulse" />
                  </div>
                </div>
                <Link
                  href="/signup"
                  className="p-4 bg-slate-800 rounded-2xl text-white hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </Link>
              </div>
            </GlassCard>
            
            {/* Quick suggestion pills */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {['Run a marathon', 'Learn a language', 'Get fit', 'Read more'].map((suggestion) => (
                <Link
                  key={suggestion}
                  href="/signup"
                  className="px-4 py-2 backdrop-blur-xl bg-white/50 border border-white/80 rounded-full text-sm text-slate-500 hover:bg-white/70 hover:text-slate-700 transition-all"
                >
                  {suggestion}
                </Link>
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex justify-center gap-8 md:gap-12 mb-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-slate-700">
                  <stat.icon className="w-5 h-5 text-slate-400" />
                  {stat.value}
                </div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Live Feed Section */}
        <section className="px-4 md:px-6 pb-16">
          <div className="max-w-4xl mx-auto">
            {/* Section Header */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-slate-400 font-medium">Live from the community</span>
            </div>

            {/* Feed Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {visibleCompletions.map((feedItem) => (
                <div 
                  key={feedItem.id}
                  className={`backdrop-blur-2xl bg-white/60 border border-white/80 rounded-2xl p-4 transition-all duration-500 ${
                    animatingId === feedItem.id ? 'ring-2 ring-slate-300' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feedItem.user.color} flex items-center justify-center font-semibold text-white text-sm flex-shrink-0`}>
                      {feedItem.user.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 text-sm">{feedItem.user.name}</span>
                        <Trophy className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{feedItem.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-400">{feedItem.timeAgo}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Heart className="w-3 h-3" /> {feedItem.likes}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Join CTA */}
            <div className="text-center mt-8">
              <Link 
                href="/signup" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 rounded-2xl font-semibold text-white hover:bg-slate-700 hover:shadow-xl transition-all"
              >
                Join the Community
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 md:px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: MessageCircle, title: 'Chat Your Goals', desc: 'Just tell us what you want to achieve' },
                { icon: Target, title: 'AI Plans It', desc: 'We break it down into daily actions' },
                { icon: Users, title: 'Climb Together', desc: 'Share progress with the community' },
              ].map((f) => (
                <GlassCard key={f.title} className="p-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <f.icon className="w-6 h-6 text-slate-600" />
                  </div>
                  <h3 className="font-semibold text-slate-700 text-lg mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm">{f.desc}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 text-center">
          <p className="text-slate-400 text-sm">© 2025 Pepzi. Reach your summit.</p>
        </footer>
      </div>
    </div>
  );
}