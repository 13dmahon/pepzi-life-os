import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat';
import goalRoutes from './routes/goals';
import scheduleRoutes from './routes/schedule';
import memoryRoutes from './routes/memory';
import availabilityRoutes from './routes/availability';

dotenv.config();

const app = express();

// CORS Configuration - Dynamic origin checker for Cloud Shell
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like curl, mobile apps)
    if (!origin) return callback(null, true);
    
    // Remove query parameters from origin for matching
    const cleanOrigin = origin.split('?')[0];
    
    // Allowed patterns
    const allowedPatterns = [
      /^https?:\/\/localhost:\d+$/,
      /^https:\/\/3000-cs-291763640218-default\.cs-europe-west1-onse\.cloudshell\.dev$/,
      /^https:\/\/3001-cs-291763640218-default\.cs-europe-west1-onse\.cloudshell\.dev$/,
      /^https:\/\/8080-cs-291763640218-default\.cs-europe-west1-onse\.cloudshell\.dev$/
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(cleanOrigin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/availability', availabilityRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'pepzi-backend',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Pepzi Life OS API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      chat: '/api/chat',
      goals: '/api/goals',
      'goals.from-dreams': '/api/goals/from-dreams',
      'goals.plan': '/api/goals/:id/plan',
      schedule: '/api/schedule',
      'schedule.today': '/api/schedule/today',
      memory: '/api/memory',
      'memory.recent': '/api/memory/recent',
      'memory.search': '/api/memory/search',
      availability: '/api/availability'
    }
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('🚀 Pepzi Backend starting...');
  console.log(`📡 Server running on port ${port}`);
  console.log(`✅ Ready to receive requests`);
  console.log(`💬 Chat: http://localhost:${port}/api/chat`);
  console.log(`🎯 Goals: http://localhost:${port}/api/goals`);
  console.log(`📅 Schedule: http://localhost:${port}/api/schedule`);
  console.log(`🧠 Memory: http://localhost:${port}/api/memory`);
  console.log(`⏰ Availability: http://localhost:${port}/api/availability`);
});