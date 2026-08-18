import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ScanLine, QrCode, Package, WifiOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VRAS — Visitor & Resident Access System" },
      {
        name: "description",
        content:
          "Multi-tenant gate control for condos, offices, campuses and resorts: rotating QR passes, guard terminal, parcel logging and offline-first check-ins.",
      },
      { property: "og:title", content: "VRAS — Visitor & Resident Access System" },
      {
        property: "og:description",
        content: "Rotating QR passes, guard terminal, host approvals and offline-first gate logs.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: QrCode, title: "Rotating digital passes", body: "Time-bound QR IDs that re-key every 30 seconds, so screenshots die on arrival." },
  { icon: ScanLine, title: "Guard terminal", body: "Hardware scanner input, camera capture, ID text extraction and audible grant/deny cues." },
  { icon: Users, title: "Host approvals", body: "Walk-ins ping the resident instantly; they approve or deny from their phone." },
  { icon: Package, title: "Parcel desk", body: "Log couriers with a photo, issue a claim code, verify on pickup." },
  { icon: WifiOff, title: "Offline-first", body: "Check-ins keep flowing during outages and replay automatically on reconnect." },
  { icon: ShieldCheck, title: "Tenant-scoped RBAC", body: "Admins, guards and residents see only what their property and role allow." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <span className="font-display text-sm font-bold tracking-[0.3em]">VRAS</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-20">
        <p className="label-caps">Visitor &amp; resident access system</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Every gate, every guest,
          <span className="text-primary"> one verified record.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Configure any property type — condominium, office tower, campus, factory or resort — then run
          high-throughput check-ins from the guard house, a self-service kiosk or a resident's phone.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Open your gate</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/gate/terminal">Guard terminal</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="panel p-6">
            <f.icon className="size-5 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
