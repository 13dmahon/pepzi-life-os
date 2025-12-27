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
  Check,
  Clock,
  Play,
  SkipForward,
  CheckCircle2,
  CalendarDays,
  Zap,
  Bot,
  Repeat2,
  Bookmark,
  BarChart3,
  CalendarPlus,
  ArrowRightLeft,
  ChevronLeft,
  Plane,
  Briefcase,
  Music,
  BookOpen,
  Dumbbell,
  Globe,
  Code,
  PenTool,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface FeedItemType {
  id: number;
  type: 'goal_complete' | 'milestone' | 'streak' | 'started';
  user: { name: string; handle: string; avatar: string; color: string; verified?: boolean };
  content: string;
  goal: string;
  category: string;
  timeAgo: string;
  likes: number;
  comments: number;
  reposts: number;
  views: string;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  milestone?: string;
  streak?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const creativeGoals = [
  { text: "I want to summit Kilimanjaro this year", icon: "🏔️", plan: "Summit Kilimanjaro", duration: "6 months", sessions: "72 training sessions", date: "Aug 15, 2025" },
  { text: "Help me land a promotion by Q3", icon: "💼", plan: "Career Advancement", duration: "5 months", sessions: "45 skill sessions", date: "Sep 30, 2025" },
  { text: "I want to visit 10 countries this year", icon: "✈️", plan: "10 Countries Challenge", duration: "12 months", sessions: "10 trips planned", date: "Dec 20, 2025" },
  { text: "Help me write and publish my first novel", icon: "📖", plan: "First Novel", duration: "8 months", sessions: "160 writing sessions", date: "Oct 1, 2025" },
  { text: "I want to speak fluent Spanish by summer", icon: "🇪🇸", plan: "Spanish Fluency (B2)", duration: "6 months", sessions: "156 lessons", date: "Jul 15, 2025" },
  { text: "Help me launch my side business", icon: "🚀", plan: "Side Business Launch", duration: "4 months", sessions: "60 work blocks", date: "May 1, 2025" },
  { text: "I want to run a sub-3:30 marathon", icon: "🏃", plan: "Marathon Sub-3:30", duration: "16 weeks", sessions: "64 runs", date: "Apr 20, 2025" },
  { text: "Help me learn piano to Grade 5", icon: "🎹", plan: "Piano Grade 5", duration: "12 months", sessions: "312 practice sessions", date: "Jan 15, 2026" },
  { text: "I want to build a SaaS product", icon: "💻", plan: "SaaS MVP Launch", duration: "5 months", sessions: "100 dev sessions", date: "Jun 1, 2025" },
  { text: "Help me save £20,000 for a house deposit", icon: "🏠", plan: "House Deposit Fund", duration: "18 months", sessions: "78 budget reviews", date: "Jul 1, 2026" },
  { text: "I want to complete an Ironman triathlon", icon: "🏊", plan: "Ironman Completion", duration: "9 months", sessions: "180 training sessions", date: "Sep 15, 2025" },
  { text: "Help me get AWS Solutions Architect certified", icon: "☁️", plan: "AWS Certification", duration: "3 months", sessions: "60 study sessions", date: "Apr 1, 2025" },
];

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
  'from-indigo-400 to-indigo-600',
];

const generateFeedItems = (): FeedItemType[] => [
  {
    id: 1,
    type: 'goal_complete',
    user: { name: 'Alex Chen', handle: 'alexclimbs', avatar: 'A', color: avatarColors[0], verified: true },
    content: '🏔️ SUMMIT REACHED! Standing on top of Kilimanjaro right now. 6 months of training, altitude prep, gear research — all scheduled by Pepzi around my 60-hour work weeks. The view from 5,895m is unreal.',
    goal: 'Summit Kilimanjaro',
    category: 'adventure',
    timeAgo: '2m',
    likes: 2341,
    comments: 234,
    reposts: 189,
    views: '45.2K',
    liked: false,
    reposted: false,
    bookmarked: false,
  },
  {
    id: 2,
    type: 'goal_complete',
    user: { name: 'Priya Sharma', handle: 'priya_codes', avatar: 'P', color: avatarColors[1], verified: true },
    content: 'Just got THE email. Senior Engineer, effective Monday. 🎉\n\n5 months ago I told Pepzi "help me get promoted." It scheduled LeetCode, system design study, 1:1 prep, and visibility projects around my actual calendar. Every session counted.',
    goal: 'Land a Promotion',
    category: 'career',
    timeAgo: '15m',
    likes: 1892,
    comments: 156,
    reposts: 234,
    views: '32.1K',
    liked: true,
    reposted: false,
    bookmarked: true,
  },
  {
    id: 3,
    type: 'milestone',
    user: { name: 'Marco Silva', handle: 'marco_adventures', avatar: 'M', color: avatarColors[2] },
    content: 'Country 7 of 10: Japan 🇯🇵✨\n\nPepzi planned all 10 trips around my remote work schedule, budget cycles, and best seasons to visit. 3 more to go and I\'m actually AHEAD of schedule.',
    goal: '10 Countries in 2025',
    category: 'travel',
    milestone: '70%',
    timeAgo: '1h',
    likes: 1456,
    comments: 189,
    reposts: 145,
    views: '28.4K',
    liked: false,
    reposted: true,
    bookmarked: false,
  },
  {
    id: 4,
    type: 'goal_complete',
    user: { name: 'Emma Wright', handle: 'emwrites', avatar: 'E', color: avatarColors[3] },
    content: 'THE END. Two words I never thought I\'d type.\n\n📖 82,000 words. 160 sessions. 8 months.\n\nEvery morning at 6am, Pepzi blocked 45 mins before work. No excuses. My novel is DONE and out to agents.',
    goal: 'Write a Novel',
    category: 'creative',
    timeAgo: '3h',
    likes: 3421,
    comments: 445,
    reposts: 567,
    views: '89.2K',
    liked: false,
    reposted: false,
    bookmarked: false,
  },
  {
    id: 5,
    type: 'streak',
    user: { name: 'David Kim', handle: 'davidlearns', avatar: 'D', color: avatarColors[4], verified: true },
    content: '100 days of Spanish. 💯🇪🇸\n\nStarted with "hola" and just had a 30-minute conversation with my girlfriend\'s Colombian grandmother. She cried. I cried. Pepzi scheduled around my shifts and it just... worked.',
    goal: 'Spanish Fluency',
    category: 'languages',
    streak: 100,
    timeAgo: '5h',
    likes: 2156,
    comments: 312,
    reposts: 289,
    views: '56.7K',
    liked: false,
    reposted: false,
    bookmarked: false,
  },
];

// Only App Store rating - removed fake user/goal stats
const stats = [
  { value: '4.9', label: 'App Store Rating', icon: Star },
];

const categoryIcons: Record<string, string> = {
  adventure: '🏔️',
  fitness: '🏃',
  languages: '🌍',
  career: '💼',
  creative: '✨',
  skill: '🎯',
  business: '📈',
  education: '📚',
  travel: '✈️',
  mental_health: '🧘',
};

// ============================================================
// TYPING ANIMATION HOOK - Now cycles through creative goals
// ============================================================

function useGoalTypingAnimation(goals: typeof creativeGoals, typingSpeed = 50, pauseTime = 2500) {
  const [displayText, setDisplayText] = useState('');
  const [goalIndex, setGoalIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [currentGoal, setCurrentGoal] = useState(goals[0]);

  useEffect(() => {
    const goal = goals[goalIndex];
    const text = goal.text;
    
    if (isTyping) {
      if (displayText.length < text.length) {
        const timeout = setTimeout(() => {
          setDisplayText(text.slice(0, displayText.length + 1));
        }, typingSpeed);
        return () => clearTimeout(timeout);
      } else {
        setCurrentGoal(goal);
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, pauseTime);
        return () => clearTimeout(timeout);
      }
    } else {
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, typingSpeed / 3);
        return () => clearTimeout(timeout);
      } else {
        setGoalIndex((prev) => (prev + 1) % goals.length);
        setIsTyping(true);
      }
    }
  }, [displayText, isTyping, goalIndex, goals, typingSpeed, pauseTime]);

  return { displayText, currentGoal, isComplete: displayText === currentGoal.text };
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
// SOCIAL FEED HOME (Logged In) - Keep existing
// ============================================================

function SocialFeedHome() {
  const { profile } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItemType[]>(generateFeedItems());
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  
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
                <h1 className="text-xl font-semibold text-slate-700">{greeting}, {firstName}</h1>
                <p className="text-sm text-slate-400">Continue your journey</p>
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
                <Target className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Today's Progress</p>
                <p className="text-sm text-slate-400">2 of 5 sessions</p>
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
        <div className="space-y-4">
          {feedItems.map((feedItem) => (
            <TwitterFeedCard key={feedItem.id} item={feedItem} onLike={handleLike} />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 my-8">
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
// TWITTER-STYLE FEED CARD
// ============================================================

function TwitterFeedCard({ item, onLike }: { item: FeedItemType; onLike: (id: number) => void }) {
  const [isBookmarked, setIsBookmarked] = useState(item.bookmarked);
  const [isReposted, setIsReposted] = useState(item.reposted);
  const [reposts, setReposts] = useState(item.reposts);

  const handleRepost = () => {
    setIsReposted(!isReposted);
    setReposts(prev => isReposted ? prev - 1 : prev + 1);
  };

  return (
    <GlassCard className="p-4 hover:bg-white/85">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${item.user.color} flex items-center justify-center font-bold text-white text-lg shadow-lg flex-shrink-0`}>
          {item.user.avatar}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{item.user.name}</span>
            {item.user.verified && (
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
              </svg>
            )}
            <span className="text-slate-400">@{item.user.handle}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">{item.timeAgo}</span>
          </div>

          {/* Tweet Content */}
          <p className="mt-2 text-slate-700 text-[15px] leading-relaxed whitespace-pre-line">{item.content}</p>

          {/* Goal Tag */}
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 rounded-full text-xs font-medium text-slate-600">
              {categoryIcons[item.category]} {item.goal}
              {item.type === 'goal_complete' && <Trophy className="w-3 h-3 text-amber-500 ml-1" />}
              {item.type === 'streak' && <Flame className="w-3 h-3 text-orange-500 ml-1" />}
            </span>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-4 max-w-md">
            <button className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="text-sm">{item.comments}</span>
            </button>

            <button 
              onClick={handleRepost}
              className={`flex items-center gap-2 transition-colors group ${isReposted ? 'text-green-500' : 'text-slate-400 hover:text-green-500'}`}
            >
              <div className={`p-2 rounded-full transition-colors ${isReposted ? 'bg-green-50' : 'group-hover:bg-green-50'}`}>
                <Repeat2 className="w-4 h-4" />
              </div>
              <span className="text-sm">{reposts}</span>
            </button>

            <button 
              onClick={() => onLike(item.id)}
              className={`flex items-center gap-2 transition-colors group ${item.liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
            >
              <div className={`p-2 rounded-full transition-colors ${item.liked ? 'bg-rose-50' : 'group-hover:bg-rose-50'}`}>
                <Heart className={`w-4 h-4 ${item.liked ? 'fill-current' : ''}`} />
              </div>
              <span className="text-sm">{item.likes.toLocaleString()}</span>
            </button>

            <button className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-sm">{item.views}</span>
            </button>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-blue-500 bg-blue-50' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 rounded-full text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================
// LANDING PAGE (Logged Out) - COMPLETELY REDESIGNED
// ============================================================

function LandingPage() {
  const { displayText, currentGoal, isComplete } = useGoalTypingAnimation(creativeGoals, 40, 3000);
  const [feedItems, setFeedItems] = useState<FeedItemType[]>(() => generateFeedItems());
  const [activeStep, setActiveStep] = useState(0);
  const [showPlanPreview, setShowPlanPreview] = useState(false);

  // Show plan preview when typing completes
  useEffect(() => {
    if (isComplete) {
      const timeout = setTimeout(() => setShowPlanPreview(true), 300);
      return () => clearTimeout(timeout);
    } else {
      setShowPlanPreview(false);
    }
  }, [isComplete]);

  // Auto-cycle through journey steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % 5);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleLike = (id: number) => {
    setFeedItems(prev => prev.map(feedItem => 
      feedItem.id === id 
        ? { ...feedItem, liked: !feedItem.liked, likes: feedItem.liked ? feedItem.likes - 1 : feedItem.likes + 1 }
        : feedItem
    ));
  };

  const stepLabels = [
    { icon: MessageCircle, label: 'Chat', desc: 'Tell Pepzi your goal' },
    { icon: Sparkles, label: 'Plan', desc: 'Get a custom training plan' },
    { icon: Calendar, label: 'Schedule', desc: 'Auto-fits your calendar' },
    { icon: CheckCircle2, label: 'Track', desc: 'Log progress naturally' },
    { icon: TrendingUp, label: 'Achieve', desc: 'Watch your finish date' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2076&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/50 to-white/80" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 backdrop-blur-xl bg-white/70 rounded-2xl flex items-center justify-center border border-white/80 shadow-sm overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-slate-200/30" />
              <svg viewBox="0 0 40 40" className="w-7 h-7 relative z-10">
                <path d="M6 32 L16 16 L26 32 Z" className="fill-slate-300/80" />
                <path d="M16 16 L13 22 L16 20 L19 22 Z" className="fill-white/90" />
                <path d="M12 32 L24 12 L36 32 Z" className="fill-slate-500" />
                <path d="M24 12 L20 20 L24 17 L28 20 Z" className="fill-white" />
              </svg>
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
              className="px-5 py-2.5 bg-slate-800 rounded-2xl text-white text-sm font-medium hover:bg-slate-700 transition-all shadow-lg"
            >
              Get Started Free
            </Link>
          </div>
        </nav>

        {/* ============================================================ */}
        {/* HERO SECTION - Completely Redesigned */}
        {/* ============================================================ */}
        <section className="px-4 md:px-6 pt-8 md:pt-12 pb-8 max-w-4xl mx-auto">
          {/* Main Value Prop */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/80 rounded-full text-sm text-slate-600 mb-6">
              <Sparkles className="w-4 h-4 text-slate-500" />
              Your personal life coach
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 text-slate-800">
              Any goal.
              <span className="block text-slate-500">A clear finish date.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto">
              Tell Pepzi what you want to achieve. Get a personalized training plan that fits your schedule and see exactly when you'll reach your goal.
            </p>
          </div>

          {/* Interactive Goal Input + Live Preview */}
          <div className="max-w-2xl mx-auto mb-8">
            {/* Chat Input */}
            <GlassCard className="p-2 mb-4" hover={false}>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-4">
                  <div className="flex items-center">
                    <span className="text-slate-600 text-lg">{displayText}</span>
                    <span className="w-0.5 h-6 bg-slate-400 ml-1 animate-pulse" />
                  </div>
                </div>
                <Link
                  href="/signup"
                  className="p-4 bg-slate-800 rounded-2xl text-white hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl flex-shrink-0 hover:scale-105"
                >
                  <Send className="w-5 h-5" />
                </Link>
              </div>
            </GlassCard>

            {/* Live Plan Preview - Animated */}
            <div className={`transition-all duration-500 ${showPlanPreview ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
              <GlassCard className="p-4 border-2 border-slate-200/50" hover={false}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Pepzi creates your plan</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/60 rounded-2xl border border-white/80">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">
                      {currentGoal.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700">{currentGoal.plan}</h4>
                      <p className="text-sm text-slate-400">{currentGoal.duration} • {currentGoal.sessions}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Finish Date</span>
                    </div>
                    <p className="text-lg font-bold text-slate-700">{currentGoal.date}</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Quick Goal Pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {[
              { icon: '🏔️', text: 'Climb a mountain' },
              { icon: '💼', text: 'Get promoted' },
              { icon: '✈️', text: 'Travel 10 countries' },
              { icon: '📖', text: 'Write a novel' },
              { icon: '🎹', text: 'Learn piano' },
              { icon: '💻', text: 'Build a startup' },
            ].map((goal) => (
              <Link
                key={goal.text}
                href="/signup"
                className="inline-flex items-center gap-2 px-4 py-2.5 backdrop-blur-xl bg-white/50 border border-white/80 rounded-full text-sm text-slate-600 hover:bg-white/70 hover:text-slate-800 hover:scale-105 transition-all"
              >
                <span>{goal.icon}</span>
                {goal.text}
              </Link>
            ))}
          </div>

          {/* Stats Row - Now just App Store rating */}
          <div className="flex justify-center">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-2xl md:text-3xl font-bold text-slate-700">
                  <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-amber-400 fill-amber-400" />
                  {stat.value}
                </div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* HOW IT WORKS - With Clear Navigation */}
        {/* ============================================================ */}
        <section className="px-4 md:px-6 py-16 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-700 mb-3">
                See how it works
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto mb-2">
                From goal to achievement in 5 simple steps
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <span>Swipe or click to explore</span>
                <ChevronRight className="w-4 h-4 animate-pulse" />
              </div>
            </div>

            {/* Step Navigation with Labels */}
            <div className="flex justify-center gap-2 md:gap-3 mb-4">
              {stepLabels.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`flex flex-col items-center gap-1.5 px-3 md:px-5 py-3 rounded-2xl transition-all duration-300 ${
                    activeStep === idx 
                      ? 'bg-slate-800 text-white shadow-lg scale-105' 
                      : 'bg-white/60 text-slate-500 hover:bg-white/80 hover:scale-102'
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                  <span className="text-xs font-medium hidden md:block">{step.label}</span>
                </button>
              ))}
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mb-8">
              {stepLabels.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeStep === idx ? 'w-8 bg-slate-600' : 'w-1.5 bg-slate-300'
                  }`}
                />
              ))}
            </div>

            {/* Step Description */}
            <div className="text-center mb-8">
              <p className="text-lg font-medium text-slate-700">
                {stepLabels[activeStep].desc}
              </p>
            </div>

            {/* Journey Display */}
            <div className="relative min-h-[500px] md:min-h-[480px]">
              
              {/* Step 0: Chat Your Goal */}
              <div className={`absolute inset-0 transition-all duration-500 ${
                activeStep === 0 ? 'opacity-100 translate-x-0' : activeStep > 0 ? 'opacity-0 -translate-x-full pointer-events-none' : 'opacity-0 translate-x-full pointer-events-none'
              }`}>
                <div className="max-w-xl mx-auto">
                  <GlassCard className="p-6" hover={false}>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-white">You</span>
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-2xl rounded-tl-md p-4">
                          <p className="text-slate-700">I want to summit Kilimanjaro in August. I work full time and have never done serious hiking. Can you create a training plan?</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/50 border border-white/60 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl rounded-tl-md p-4">
                          <p className="text-slate-600 mb-3">I'll create a complete 6-month training plan for Kilimanjaro! Let me analyze your schedule and build something that fits...</p>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            Creating your personalized plan...
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Floating suggestion chips */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/40">
                      <span className="px-3 py-1.5 bg-white/40 rounded-full text-xs text-slate-500">💡 "Add altitude training"</span>
                      <span className="px-3 py-1.5 bg-white/40 rounded-full text-xs text-slate-500">💡 "Include gear checklist"</span>
                      <span className="px-3 py-1.5 bg-white/40 rounded-full text-xs text-slate-500">💡 "What about nutrition?"</span>
                    </div>
                  </GlassCard>
                </div>
              </div>

              {/* Step 1: AI Creates Plan */}
              <div className={`absolute inset-0 transition-all duration-500 ${
                activeStep === 1 ? 'opacity-100 translate-x-0' : activeStep > 1 ? 'opacity-0 -translate-x-full pointer-events-none' : 'opacity-0 translate-x-full pointer-events-none'
              }`}>
                <div className="max-w-4xl mx-auto">
                  <GlassCard className="p-6" hover={false}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">🏔️</div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-700">Summit Kilimanjaro</h4>
                        <p className="text-slate-400">6 months • 72 sessions • Fits your 9-5</p>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="flex items-center gap-1 text-slate-500 text-sm mb-1">
                          <Sparkles className="w-4 h-4" />
                          Expected Finish
                        </div>
                        <p className="text-2xl font-bold text-slate-700">Aug 15, 2025</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Phase 1 */}
                      <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">1</div>
                          <span className="font-semibold text-slate-700">Base Fitness</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-3">Weeks 1-8</p>
                        <ul className="space-y-2 text-sm text-slate-600">
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Cardio foundation</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Leg strength</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Weekend hikes</li>
                        </ul>
                      </div>

                      {/* Phase 2 */}
                      <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">2</div>
                          <span className="font-semibold text-slate-700">Altitude Prep</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-3">Weeks 9-18</p>
                        <ul className="space-y-2 text-sm text-slate-600">
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Elevation training</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Multi-day hikes</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Gear testing</li>
                        </ul>
                      </div>

                      {/* Phase 3 */}
                      <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">3</div>
                          <span className="font-semibold text-slate-700">Peak & Taper</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-3">Weeks 19-24</p>
                        <ul className="space-y-2 text-sm text-slate-600">
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Summit simulation</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Recovery focus</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-400" /> Final prep</li>
                        </ul>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </div>

              {/* Step 2: Smart Schedule */}
              <div className={`absolute inset-0 transition-all duration-500 ${
                activeStep === 2 ? 'opacity-100 translate-x-0' : activeStep > 2 ? 'opacity-0 -translate-x-full pointer-events-none' : 'opacity-0 translate-x-full pointer-events-none'
              }`}>
                <div className="max-w-4xl mx-auto">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Calendar */}
                    <GlassCard className="p-5" hover={false}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-slate-700">Your Week</h4>
                        <span className="text-xs text-slate-400">Auto-scheduled around your 9-5</span>
                      </div>
                      
                      <div className="space-y-2">
                        {[
                          { day: 'Mon', time: '6:30am', task: '🏃 Morning Run (5K)', status: 'done' },
                          { day: 'Tue', time: '7:00pm', task: '💪 Leg Strength', status: 'done' },
                          { day: 'Wed', time: '6:30am', task: '🏃 Interval Training', status: 'current' },
                          { day: 'Thu', time: '7:00pm', task: '🧘 Recovery Yoga', status: 'upcoming' },
                          { day: 'Sat', time: '8:00am', task: '🥾 Long Hike (15km)', status: 'upcoming', highlight: true },
                        ].map((item, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                              item.status === 'current' ? 'bg-slate-100 ring-2 ring-slate-300' :
                              item.highlight ? 'bg-white/60 border border-slate-200' :
                              item.status === 'done' ? 'bg-white/40 opacity-60' : 'bg-white/40'
                            }`}
                          >
                            <div className="w-10 text-xs font-medium text-slate-500">{item.day}</div>
                            <div className="w-16 text-xs text-slate-400">{item.time}</div>
                            <div className="flex-1 text-sm text-slate-700">{item.task}</div>
                            {item.status === 'done' && <Check className="w-4 h-4 text-slate-400" />}
                            {item.status === 'current' && <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse" />}
                          </div>
                        ))}
                      </div>
                    </GlassCard>

                    {/* Reschedule Demo */}
                    <GlassCard className="p-5" hover={false}>
                      <div className="flex items-center gap-2 mb-4">
                        <Bot className="w-5 h-5 text-slate-500" />
                        <h4 className="font-semibold text-slate-700">Life happens? Just tell me.</h4>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <div className="bg-slate-700 text-white text-sm p-3 rounded-2xl rounded-br-md max-w-[85%]">
                            I have a work dinner Wednesday night
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <div className="bg-white/60 border border-white/60 text-slate-600 text-sm p-3 rounded-2xl rounded-bl-md">
                            <p className="mb-2">Done! Moved your interval training to Thursday morning instead.</p>
                            <div className="flex items-center gap-2 p-2 bg-white/50 rounded-lg text-xs">
                              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-500">Wed 6:30am → Thu 6:30am</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Summit date unchanged</span>
                            <span className="font-semibold text-slate-700">Aug 15 ✓</span>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              </div>

              {/* Step 3: Track Progress */}
              <div className={`absolute inset-0 transition-all duration-500 ${
                activeStep === 3 ? 'opacity-100 translate-x-0' : activeStep > 3 ? 'opacity-0 -translate-x-full pointer-events-none' : 'opacity-0 translate-x-full pointer-events-none'
              }`}>
                <div className="max-w-xl mx-auto">
                  <GlassCard className="p-6" hover={false}>
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/40">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Check className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-700">Long Hike Complete</h4>
                        <p className="text-sm text-slate-400">Week 12, Session 36 • Saturday</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-end">
                        <div className="bg-slate-700 text-white text-sm p-3 rounded-2xl rounded-br-md max-w-[85%]">
                          Just finished! 18km, 1,200m elevation. Legs are burning but feeling strong 💪
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="bg-white/60 border border-white/60 text-slate-600 text-sm p-3 rounded-2xl rounded-bl-md">
                          <p className="mb-3">Amazing! That's your longest hike yet. You're building serious endurance.</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-white/50 rounded-lg">
                              <p className="text-xs text-slate-400">Logged</p>
                              <p className="font-semibold text-slate-700">18km • 1,200m</p>
                            </div>
                            <div className="p-2 bg-white/50 rounded-lg">
                              <p className="text-xs text-slate-400">Progress</p>
                              <p className="font-semibold text-slate-700">50% complete</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </div>

              {/* Step 4: Achievement Dashboard */}
              <div className={`absolute inset-0 transition-all duration-500 ${
                activeStep === 4 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
              }`}>
                <div className="max-w-xl mx-auto">
                  <GlassCard className="p-6" hover={false}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl">🏔️</div>
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-slate-700">Summit Kilimanjaro</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-500 rounded-full" style={{ width: '67%' }} />
                          </div>
                          <span className="text-sm font-semibold text-slate-600">67%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="p-3 bg-white/50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-slate-700">48</p>
                        <p className="text-xs text-slate-400">Sessions done</p>
                      </div>
                      <div className="p-3 bg-white/50 rounded-xl text-center">
                        <p className="text-2xl font-bold text-slate-700">24</p>
                        <p className="text-xs text-slate-400">Remaining</p>
                      </div>
                      <div className="p-3 bg-white/50 rounded-xl text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <span className="text-2xl font-bold text-slate-700">18</span>
                        </div>
                        <p className="text-xs text-slate-400">Day streak</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-slate-100 to-white rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-1">
                            <Sparkles className="w-4 h-4" />
                            <span>Expected Summit Date</span>
                          </div>
                          <p className="text-2xl font-bold text-slate-700">August 15, 2025</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <TrendingUp className="w-4 h-4" />
                            3 days ahead
                          </div>
                          <p className="text-xs text-slate-400 line-through">Original: Aug 18</p>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center mt-8">
              <Link 
                href="/signup" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 rounded-2xl font-semibold text-white hover:bg-slate-700 hover:shadow-xl transition-all hover:scale-105 shadow-lg"
              >
                Start Your Journey
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-sm text-slate-400 mt-3">Free to start • No credit card required</p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* COMMUNITY FEED */}
        {/* ============================================================ */}
        <section className="px-4 md:px-6 py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm text-slate-400 font-medium">Live from the community</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-700">Real people. Real goals. Real results.</h2>
            </div>

            <div className="space-y-4">
              {feedItems.slice(0, 4).map((item) => (
                <TwitterFeedCard key={item.id} item={item} onLike={handleLike} />
              ))}
            </div>

            <div className="text-center mt-10">
              <Link 
                href="/signup" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 rounded-2xl font-semibold text-white hover:bg-slate-700 hover:shadow-xl transition-all shadow-lg"
              >
                Join the Community
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 text-center border-t border-white/40">
          <p className="text-slate-400 text-sm">© 2025 Pepzi. Any goal. A clear finish date.</p>
        </footer>
      </div>
    </div>
  );
}