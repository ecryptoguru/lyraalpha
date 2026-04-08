"use client";

import { useUser as useClerkUser, useAuth as useClerkAuth } from "@clerk/nextjs";
import type { UserResource } from "@clerk/types";

const MOCK_USER = {
  id: "test-user-id",
  firstName: "Test",
  lastName: "User",
  fullName: "Test User",
  primaryEmailAddress: { emailAddress: "test@example.com" },
  primaryPhoneNumber: null,
  imageUrl: "https://ui-avatars.com/api/?name=Test+User",
};

function isClientAuthBypassEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname;
  const isLocalDevHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");

  if (!isLocalDevHost) {
    return false;
  }

  return window.localStorage.getItem("skip-auth-bypass") === "true";
}

export function useAuthUser() {
  try {
    const clerkResult = useClerkUser();
    if (isClientAuthBypassEnabled()) {
      return { user: MOCK_USER as unknown as UserResource, isLoaded: true, isSignedIn: true, isMock: true };
    }
    return { ...clerkResult, isMock: false };
  } catch {
    return { user: MOCK_USER as unknown as UserResource, isLoaded: true, isSignedIn: true, isMock: true };
  }
}

export function useAuthState() {
  try {
    const clerkResult = useClerkAuth();
    if (isClientAuthBypassEnabled()) {
      return {
        isLoaded: true,
        isSignedIn: true,
        userId: "test-user-id",
        sessionId: "test-session-id",
        getToken: () => Promise.resolve("test-token"),
      };
    }
    return clerkResult;
  } catch {
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: "test-user-id",
      sessionId: "test-session-id",
      getToken: () => Promise.resolve("test-token"),
    };
  }
}
