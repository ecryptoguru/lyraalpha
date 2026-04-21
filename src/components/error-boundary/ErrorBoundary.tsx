"use client";

import React, { Component, ErrorInfo } from "react";
import { ErrorBoundaryProps, ErrorBoundaryState } from "./types";
import { logComponentError } from "@/lib/logger";

/**
 * Error Boundary Component
 * Catches errors in child components and displays fallback UI
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console and structured logger
    logComponentError(error, {
      componentStack: errorInfo.componentStack || "",
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys || [];
      const currentKeys = this.props.resetKeys;

      if (
        prevKeys.length !== currentKeys.length ||
        prevKeys.some((key, index) => key !== currentKeys[index])
      ) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        // Support render function pattern: (props) => ReactNode
        if (typeof this.props.fallback === "function") {
          return this.props.fallback({
            error: this.state.error,
            resetError: this.resetError,
          });
        }
        return this.props.fallback;
      }

      // Default fallback — production hides the raw error message because it can
      // leak internal endpoint names, SQL fragments, or stack context that the
      // user shouldn't see. Development keeps the message + stack behind an
      // expandable <details> for fast triage.
      const isDev = process.env.NODE_ENV !== "production";
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-danger mb-4">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-4">
              We couldn&apos;t render this part of the page. Try again, or reload if
              the issue persists.
            </p>
            <button
              type="button"
              onClick={this.resetError}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Try Again
            </button>
            {isDev && (
              <details className="mt-6 text-left text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none font-semibold">
                  Developer details
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-muted/50 p-3 text-muted-foreground">
                  {this.state.error.message}
                  {this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
