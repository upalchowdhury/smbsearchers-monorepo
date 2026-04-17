"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Home,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  UserCircle,
  EyeOff,
  Database,
  GitBranch,
  Eye,
  TrendingUp,
  Shield,
  HelpCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string;
  badgeColor?: string;
  active?: boolean;
  children?: { label: string; href: string }[];
}

const sourceItems: NavItem[] = [
  {
    label: "Search Deals",
    icon: <Search size={18} />,
    href: "/deals",
  },
  {
    label: "Saved Searches",
    icon: <Bookmark size={18} />,
    children: [
      { label: "SaaS > $500K", href: "/saved-searches/saas-500k" },
      { label: "Restaurants FL", href: "/saved-searches/restaurants-fl" },
    ],
  },
  {
    label: "BuyerProfile",
    icon: <UserCircle size={18} />,
    href: "/buyer-profile",
    badge: "New",
    badgeColor: "bg-emerald-500",
  },
  {
    label: "Off-Market Deals",
    icon: <EyeOff size={18} />,
    href: "/off-market",
    badge: "New",
    badgeColor: "bg-emerald-500",
  },
  {
    label: "Data Sources",
    icon: <Database size={18} />,
    href: "/sources",
  },
];

const trackItems: NavItem[] = [
  {
    label: "Deal Pipeline",
    icon: <GitBranch size={18} />,
    href: "/pipeline",
  },
  {
    label: "Viewed Deals",
    icon: <Eye size={18} />,
    href: "/viewed",
  },
];

const evaluateItems: NavItem[] = [
  {
    label: "Market Insights",
    icon: <TrendingUp size={18} />,
    children: [
      { label: "Industry Trends", href: "/insights/industry-trends" },
      { label: "Valuation Comps", href: "/insights/valuation-comps" },
    ],
  },
  {
    label: "DealScreen",
    icon: <Shield size={18} />,
    href: "/deal-screen",
    badge: "New",
    badgeColor: "bg-brand-500",
  },
];

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar-bg transition-all duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-sidebar-text-active tracking-tight">
              DealFlow
            </span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
            <Sparkles size={14} className="text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="flex h-6 w-6 items-center justify-center rounded text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {collapsed ? (
          <CollapsedNav />
        ) : (
          <>
            <NavSection label="SOURCE" items={sourceItems} />
            <NavSection label="TRACK" items={trackItems} />
            <NavSection label="EVALUATE & STRUCTURE" items={evaluateItems} />
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {!collapsed ? (
          <>
            <Link
              href="/upgrade"
              className="block w-full rounded-lg bg-brand-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Upgrade
            </Link>
            <NavItemRow
              icon={<HelpCircle size={18} />}
              label="Help Center"
              collapsed={false}
              href="/help-center"
            />
            <NavItemRow
              icon={<Settings size={18} />}
              label="Settings"
              collapsed={false}
              href="/settings"
            />
          </>
        ) : (
          <>
            <button
              onClick={toggleSidebar}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function CollapsedNav() {
  const pathname = usePathname();
  const items: Array<{ href: string; icon: React.ReactNode }> = [
    { href: "/", icon: <Home size={18} key="h" /> },
    { href: "/deals", icon: <Search size={18} key="s" /> },
    { href: "/saved-searches/saas-500k", icon: <Bookmark size={18} key="b" /> },
    { href: "/buyer-profile", icon: <UserCircle size={18} key="u" /> },
    { href: "/pipeline", icon: <GitBranch size={18} key="g" /> },
    { href: "/viewed", icon: <Eye size={18} key="e" /> },
    { href: "/deal-screen", icon: <Shield size={18} key="sh" /> },
  ];

  const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="space-y-1 flex flex-col items-center">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors",
            isActivePath(item.href) && "bg-sidebar-active text-sidebar-text-active"
          )}
        >
          {item.icon}
        </Link>
      ))}
    </div>
  );
}

function NavSection({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div>
      <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/50">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItemExpandable key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function NavItemExpandable({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const isCurrent = !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
  const isChildCurrent = !!item.children?.some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
  );
  const isActive = isCurrent || isChildCurrent;

  const rowClass = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
    isActive
      ? "bg-sidebar-active text-sidebar-text-active font-medium"
      : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
  );

  return (
    <div>
      {hasChildren ? (
        <button onClick={() => setOpen(!open)} className={rowClass}>
          <span className="shrink-0">{item.icon}</span>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white",
                item.badgeColor || "bg-emerald-500"
              )}
            >
              {item.badge}
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 transition-transform",
              (open || isChildCurrent) && "rotate-180"
            )}
          />
        </button>
      ) : (
        <Link href={item.href || "#"} className={rowClass}>
          <span className="shrink-0">{item.icon}</span>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white",
                item.badgeColor || "bg-emerald-500"
              )}
            >
              {item.badge}
            </span>
          )}
        </Link>
      )}
      {hasChildren && (open || isChildCurrent) && (
        <div className="ml-7 mt-0.5 space-y-0.5">
          {item.children!.map((child) => (
            <Link
              key={child.label}
              href={child.href}
              className={cn(
                "block rounded px-2.5 py-1 text-xs transition-colors",
                pathname === child.href || pathname.startsWith(`${child.href}/`)
                  ? "bg-sidebar-active text-sidebar-text-active"
                  : "text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-hover"
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItemRow({
  icon,
  label,
  collapsed,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors",
        collapsed ? "w-9 h-9 justify-center mx-auto" : "w-full"
      )}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
