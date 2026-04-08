import { ErrorInfo } from "react";

export type ErrorFallbackRenderFn = (props: { error: Error; resetError: () => void }) => React.ReactNode;

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ErrorFallbackRenderFn;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError?: () => void;
  showDetails?: boolean;
}

export type ErrorFallbackVariant = "page" | "section" | "inline";
