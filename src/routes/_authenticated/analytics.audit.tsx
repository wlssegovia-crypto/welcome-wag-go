import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-vras";
import { AppShell } from "@/components/vras/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  formatDateTime,
  maskPhone,
  type Category,
} from "@/lib/vras";

export const Route = createFileRoute("/_authenticated/analytics/audit")({
  head: () => ({
    meta: [
      { title: "Access audit log — VRAS" },
      {
        name: "description",
        content: "Filterable gate activity log with CSV export, offline sync markers and privacy masking.",
      },
      { property: "og:title", content: "Access audit log — VRAS" },
      { property: "og:description", content: "Every entry and exit, filterable and exportable." },
    ],
  }),
  component: Audit,
});

const STATUSES = ["GRANTED", "DENIED", "PENDING_HOST_APPROVAL", "EXPIRED"] as const;

function Audit() {
  const { data: me } = useMe();
  const propertyId = me?.profile?.property_id ?? null;
  const mask = me?.property?.mask_contacts_in_logs ?? true;

  const [category, setCategory] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [gate, setGate] = useState<string>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const logs = useQuery({
    queryKey: ["audit", propertyId, category, status, gate, from, to],
    enabled: !!propertyId,
    queryFn: async () => {
      let q = supabase
        .from("access_logs")
        .select("*")
        .eq("property_id", propertyId!)
        .order("timestamp", { ascending: false })
        .limit(500);
      if (category !== "ALL") q = q.eq("category", category as Category);
      if (status !== "ALL") q = q.eq("status", status as (typeof STATUSES)[number]);
      if (gate !== "ALL") q = q.eq("entry_gate", gate);
      if (from) q = q.gte("timestamp", new Date(from).toISOString());
      if (to) q = q.lte("timestamp", new Date(to).toISOString());
      const { data } = await q;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const rows = logs.data ?? [];
    return {
      total: rows.length,
      granted: rows.filter((r) => r.status === "GRANTED").length,
      denied: rows.filter((r) => r.status === "DENIED").length,
      offline: rows.filter((r) => r.synced_from_offline).length,
    };
  }, [logs.data]);

  function exportCsv() {
    const rows = logs.data ?? [];
    const header = ["Timestamp", "Name", "Category", "Gate", "Direction", "Status", "Contact", "Offline"];
    const body = rows.map((r) => [
      new Date(r.timestamp).toISOString(),
      r.visitor_name ?? "",
      r.category,
      r.entry_gate,
      r.direction,
      r.status,
      mask ? maskPhone(r.visitor_phone) : (r.visitor_phone ?? ""),
      r.synced_from_offline ? "yes" : "no",
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vras-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gates = me?.property?.gates ?? [];

  return (
    <AppShell title="Access audit">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Events", value: stats.total },
          { label: "Granted", value: stats.granted },
          { label: "Denied", value: stats.denied },
          { label: "Offline synced", value: stats.offline },
        ].map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="label-caps">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="panel mt-6 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Gate</Label>
            <Select value={gate} onValueChange={setGate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All gates</SelectItem>
                {gates.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="no-print mt-4 flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / PDF
          </Button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Gate</th>
                <th className="py-2 pr-3 font-medium">Contact</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.data?.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">{formatDateTime(r.timestamp)}</td>
                  <td className="py-2 pr-3">{r.visitor_name ?? "Registered pass"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {CATEGORY_LABELS[r.category as Category]}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.entry_gate}
                    {r.synced_from_offline ? " ⟳" : ""}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {mask ? maskPhone(r.visitor_phone) : (r.visitor_phone ?? "—")}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge
                      variant="outline"
                      className={
                        r.status === "GRANTED"
                          ? "border-success/50 text-success"
                          : r.status === "DENIED"
                            ? "border-destructive/50 text-destructive"
                            : "border-warning/50 text-warning"
                      }
                    >
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.data?.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">No events match these filters.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
