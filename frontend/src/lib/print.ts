/** Shared helpers for browser print / paper export. */

export function printPage(): void {
  if (typeof window === "undefined") return;
  window.print();
}

export const PRINT_DOCUMENT_TITLE = "Velora";