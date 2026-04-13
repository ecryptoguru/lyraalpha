import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "LyraAlpha AI | Institutional-Grade Financial Intelligence",
  description: "Decode market signals with AI that understands context. Real-time analysis for Equities, Crypto and Commodities with Institutional Grade Retail Clarity.",
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
    title: "LyraAlpha AI | Institutional-Grade Financial Intelligence",
    description: "Institutional-grade financial intelligence for every investor.",
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
    title: "LyraAlpha AI | Institutional-Grade Financial Intelligence",
    description: "Institutional-grade financial intelligence for every investor.",
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
        className={`${inter.variable} ${firaCode.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            storageKey="lyraalpha-theme"
            disableTransitionOnChange
          >
            {children}
            <OfflineBanner />
            <Toaster theme="system" position="bottom-right" richColors closeButton />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
