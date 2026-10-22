import {
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  FolderTree,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Ícones referenciados por nome no registro de módulos. */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  ListChecks,
  CalendarDays,
  FolderTree,
  ReceiptText,
  Users,
  BookOpenCheck,
  Landmark,
  FileSpreadsheet,
  MessagesSquare,
  BarChart3,
  ShieldCheck,
  Settings,
};

export function ModuleIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = ICONS[name] ?? LayoutDashboard;
  return <Cmp className={className} aria-hidden />;
}
