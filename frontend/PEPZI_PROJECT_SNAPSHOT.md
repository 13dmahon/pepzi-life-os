./app/chat/page.tsx
./app/goals/page ARCH.tsx
./app/goals/page.tsx
./app/layout.tsx
./app/page.tsx
./app/providers.tsx
./app/schedule/page copy.tsx
./app/schedule/page.tsx
./app/today/page.tsx
./components/AvailabilityModal.tsx
./components/FeasibilityWidget.tsx
./components/goals/AddGoalModal.tsx
./components/goals/GoalDetailView.tsx
./components/Navigation.tsx
./components/schedule/TodaySchedule.tsx
./components/schedule/WeeklyScheduleBoard.tsx
./lib/api copy.ts
./lib/api.ts
./lib/store.ts
./lib/types.ts
./types/index.ts
```

## 📦 Dependencies

### Backend Dependencies
```json
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "cors": "^2.8.5",
    "date-fns": "^3.0.6",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "openai": "^4.24.1"
  },
```

### Frontend Dependencies
```json
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tanstack/react-query": "^5.90.10",
    "axios": "^1.13.2",
    "date-fns": "^4.1.0",
    "framer-motion": "^12.23.24",
    "lucide-react": "^0.554.0",
    "next": "16.0.3",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "zustand": "^5.0.8"
  },
```

## 🔌 API Routes

### Route Files
```
total 148
drwxrwxr-x 2 ascensionfd50 ascensionfd50  4096 Nov 25 00:33 .
drwxrwxr-x 6 ascensionfd50 ascensionfd50  4096 Nov 21 12:22 ..
-rw-rw-r-- 1 ascensionfd50 ascensionfd50  9360 Nov 22 16:20 availability.ts
-rw-rw-r-- 1 ascensionfd50 ascensionfd50  8655 Nov 22 08:45 chat.ts
-rw-rw-r-- 1 ascensionfd50 ascensionfd50 30125 Nov 24 20:53 goals copy.ts
-rw-rw-r-- 1 ascensionfd50 ascensionfd50 37319 Nov 24 23:38 goals.ts
-rw-rw-r-- 1 ascensionfd50 ascensionfd50  3206 Nov 22 08:34 memory.ts
-rw-rw-r-- 1 ascensionfd50 ascensionfd50 12716 Nov 25 00:33 schedule copy.ts
-rw-rw-r-- 1 ascensionfd50 ascensionfd50 21137 Nov 25 20:42 schedule.ts
```

### Endpoints Found
```
=== availability.ts ===
router.post('/extract', async (req: Request, res: Response) => {
router.post('/', async (req: Request, res: Response) => {
router.get('/', async (req: Request, res: Response) => {
router.get('/feasibility', async (req: Request, res: Response) => {

=== chat.ts ===
router.post('/', async (req: Request, res: Response) => {

=== goals copy.ts ===
router.post('/from-dreams', async (req: Request, res: Response) => {
router.post('/conversation', async (req: Request, res: Response) => {
router.post('/', async (req: Request, res: Response) => {
router.post('/:goalId/create-plan-with-milestones', async (req: Request, res: Response) => {
router.get('/', async (req: Request, res: Response) => {
router.delete('/:goalId/plan', async (req: Request, res: Response) => {
router.delete('/:goalId', async (req: Request, res: Response) => {
router.post('/:id/plan', async (req: Request, res: Response) => {
router.post('/:goalId/generate-plan', async (req: Request, res: Response) => {

=== goals.ts ===
router.post('/from-dreams', async (req: Request, res: Response) => {
router.post('/conversation', async (req: Request, res: Response) => {
router.post('/', async (req: Request, res: Response) => {
router.post(
router.get('/', async (req: Request, res: Response) => {
router.delete('/:goalId', async (req: Request, res: Response) => {
router.delete('/:goalId/plan', async (req: Request, res: Response) => {

=== memory.ts ===
router.post('/summarize-week', async (req: Request, res: Response) => {
router.get('/recent', async (req: Request, res: Response) => {
router.post('/search', async (req: Request, res: Response) => {
router.post('/store', async (req: Request, res: Response) => {

=== schedule copy.ts ===
router.get('/', async (req: Request, res: Response) => {
router.get('/today', async (req: Request, res: Response) => {
router.post('/', async (req: Request, res: Response) => {
router.post('/auto-generate', async (req: Request, res: Response) => {
router.patch('/:id/reschedule', async (req: Request, res: Response) => {
router.delete('/:id', async (req: Request, res: Response) => {
router.patch('/:id/complete', async (req: Request, res: Response) => {

=== schedule.ts ===
router.get('/', async (req: Request, res: Response) => {
router.get('/today', async (req: Request, res: Response) => {
router.post('/', async (req: Request, res: Response) => {
router.post('/auto-generate', async (req: Request, res: Response) => {
router.patch('/:id', async (req: Request, res: Response) => {
router.patch('/:id/reschedule', async (req: Request, res: Response) => {
router.delete('/:id', async (req: Request, res: Response) => {
router.patch('/:id/complete', async (req: Request, res: Response) => {

```

## 🎨 Frontend Pages

```
/app/chat/page.tsx
/app/goals/page.tsx
/app/page.tsx
/app/schedule/page.tsx
/app/today/page.tsx
```

## 🔐 Environment Variables (Keys Only)

### Backend .env
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
OPENAI_API_KEY
PORT
NODE_ENV
```

### Frontend .env.local
```
.env.local not found
```

## 🗄 Database Info

### Known Tables
```
- goals
- schedule_blocks
- user_availability
- memories
(Run Supabase dashboard for full schema)
```

## 📝 Git Status

