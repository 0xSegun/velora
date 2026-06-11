import { formatDateTime } from "@/lib/dates";
import { PRINT_DOCUMENT_TITLE } from "@/lib/print";

interface PrintDocumentHeaderProps {
  title: string;
  subtitle?: string;
}

/** Visible only when printing — gives exports a consistent paper header. */
export default function PrintDocumentHeader({
  title,
  subtitle,
}: PrintDocumentHeaderProps) {
  return (
    <header className="print-only mb-6 border-b border-[#cccccc] pb-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
        {PRINT_DOCUMENT_TITLE}
      </p>
      <h1 className="mt-1 text-xl font-bold text-[#000000]">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-[#444444]">{subtitle}</p>
      )}
      <p className="mt-2 text-xs text-[#777777]">
        Exported {formatDateTime(new Date())}
      </p>
    </header>
  );
}