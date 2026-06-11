"use client";

import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCountryMeta } from "@/lib/countries";

const SIZE_MAP = {
  xs: { width: 16, height: 12, className: "h-3 w-4" },
  sm: { width: 20, height: 15, className: "h-[15px] w-5" },
  md: { width: 24, height: 18, className: "h-[18px] w-6" },
  lg: { width: 32, height: 24, className: "h-6 w-8" },
  xl: { width: 48, height: 36, className: "h-9 w-12" },
} as const;

export type CountryFlagSize = keyof typeof SIZE_MAP;

export function countryFlagImageUrl(
  code: string | null | undefined,
  width = 24,
  height = 18,
): string | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return null;
  return `https://flagcdn.com/${width}x${height}/${normalized.toLowerCase()}.png`;
}

export function CountryFlag({
  code,
  size = "md",
  className,
  title,
}: {
  code: string | null | undefined;
  size?: CountryFlagSize;
  className?: string;
  title?: string;
}) {
  const dims = SIZE_MAP[size];
  const src = countryFlagImageUrl(code, dims.width, dims.height);

  if (!src) {
    return (
      <Globe
        className={cn("shrink-0 text-[var(--text-muted)]", dims.className, className)}
        aria-hidden={!title}
      />
    );
  }

  return (
    <img
      src={src}
      width={dims.width}
      height={dims.height}
      alt={title ? `${title} flag` : ""}
      role={title ? undefined : "presentation"}
      className={cn(
        "shrink-0 rounded-[2px] border border-black/10 object-cover shadow-sm",
        dims.className,
        className,
      )}
      loading="lazy"
    />
  );
}

export function CountryLabel({
  code,
  name,
  showCode = false,
  flagSize = "sm",
  className,
  nameClassName,
}: {
  code: string;
  name?: string | null;
  showCode?: boolean;
  flagSize?: CountryFlagSize;
  className?: string;
  nameClassName?: string;
}) {
  const meta = getCountryMeta(code, name);

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <CountryFlag code={meta.code} size={flagSize} title={meta.name} />
      <span className={cn("truncate", nameClassName)}>
        {meta.name}
        {showCode ? ` (${meta.code})` : ""}
      </span>
    </span>
  );
}