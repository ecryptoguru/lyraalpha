/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. NEVER cache Clerk auth routes or API routes containing sensitive data
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // 2. Fallback for Auth-gated dashboard navigation (NetworkFirst)
    {
      matcher: ({ url, request }) => 
        request.destination === "document" && url.pathname.startsWith("/dashboard"),
      handler: new NetworkFirst({
        cacheName: "dashboard-pages",
        networkTimeoutSeconds: 3,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              // Only cache successful responses
              return response && response.status === 200 ? response : null;
            }
          }
        ]
      }),
    },
    // 4. Default Serwist cache strategies for static assets (images, fonts, _next)
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }: { request: Request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Define explicit types to avoid any in service worker events
type CustomPushEvent = Event & {
  data?: {
    json: () => { title?: string; body?: string; icon?: string; url?: string };
  };
  waitUntil: (promise: Promise<void>) => void;
};

type CustomNotificationEvent = Event & {
  notification: {
    close: () => void;
    data?: { url?: string };
  };
  waitUntil: (promise: Promise<WindowClient | null> | void) => void;
};

// Push notification handler
self.addEventListener("push", (e: Event) => {
  const event = e as unknown as CustomPushEvent;
  if (!event.data) return;

  let data: { title?: string; body?: string; icon?: string; url?: string };
  try {
    data = event.data.json();
  } catch {
    // Malformed push payload — nothing to show
    return;
  }

  event.waitUntil(
    // @ts-expect-error - registration not available on basic WorkerGlobalScope
    (self.registration as ServiceWorkerRegistration)
      .showNotification(data.title ?? "InsightAlpha AI", {
        body: data.body ?? "",
        icon: data.icon ?? "/logo.png",
        badge: "/logo.png",
        data: { url: data.url ?? "/dashboard" },
      })
      .catch((err: unknown) => {
        console.error("[SW] showNotification failed:", err);
      })
  );
});

self.addEventListener("notificationclick", (e: Event) => {
  const event = e as unknown as CustomNotificationEvent;
  event.notification.close();
  const url = event.notification?.data?.url ?? "/dashboard";
  // @ts-expect-error - clients not available on basic WorkerGlobalScope
  event.waitUntil((self.clients as Clients).openWindow(url));
});
