import {
  BarChart3,
  Bell,
  Brain,
  FileText,
  Globe,
  Layers,
  Shield,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Globe,
  TrendingUp,
  Shield,
  BarChart3,
  Zap,
  Bell,
  FileText,
  Layers,
};

export function resolveCmsIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Brain;
}