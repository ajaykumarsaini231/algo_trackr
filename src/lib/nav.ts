/** Sidebar navigation model. Icons resolve through `components/shared/icon`. */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  admin?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Learn", href: "/learn", icon: "Gauge" },
  { label: "Google Prep", href: "/google", icon: "Target" },
  { label: "Topics", href: "/topics", icon: "FolderTree" },
  { label: "Companies", href: "/companies", icon: "Building2" },
  { label: "Patterns", href: "/patterns", icon: "Sparkles" },
  { label: "Algorithm Patterns", href: "/algorithm-patterns", icon: "Cpu" },
  { label: "Sheets", href: "/sheets", icon: "BookMarked" },
  { label: "Favorites", href: "/favorites", icon: "Star" },
  { label: "Revision", href: "/revision", icon: "RotateCcw" },
  { label: "Statistics", href: "/statistics", icon: "BarChart3" },
  { label: "Search", href: "/search", icon: "Search" },
  { label: "Admin Panel", href: "/admin", icon: "ShieldCheck", admin: true },
  { label: "Settings", href: "/settings", icon: "Settings" },
];
