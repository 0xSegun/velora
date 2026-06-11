import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  LucideIcon,
} from "lucide-react";
import type { NotificationType } from "@/store/dashboardStore";

const FEEDBACK_TYPES = new Set(["success", "error", "warning", "info"]);

const TYPE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: "#16A34A" },
  error: { icon: XCircle, color: "#DC2626" },
  warning: { icon: AlertTriangle, color: "#CA8A04" },
  info: { icon: Info, color: "#525252" },
  alert: { icon: AlertTriangle, color: "#CA8A04" },
  prediction: { icon: Info, color: "#525252" },
  training: { icon: Info, color: "#525252" },
  dataset: { icon: Info, color: "#525252" },
  model: { icon: Info, color: "#525252" },
  system: { icon: Info, color: "#525252" },
  security: { icon: AlertTriangle, color: "#CA8A04" },
};

export function getNotificationIcon(type: NotificationType | string) {
  const normalized = FEEDBACK_TYPES.has(type) ? type : "info";
  return TYPE_ICONS[type] ?? TYPE_ICONS[normalized] ?? TYPE_ICONS.info;
}

export function NotificationTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: NotificationType | string;
  className?: string;
}) {
  const { icon: Icon, color } = getNotificationIcon(type);
  return <Icon className={className} style={{ color }} aria-hidden="true" />;
}