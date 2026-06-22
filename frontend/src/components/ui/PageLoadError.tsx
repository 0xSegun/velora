"use client";

import { AlertCircle } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface PageLoadErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export default function PageLoadError({
  title = "Unable to load this page",
  description = "The API request failed. Ensure you are signed in and the backend with PostgreSQL is running.",
  onRetry,
}: PageLoadErrorProps) {
  return (
    <EmptyState
      variant="warning"
      icon={AlertCircle}
      title={title}
      description={description}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Retry
          </button>
        ) : undefined
      }
    />
  );
}