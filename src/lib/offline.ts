import { get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "vras.pending-access-logs";

export type PendingLog = {
  client_ref: string;
  property_id: string;
  user_id?: string | null;
  host_id?: string | null;
  invite_id?: string | null;
  visitor_name?: string | null;
  visitor_phone?: string | null;
  vehicle_plate?: string | null;
  category: string;
  entry_gate: string;
  direction: string;
  status: string;
  photo_captured?: string | null;
  id_document_text?: string | null;
  notes?: string | null;
  created_by?: string | null;
  timestamp: string;
};

const listeners = new Set<(count: number) => void>();

async function readQueue(): Promise<PendingLog[]> {
  return (await get<PendingLog[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(items: PendingLog[]) {
  await set(QUEUE_KEY, items);
  listeners.forEach((fn) => fn(items.length));
}

export function onQueueChange(fn: (count: number) => void): () => void {
  listeners.add(fn);
  void pendingCount().then(fn);
  return () => listeners.delete(fn);
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Read-only view of the retry queue for device health UIs. */
export async function listQueue(): Promise<PendingLog[]> {
  return readQueue();
}

/** Drop a single stuck entry from the retry queue. */
export async function discardQueued(clientRef: string): Promise<void> {
  const items = await readQueue();
  await writeQueue(items.filter((i) => i.client_ref !== clientRef));
}

/** Clear the whole retry queue (destructive). */
export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

const LAST_SYNC_KEY = "vras.last-sync-at";

export async function getLastSyncedAt(): Promise<string | null> {
  return (await get<string>(LAST_SYNC_KEY)) ?? null;
}

export async function enqueueLog(log: PendingLog) {
  const items = await readQueue();
  items.push(log);
  await writeQueue(items);
}

/** Try to write immediately; fall back to the offline queue on any failure. */
export async function recordAccessLog(log: PendingLog): Promise<"synced" | "queued"> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueLog(log);
    return "queued";
  }
  const { error } = await supabase.from("access_logs").insert({ ...log } as never);
  if (error) {
    await enqueueLog(log);
    return "queued";
  }
  return "synced";
}

/** Replay queued logs. Conflicts resolve on the unique client_ref (last write wins server-side). */
export async function flushQueue(): Promise<number> {
  const items = await readQueue();
  if (items.length === 0) return 0;
  const remaining: PendingLog[] = [];
  let synced = 0;
  for (const item of items) {
    const { error } = await supabase
      .from("access_logs")
      .upsert({ ...item, synced_from_offline: true } as never, { onConflict: "client_ref" });
    if (error) remaining.push(item);
    else synced++;
  }
  await writeQueue(remaining);
  if (synced > 0) await set(LAST_SYNC_KEY, new Date().toISOString());
  return synced;
}
