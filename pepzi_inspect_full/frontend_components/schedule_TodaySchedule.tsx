'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Clock, Check, Trash2, Edit2, Play } from 'lucide-react';
import axios from 'axios';

interface ScheduleBlock {
  id: string;
  type: string;
  scheduled_start: string;
  duration_mins: number;
  status: string;
  notes?: string;
  goals?: { name: string };
}

interface TodayScheduleProps {
  blocks: ScheduleBlock[];
}



const API_BASE_URL = 'https://pepzi-backend-1029121217006.us-central1.run.app';


export default function TodaySchedule({ blocks }: TodayScheduleProps) {
  const queryClient = useQueryClient();

  const completeBlockMutation = useMutation({
    mutationFn: (blockId: string) =>
      axios.patch(`${API_BASE_URL}/api/schedule/${blockId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'today'] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) =>
      axios.delete(`${API_BASE_URL}/api/schedule/${blockId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'today'] });
    },
  });

  const getBlockIcon = (type: string) => {
    const icons: Record<string, string> = {
      running: '🏃',
      workout: '💪',
      activity: '📍',
      meeting: '👥',
      deep_work: '💻',
      practice: '🎯',
    };
    return icons[type] || '📅';
  };

  const getBlockColor = (status: string) => {
    if (status === 'completed') return 'border-green-300 bg-green-50';
    if (status === 'rescheduled') return 'border-orange-300 bg-orange-50';
    return 'border-purple-300 bg-purple-50';
  };

  if (blocks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
          <Clock className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No scheduled blocks today</h3>
        <p className="text-gray-600 text-sm">
          Chat with Pepzi to add activities to your schedule!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => {
        const startTime = new Date(block.scheduled_start);
        const isCompleted = block.status === 'completed';

        return (
          <div
            key={block.id}
            className={`relative border-2 rounded-2xl p-4 transition-all hover:shadow-md ${getBlockColor(
              block.status
            )}`}
          >
            {/* Block Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getBlockIcon(block.type)}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 capitalize">
                    {block.type.replace('_', ' ')}
                  </h3>
                  {block.goals && (
                    <p className="text-xs text-purple-600">{block.goals.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Time & Duration */}
            <div className="flex items-center gap-4 mb-3 text-sm text-gray-700">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{format(startTime, 'h:mm a')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Play className="w-4 h-4" />
                <span>{block.duration_mins} mins</span>
              </div>
            </div>

            {/* Notes */}
            {block.notes && (
              <p className="text-sm text-gray-600 mb-3 italic">{block.notes}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!isCompleted && (
                <button
                  onClick={() => completeBlockMutation.mutate(block.id)}
                  disabled={completeBlockMutation.isPending}
                  className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Complete
                </button>
              )}
              {isCompleted && (
                <div className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                  <Check className="w-4 h-4" />
                  Completed
                </div>
              )}
              <button
                onClick={() => deleteBlockMutation.mutate(block.id)}
                disabled={deleteBlockMutation.isPending}
                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}