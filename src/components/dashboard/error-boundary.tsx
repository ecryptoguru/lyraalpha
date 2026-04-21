"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in child components and displays a graceful fallback.
 * Wrap page content or high-risk subtrees with this.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6 max-w-md">
            <AlertTriangle className="h-8 w-8 text-danger mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This section encountered an error. Try refreshing or navigating back.
            </p>
            {this.state.error && process.env.NODE_ENV !== "production" && (
              <pre className="text-xs text-danger/70 bg-danger/5 rounded-lg p-3 mb-4 overflow-x-auto text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Try Again
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
