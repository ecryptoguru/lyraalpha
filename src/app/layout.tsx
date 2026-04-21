import type { Metadata } from "next";
import { Inter, Fira_Code, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { validateEnv } from "@/lib/env/schema";
import "./globals.css";

// Validate environment variables at startup
validateEnv();

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "LyraAlpha AI | Institutional-Grade Crypto Intelligence",
  description: "Decode crypto market signals with AI that understands context. Real-time analysis for Bitcoin, Ethereum, and altcoins with institutional-grade retail clarity.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LyraAlpha AI",
  },
  openGraph: {
    title: "LyraAlpha AI | Institutional-Grade Crypto Intelligence",
    description: "Institutional-grade crypto intelligence for every investor.",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz",
    siteName: "LyraAlpha AI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LyraAlpha AI | Institutional-Grade Crypto Intelligence",
    description: "Institutional-grade crypto intelligence for every investor.",
    images: ["/og-image.png"],
  },
  alternates: {
    types: {
      "application/rss+xml": [
        { url: `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/blog/feed.xml`, title: "LyraAlpha AI Blog" },
      ],
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          id="theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var storageKey = 'lyraalpha-theme';
                var cookieMatch = document.cookie.match(new RegExp('(?:^|; )' + storageKey + '=([^;]+)'));
                var cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
                var storedTheme = null;
                try {
                  storedTheme = window.localStorage.getItem(storageKey);
                } catch (e) {}
                var theme = storedTheme || cookieTheme || 'dark';
                var root = document.documentElement;
                root.classList.remove('light', 'dark');
                root.classList.add(theme === 'light' ? 'light' : 'dark');
                root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
              })();
            `,
          }}
        />
        <script
          id="density-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var d = window.localStorage.getItem('lyraalpha-density');
                  if (d === 'compact' || d === 'cozy') {
                    document.documentElement.setAttribute('data-density', d);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Hydration Mitigation Script: Runs before React to strip extension-injected attributes */}
        <script
          id="hydration-mitigation"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var attrs = ['bis_skin_checked', 'leather-installed'];
                function strip(el) {
                  for (var i = 0; i < attrs.length; i++) {
                    if (el && el.removeAttribute) el.removeAttribute(attrs[i]);
                  }
                }
                function stripAll() {
                  for (var i = 0; i < attrs.length; i++) {
                    var els = document.querySelectorAll('[' + attrs[i] + ']');
                    for (var j = 0; j < els.length; j++) els[j].removeAttribute(attrs[i]);
                  }
                }
                stripAll();
                new MutationObserver(function(mutations) {
                  for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].type === 'attributes') strip(mutations[i].target);
                  }
                }).observe(document.documentElement, { attributes: true, attributeFilter: attrs, subtree: true });
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${firaCode.variable} ${spaceGrotesk.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <AuthProvider>
          {/* Skip link — WCAG AA: first focusable element, jumps to main content */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-9999 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none"
          >
            Skip to main content
          </a>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            storageKey="lyraalpha-theme"
            disableTransitionOnChange
          >
            {children}
            <OfflineBanner />
            <Toaster
              theme="system"
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                duration: 4000,
                classNames: {
                  toast: "font-sans text-sm",
                  success: "!bg-success-subtle !text-success !border-success/20",
                  error: "!bg-danger-subtle !text-danger !border-danger/20",
                  warning: "!bg-warning-subtle !text-warning !border-warning/20",
                  info: "!bg-info-subtle !text-info !border-info/20",
                },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
