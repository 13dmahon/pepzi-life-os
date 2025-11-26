'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { scheduleAPI } from '@/lib/api';
import { Calendar, Clock, Target, CheckCircle, Circle } from 'lucide-react';


const USER_ID = '550e8400-e29b-41d4-a957-146664440000';

type ScheduleBlock = {
  id: string;
  type: string;
  scheduled_start: string;
  duration_mins: number;
  status: string;
  notes?: string;
  goals?: { name: string };
};

export default function SchedulePage() {
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['schedule', USER_ID],
    queryFn: () => {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      return scheduleAPI.getSchedule(
        USER_ID,
        startOfWeek.toISOString().split('T')[0],
        endOfWeek.toISOString().split('T')[0]
      );
    },
  });

  const blocks: ScheduleBlock[] = scheduleData || [];

  // Group blocks by day
  const blocksByDay: Record<string, ScheduleBlock[]> = {};
  blocks.forEach((block) => {
    const date = new Date(block.scheduled_start).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    if (!blocksByDay[date]) {
      blocksByDay[date] = [];
    }
    blocksByDay[date].push(block);
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-8 pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📅 Your Schedule</h1>
          <p className="text-gray-600">
            Your automatically generated training schedule for this week
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">{blocks.length}</div>
                <div className="text-sm text-gray-600">Sessions This Week</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {blocks.filter((b) => b.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {Math.round(
                    blocks.reduce((sum, b) => sum + b.duration_mins, 0) / 60
                  )}
                  h
                </div>
                <div className="text-sm text-gray-600">Total Hours</div>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule by Day */}
        <div className="space-y-6">
          {Object.keys(blocksByDay).length === 0 && (
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Schedule Yet</h3>
              <p className="text-gray-600 mb-6">
                Generate your weekly schedule from the Goals page to see your training
                blocks here.
              </p>

              <Link
                href="/goals"
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition-colors"
              >
                Go to Goals
              </Link>
            </div>
          )}

          {Object.entries(blocksByDay).map(([day, dayBlocks]) => (
            <div
              key={day}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">{day}</h2>
              <div className="space-y-3">
                {dayBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {block.status === 'completed' ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-gray-600">
                          {new Date(block.scheduled_start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {block.duration_mins} min
                        </span>
                      </div>
                      <div className="font-medium text-gray-900">
                        {block.notes || block.type}
                      </div>
                      {block.goals && (
                        <div className="text-sm text-gray-600 mt-1">
                          <Target className="w-4 h-4 inline mr-1" />
                          {block.goals.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
