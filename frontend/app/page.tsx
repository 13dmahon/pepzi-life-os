import Link from 'next/link';
import { MessageSquare, Target, Calendar, Sparkles, TrendingUp, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mb-6 animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Welcome to <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Pepzi</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Your AI-powered life operating system. Talk naturally, set goals, track progress, and achieve your dreams.
          </p>
          <Link
            href="/today"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full font-semibold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
          >
            <MessageSquare className="w-6 h-6" />
            Get Started
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <Link href="/today" className="group">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all transform hover:-translate-y-2">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Natural Chat</h3>
              <p className="text-gray-600 leading-relaxed">
                Talk to Pepzi like a friend. "I ran 5km today" or "Book gym time next Tuesday at 6pm"
              </p>
            </div>
          </Link>

          <Link href="/goals" className="group">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all transform hover:-translate-y-2">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Smart Goals</h3>
              <p className="text-gray-600 leading-relaxed">
                Extract goals from your dreams, track micro-milestones, and visualize progress
              </p>
            </div>
          </Link>

          <Link href="/schedule" className="group">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all transform hover:-translate-y-2">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Auto Schedule</h3>
              <p className="text-gray-600 leading-relaxed">
                AI generates your schedule based on goals. Move blocks with natural language
              </p>
            </div>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-8 mt-20 text-center">
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-6 h-6 text-purple-500" />
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                100%
              </div>
            </div>
            <p className="text-gray-600">Natural Language</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-6 h-6 text-blue-500" />
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI-Powered
              </div>
            </div>
            <p className="text-gray-600">OpenAI GPT-4</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-indigo-500" />
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Real-time
              </div>
            </div>
            <p className="text-gray-600">Progress Tracking</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <p className="text-gray-600 mb-4">Ready to transform your life?</p>
          <Link
            href="/today"
            className="inline-flex items-center gap-2 text-purple-600 font-semibold hover:text-purple-700 transition-colors"
          >
            Start now <span className="text-2xl">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}