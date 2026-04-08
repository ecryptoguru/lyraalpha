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

      // Default fallback - will be replaced by ErrorFallback component
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {this.state.error.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={this.resetError}
              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
