import { addDays, addWeeks, addMonths, setDay, parseISO, format } from 'date-fns';

/**
 * Parse natural language time expressions
 * Examples: "next Tuesday", "in 3 months", "tomorrow at 7pm"
 */
export function parseRelativeTime(
  expression: string,
  referenceDate: Date = new Date()
): Date | null {
  const lower = expression.toLowerCase().trim();

  // Tomorrow
  if (lower.includes('tomorrow')) {
    return addDays(referenceDate, 1);
  }

  // Today
  if (lower.includes('today')) {
    return referenceDate;
  }

  // Next [day of week]
  const dayMatch = lower.match(/next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (dayMatch) {
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const targetDay = dayMap[dayMatch[1]];
    return getNextDayOfWeek(referenceDate, targetDay);
  }

  // In X days
  const daysMatch = lower.match(/in (\d+) days?/);
  if (daysMatch) {
    return addDays(referenceDate, parseInt(daysMatch[1]));
  }

  // In X weeks
  const weeksMatch = lower.match(/in (\d+) weeks?/);
  if (weeksMatch) {
    return addWeeks(referenceDate, parseInt(weeksMatch[1]));
  }

  // In X months
  const monthsMatch = lower.match(/in (\d+) months?/);
  if (monthsMatch) {
    return addMonths(referenceDate, parseInt(monthsMatch[1]));
  }

  // "In a few months" - default to 3
  if (lower.includes('in a few months')) {
    return addMonths(referenceDate, 3);
  }

  // "In a few weeks" - default to 2
  if (lower.includes('in a few weeks')) {
    return addWeeks(referenceDate, 2);
  }

  return null;
}

/**
 * Get the next occurrence of a specific day of week
 */
function getNextDayOfWeek(date: Date, targetDay: number): Date {
  const result = new Date(date);
  const currentDay = date.getDay();
  const daysToAdd = (targetDay + 7 - currentDay) % 7 || 7;
  result.setDate(date.getDate() + daysToAdd);
  return result;
}

/**
 * Parse time from text like "at 7pm", "at 14:00"
 */
export function parseTime(expression: string): { hours: number; minutes: number } | null {
  const lower = expression.toLowerCase();

  // Match "7pm", "7:30pm", "19:00"
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const meridiem = timeMatch[3];

  // Convert to 24-hour format
  if (meridiem === 'pm' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
}

/**
 * Combine date and time
 */
export function combineDateAndTime(
  date: Date,
  time: { hours: number; minutes: number }
): Date {
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}
