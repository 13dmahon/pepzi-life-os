# 🧠 Pepzi Life OS

AI-powered Life Operating System with natural language goal tracking, scheduling, and progress monitoring.

## ✨ Live API

**Endpoint:** https://pepzi-backend-1029121217006.us-central1.run.app

**Try it:**
```bash
curl -X POST https://pepzi-backend-1029121217006.us-central1.run.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"550e8400-e29b-41d4-a957-146664440000","message":"I ran 5km today"}'
```

## 🎯 Features

- 🤖 Natural language chat interface
- 🎯 Goal extraction and management
- 📅 Intelligent scheduling
- 📝 Activity logging with micro-goals
- 📊 Real-time progress tracking
- ⏰ Smart time parsing

## 🏗️ Tech Stack

- Node.js + Express + TypeScript
- Supabase (PostgreSQL)
- OpenAI GPT-4
- Google Cloud Run

## 📚 API Endpoints

- `POST /api/chat` - Natural language conversation
- `POST /api/goals` - Create goals
- `POST /api/goals/from-dreams` - Extract goals from text
- `GET /api/schedule` - Get schedule
- `POST /api/schedule` - Create schedule blocks

## 🚀 Quick Start
```bash
git clone https://github.com/13dmahon/pepzi-life-os.git
cd pepzi-life-os/backend
npm install
npm run dev
```

## 👨‍💻 Author

Built by [@13dmahon](https://github.com/13dmahon)

## 📄 License

MIT
