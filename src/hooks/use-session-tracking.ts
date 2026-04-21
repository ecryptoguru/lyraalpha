"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClientLogger } from "@/lib/logger/client";

const logger = createClientLogger("session-tracking");

interface UseSessionTrackingOptions {
  /** Interval in ms for heartbeat (default: 30000 = 30s) */
  heartbeatInterval?: number;
  /** Paths to track (default: all) */
  trackPaths?: string[];
  /** Authenticated user id from a trusted parent layout */
  userId?: string | null;
}

interface SessionState {
  sessionId: string | null;
  isTracking: boolean;
}

/**
 * Hook for tracking user sessions and activity
 * - Starts a session on mount
 * - Sends heartbeat every 30 seconds
 * - Tracks page views automatically
 * - Ends session on unmount
 * 
 * Uses refs for values that don't need to trigger re-renders.
 * Reads `userId` from a trusted parent so tracking does not depend on Clerk client context.
 */
export function useSessionTracking(options: UseSessionTrackingOptions = {}) {
  const { heartbeatInterval = 30000, trackPaths, userId } = options;
  const pathname = usePathname();

  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: null,
    isTracking: false,
  });
  
  // Use refs for values needed in effects without causing re-renders
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const currentPathRef = useRef<string>("");
  const isUnmountedRef = useRef(false);
  const pendingPageViewPathRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionState.sessionId;
  }, [sessionState.sessionId]);

  useEffect(() => {
    userIdRef.current = userId ?? null;
  }, [userId]);

  // Track when component unmounts
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  const startSession = async () => {
    if (!userIdRef.current) return;
    
    try {
      const res = await fetch("/api/user/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          deviceInfo: navigator.userAgent,
          ipAddress: null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.sessionId && !isUnmountedRef.current) {
        setSessionState({ sessionId: data.sessionId, isTracking: true });
      }
    } catch {
      // Non-fatal - session tracking failure is silent
    }
  };

  const sendHeartbeat = async () => {
    if (!sessionIdRef.current || !userIdRef.current) return;
    
    try {
      await fetch("/api/user/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId: sessionIdRef.current,
        }),
      });
    } catch {
      // Non-fatal
    }
  };

  const trackEvent = async (
    eventType: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!userIdRef.current) return;
    
    try {
      await fetch("/api/user/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "track",
          sessionId: sessionIdRef.current,
          eventType,
          path: currentPathRef.current,
          metadata,
        }),
      });
    } catch {
      // Non-fatal
    }
  };

  const endSession = async () => {
    if (!sessionIdRef.current || !userIdRef.current) return;
    
    try {
      await fetch("/api/user/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          sessionId: sessionIdRef.current,
        }),
      });
    } catch {
      // Non-fatal
    } finally {
      if (!isUnmountedRef.current) {
        setSessionState({ sessionId: null, isTracking: false });
      }
    }
  };

  const shouldTrackPath = useCallback((path: string) => {
    if (!trackPaths || trackPaths.length === 0) return true;

    return trackPaths.some((trackedPath) =>
      path === trackedPath || path.startsWith(trackedPath.replace(/\/$/, "") + "/")
    );
  }, [trackPaths]);

  // Start session on mount once a user id is available
  useEffect(() => {
    if (userId && !sessionState.sessionId) {
      startSession();
    }
  }, [userId, sessionState.sessionId]);

  // Setup heartbeat
  useEffect(() => {
    if (sessionState.sessionId && sessionState.isTracking) {
      heartbeatRef.current = setInterval(sendHeartbeat, heartbeatInterval);
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [sessionState.sessionId, sessionState.isTracking, heartbeatInterval]);

  // Track page views when pathname changes.
  useEffect(() => {
    currentPathRef.current = pathname;

    if (!shouldTrackPath(pathname)) {
      pendingPageViewPathRef.current = null;
      return;
    }

    if (!userId) return;

    if (!sessionState.sessionId) {
      pendingPageViewPathRef.current = pathname;
      return;
    }

    pendingPageViewPathRef.current = null;
    trackEvent("page_view", { path: pathname }).catch((e) => logger.warn("Page view tracking failed", { error: e }));
  }, [pathname, shouldTrackPath, userId, sessionState.sessionId]);

  useEffect(() => {
    const pendingPath = pendingPageViewPathRef.current;
    if (!pendingPath || !sessionState.sessionId) return;

    currentPathRef.current = pendingPath;
    pendingPageViewPathRef.current = null;
    trackEvent("page_view", { path: pendingPath }).catch((e) => logger.warn("Pending page view tracking failed", { error: e }));
  }, [sessionState.sessionId]);

  // End session on unmount - use ref to avoid stale closure
  useEffect(() => {
    return () => {
      // Use ref value to avoid calling setState on unmounted component
      if (sessionIdRef.current) {
        endSession().catch((e) => logger.warn("Session end failed", { error: e }));
      }
    };
    // Empty deps - intentionally runs once on mount to set up cleanup
  }, []);

  return {
    sessionId: sessionState.sessionId,
    isTracking: sessionState.isTracking,
    trackEvent,
  };
}