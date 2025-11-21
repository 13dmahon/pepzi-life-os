import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat';
import goalRoutes from './routes/goals';
import scheduleRoutes from './routes/schedule';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/schedule', scheduleRoutes);

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
      'schedule.today': '/api/schedule/today'
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
});
