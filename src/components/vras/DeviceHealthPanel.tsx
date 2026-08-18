import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MonitorSmartphone, BatteryMedium, RefreshCw, CloudOff, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isStale, sinceLabel, STALE_SECONDS } from "@/hooks/use-device";

const KIND_LABELS: Record<string, string> = {
  GATE_TERMINAL: "Gate terminal",
  KIOSK: "Kiosk",
};

export function DeviceHealthPanel({ propertyId }: { propertyId: string | null }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const devices = useQuery({
    queryKey: ["devices", propertyId],
    enabled: !!propertyId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("devices")
        .select("*")
        .eq("property_id", propertyId!)
        .order("last_seen_at", { ascending: false });
      return data ?? [];
    },
  });

  const rows = devices.data ?? [];
  const offline = rows.filter((d) => isStale(d.last_seen_at) || !d.online).length;
  const queued = rows.reduce((sum, d) => sum + (d.queue_depth ?? 0), 0);

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MonitorSmartphone className="size-4 text-primary" /> Device health
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label="Refresh devices"
          onClick={() => void devices.refetch()}
        >
          <RefreshCw className={`size-4 ${devices.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Terminals and kiosks report in every 30s; anything silent for {STALE_SECONDS}s is flagged
        offline.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Devices" value={rows.length} />
        <Stat label="Offline" value={offline} tone={offline ? "bad" : "ok"} />
        <Stat label="Queued logs" value={queued} tone={queued ? "warn" : "ok"} />
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((d) => {
          const down = isStale(d.last_seen_at) || !d.online;
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border p-3"
            >
              <span
                className={`size-2 rounded-full ${down ? "bg-destructive live-dot" : "bg-success"}`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABELS[d.kind] ?? d.kind}
                  {d.gate ? ` · ${d.gate}` : ""} · seen {sinceLabel(d.last_seen_at)}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {typeof d.battery_percent === "number" && (
                  <Badge variant="outline" className="gap-1">
                    <BatteryMedium className="size-3" /> {d.battery_percent}%
                  </Badge>
                )}
                {d.queue_depth > 0 && (
                  <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
                    <CloudOff className="size-3" /> {d.queue_depth} queued
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    down ? "gap-1 border-destructive/50 text-destructive" : "gap-1 border-success/40 text-success"
                  }
                >
                  {down ? <CloudOff className="size-3" /> : <Wifi className="size-3" />}
                  {down ? "Offline" : "Online"}
                </Badge>
              </div>
              {d.last_error && (
                <p className="w-full text-xs text-destructive">Last error: {d.last_error}</p>
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No devices have reported yet. Open the gate terminal or kiosk on a device to register it.
          </li>
        )}
      </ul>
    </section>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="label-caps text-xs">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
