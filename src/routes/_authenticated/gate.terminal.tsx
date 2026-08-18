import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanLine, UserPlus, Package, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-vras";
import { AppShell } from "@/components/vras/AppShell";
import { DeviceStatusCard } from "@/components/vras/DeviceStatusCard";
import { CameraCapture } from "@/components/vras/CameraCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordAccessLog } from "@/lib/offline";
import { extractIdDocument, verifyFace } from "@/lib/ai.functions";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  formatDateTime,
  maskPhone,
  parsePassPayload,
  verifyPassPayload,
} from "@/lib/vras";

export const Route = createFileRoute("/_authenticated/gate/terminal")({
  head: () => ({
    meta: [
      { title: "Gate terminal — VRAS" },
      {
        name: "description",
        content: "High-speed guard station: scan passes, capture IDs and photos, log walk-ins and parcels.",
      },
      { property: "og:title", content: "Gate terminal — VRAS" },
      { property: "og:description", content: "Scan, verify and log every arrival at the guard house." },
    ],
  }),
  component: GateTerminal,
});

type Verdict = { tone: "granted" | "denied" | "pending"; title: string; detail: string } | null;

function beep(tone: "granted" | "denied" | "pending") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone === "denied" ? "sawtooth" : "sine";
    osc.frequency.value = tone === "granted" ? 880 : tone === "pending" ? 660 : 200;
    gain.gain.value = 0.12;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (tone === "denied" ? 0.5 : 0.18));
  } catch {
    /* audio unavailable */
  }
}

const walkInSchema = z.object({
  visitorName: z.string().trim().min(2, "Visitor name required").max(100),
  visitorPhone: z.string().trim().max(30).optional(),
  vehiclePlate: z.string().trim().max(15).optional(),
});

function GateTerminal() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const scanRef = useRef<HTMLInputElement | null>(null);
  const [scan, setScan] = useState("");
  const [gate, setGate] = useState<string>("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [parcelOpen, setParcelOpen] = useState(false);

  const propertyId = me?.profile?.property_id ?? null;
  const gates = me?.property?.gates ?? ["Main Gate"];
  const activeGate = gate || gates[0] || "Main Gate";

  const feed = useQuery({
    queryKey: ["gate-feed", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("access_logs")
        .select("*")
        .eq("property_id", propertyId!)
        .order("timestamp", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!propertyId) return;
    const channel = supabase
      .channel("gate-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "access_logs" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["gate-feed", propertyId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [propertyId, queryClient]);

  const announce = useCallback((next: NonNullable<Verdict>) => {
    setVerdict(next);
    beep(next.tone);
    window.setTimeout(() => setVerdict(null), 6000);
  }, []);

  const resolveScan = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !propertyId) return;
      setScan("");

      // 1. Parcel claim code
      if (code.startsWith("PCL-")) {
        const { data: parcel } = await supabase
          .from("parcels")
          .select("*")
          .eq("claim_code", code)
          .maybeSingle();
        if (!parcel || parcel.status !== "PENDING") {
          announce({ tone: "denied", title: "Invalid claim code", detail: code });
          return;
        }
        await supabase
          .from("parcels")
          .update({ status: "CLAIMED", claimed_at: new Date().toISOString() })
          .eq("id", parcel.id);
        announce({ tone: "granted", title: "Parcel released", detail: parcel.courier_name });
        return;
      }

      // 2. Rotating resident/employee pass
      const parsed = parsePassPayload(code);
      if (parsed) {
        const { data: cred } = await supabase
          .from("qr_credentials")
          .select("*")
          .eq("qr_token", parsed.token)
          .maybeSingle();
        if (!cred || !cred.is_active) {
          announce({ tone: "denied", title: "Pass not recognised", detail: "Credential inactive" });
          return;
        }
        if (cred.valid_until && new Date(cred.valid_until) < new Date()) {
          announce({ tone: "denied", title: "Pass expired", detail: formatDateTime(cred.valid_until) });
          return;
        }
        if (!verifyPassPayload(code, cred.qr_token)) {
          announce({ tone: "denied", title: "Stale QR code", detail: "Screenshot or replay rejected" });
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", cred.user_id)
          .maybeSingle();
        await recordAccessLog({
          client_ref: crypto.randomUUID(),
          property_id: propertyId,
          user_id: cred.user_id,
          visitor_name: profile?.full_name ?? null,
          category: profile?.category ?? "RESIDENT",
          entry_gate: activeGate,
          direction: "IN",
          status: "GRANTED",
          created_by: me?.userId ?? null,
          timestamp: new Date().toISOString(),
        });
        announce({
          tone: "granted",
          title: `Welcome, ${profile?.full_name || "resident"}`,
          detail: `${CATEGORY_LABELS[(profile?.category ?? "RESIDENT") as keyof typeof CATEGORY_LABELS]} · ${activeGate}`,
        });
        void feed.refetch();
        return;
      }

      // 3. Guest invite access code
      const { data: invite } = await supabase
        .from("guest_invites")
        .select("*")
        .eq("access_code", code.toUpperCase())
        .maybeSingle();
      if (!invite) {
        announce({ tone: "denied", title: "Unknown code", detail: code });
        return;
      }
      const now = new Date();
      if (new Date(invite.valid_until) < now || new Date(invite.valid_from) > now) {
        announce({ tone: "denied", title: "Guest pass expired", detail: invite.guest_name });
        return;
      }
      await supabase.from("guest_invites").update({ is_used: true }).eq("id", invite.id);
      await recordAccessLog({
        client_ref: crypto.randomUUID(),
        property_id: propertyId,
        host_id: invite.host_id,
        invite_id: invite.id,
        visitor_name: invite.guest_name,
        visitor_phone: invite.guest_phone,
        vehicle_plate: invite.vehicle_plate,
        category: "GUEST",
        entry_gate: activeGate,
        direction: "IN",
        status: "GRANTED",
        created_by: me?.userId ?? null,
        timestamp: new Date().toISOString(),
      });
      announce({ tone: "granted", title: invite.guest_name, detail: "Pre-approved guest" });
      void feed.refetch();
    },
    [propertyId, activeGate, announce, feed, me?.userId],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && document.activeElement === scanRef.current && scan === "") {
        e.preventDefault();
        setWalkInOpen(true);
      }
      if (e.key === "F2") {
        e.preventDefault();
        scanRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scan]);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  return (
    <AppShell title="Gate terminal">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div
            className={`panel p-6 transition-colors ${
              verdict?.tone === "granted"
                ? "border-success bg-success/10"
                : verdict?.tone === "denied"
                  ? "border-destructive bg-destructive/10"
                  : verdict?.tone === "pending"
                    ? "border-warning bg-warning/10"
                    : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <p className="label-caps">Scan pass, guest code or parcel claim</p>
              <div className="ml-auto w-44">
                <Select value={activeGate} onValueChange={setGate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gates.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void resolveScan(scan);
              }}
              className="mt-4 flex gap-3"
            >
              <Input
                ref={scanRef}
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="Waiting for scanner…"
                autoComplete="off"
                className="h-16 font-mono text-lg"
              />
              <Button type="submit" size="lg" className="h-16 px-8 text-base">
                <ScanLine className="size-5" /> Verify
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Enter submits · Space opens walk-in capture · F2 refocuses the scanner
            </p>

            {verdict && (
              <div className="mt-5 flex items-center gap-3">
                {verdict.tone === "denied" ? (
                  <ShieldAlert className="size-10 text-destructive" />
                ) : (
                  <ShieldCheck
                    className={`size-10 ${verdict.tone === "granted" ? "text-success" : "text-warning"}`}
                  />
                )}
                <div>
                  <p className="text-2xl font-bold">{verdict.title}</p>
                  <p className="text-sm text-muted-foreground">{verdict.detail}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="lg">
                  <UserPlus className="size-5" /> Walk-in / delivery
                </Button>
              </DialogTrigger>
              <WalkInDialog
                propertyId={propertyId}
                gate={activeGate}
                guardId={me?.userId ?? null}
                requireApproval={me?.property?.require_host_approval ?? true}
                onDone={(v) => {
                  setWalkInOpen(false);
                  announce(v);
                  void feed.refetch();
                }}
              />
            </Dialog>

            <Dialog open={parcelOpen} onOpenChange={setParcelOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="lg">
                  <Package className="size-5" /> Log parcel
                </Button>
              </DialogTrigger>
              <ParcelDialog propertyId={propertyId} onDone={() => setParcelOpen(false)} />
            </Dialog>
          </div>
        </div>

        <div className="space-y-6">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Live gate activity</h2>
          <div className="mt-3 space-y-2">
            {feed.data?.map((log) => (
              <div key={log.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{log.visitor_name ?? "Registered pass"}</span>
                  <Badge
                    variant="outline"
                    className={
                      log.status === "GRANTED"
                        ? "border-success/50 text-success"
                        : log.status === "DENIED"
                          ? "border-destructive/50 text-destructive"
                          : "border-warning/50 text-warning"
                    }
                  >
                    {log.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {log.entry_gate} · {formatDateTime(log.timestamp)} · {maskPhone(log.visitor_phone)}
                  {log.synced_from_offline ? " · offline sync" : ""}
                </p>
              </div>
            ))}
            {!feed.data?.length && <p className="text-sm text-muted-foreground">No activity yet today.</p>}
          </div>
        </section>

          <DeviceStatusCard
            propertyId={propertyId}
            kind="GATE_TERMINAL"
            gate={activeGate}
            defaultName="Gate terminal"
          />
        </div>
      </div>
    </AppShell>
  );
}

function WalkInDialog({
  propertyId,
  gate,
  guardId,
  requireApproval,
  onDone,
}: {
  propertyId: string | null;
  gate: string;
  guardId: string | null;
  requireApproval: boolean;
  onDone: (verdict: NonNullable<Verdict>) => void;
}) {
  const [form, setForm] = useState({ visitorName: "", visitorPhone: "", vehiclePlate: "" });
  const [category, setCategory] = useState<string>("TRANSIENT");
  const [hostId, setHostId] = useState<string>("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [idText, setIdText] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const hosts = useQuery({
    queryKey: ["hosts", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, unit_id, photo_url")
        .eq("property_id", propertyId!)
        .order("full_name");
      return data ?? [];
    },
  });

  async function runOcr() {
    if (!idPhoto) return;
    setBusy(true);
    try {
      const result = await extractIdDocument({ data: { image: idPhoto } });
      setIdText(`${result.documentType} ${result.idNumber}`.trim() || result.rawText.slice(0, 200));
      if (result.fullName && !form.visitorName) {
        setForm((f) => ({ ...f, visitorName: result.fullName }));
      }
      toast.success("ID text extracted");
    } catch {
      toast.error("Could not read the ID document");
    } finally {
      setBusy(false);
    }
  }

  async function runFaceCheck() {
    const host = hosts.data?.find((h) => h.id === hostId);
    if (!photo || !host?.photo_url) {
      toast.error("Need a live capture and a registered profile photo");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyFace({ data: { live: photo, reference: host.photo_url } });
      toast[result.match ? "success" : "warning"](
        `${result.match ? "Face match" : "No match"} · ${Math.round(result.confidence * 100)}%`,
      );
    } catch {
      toast.error("Face verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = walkInSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (!propertyId) {
      toast.error("No property assigned to your account");
      return;
    }
    const status = requireApproval && hostId ? "PENDING_HOST_APPROVAL" : "GRANTED";
    const result = await recordAccessLog({
      client_ref: crypto.randomUUID(),
      property_id: propertyId,
      host_id: hostId || null,
      visitor_name: parsed.data.visitorName,
      visitor_phone: parsed.data.visitorPhone || null,
      vehicle_plate: parsed.data.vehiclePlate || null,
      category,
      entry_gate: gate,
      direction: "IN",
      status,
      photo_captured: photo,
      id_document_text: idText || null,
      created_by: guardId,
      timestamp: new Date().toISOString(),
    });
    onDone({
      tone: status === "GRANTED" ? "granted" : "pending",
      title: parsed.data.visitorName,
      detail:
        status === "GRANTED"
          ? `Logged at ${gate}${result === "queued" ? " (offline queue)" : ""}`
          : "Waiting for host approval",
    });
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Walk-in check-in</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wname">Visitor name</Label>
          <Input
            id="wname"
            maxLength={100}
            value={form.visitorName}
            onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wphone">Mobile</Label>
          <Input
            id="wphone"
            maxLength={30}
            value={form.visitorPhone}
            onChange={(e) => setForm((f) => ({ ...f, visitorPhone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wplate">Vehicle plate</Label>
          <Input
            id="wplate"
            maxLength={15}
            value={form.vehiclePlate}
            onChange={(e) => setForm((f) => ({ ...f, vehiclePlate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Host</Label>
          <Select value={hostId} onValueChange={setHostId}>
            <SelectTrigger>
              <SelectValue placeholder="Select the person being visited" />
            </SelectTrigger>
            <SelectContent>
              {hosts.data?.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.full_name || "Unnamed occupant"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CameraCapture label="Live face capture" value={photo} onCapture={setPhoto} />
        <CameraCapture label="Physical ID capture" value={idPhoto} onCapture={setIdPhoto} />

        <div className="flex gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={runOcr} disabled={!idPhoto || busy}>
            Extract ID text
          </Button>
          <Button type="button" variant="secondary" onClick={runFaceCheck} disabled={!photo || busy}>
            Verify face
          </Button>
        </div>
        {idText && <p className="sm:col-span-2 font-mono text-xs text-muted-foreground">{idText}</p>}

        <Button type="submit" size="lg" className="sm:col-span-2">
          Log arrival
        </Button>
      </form>
    </DialogContent>
  );
}

function ParcelDialog({ propertyId, onDone }: { propertyId: string | null; onDone: () => void }) {
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [unitId, setUnitId] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  const units = useQuery({
    queryKey: ["units", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("units")
        .select("id, unit_number")
        .eq("property_id", propertyId!)
        .order("unit_number");
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || courier.trim().length < 2) {
      toast.error("Courier name is required");
      return;
    }
    const claimCode = `PCL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error } = await supabase.from("parcels").insert({
      property_id: propertyId,
      unit_id: unitId || null,
      courier_name: courier.trim().slice(0, 80),
      tracking_no: tracking.trim().slice(0, 60) || null,
      photo_url: photo,
      claim_code: claimCode,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Parcel logged · claim code ${claimCode}`);
    onDone();
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Log incoming parcel</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="courier">Courier</Label>
          <Input id="courier" maxLength={80} value={courier} onChange={(e) => setCourier(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tracking">Tracking number</Label>
          <Input id="tracking" maxLength={60} value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Recipient unit</Label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {units.data?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.unit_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CameraCapture label="Parcel photo" value={photo} onCapture={setPhoto} />
        <Button type="submit" className="w-full">
          Save parcel &amp; notify recipient
        </Button>
      </form>
    </DialogContent>
  );
}
