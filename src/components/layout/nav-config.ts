import type { NavRole } from "@/lib/constants";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  UserCircle,
  DoorOpen,
  Heart,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: NavRole[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

const ALL: NavRole[] = ["HR_ADMIN", "HR_STAFF", "EMPLOYEE"];
const HR: NavRole[] = ["HR_ADMIN", "HR_STAFF"];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "HR",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: HR },
      { label: "Karyawan", href: "/employees", icon: Users, roles: HR },
    ],
  },
  {
    title: "Layanan Mandiri (ESS)",
    items: [
      { label: "Beranda ESS", href: "/ess", icon: UserCircle, roles: ALL },
      { label: "Cuti", href: "/leave", icon: CalendarDays, roles: ALL },
      { label: "Reimbursement", href: "/reimbursement", icon: Receipt, roles: ALL },
      { label: "Meeting Room", href: "/meeting-rooms", icon: DoorOpen, roles: ALL },
      { label: "Kudos Wall", href: "/kudos", icon: Heart, roles: ALL },
    ],
  },
];

export function navForRole(role: NavRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}
