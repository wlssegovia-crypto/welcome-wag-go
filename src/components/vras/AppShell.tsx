import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-vras";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OfflineIndicator } from "@/components/vras/OfflineIndicator";
import { ROLE_LABELS } from "@/lib/vras";

const NAV = [
  { to: "/dashboard/admin", label: "Admin", staffOnly: true, adminOnly: true },
  { to: "/gate/terminal", label: "Gate terminal", staffOnly: true },
  { to: "/kiosk/self-checkin", label: "Kiosk", staffOnly: false },
  { to: "/portal/resident", label: "My portal", staffOnly: false },
  { to: "/analytics/audit", label: "Audit", staffOnly: true },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => {
    if (item.adminOnly) return me?.isAdmin;
    if (item.staffOnly) return me?.isStaff;
    return true;
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <span className="font-display text-sm font-bold tracking-widest">VRAS</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <OfflineIndicator />
            {me?.roles[0] && (
              <Badge variant="outline" className="hidden border-primary/40 text-primary sm:inline-flex">
                {ROLE_LABELS[me.roles[0]]}
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
        {open && (
          <nav className="grid gap-1 border-t border-border px-4 py-2 md:hidden">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}
