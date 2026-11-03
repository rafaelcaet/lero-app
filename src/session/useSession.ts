"use client";

import { useSyncExternalStore } from "react";
import type { Session, SessionState } from "./Session";

export function useSessionState(session: Session): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}
