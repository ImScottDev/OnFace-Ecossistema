"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { CommandPalette } from "./CommandPalette";
import type { Session } from "next-auth";

// Global 401 handler — redirects to /login when session expires silently.
// Without this, fetches fail quietly and UI feels "dead" (clicks stop working).
let isRedirecting = false;
function handleAuthError(error: unknown) {
  if (isRedirecting) return;
  const status = (error as { status?: number; response?: { status?: number } })?.status
    ?? (error as { response?: { status?: number } })?.response?.status;
  if (status === 401) {
    isRedirecting = true;
    const current = window.location.pathname + window.location.search;
    window.location.href = `/login?callbackUrl=${encodeURIComponent(current)}`;
  }
}

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleAuthError }),
        mutationCache: new MutationCache({ onError: handleAuthError }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30s
            refetchOnWindowFocus: false,
            retry: (failureCount, error: unknown) => {
              const status = (error as { status?: number })?.status;
              if (status === 401 || status === 403 || status === 404) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  // Global fetch wrapper: detect 401 on any direct fetch and redirect to /login.
  // Preserves original fetch behavior for everything else.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401 && !isRedirecting) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
        // Only redirect if the 401 is from our API — ignore external APIs
        if (url.startsWith("/") || url.includes(window.location.host)) {
          isRedirecting = true;
          const current = window.location.pathname + window.location.search;
          window.location.href = `/login?callbackUrl=${encodeURIComponent(current)}`;
        }
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1d24",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              backdropFilter: "blur(12px)",
            },
          }}
        />
        <CommandPalette />
      </QueryClientProvider>
    </SessionProvider>
  );
}
