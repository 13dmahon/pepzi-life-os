import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat';
import goalRoutes from './routes/goals';
import scheduleRoutes from './routes/schedule';
import memoryRoutes from './routes/memory';
import availabilityRoutes from './routes/availability';
import aiChatRoutes from './routes/ai-chat';

dotenv.config();

const app = express();

// CORS Configuration - Allow Cloud Run + Cloud Shell + localhost
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedPatterns = [
      /^https?:\/\/localhost:\d+$/,
      /^https:\/\/.*\.cloudshell\.dev$/,
      /^https:\/\/.*\.run\.app$/,
    ];
    
    if (allowedPatterns.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/chat', chatRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/ai-chat', aiChatRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Pepzi Life OS API', version: '1.0.0' });
});

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Pepzi Backend running on port ${port}`);
});