'use client';

import { useState } from 'react';
import { Calendar, Clock, Check, ArrowRight, ChevronLeft } from 'lucide-react';

interface ScheduleSelection {
  days: string[];
  preferredTime: 'morning' | 'afternoon' | 'evening';
  specificTimes: Record<string, string>;
}

interface QuickSchedulePickerProps {
  sessionsPerWeek: number;
  sessionDurationMins: number;
  goalName: string;
  onConfirm: (schedule: ScheduleSelection) => void;
  onSkip: () => void;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const TIME_PRESETS = {
  morning: { label: 'Morning', times: ['6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM'] },
  afternoon: { label: 'Afternoon', times: ['12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM'] },
  evening: { label: 'Evening', times: ['5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM'] },
};

function convertTo24Hour(time12: string): string {
  const [time, modifier] = time12.split(' ');
  let [hours, minutes] = time.split(':');
  let hoursNum = parseInt(hours, 10);
  
  if (modifier === 'PM' && hoursNum !== 12) {
    hoursNum += 12;
  } else if (modifier === 'AM' && hoursNum === 12) {
    hoursNum = 0;
  }
  
  return `${hoursNum.toString().padStart(2, '0')}:${minutes}`;
}

export default function QuickSchedulePicker({
  sessionsPerWeek,
  sessionDurationMins,
  goalName,
  onConfirm,
  onSkip,
}: QuickSchedulePickerProps) {
  const [step, setStep] = useState<'days' | 'times'>('days');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState<'morning' | 'afternoon' | 'evening'>('evening');
  const [specificTimes, setSpecificTimes] = useState<Record<string, string>>({});

  // Get today's day name
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[today.getDay()];

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
      const newTimes = { ...specificTimes };
      delete newTimes[day.toLowerCase()];
      setSpecificTimes(newTimes);
    } else if (selectedDays.length < sessionsPerWeek) {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const setTimeForDay = (day: string, time: string) => {
    setSpecificTimes({
      ...specificTimes,
      [day.toLowerCase()]: convertTo24Hour(time),
    });
  };

  const handleContinueToTimes = () => {
    if (selectedDays.length === sessionsPerWeek) {
      // Set default times for all selected days
      const defaultTimes: Record<string, string> = {};
      const defaultTime = TIME_PRESETS[preferredTime].times[Math.floor(TIME_PRESETS[preferredTime].times.length / 2)];
      selectedDays.forEach(day => {
        defaultTimes[day.toLowerCase()] = convertTo24Hour(defaultTime);
      });
      setSpecificTimes(defaultTimes);
      setStep('times');
    }
  };

  const handleConfirm = () => {
    onConfirm({
      days: selectedDays.map(d => d.toLowerCase()),
      preferredTime,
      specificTimes,
    });
  };

  const canProceed = selectedDays.length === sessionsPerWeek;
  const allTimesSet = selectedDays.every(day => specificTimes[day.toLowerCase()]);

  // Sort selected days by week order
  const sortedSelectedDays = [...selectedDays].sort(
    (a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b)
  );

  if (step === 'days') {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Pick your {sessionsPerWeek} days</h3>
          <p className="text-sm text-slate-500 mt-1">
            {sessionDurationMins} min sessions for "{goalName}"
          </p>
        </div>

        {/* Day selector */}
        <div className="grid grid-cols-7 gap-1 mb-6">
          {ALL_DAYS.map((day) => {
            const isSelected = selectedDays.includes(day);
            const isToday = day === todayName;
            const isDisabled = !isSelected && selectedDays.length >= sessionsPerWeek;

            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                disabled={isDisabled}
                className={`
                  py-3 rounded-xl text-xs font-medium transition-all relative
                  ${isSelected 
                    ? 'bg-slate-800 text-white shadow-lg' 
                    : isDisabled
                      ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }
                `}
              >
                {SHORT_DAYS[day]}
                {isToday && (
                  <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selection count */}
        <div className="text-center mb-4">
          <p className={`text-sm font-medium ${canProceed ? 'text-emerald-600' : 'text-slate-500'}`}>
            {selectedDays.length} of {sessionsPerWeek} days selected
            {canProceed && ' ✓'}
          </p>
        </div>

        {/* Preferred time quick select */}
        <div className="mb-6">
          <p className="text-xs text-slate-500 mb-2 text-center">I prefer to train in the:</p>
          <div className="flex gap-2">
            {(Object.keys(TIME_PRESETS) as Array<keyof typeof TIME_PRESETS>).map((timeKey) => (
              <button
                key={timeKey}
                onClick={() => setPreferredTime(timeKey)}
                className={`
                  flex-1 py-2 rounded-xl text-sm font-medium transition-all
                  ${preferredTime === timeKey
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }
                `}
              >
                {TIME_PRESETS[timeKey].label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 py-3 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
          >
            Skip, auto-schedule
          </button>
          <button
            onClick={handleContinueToTimes}
            disabled={!canProceed}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Times step
  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
      <button
        onClick={() => setStep('days')}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to days
      </button>

      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6 text-slate-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Set your times</h3>
        <p className="text-sm text-slate-500 mt-1">
          Fine-tune when you'll train each day
        </p>
      </div>

      {/* Time pickers for each day */}
      <div className="space-y-3 mb-6">
        {sortedSelectedDays.map((day) => {
          const currentTime = specificTimes[day.toLowerCase()];
          const isToday = day === todayName;

          return (
            <div
              key={day}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">{day}</span>
                {isToday && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    Today
                  </span>
                )}
              </div>
              <select
                value={currentTime ? TIME_PRESETS[preferredTime].times.find(t => convertTo24Hour(t) === currentTime) || '' : ''}
                onChange={(e) => setTimeForDay(day, e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {TIME_PRESETS[preferredTime].times.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Preview */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-6">
        <p className="text-emerald-800 text-sm text-center">
          <span className="font-semibold">Your schedule:</span>{' '}
          {sortedSelectedDays.map((day, i) => (
            <span key={day}>
              {SHORT_DAYS[day]}
              {i < sortedSelectedDays.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={handleConfirm}
        disabled={!allTimesSet}
        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        <Check className="w-5 h-5" />
        Confirm & Create Account
      </button>
    </div>
  );
}