"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

interface AssetUploadFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onUrlChange: (url: string) => void;
  onUpload: (file: File) => Promise<string>;
  accept?: string;
  previewClassName?: string;
}

export default function AssetUploadField({
  id,
  label,
  hint,
  value,
  onUrlChange,
  onUpload,
  accept = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/gif",
  previewClassName = "h-16 w-16",
}: AssetUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUpload(file);
      onUrlChange(url);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </label>
          {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onUrlChange("")}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]"
            aria-label={`Clear ${label}`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--border-hover)] bg-[var(--bg-secondary)] ${previewClassName}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-[var(--text-faint)]" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <input
            id={id}
            type="url"
            value={value}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://… or upload a file"
            className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)]"
          />
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--border-hover)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-active)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {uploading ? "Uploading…" : "Upload file"}
          </button>
        </div>
      </div>
    </div>
  );
}