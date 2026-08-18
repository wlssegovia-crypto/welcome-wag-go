import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLastSyncedAt, onQueueChange } from "@/lib/offline";

export type DeviceKind = "GATE_TERMINAL" | "KIOSK";

const DEVICE_KEY_STORAGE = "vras.device-key";
const DEVICE_NAME_STORAGE = "vras.device-name";
export const HEARTBEAT_SECONDS = 30;
/** A device is considered offline once no heartbeat lands within this window. */
export const STALE_SECONDS = 90;

export function deviceKey(): string {
  if (typeof window === "undefined") return "server";
  let key = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY_STORAGE, key);
  }
  return key;
}

export function deviceName(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(DEVICE_NAME_STORAGE) || fallback;
}

export function setDeviceName(name: string) {
  localStorage.setItem(DEVICE_NAME_STORAGE, name.trim().slice(0, 60));
}

type BatteryLike = { level: number; addEventListener?: (t: string, fn: () => void) => void };

async function batteryPercent(): Promise<number | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
  if (!nav.getBattery) return null;
  try {
    const b = await nav.getBattery();
    return Math.round(b.level * 100);
  } catch {
    return null;
  }
}

/**
 * Registers this browser as a monitored device and sends a heartbeat every
 * HEARTBEAT_SECONDS with connectivity, retry-queue depth and battery level.
 */
export function useDeviceHeartbeat(options: {
  propertyId: string | null | undefined;
  kind: DeviceKind;
  gate?: string | null;
  defaultName: string;
}) {
  const { propertyId, kind, gate, defaultName } = options;
  const [queueDepth, setQueueDepth] = useState(0);
  const [online, setOnline] = useState(true);
  const [lastBeat, setLastBeat] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const queueRef = useRef(0);
  const onlineRef = useRef(true);

  useEffect(() => {
    const unsub = onQueueChange((n) => {
      queueRef.current = n;
      setQueueDepth(n);
    });
    const sync = () => {
      onlineRef.current = navigator.onLine;
      setOnline(navigator.onLine);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      unsub();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    async function beat() {
      if (cancelled || !navigator.onLine) return;
      const payload = {
        property_id: propertyId!,
        device_key: deviceKey(),
        name: deviceName(defaultName),
        kind,
        gate: gate ?? null,
        app_version: "1.0.0",
        user_agent: navigator.userAgent.slice(0, 200),
        online: true,
        queue_depth: queueRef.current,
        battery_percent: await batteryPercent(),
        last_synced_at: await getLastSyncedAt(),
        last_seen_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("devices")
        .upsert(payload, { onConflict: "property_id,device_key" });
      if (cancelled) return;
      if (error) setLastError(error.message);
      else {
        setLastError(null);
        setLastBeat(payload.last_seen_at);
      }
    }

    void beat();
    const id = window.setInterval(beat, HEARTBEAT_SECONDS * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [propertyId, kind, gate, defaultName]);

  return { queueDepth, online, lastBeat, lastError };
}

export function isStale(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > STALE_SECONDS * 1000;
}

export function sinceLabel(value: string | null | undefined): string {
  if (!value) return "never";
  const secs = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}
