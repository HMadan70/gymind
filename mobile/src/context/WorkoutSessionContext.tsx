// src/context/WorkoutSessionContext.tsx
//
// Minimal cross-tab state: just enough for Home's Workout CTA card to show
// "Start" vs "Resume" and the live elapsed time, per Design2/README.md's
// Home spec. PROJECT_STATUS.md's roadmap defers a real state-management
// decision (Context vs Zustand/Redux) until "the app has enough shared
// state to justify it" - this is exactly that trigger, but the need is
// narrow (one screen reading what another screen is doing), so this adds
// one small context rather than pulling in a store for the whole app.
// workout.tsx's own session state (hasStarted/isRunning/elapsedSeconds) is
// unchanged and remains the source of truth; it only publishes into this
// context via a sync effect.
import React, { createContext, useContext, useMemo, useState } from "react";

type WorkoutSessionState = {
  hasStarted: boolean;
  isRunning: boolean;
  elapsedSeconds: number;
};

type WorkoutSessionContextValue = WorkoutSessionState & {
  setSession: (state: WorkoutSessionState) => void;
};

const WorkoutSessionContext = createContext<WorkoutSessionContextValue | undefined>(undefined);

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkoutSessionState>({
    hasStarted: false,
    isRunning: false,
    elapsedSeconds: 0,
  });

  const value = useMemo(
    () => ({ ...state, setSession: setState }),
    [state]
  );

  return <WorkoutSessionContext.Provider value={value}>{children}</WorkoutSessionContext.Provider>;
}

export function useWorkoutSession() {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) throw new Error("useWorkoutSession must be used inside a WorkoutSessionProvider");
  return ctx;
}
