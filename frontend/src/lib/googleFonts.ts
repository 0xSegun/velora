/** Curated Google Fonts available in admin typography settings. */
export const GOOGLE_FONT_OPTIONS = [
  { id: "Inter", label: "Inter", category: "Sans" },
  { id: "Outfit", label: "Outfit", category: "Sans" },
  { id: "DM Sans", label: "DM Sans", category: "Sans" },
  { id: "Plus Jakarta Sans", label: "Plus Jakarta Sans", category: "Sans" },
  { id: "Manrope", label: "Manrope", category: "Sans" },
  { id: "Space Grotesk", label: "Space Grotesk", category: "Sans" },
  { id: "Sora", label: "Sora", category: "Sans" },
  { id: "Poppins", label: "Poppins", category: "Sans" },
  { id: "Roboto", label: "Roboto", category: "Sans" },
  { id: "Open Sans", label: "Open Sans", category: "Sans" },
  { id: "Lato", label: "Lato", category: "Sans" },
  { id: "Montserrat", label: "Montserrat", category: "Sans" },
  { id: "Playfair Display", label: "Playfair Display", category: "Display" },
  { id: "Fraunces", label: "Fraunces", category: "Display" },
  { id: "Libre Baskerville", label: "Libre Baskerville", category: "Display" },
  { id: "JetBrains Mono", label: "JetBrains Mono", category: "Mono" },
  { id: "IBM Plex Mono", label: "IBM Plex Mono", category: "Mono" },
  { id: "Fira Code", label: "Fira Code", category: "Mono" },
  { id: "Source Code Pro", label: "Source Code Pro", category: "Mono" },
] as const;

export type GoogleFontId = (typeof GOOGLE_FONT_OPTIONS)[number]["id"];

export function buildGoogleFontsHref(fonts: string[]): string {
  const unique = [...new Set(fonts.filter(Boolean))];
  if (!unique.length) return "";
  const families = unique
    .map((name) => `family=${encodeURIComponent(name)}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export function fontFamilyStack(fontName: string, fallback: string): string {
  const safe = fontName.replace(/'/g, "\\'");
  return `'${safe}', ${fallback}`;
}