"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Global error boundary for Next.js App Router
 * Catches errors in root layout - must be minimal with no dependencies
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Global Error:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Critical Error | InsightAlpha AI</title>
        <meta name="description" content="A critical error occurred. Please refresh or return home." />
        <meta property="og:title" content="Critical Error | InsightAlpha AI" />
        <meta property="og:description" content="A critical error occurred. Please refresh or return home." />
        <meta property="og:type" content="website" />
      </head>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(to bottom right, #121212, #1a1a1a)",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: "32rem",
              width: "100%",
              background: "#1c1c1e",
              borderRadius: "0.75rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
              padding: "2rem",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.5rem",
              }}
            >
              <div
                style={{
                  padding: "0.75rem",
                  background: "#fee2e2",
                  borderRadius: "9999px",
                }}
              >
                <AlertTriangle
                  style={{ width: "3rem", height: "3rem", color: "#dc2626" }}
                />
              </div>
            </div>

            <h1
              style={{
                fontSize: "1.875rem",
                fontWeight: "bold",
                textAlign: "center",
                color: "#f5f5f5",
                marginBottom: "1rem",
                lineHeight: "1.2",
              }}
            >
              Critical Error
            </h1>

            <p
              style={{
                textAlign: "center",
                color: "#a1a1aa",
                marginBottom: "2rem",
              }}
            >
              We encountered a critical error. Please try refreshing the page.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                alignItems: "center",
              }}
            >
              <button
                onClick={reset}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  minHeight: "44px",
                  width: "100%",
                  maxWidth: "200px",
                  background: "#2563eb",
                  color: "white",
                  borderRadius: "0.5rem",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <RefreshCw style={{ width: "1.25rem", height: "1.25rem" }} />
                Reload Page
              </button>

              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.625rem 1.25rem",
                  minHeight: "44px",
                  width: "100%",
                  maxWidth: "200px",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "#a1a1aa",
                  textDecoration: "none",
                  borderRadius: "0.5rem",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
