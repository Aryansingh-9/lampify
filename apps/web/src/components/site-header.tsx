"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mock-interviews", label: "Mock Interviews" },
  { href: "/pathways", label: "Pathways" },
  { href: "/interview-wizard", label: "Interview Wizard" },
  { href: "/profile/resumes", label: "Resumes" },
];

export function SiteHeader() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";

  if (loading || !user) return null;

  return (
    <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="text-lg font-bold text-primary">
          Lampify
        </Link>
        <nav className="hidden md:flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
                pathname === l.href || pathname.startsWith(l.href + "/") ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
                pathname.startsWith("/admin") ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline text-muted-foreground truncate max-w-[140px]">{user.email}</span>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
