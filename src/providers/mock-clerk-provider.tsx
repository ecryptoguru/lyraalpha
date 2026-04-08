"use client";

import React, { createContext, useContext } from "react";

// Minimal mock context satisfying basic Clerk hooks
const MockClerkContext = createContext({
  user: {
    id: "test-user-id",
    firstName: "Test",
    lastName: "User",
    fullName: "Test User",
    primaryEmailAddress: { emailAddress: "test@example.com" },
    imageUrl: "",
  },
  isLoaded: true,
  isSignedIn: true,
  signOut: () => Promise.resolve(),
  openUserProfile: () => {},
});

export const useUser = () => {
  const context = useContext(MockClerkContext);
  return { ...context };
};

export const useAuth = () => {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: "test-user-id",
    sessionId: "test-session-id",
    getToken: () => Promise.resolve("test-token"),
    signOut: () => Promise.resolve(),
  };
};

export const useClerk = () => {
  const context = useContext(MockClerkContext);
  return {
    ...context,
    openSignIn: () => {},
    openSignUp: () => {},
  };
};

export const SignedIn = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SignedOut = () => null;
export const UserButton = () => <div data-testid="user-button">Test User</div>;
export const ClerkLoaded = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const ClerkLoading = () => null;
export const SignInButton = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const SignUpButton = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const SignOutButton = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const SignIn = () => null;
export const SignUp = () => null;

export function ClerkProvider({ children, ...rest }: { children: React.ReactNode; [key: string]: unknown }) {
  void rest;
  return <MockClerkProvider>{children}</MockClerkProvider>;
}

export function MockClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <MockClerkContext.Provider value={{
      user: {
        id: "test-user-id",
        firstName: "Test",
        lastName: "User",
        fullName: "Test User",
        primaryEmailAddress: { emailAddress: "test@example.com" },
        imageUrl: "",
      },
      isLoaded: true,
      isSignedIn: true,
      signOut: () => Promise.resolve(),
      openUserProfile: () => {},
    }}>
      {children}
    </MockClerkContext.Provider>
  );
}
