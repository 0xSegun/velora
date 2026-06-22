"use client";

import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  variant?: "default" | "panel";
  id?: string;
}

export default function Card({
  children,
  className,
  hoverable = false,
  variant = "default",
  id,
}: CardProps) {
  return (
    <div
      id={id}
      className={cn(
        variant === "panel" ? "glass-panel" : "glass-card",
        hoverable && "cursor-default",
        !hoverable && variant === "default" && "hover:transform-none",
        className,
      )}
    >
      {children}
    </div>
  );
}