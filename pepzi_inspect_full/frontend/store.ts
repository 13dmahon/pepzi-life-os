import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserStore {
  userId: string;
  setUserId: (id: string) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      userId: '550e8400-e29b-41d4-a957-146664440000', // Default test user
      setUserId: (id) => set({ userId: id }),
    }),
    {
      name: 'pepzi-user-storage',
    }
  )
);
