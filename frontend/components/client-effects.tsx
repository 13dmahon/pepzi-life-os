'use client';

import { ReactNode } from 'react';
import { usePendingGoal } from '@/lib/use-pending-goal';
import PlanReadyModal from '@/components/PlanReadyModal';

/**
 * ClientEffects - Handles client-side effects that need to run after auth
 * 
 * Currently handles:
 * - Processing pending goals from homepage signup flow
 * - Showing the "Plan Ready" modal after goal is created
 */
export function ClientEffects({ children }: { children: ReactNode }) {
  const { planReadyData, dismissPlanReady, isProcessing } = usePendingGoal();
  
  return (
    <>
      {children}
      
      {/* Plan Ready Modal - shows after signup with pending goal */}
      {planReadyData && (
        <PlanReadyModal
          isOpen={true}
          onClose={dismissPlanReady}
          goalName={planReadyData.goalName}
          goalIcon={planReadyData.goalIcon}
          firstSessionDay={planReadyData.firstSessionDay}
          firstSessionTime={planReadyData.firstSessionTime}
          sessionDuration={planReadyData.sessionDuration}
          totalWeeks={planReadyData.totalWeeks}
          sessionsPerWeek={planReadyData.sessionsPerWeek}
        />
      )}
    </>
  );
}