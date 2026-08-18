import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, Trash2, Wifi, Activity } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  discardQueued,
  flushQueue,
  getLastSyncedAt,
  listQueue,
  onQueueChange,
  type PendingLog,
} from "@/lib/offline";
import {
  deviceName,
  sinceLabel,
  setDeviceName,
  useDeviceHeartbeat,
  type DeviceKind,
} from "@/hooks/use-device";
import { formatDateTime } from "@/lib/vras";

/** Per-device panel: connectivity, heartbeat status and the offline retry queue. */
export function DeviceStatusCard({
  propertyId,
  kind,
  gate,
  defaultName,
}: {
  propertyId: string | null;
  kind: DeviceKind;
  gate?: string | null;
  defaultName: string;
}) {
  const { queueDepth, online, lastBeat, lastError } = useDeviceHeartbeat({
    propertyId,
    kind,
    gate: gate ?? null,
    defaultName,
  });
  const [items, setItems] = useState<PendingLog[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await listQueue());
    setLastSync(await getLastSyncedAt());
  }, []);

  useEffect(() => {
    setName(deviceName(defaultName));
    const unsub = onQueueChange(() => void refresh());
    return unsub;
  }, [defaultName, refresh]);

  async function retry() {
    setRetrying(true);
    const synced = await flushQueue();
    setRetrying(false);
    await refresh();
    toast[synced > 0 ? "success" : "info"](
      synced > 0 ? `Replayed ${synced} queued entr${synced === 1 ? "y" : "ies"}` : "Nothing to replay",
    );
  }

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="size-4 text-primary" /> This device
        </h2>
        <Badge
          variant="outline"
          className={
            online ? "ml-auto gap-1 border-success/40 text-success" : "ml-auto gap-1 border-destructive/50 text-destructive"
          }
        >
          {online ? <Wifi className="size-3" /> : <CloudOff className="size-3 live-dot" />}
          {online ? "Connected" : "Offline"}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Row label="Last heartbeat" value={lastBeat ? sinceLabel(lastBeat) : "pending"} />
        <Row label="Last cloud sync" value={lastSync ? sinceLabel(lastSync) : "never"} />
        <Row label="Retry queue" value={`${queueDepth} pending`} />
        <Row label="Role" value={kind === "KIOSK" ? "Kiosk" : "Gate terminal"} />
      </dl>

      {lastError && <p className="mt-3 text-xs text-destructive">Heartbeat error: {lastError}</p>}

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="devname">Device name</Label>
        <div className="flex gap-2">
          <Input
            id="devname"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setDeviceName(name);
              toast.success("Device name saved");
            }}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={retry} disabled={retrying || !online} className="gap-2">
          <RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} /> Retry queued entries
        </Button>
      </div>

      {items.length > 0 && (
        <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.client_ref}
              className="flex items-center gap-3 rounded-lg border border-border p-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">{item.visitor_name || "Access log"}</p>
                <p className="text-xs text-muted-foreground">
                  {item.entry_gate} · {item.direction} · {formatDateTime(item.timestamp)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label="Discard queued entry"
                onClick={async () => {
                  await discardQueued(item.client_ref);
                  await refresh();
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="label-caps text-xs">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
