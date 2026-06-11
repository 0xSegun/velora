import type { ReactNode } from "react";
import GoogleAuthProvider from "@/components/auth/GoogleAuthProvider";
import AppAmbient from "@/components/ui/AppAmbient";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <GoogleAuthProvider>
      <div className="app-shell relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        <AppAmbient variant="rich" />
        <div className="app-shell-content relative z-10 w-full">{children}</div>
      </div>
    </GoogleAuthProvider>
  );
}