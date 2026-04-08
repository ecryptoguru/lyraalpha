"use client";

import {
  useClerk,
  SignedIn,
  SignedOut,
  UserButton,
  ClerkLoaded,
  ClerkLoading,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import { useAuthState, useAuthUser } from "@/hooks/use-auth-user";

export function useAuth() {
  return useAuthState();
}

export function useUser() {
  return useAuthUser();
}

export {
  useClerk,
  SignedIn,
  SignedOut,
  UserButton,
  ClerkLoaded,
  ClerkLoading,
  SignInButton,
  SignUpButton,
};
