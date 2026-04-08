"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown } from "lucide-react";
import { ErrorFallbackProps } from "./types";

/**
 * Page-level error fallback
 * Full-page error display with navigation options
 */
export function PageErrorFallback({
  error,
  resetError,
  showDetails = false,
}: ErrorFallbackProps) {
  const [showStack, setShowStack] = React.useState(false);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decorative Labels */}
      <div className="absolute -top-10 text-[15vw] font-bold text-primary/5 select-none pointer-events-none tracking-tighter z-0 hidden lg:block">
        INTELLIGENCE
      </div>
      
      <div className="max-w-2xl w-full bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl border-white/5 rounded-3xl p-10 relative z-10">
        <div className="flex items-center justify-center mb-6">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-center tracking-tighter uppercase mb-4 premium-gradient-text">
          Terminal Disruption
        </h1>

        <p className="text-center text-muted-foreground mb-8 max-w-prose mx-auto font-medium leading-relaxed">
          The Alpha Engine encountered an unexpected operational anomaly. Rest assured, your portfolio data and core logic remains secure within the vault.
        </p>

        {(isDev || showDetails) && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm font-mono text-red-800 dark:text-red-300 break-all">
              {error.message}
            </p>

            {isDev && error.stack && (
              <div className="mt-4">
                <button
                  onClick={() => setShowStack(!showStack)}
                  className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showStack ? "rotate-180" : ""}`}
                  />
                  {showStack ? "Hide" : "Show"} Stack Trace
                </button>

                {showStack && (
                  <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={resetError}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-black rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Reformat Terminal
          </button>

          <a
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-8 py-3 bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl border-white/5 hover:bg-muted/50 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
          >
            <Home className="w-4 h-4" />
            Return to Vault
          </a>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border/10 text-center">
          <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-40">
            Alpha Terminal System | Secure Instance
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Section-level error fallback
 * For errors in specific sections/widgets
 */
export function SectionErrorFallback({
  error,
  resetError,
  showDetails = false,
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="w-full p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Unable to load this section
          </h3>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {isDev || showDetails
              ? error.message
              : "An error occurred while loading this content."}
          </p>

          <button
            onClick={resetError}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error fallback
 * Minimal error display for small components
 */
export function InlineErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
      <span className="text-gray-700 dark:text-gray-300 flex-1">
        Error loading component
      </span>
      <button
        onClick={resetError}
        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-medium"
      >
        Retry
      </button>
    </div>
  );
}
