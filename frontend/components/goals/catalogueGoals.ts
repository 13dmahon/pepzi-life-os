// ============================================
// CATALOGUE GOALS - Prebuilt goals with sessions
// ============================================

export interface CatalogueSession {
  session_number: number;
  name: string;
  description: string;
  duration_mins: number;
  prompt: string;
}

export interface VerificationRequirement {
  icon: 'camera' | 'notes' | 'metric' | 'timer' | 'checklist';
  label: string;
  description: string;
}

export interface CatalogueGoal {
  id: string;
  name: string;
  emoji: string;
  category: string;
  description: string;
  long_description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  total_sessions: number;
  sessions_per_week: number;
  session_duration_mins: number;
  total_weeks: number;
  weekly_sessions: CatalogueSession[];
  tags: string[];
  popular?: boolean;
  what_youll_gain?: string[];
  verification?: VerificationRequirement[];
}

// ============================================
// THE CATALOGUE
// ============================================

export const CATALOGUE_GOALS: CatalogueGoal[] = [
  // ============================================
  // TEST CHALLENGE (for development/testing)
  // ============================================
  {
    id: 'test-challenge',
    name: 'Test Challenge',
    emoji: '🧪',
    category: 'skill',
    description: 'A quick 2-session test challenge to try the full flow — start, complete, and share!',
    long_description: 'This is a quick test challenge designed to walk you through the complete Pepzi experience. Complete two short sessions, log your progress, and share your achievement with the community.',
    difficulty: 'beginner',
    total_sessions: 2,
    sessions_per_week: 2,
    session_duration_mins: 5,
    total_weeks: 1,
    tags: ['test', 'quick', 'demo'],
    popular: true,
    what_youll_gain: [
      'Understand how sessions work',
      'Practice logging notes and photos',
      'Experience the completion flow',
      'Share your first achievement',
    ],
    verification: [
      { icon: 'notes', label: 'Session Notes', description: 'Write a quick note about what you did' },
      { icon: 'camera', label: 'Photo Proof', description: 'Snap a photo of anything nearby' },
      { icon: 'checklist', label: 'Mark Complete', description: 'Hit the complete button when done' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'Session 1: Quick Start',
        description: 'Complete a quick task and log your progress',
        duration_mins: 5,
        prompt: `This is Session {{session_number}} of the Test Challenge ({{total_sessions}} total).
Duration: 5 minutes

This is a test session! Simply:
1. Take a deep breath
2. Write down one thing you're grateful for
3. Do 10 star jumps
4. Take a photo of something nearby
5. Mark as complete!

You're testing the system — have fun with it!`
      },
      {
        session_number: 2,
        name: 'Session 2: Finish Line',
        description: 'Complete the challenge and share your achievement',
        duration_mins: 5,
        prompt: `This is Session {{session_number}} of the Test Challenge ({{total_sessions}} total).
Duration: 5 minutes

Final session! You made it:
1. Do a victory dance (seriously)
2. Write a quick note about the experience
3. Take a celebratory photo
4. Complete this session
5. Share your achievement to the feed!

Challenge complete — you're a champion! 🏆`
      }
    ]
  },

  // ============================================
  // FITNESS
  // ============================================
  {
    id: 'backflip',
    name: 'Learn a Backflip',
    emoji: '🤸',
    category: 'fitness',
    description: 'Master the standing backflip from scratch with progressive training',
    long_description: 'Go from zero acrobatic experience to landing a clean standing backflip. This 8-week programme builds your jump height, tuck speed, and confidence through progressive drills — starting on soft surfaces and working up to solid ground.',
    difficulty: 'advanced',
    total_sessions: 24,
    sessions_per_week: 3,
    session_duration_mins: 45,
    total_weeks: 8,
    tags: ['gymnastics', 'acrobatics', 'strength'],
    popular: true,
    what_youll_gain: [
      'A clean standing backflip',
      'Explosive jump power',
      'Body awareness and air sense',
      'Mental toughness under fear',
    ],
    verification: [
      { icon: 'camera', label: 'Video Your Attempts', description: 'Record your drills and attempts for form review' },
      { icon: 'notes', label: 'Session Notes', description: 'Log what drills you did and how they felt' },
      { icon: 'metric', label: 'Track Jump Height', description: 'Measure your standing jump progress' },
      { icon: 'timer', label: 'Log Duration', description: 'Track your actual training time' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'Foundation & Fear Work',
        description: 'Build jumping power and start backwards rolling drills',
        duration_mins: 45,
        prompt: `This is Session {{session_number}} of my backflip training ({{total_sessions}} total).
Duration: 45 minutes

I'm learning to do a standing backflip. Today's focus is foundation and overcoming fear.

Please give me a structured 45-minute session that includes:
1. Warm-up (jumping, mobility)
2. Backwards rolling progressions on soft surface
3. Jump height drills
4. Mental visualization exercises
5. Cool down

Keep me safe and build my confidence gradually.`
      },
      {
        session_number: 2,
        name: 'Tucking & Rotation',
        description: 'Practice tuck position and rotation mechanics',
        duration_mins: 45,
        prompt: `This is Session {{session_number}} of my backflip training ({{total_sessions}} total).
Duration: 45 minutes

Today's focus is tucking mechanics and rotation speed.

Please give me a structured 45-minute session that includes:
1. Warm-up focused on hip flexors and core
2. Tuck jump drills (knees to chest)
3. Rotation drills on trampoline or soft surface
4. Back drop to tuck practice
5. Strength work for rotation power

I want to understand the feeling of a tight tuck.`
      },
      {
        session_number: 3,
        name: 'Height & Set',
        description: 'Focus on vertical jump and arm swing technique',
        duration_mins: 45,
        prompt: `This is Session {{session_number}} of my backflip training ({{total_sessions}} total).
Duration: 45 minutes

Today's focus is getting maximum height and proper arm swing.

Please give me a structured 45-minute session that includes:
1. Dynamic warm-up
2. Arm swing technique drills
3. Max height jump practice
4. Combining arm swing with tuck timing
5. Video analysis tips for my form

The set (takeoff) is crucial - help me nail it.`
      }
    ]
  },
  {
    id: '10k-steps',
    name: '10K Steps Daily',
    emoji: '👟',
    category: 'fitness',
    description: 'Build the habit of walking 10,000 steps every day',
    long_description: 'Transform your daily movement with a 30-day walking challenge. Build the 10K steps habit through morning walks, lunchtime routes, and evening wind-downs — with strategies to make every step count.',
    difficulty: 'beginner',
    total_sessions: 30,
    sessions_per_week: 7,
    session_duration_mins: 60,
    total_weeks: 5,
    tags: ['walking', 'cardio', 'habit'],
    popular: true,
    what_youll_gain: [
      'A daily walking habit',
      'Improved cardiovascular health',
      'Better mood and energy',
      'Weight management support',
    ],
    verification: [
      { icon: 'metric', label: 'Log Step Count', description: 'Record your daily step total' },
      { icon: 'camera', label: 'Route Photos', description: 'Snap photos from your walks (optional)' },
      { icon: 'notes', label: 'Daily Reflection', description: 'Note how you felt and what worked' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'Morning Walk',
        description: 'Start your day with movement',
        duration_mins: 60,
        prompt: `This is Day {{session_number}} of my 10K steps challenge ({{total_sessions}} days total).

I need to hit 10,000 steps today. Give me:
1. A motivating morning walking routine
2. Tips to make it enjoyable (podcasts, music, routes)
3. How to track progress
4. Ways to add steps throughout the day
5. Evening top-up strategies if I'm behind

Make walking feel like a gift, not a chore.`
      },
      {
        session_number: 2,
        name: 'Lunchtime Steps',
        description: 'Use your lunch break wisely',
        duration_mins: 60,
        prompt: `Day {{session_number}} of 10K steps challenge.

Help me maximize my lunch break for steps:
1. Quick 20-30 min walking routes
2. Walking meeting ideas
3. Stair climbing alternatives
4. Post-lunch energy boost walks
5. Tracking check-in

I want to hit 5K by end of lunch.`
      },
      {
        session_number: 3,
        name: 'Evening Wind-Down Walk',
        description: 'Finish strong and decompress',
        duration_mins: 60,
        prompt: `Day {{session_number}} of 10K steps challenge.

Evening session to hit my target:
1. Relaxing evening walk routine
2. How many steps do I likely need?
3. Mindful walking techniques
4. Sleep benefits of evening walks
5. Celebration for hitting 10K

Help me end the day strong.`
      },
      {
        session_number: 4,
        name: 'Active Day',
        description: 'Build steps into everything',
        duration_mins: 60,
        prompt: `Day {{session_number}} of 10K steps challenge.

Make today an active day:
1. Park further away strategies
2. Take the stairs always
3. Walking phone calls
4. Household chores that add steps
5. Fun ways to sneak in movement

Every step counts!`
      },
      {
        session_number: 5,
        name: 'Weekend Explorer',
        description: 'Make walking an adventure',
        duration_mins: 60,
        prompt: `Day {{session_number}} of 10K steps challenge.

Weekend walking adventure:
1. New route to explore in my area
2. Nature walk options
3. Walking with friends/family ideas
4. Photography walk concept
5. Reward myself for consistency

Make it fun, not a task.`
      },
      {
        session_number: 6,
        name: 'Rest Day Walk',
        description: 'Gentle movement for recovery',
        duration_mins: 60,
        prompt: `Day {{session_number}} of 10K steps challenge.

Gentle rest day approach:
1. Easy pace walking
2. Stretching between walks
3. Listen to your body tips
4. Still hit 10K but gently
5. Recovery mindset

Rest days still count!`
      },
      {
        session_number: 7,
        name: 'Week Review & Push',
        description: 'Celebrate and prepare for next week',
        duration_mins: 60,
        prompt: `Day {{session_number}} of 10K steps challenge - end of week {{week_number}}!

Weekly review:
1. How did this week go?
2. What worked best?
3. Challenges faced
4. Wins to celebrate
5. Plan for next week

You're building a lifelong habit!`
      }
    ]
  },
  {
    id: 'cold-showers',
    name: 'Cold Shower Challenge',
    emoji: '🥶',
    category: 'health',
    description: '30 days of cold showers to build mental toughness',
    long_description: 'Build unshakeable mental toughness through progressive cold exposure. Start with just 30 seconds and work your way up to full cold showers — rewiring your brain to embrace discomfort and boosting your immune system along the way.',
    difficulty: 'intermediate',
    total_sessions: 30,
    sessions_per_week: 7,
    session_duration_mins: 10,
    total_weeks: 5,
    tags: ['mental-toughness', 'health', 'habit'],
    popular: true,
    what_youll_gain: [
      'Mental resilience under discomfort',
      'Improved cold tolerance',
      'Better immune function',
      'Increased dopamine and alertness',
    ],
    verification: [
      { icon: 'timer', label: 'Cold Duration', description: 'Log how many seconds you spent in cold water' },
      { icon: 'notes', label: 'How It Felt', description: 'Rate difficulty and note mental state after' },
      { icon: 'metric', label: 'Temperature Rating', description: 'Rate the water temperature 1-5' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'First Cold Plunge',
        description: 'Start with 30 seconds cold',
        duration_mins: 10,
        prompt: `Day {{session_number}} of Cold Shower Challenge ({{total_sessions}} days).

First cold shower! Guide me through:
1. Mental preparation techniques
2. Breathing before entering
3. Start with 30 seconds cold at end
4. How to control the shock response
5. Warm-up after

This is about building mental strength.`
      },
      {
        session_number: 2,
        name: 'Building Duration',
        description: '45 seconds cold',
        duration_mins: 10,
        prompt: `Day {{session_number}} of Cold Shower Challenge.

Increasing to 45 seconds:
1. Pre-shower breathwork
2. Techniques to stay calm
3. Focus points during cold
4. Benefits I'm getting
5. Progress tracking

I'm getting stronger.`
      },
      {
        session_number: 3,
        name: 'One Minute Mark',
        description: 'Push to 1 full minute',
        duration_mins: 10,
        prompt: `Day {{session_number}} of Cold Shower Challenge.

Today: 1 full minute cold!
1. Mental mantras to use
2. Body scanning during cold
3. Breathing rhythm
4. Celebrate this milestone
5. What's happening in my body

Mind over matter.`
      },
      {
        session_number: 4,
        name: 'Embracing Discomfort',
        description: '1 minute with presence',
        duration_mins: 10,
        prompt: `Day {{session_number}} of Cold Shower Challenge.

1 minute with full presence:
1. Don't resist - accept the cold
2. Find calm within discomfort
3. Gratitude practice during
4. Energy boost after
5. Mental toughness transfer to life

This is meditation under pressure.`
      },
      {
        session_number: 5,
        name: '90 Second Push',
        description: 'Extend to 90 seconds',
        duration_mins: 10,
        prompt: `Day {{session_number}} of Cold Shower Challenge.

Pushing to 90 seconds:
1. Progressive exposure technique
2. Cold adaptation signs
3. Breathing mastery
4. Mental resilience building
5. Recovery optimization

You're becoming cold-adapted.`
      },
      {
        session_number: 6,
        name: 'Full 2 Minutes',
        description: 'The real challenge begins',
        duration_mins: 10,
        prompt: `Day {{session_number}} of Cold Shower Challenge.

2 full minutes today:
1. This is where growth happens
2. Wim Hof breathing prep
3. Finding your edge
4. Dopamine and norepinephrine benefits
5. You're in the top 1%

Most people quit. You won't.`
      },
      {
        session_number: 7,
        name: 'Week 1 Complete',
        description: 'Reflect and prepare',
        duration_mins: 10,
        prompt: `Day {{session_number}} of Cold Shower Challenge - Week {{week_number}} done!

Weekly reflection:
1. How has your tolerance changed?
2. Mental benefits noticed
3. Energy level changes
4. Sleep improvements
5. Ready for week 2

You did what most never will.`
      }
    ]
  },

  // ============================================
  // LEARNING
  // ============================================
  {
    id: 'learn-guitar',
    name: 'Learn Guitar Basics',
    emoji: '🎸',
    category: 'music',
    description: 'Play your first 5 songs in 12 weeks',
    long_description: 'Pick up a guitar and go from knowing nothing to playing real songs. Learn chords, strumming patterns, and transitions through structured practice sessions — with your first song attempt by week one.',
    difficulty: 'beginner',
    total_sessions: 36,
    sessions_per_week: 3,
    session_duration_mins: 30,
    total_weeks: 12,
    tags: ['music', 'instrument', 'creative'],
    popular: true,
    what_youll_gain: [
      'Play 5 complete songs',
      'Know all basic open chords',
      'Confident strumming patterns',
      'Ability to learn new songs independently',
    ],
    verification: [
      { icon: 'camera', label: 'Record Practice', description: 'Video yourself playing for form feedback' },
      { icon: 'notes', label: 'Practice Log', description: 'Note which chords/songs you worked on' },
      { icon: 'timer', label: 'Practice Duration', description: 'Log your actual practice time' },
      { icon: 'metric', label: 'Chord Speed', description: 'Track chord transition speed (changes/min)' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'First Chords',
        description: 'Learn Em and G chords',
        duration_mins: 30,
        prompt: `Session {{session_number}} of Learn Guitar ({{total_sessions}} sessions).
Duration: 30 minutes

I'm a complete beginner. Today: first chords!

Please give me:
1. Proper posture and guitar holding
2. How to read chord diagrams
3. Em chord - finger placement
4. G chord - finger placement  
5. Switching between them slowly
6. Simple strumming pattern

Keep it encouraging - this is day 1!`
      },
      {
        session_number: 2,
        name: 'Adding C Chord',
        description: 'Third chord and transitions',
        duration_mins: 30,
        prompt: `Session {{session_number}} of Learn Guitar.

Building on Em and G, adding C chord:
1. Warm up with Em and G
2. C chord finger placement
3. Common mistakes to avoid
4. Transition exercises: G to C
5. Simple 3-chord progression
6. First mini song attempt

I'm getting calluses!`
      },
      {
        session_number: 3,
        name: 'First Song Attempt',
        description: 'Put it together with a real song',
        duration_mins: 30,
        prompt: `Session {{session_number}} of Learn Guitar.

Time to play a real song with Em, G, C:
1. Song suggestions (easy 3-chord songs)
2. How to read/follow a chord chart
3. Strumming pattern for the song
4. Practice sections slowly
5. Put it all together
6. Record yourself tip

This is why we practice!`
      }
    ]
  },
  {
    id: 'spanish-basics',
    name: 'Spanish in 90 Days',
    emoji: '🇪🇸',
    category: 'languages',
    description: 'Conversational Spanish in 90 days',
    long_description: 'Go from zero to holding basic conversations in Spanish. Daily 20-minute sessions build your vocabulary, grammar, and confidence through practical scenarios — from ordering food to talking about your family.',
    difficulty: 'beginner',
    total_sessions: 90,
    sessions_per_week: 7,
    session_duration_mins: 20,
    total_weeks: 13,
    tags: ['language', 'spanish', 'communication'],
    what_youll_gain: [
      'Order food and drinks confidently',
      'Introduce yourself and chat about family',
      'Ask questions and understand answers',
      'Navigate common travel situations',
    ],
    verification: [
      { icon: 'notes', label: 'New Words Learned', description: 'List the new vocabulary from each session' },
      { icon: 'camera', label: 'Speaking Practice', description: 'Record yourself speaking Spanish (optional)' },
      { icon: 'metric', label: 'Words Known', description: 'Track your growing vocabulary count' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'Greetings & Basics',
        description: 'Hello, goodbye, please, thank you',
        duration_mins: 20,
        prompt: `Day {{session_number}} of Spanish in 90 Days.

First day! Teach me:
1. Hola, adiós, buenos días/tardes/noches
2. Por favor, gracias, de nada
3. Me llamo... / ¿Cómo te llamas?
4. Pronunciation tips
5. Practice sentences
6. Quick quiz

Make it stick in my brain!`
      },
      {
        session_number: 2,
        name: 'Numbers 1-20',
        description: 'Count like a native',
        duration_mins: 20,
        prompt: `Day {{session_number}} of Spanish in 90 Days.

Numbers today:
1. 1-10 with pronunciation
2. 11-20 
3. Number patterns
4. Practice counting objects
5. Age: Tengo __ años
6. Quick number quiz

Numbers are everywhere - master them!`
      },
      {
        session_number: 3,
        name: 'Common Verbs',
        description: 'Ser, estar, tener basics',
        duration_mins: 20,
        prompt: `Day {{session_number}} of Spanish in 90 Days.

Essential verbs:
1. Ser (to be - permanent)
2. Estar (to be - temporary)
3. Tener (to have)
4. Yo, tú, él/ella forms
5. Simple sentences with each
6. When to use ser vs estar

These 3 verbs = 50% of Spanish!`
      },
      {
        session_number: 4,
        name: 'Restaurant Spanish',
        description: 'Order food confidently',
        duration_mins: 20,
        prompt: `Day {{session_number}} of Spanish in 90 Days.

Restaurant vocabulary:
1. La cuenta, por favor
2. Quiero / Quisiera...
3. Common food words
4. Drinks vocabulary
5. Roleplay: ordering a meal
6. Cultural tips

You'll use this on vacation!`
      },
      {
        session_number: 5,
        name: 'Questions',
        description: '¿Qué? ¿Dónde? ¿Cuándo?',
        duration_mins: 20,
        prompt: `Day {{session_number}} of Spanish in 90 Days.

Question words:
1. ¿Qué? (What?)
2. ¿Dónde? (Where?)
3. ¿Cuándo? (When?)
4. ¿Por qué? (Why?)
5. ¿Cómo? (How?)
6. Practice asking questions

Questions = conversations!`
      },
      {
        session_number: 6,
        name: 'Family Words',
        description: 'Madre, padre, hermano...',
        duration_mins: 20,
        prompt: `Day {{session_number}} of Spanish in 90 Days.

Family vocabulary:
1. Immediate family words
2. Extended family
3. Mi familia es...
4. Describing family members
5. Practice sentences
6. Talk about YOUR family

Personal connection helps memory!`
      },
      {
        session_number: 7,
        name: 'Week 1 Review',
        description: 'Consolidate everything',
        duration_mins: 20,
        prompt: `Day {{session_number}} of Spanish in 90 Days - Week {{week_number}} complete!

Review session:
1. Quick-fire greetings
2. Count to 20
3. Use ser, estar, tener
4. Order imaginary food
5. Ask 5 questions
6. Describe your family

You know more Spanish than 90% of people!`
      }
    ]
  },

  // ============================================
  // PRODUCTIVITY / HABITS
  // ============================================
  {
    id: 'screen-time',
    name: 'Screen Time Under 2hrs',
    emoji: '📱',
    category: 'mental_health',
    description: '30 days to break phone addiction',
    long_description: 'Take back your attention in 30 days. Through daily audits, notification detoxes, and replacement activities, you\'ll go from mindless scrolling to intentional phone use — reclaiming hours of your day.',
    difficulty: 'intermediate',
    total_sessions: 30,
    sessions_per_week: 7,
    session_duration_mins: 15,
    total_weeks: 5,
    tags: ['digital-detox', 'focus', 'habit'],
    popular: true,
    what_youll_gain: [
      'Screen time under 2 hours daily',
      'Better focus and attention span',
      'Healthier relationship with technology',
      'More time for meaningful activities',
    ],
    verification: [
      { icon: 'camera', label: 'Screenshot Screen Time', description: 'Share your daily screen time stats' },
      { icon: 'metric', label: 'Hours Logged', description: 'Record your total screen time each day' },
      { icon: 'notes', label: 'Reflection', description: 'Note what was hard and what helped' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'Awareness Day',
        description: 'Track and understand your usage',
        duration_mins: 15,
        prompt: `Day {{session_number}} of Screen Time Challenge ({{total_sessions}} days).

Today is awareness day:
1. Check your current screen time stats
2. Which apps take most time?
3. When do you mindlessly scroll?
4. Set up tracking/limits
5. No judgment - just data
6. Set intention for tomorrow

You can't change what you don't measure.`
      },
      {
        session_number: 2,
        name: 'Morning Phone-Free',
        description: 'First hour without phone',
        duration_mins: 15,
        prompt: `Day {{session_number}} of Screen Time Challenge.

Morning phone-free hour:
1. Put phone in another room overnight
2. Morning routine without phone
3. What to do instead (journal, stretch, breakfast)
4. How it feels
5. Check phone AFTER 1 hour
6. Notice the difference

Win the morning, win the day.`
      },
      {
        session_number: 3,
        name: 'App Audit',
        description: 'Delete what doesn\'t serve you',
        duration_mins: 15,
        prompt: `Day {{session_number}} of Screen Time Challenge.

App deletion day:
1. List apps you opened yesterday
2. Which ones add value?
3. Which ones steal time?
4. Delete or hide time-wasters
5. Reorganize home screen
6. Add friction to bad apps

Your phone should be a tool, not a slot machine.`
      },
      {
        session_number: 4,
        name: 'Notification Detox',
        description: 'Turn off the noise',
        duration_mins: 15,
        prompt: `Day {{session_number}} of Screen Time Challenge.

Notification audit:
1. Check notification settings
2. Turn off ALL non-essential
3. Keep only: calls, texts, calendar
4. No social media notifications
5. No news notifications
6. Feel the peace

Notifications are other people's priorities.`
      },
      {
        session_number: 5,
        name: 'Replacement Activities',
        description: 'What to do instead',
        duration_mins: 15,
        prompt: `Day {{session_number}} of Screen Time Challenge.

Building alternatives:
1. List 10 things you enjoy (not on phone)
2. Keep a book nearby
3. Have a hobby ready
4. Go-to boredom activities
5. Social alternatives
6. Evening wind-down without screens

Boredom is not an emergency.`
      },
      {
        session_number: 6,
        name: 'Social Media Boundaries',
        description: 'Set strict limits',
        duration_mins: 15,
        prompt: `Day {{session_number}} of Screen Time Challenge.

Social media rules:
1. Set 30-min daily limit per app
2. Specific times only (e.g., 12pm and 6pm)
3. No scrolling in bed
4. Unfollow accounts that don't add value
5. Turn off infinite scroll (if possible)
6. Notice how you feel after using

Is this making your life better?`
      },
      {
        session_number: 7,
        name: 'Week 1 Celebration',
        description: 'Review your progress',
        duration_mins: 15,
        prompt: `Day {{session_number}} of Screen Time Challenge - Week {{week_number}} done!

Weekly review:
1. Compare screen time to Day 1
2. What worked?
3. What was hard?
4. Benefits noticed
5. Strategies for next week
6. Celebrate your wins!

You're taking back your attention.`
      }
    ]
  },
  {
    id: 'meditation-60',
    name: '60-Day Meditation',
    emoji: '🧘',
    category: 'mental_health',
    description: 'Build an unshakeable meditation practice',
    long_description: 'Develop a bulletproof daily meditation habit over 60 days. Start with just 5 minutes of breathing and progress through body scans, loving kindness, walking meditation, and advanced techniques.',
    difficulty: 'beginner',
    total_sessions: 60,
    sessions_per_week: 7,
    session_duration_mins: 15,
    total_weeks: 9,
    tags: ['mindfulness', 'calm', 'focus'],
    what_youll_gain: [
      'A consistent daily meditation practice',
      'Reduced stress and anxiety',
      'Improved focus and clarity',
      'Better emotional regulation',
    ],
    verification: [
      { icon: 'timer', label: 'Meditation Duration', description: 'Log how many minutes you sat' },
      { icon: 'notes', label: 'Post-Sit Reflection', description: 'Note your mental state and any insights' },
      { icon: 'metric', label: 'Calm Rating', description: 'Rate your calm level 1-5 after each sit' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'First Sit',
        description: '5 minutes of breathing',
        duration_mins: 15,
        prompt: `Day {{session_number}} of 60-Day Meditation.

Your first meditation:
1. Find a quiet spot
2. Set timer for 5 minutes
3. Sit comfortably
4. Focus on breath
5. When mind wanders, return to breath
6. No judgment

That's it. You meditated. 🎉`
      },
      {
        session_number: 2,
        name: 'Body Scan',
        description: 'Awareness of physical sensations',
        duration_mins: 15,
        prompt: `Day {{session_number}} of 60-Day Meditation.

Body scan practice:
1. 7 minutes today
2. Start at top of head
3. Slowly move attention down
4. Notice sensations without changing
5. Feet to head, then reverse
6. End with whole body awareness

Connecting mind and body.`
      },
      {
        session_number: 3,
        name: 'Counting Breaths',
        description: 'Simple focus technique',
        duration_mins: 15,
        prompt: `Day {{session_number}} of 60-Day Meditation.

Counting meditation:
1. 8 minutes
2. Count each exhale: 1, 2, 3... up to 10
3. Start over at 10
4. If you lose count, start at 1
5. Notice patterns of distraction
6. Gentle return each time

The practice IS the returning.`
      },
      {
        session_number: 4,
        name: 'Loving Kindness',
        description: 'Cultivate compassion',
        duration_mins: 15,
        prompt: `Day {{session_number}} of 60-Day Meditation.

Loving kindness (Metta):
1. 10 minutes
2. Start with yourself: "May I be happy, healthy, safe"
3. Extend to someone you love
4. Extend to a neutral person
5. Extend to someone difficult
6. Extend to all beings

This one changes your brain.`
      },
      {
        session_number: 5,
        name: 'Observing Thoughts',
        description: 'Watching the mind',
        duration_mins: 15,
        prompt: `Day {{session_number}} of 60-Day Meditation.

Thought observation:
1. 10 minutes
2. Don't follow thoughts
3. Label them: "thinking", "planning", "remembering"
4. Watch them pass like clouds
5. You are the sky, not the clouds
6. Return to breath between

You are not your thoughts.`
      },
      {
        session_number: 6,
        name: 'Walking Meditation',
        description: 'Mindfulness in motion',
        duration_mins: 15,
        prompt: `Day {{session_number}} of 60-Day Meditation.

Walking meditation:
1. Find a short path (10-20 steps)
2. Walk very slowly
3. Feel each part of the step
4. Lifting, moving, placing
5. Turn mindfully at end
6. 10 minutes total

Meditation isn't just sitting.`
      },
      {
        session_number: 7,
        name: 'Week Review',
        description: 'Reflect on your practice',
        duration_mins: 15,
        prompt: `Day {{session_number}} of 60-Day Meditation - Week {{week_number}} complete!

Weekly reflection (after 10 min sit):
1. What technique worked best?
2. When was it hardest?
3. Any changes in daily life?
4. Sleep quality?
5. Stress response?
6. Commitment for next week

You're rewiring your brain. Keep going.`
      }
    ]
  },

  // ============================================
  // READING
  // ============================================
  {
    id: 'read-12-books',
    name: 'Read 12 Books',
    emoji: '📚',
    category: 'reading',
    description: 'One book per month for a year',
    long_description: 'Build a powerful reading habit with 4 sessions per week. Each session combines focused reading with reflection — so you don\'t just consume books, you absorb their lessons and apply them to your life.',
    difficulty: 'intermediate',
    total_sessions: 52,
    sessions_per_week: 4,
    session_duration_mins: 30,
    total_weeks: 13,
    tags: ['reading', 'learning', 'growth'],
    what_youll_gain: [
      'Read 12+ books in a year',
      'Better retention and comprehension',
      'A consistent reading habit',
      'Applied knowledge from what you read',
    ],
    verification: [
      { icon: 'notes', label: 'Session Summary', description: 'Write a 1-sentence summary of what you read' },
      { icon: 'metric', label: 'Pages Read', description: 'Track pages or chapters completed' },
      { icon: 'timer', label: 'Reading Time', description: 'Log your actual reading duration' },
    ],
    weekly_sessions: [
      {
        session_number: 1,
        name: 'Reading Session',
        description: '30 minutes of focused reading',
        duration_mins: 30,
        prompt: `Reading Session {{session_number}} of {{total_sessions}}.

30-minute reading block:
1. Remove all distractions
2. Set timer for 30 minutes
3. Read actively - highlight, note
4. When done, write 1 sentence summary
5. Note any questions that arose
6. What surprised you?

Books are compressed wisdom. Absorb it.`
      },
      {
        session_number: 2,
        name: 'Reading Session',
        description: '30 minutes of focused reading',
        duration_mins: 30,
        prompt: `Reading Session {{session_number}} of {{total_sessions}}.

Continue your book:
1. Quick recall: what happened last session?
2. Set your 30-minute timer
3. Immerse yourself
4. Notice themes emerging
5. Connect to your own life
6. 1-sentence summary

Every page is progress.`
      },
      {
        session_number: 3,
        name: 'Reading Session',
        description: '30 minutes of focused reading',
        duration_mins: 30,
        prompt: `Reading Session {{session_number}} of {{total_sessions}}.

Deep reading today:
1. Recall last session
2. 30 minutes focused
3. If fiction: character motivations
4. If non-fiction: key arguments
5. What would you tell someone about this?
6. Keep going!

Reading compounds over time.`
      },
      {
        session_number: 4,
        name: 'Reading & Reflection',
        description: 'Read and process',
        duration_mins: 30,
        prompt: `Reading Session {{session_number}} of {{total_sessions}}.

End of reading week:
1. 20 minutes reading
2. 10 minutes reflection
3. What have you learned so far?
4. How does it apply to your life?
5. Would you recommend it?
6. Pace check: on track for monthly finish?

Reflection turns reading into growth.`
      }
    ]
  }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getCatalogueGoalById(id: string): CatalogueGoal | undefined {
  return CATALOGUE_GOALS.find(g => g.id === id);
}

export function getCatalogueGoalsByCategory(category: string): CatalogueGoal[] {
  return CATALOGUE_GOALS.filter(g => g.category === category);
}

export function getPopularCatalogueGoals(): CatalogueGoal[] {
  return CATALOGUE_GOALS.filter(g => g.popular);
}

export function generateSessionPrompt(
  session: CatalogueSession,
  sessionNumber: number,
  totalSessions: number,
  weekNumber: number
): string {
  return session.prompt
    .replace(/\{\{session_number\}\}/g, sessionNumber.toString())
    .replace(/\{\{total_sessions\}\}/g, totalSessions.toString())
    .replace(/\{\{week_number\}\}/g, weekNumber.toString());
}

export function getWeekSessions(goal: CatalogueGoal, weekNumber: number): CatalogueSession[] {
  const startSessionNumber = (weekNumber - 1) * goal.sessions_per_week + 1;
  return goal.weekly_sessions.map((session, index) => ({
    ...session,
    session_number: startSessionNumber + index,
  }));
}