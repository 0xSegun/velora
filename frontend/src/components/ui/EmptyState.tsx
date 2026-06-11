import { AlertTriangle, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: "default" | "warning";
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) {
  const DisplayIcon = variant === "warning" ? AlertTriangle : (Icon ?? AlertTriangle);
  const iconClass =
    variant === "warning" ? "text-[#CA8A04]" : "text-[var(--text-faint)]";
  const borderClass =
    variant === "warning"
      ? "border-[#FACC15]/30 bg-[#FACC15]/5"
      : "glass-panel";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center ${borderClass}`}
      role="status"
    >
      <DisplayIcon className={`h-10 w-10 ${iconClass}`} aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}