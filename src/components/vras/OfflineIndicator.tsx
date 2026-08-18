import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { flushQueue, onQueueChange } from "@/lib/offline";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const unsubscribe = onQueueChange(setPending);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!online || pending === 0 || syncing) return;
    setSyncing(true);
    flushQueue()
      .then((count) => {
        if (count > 0) toast.success(`Synced ${count} offline entr${count === 1 ? "y" : "ies"}`);
      })
      .finally(() => setSyncing(false));
  }, [online, pending, syncing]);

  if (online && pending === 0) {
    return (
      <Badge variant="outline" className="hidden gap-1 border-success/40 text-success sm:inline-flex">
        <Wifi className="size-3" /> Online
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={
        online ? "gap-1 border-warning/50 text-warning" : "gap-1 border-destructive/50 text-destructive"
      }
    >
      {syncing ? (
        <RefreshCw className="size-3 animate-spin" />
      ) : (
        <CloudOff className="size-3 live-dot" />
      )}
      {online ? `Syncing ${pending}` : `Offline · ${pending} queued`}
    </Badge>
  );
}
