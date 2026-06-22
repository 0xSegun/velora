"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCountryMeta } from "@/lib/countries";
import {
  countryCodeToFlag,
  normalizeFlagCode,
  worldCountryFlagUrl,
} from "@/lib/countryCatalog";
import { countryCodeForFlag } from "@/lib/currency";

const SIZE_MAP = {
  xs: { width: 16, height: 12, className: "h-3 w-4", emoji: "text-sm" },
  sm: { width: 20, height: 15, className: "h-[15px] w-5", emoji: "text-base" },
  md: { width: 24, height: 18, className: "h-[18px] w-6", emoji: "text-lg" },
  lg: { width: 32, height: 24, className: "h-6 w-8", emoji: "text-xl" },
  xl: { width: 48, height: 36, className: "h-9 w-12", emoji: "text-2xl" },
} as const;

export type CountryFlagSize = keyof typeof SIZE_MAP;

export function countryFlagImageUrl(
  code: string | null | undefined,
  width = 24,
  height = 18,
): string | null {
  const normalized = normalizeFlagCode(code);
  if (!normalized) return null;
  const base = worldCountryFlagUrl(normalized);
  if (!base) return null;
  return base.replace("/w40/", `/${width}x${height}/`);
}

function EmojiFlag({
  code,
  size,
  className,
  title,
}: {
  code: string;
  size: CountryFlagSize;
  className?: string;
  title?: string;
}) {
  const dims = SIZE_MAP[size];
  const emoji = countryCodeToFlag(code);
  if (emoji === "🌐") {
    return (
      <Globe
        className={cn("shrink-0 text-[var(--text-muted)]", dims.className, className)}
        aria-hidden={!title}
      />
    );
  }
  return (
    <span
      className={cn("shrink-0 leading-none", dims.emoji, className)}
      title={title}
      aria-hidden={!title}
    >
      {emoji}
    </span>
  );
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
  const flagCode = normalizeFlagCode(code);
  const src = flagCode ? countryFlagImageUrl(flagCode, dims.width, dims.height) : null;
  const [imgFailed, setImgFailed] = useState(false);

  if (!flagCode || !src || imgFailed) {
    return (
      <EmojiFlag
        code={flagCode ?? code ?? ""}
        size={size}
        className={className}
        title={title}
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
      onError={() => setImgFailed(true)}
    />
  );
}

/** Compact flag + ISO2 code (charts, tables — use when no full name is shown). */
export function CountryBadge({
  code,
  name,
  showName = false,
  flagOnly = false,
  flagSize = "xs",
  className,
  mono = true,
}: {
  code: string;
  name?: string | null;
  showName?: boolean;
  flagOnly?: boolean;
  flagSize?: CountryFlagSize;
  className?: string;
  mono?: boolean;
}) {
  const meta = getCountryMeta(code, name);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <CountryFlag code={meta.code} size={flagSize} title={meta.name} />
      {!flagOnly && (
        <span className={cn("truncate text-xs", mono && !showName && "font-mono uppercase")}>
          {showName ? meta.name : meta.code}
        </span>
      )}
    </span>
  );
}

/** Flag beside a currency shortcode (uses country when available). */
export function CurrencyBadge({
  currencyCode,
  countryCode,
  flagSize = "xs",
  className,
}: {
  currencyCode: string;
  countryCode?: string | null;
  flagSize?: CountryFlagSize;
  className?: string;
}) {
  const code = currencyCode.trim().toUpperCase();
  const flagCode =
    normalizeFlagCode(countryCode) ??
    normalizeFlagCode(countryCodeForFlag(code, countryCode));
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <CountryFlag code={flagCode} size={flagSize} />
      <span className="truncate font-mono text-xs uppercase">{code}</span>
    </span>
  );
}

/** Flag + full country name (never shows ISO shortcode). */
export function CountryLabel({
  code,
  name,
  flagSize = "sm",
  className,
  nameClassName,
}: {
  code: string;
  name?: string | null;
  flagSize?: CountryFlagSize;
  className?: string;
  nameClassName?: string;
}) {
  const meta = getCountryMeta(code, name);

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <CountryFlag code={meta.code} size={flagSize} title={meta.name} />
      <span className={cn("truncate", nameClassName)}>{meta.name}</span>
    </span>
  );
}