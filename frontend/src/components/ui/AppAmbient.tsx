"use client";

interface AppAmbientProps {
  variant?: "subtle" | "rich";
}

export default function AppAmbient({ variant = "subtle" }: AppAmbientProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden print:hidden"
      aria-hidden
    >
      {variant === "rich" && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[var(--accent)]/4 blur-[100px]" />
      )}
    </div>
  );
}