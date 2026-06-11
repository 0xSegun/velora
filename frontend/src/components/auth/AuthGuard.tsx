"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { authAPI } from "@/lib/api";
import { setAuthCookies } from "@/lib/authCookies";
import { MESSAGES, toast } from "@/lib/feedback";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function AuthGuard({
  children,
  requireAdmin = false,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, login, logout } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useAuthStore.persist;
    if (!persistApi) {
      setHydrated(true);
      return;
    }
    if (persistApi.hasHydrated()) setHydrated(true);
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    async function verify() {
      setChecking(true);
      setReady(false);

      const token = window.localStorage.getItem("access_token");

      if (!token) {
        logout();
        toast.warning(MESSAGES.auth.loginRequired);
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        if (!cancelled) setChecking(false);
        return;
      }

      const applySession = (
        profile: {
          id: string;
          email: string;
          full_name: string;
          phone?: string;
          institution?: string;
          country: string;
          role: string;
          avatar_url?: string;
          is_verified: boolean;
        },
        accessToken: string,
      ) => {
        login(
          {
            id: String(profile.id),
            email: profile.email,
            full_name: profile.full_name,
            phone: profile.phone,
            institution: profile.institution,
            country: profile.country,
            role: profile.role as "user" | "admin" | "analyst",
            avatar_url: profile.avatar_url,
            is_verified: profile.is_verified,
          },
          accessToken,
          window.localStorage.getItem("refresh_token") ?? "",
        );
        setAuthCookies(profile.role);

        if (requireAdmin && profile.role !== "admin") {
          toast.error(MESSAGES.auth.accessDenied);
          router.replace("/access-denied");
          if (!cancelled) setChecking(false);
          return false;
        }

        return true;
      };

      const currentUser = useAuthStore.getState().user;
      if (currentUser && token) {
        setAuthCookies(currentUser.role);
        if (requireAdmin && currentUser.role !== "admin") {
          toast.error(MESSAGES.auth.accessDenied);
          router.replace("/access-denied");
          if (!cancelled) setChecking(false);
          return;
        }
        if (!cancelled) {
          setReady(true);
          setChecking(false);
        }
        return;
      }

      try {
        const { data } = await authAPI.me();
        if (cancelled) return;

        const allowed = applySession(
          data as {
            id: string;
            email: string;
            full_name: string;
            phone?: string;
            institution?: string;
            country: string;
            role: string;
            avatar_url?: string;
            is_verified: boolean;
          },
          token,
        );

        if (!cancelled && allowed) setReady(true);
      } catch {
        if (cancelled) return;
        logout();
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [hydrated, pathname, requireAdmin, login, logout, router]);

  if (!hydrated || checking || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--text-primary)]" />
      </div>
    );
  }

  return <>{children}</>;
}