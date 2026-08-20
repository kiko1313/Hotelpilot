"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  children?: { label: string; href: string }[];
};

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "🏨" },
  {
    label: "Reservations",
    href: "/reservations",
    icon: "📅",
    children: [
      { label: "Calendar", href: "/reservations/calendar" },
      { label: "New booking", href: "/reservations/new" },
      { label: "All reservations", href: "/reservations" },
    ],
  },
  { label: "Guests", href: "/guests", icon: "👥" },
  {
    label: "Rooms",
    href: "/rooms",
    icon: "🚪",
    children: [
      { label: "Room overview", href: "/rooms/overview" },
      { label: "Room management", href: "/rooms/management" },
    ],
  },
  { label: "Payments", href: "/payments", icon: "💳" },
  { label: "Check-in / Check-out", href: "/checkin-checkout", icon: "🔄" },
  {
    label: "Shifts",
    href: "/shifts",
    icon: "🕐",
    children: [
      { label: "Current shift", href: "/shifts/current" },
      { label: "Start verification", href: "/shifts/start-verification" },
      { label: "Handover", href: "/shifts/handover" },
      { label: "Shift reports", href: "/shifts/reports" },
    ],
  },
  { label: "Reports", href: "/reports", icon: "📊" },
];

const OPS_AGENT_NAV: NavItem = {
  label: "Operations Assistant",
  href: "/ai",
  icon: "🤖",
};

const ADMIN_NAV: NavItem = {
  label: "Admin",
  href: "/admin",
  icon: "⚙️",
  children: [
    { label: "Hotel settings", href: "/admin/hotel-settings" },
    { label: "Rooms", href: "/admin/rooms" },
    { label: "Employees", href: "/admin/employees" },
    { label: "Payments / prices", href: "/admin/pricing" },
    { label: "Permissions", href: "/admin/permissions" },
    { label: "Audit log", href: "/admin/audit-log" },
  ],
};

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...MAIN_NAV, OPS_AGENT_NAV, ADMIN_NAV] : MAIN_NAV;

  return (
    <nav className="flex h-full w-64 flex-col border-r border-ink-700 bg-ink-900">
      <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brass-dim bg-ink-800">
          <span className="font-display text-sm text-brass-bright">01</span>
        </div>
        <span className="font-display text-base font-semibold text-parchment">
          HotelPilot AI
        </span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavGroup key={item.href} item={item} pathname={pathname} />
        ))}
      </div>

      <div className="space-y-1 border-t border-ink-700 px-3 py-3">
        <SidebarLink
          href="/account"
          icon="👤"
          label="My account"
          active={pathname === "/account"}
        />
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-parchment-dim transition-colors hover:bg-ink-800 hover:text-parchment"
          >
            <span aria-hidden>🚪</span>
            Log out
          </button>
        </form>
      </div>
    </nav>
  );
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActiveGroup =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const [open, setOpen] = useState(isActiveGroup);

  if (!item.children) {
    return (
      <SidebarLink
        href={item.href}
        icon={item.icon}
        label={item.label}
        active={pathname === item.href}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          isActiveGroup
            ? "bg-ink-800 text-parchment"
            : "text-parchment-dim hover:bg-ink-800 hover:text-parchment"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </span>
        <span
          className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ›
        </span>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l border-ink-700 pl-3">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                pathname === child.href
                  ? "text-brass-bright"
                  : "text-parchment-dim hover:text-parchment"
              }`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-ink-800 text-parchment"
          : "text-parchment-dim hover:bg-ink-800 hover:text-parchment"
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </Link>
  );
}
