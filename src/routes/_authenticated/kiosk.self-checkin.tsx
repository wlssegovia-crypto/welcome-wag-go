import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-vras";
import { AppShell } from "@/components/vras/AppShell";
import { CameraCapture } from "@/components/vras/CameraCapture";
import { DeviceStatusCard } from "@/components/vras/DeviceStatusCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAccessLog } from "@/lib/offline";
import { extractIdDocument } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/kiosk/self-checkin")({
  head: () => ({
    meta: [
      { title: "Self check-in kiosk — VRAS" },
      {
        name: "description",
        content: "Walk-in visitors select a host, capture a photo and ID, then wait for gate approval.",
      },
      { property: "og:title", content: "Self check-in kiosk — VRAS" },
      { property: "og:description", content: "Touch-friendly visitor self check-in with host approval." },
    ],
  }),
  component: Kiosk,
});

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  phone: z.string().trim().max(30).optional(),
});

function Kiosk() {
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hostId, setHostId] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const propertyId = me?.profile?.property_id ?? null;
  const unitLabel = me?.property?.unit_label ?? "Unit";

  const hosts = useQuery({
    queryKey: ["kiosk-hosts", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, unit_id")
        .eq("property_id", propertyId!)
        .order("full_name");
      return data ?? [];
    },
  });

  async function submit() {
    const parsed = schema.safeParse({ name, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    if (!propertyId) {
      toast.error("Kiosk is not linked to a property");
      return;
    }
    setBusy(true);
    let idText: string | null = null;
    if (idPhoto) {
      try {
        const r = await extractIdDocument({ data: { image: idPhoto } });
        idText = `${r.documentType} ${r.idNumber}`.trim() || null;
      } catch {
        idText = null;
      }
    }
    await recordAccessLog({
      client_ref: crypto.randomUUID(),
      property_id: propertyId,
      host_id: hostId || null,
      visitor_name: parsed.data.name,
      visitor_phone: parsed.data.phone || null,
      category: "TRANSIENT",
      entry_gate: "Kiosk",
      direction: "IN",
      status: "PENDING_HOST_APPROVAL",
      photo_captured: photo,
      id_document_text: idText,
      timestamp: new Date().toISOString(),
    });
    setBusy(false);
    setDone(true);
  }

  if (done) {
    return (
      <AppShell title="Self check-in">
        <div className="panel mx-auto max-w-xl p-10 text-center">
          <CheckCircle2 className="mx-auto size-16 text-success" />
          <h2 className="mt-6 text-3xl font-bold">Thanks, {name.split(" ")[0]}</h2>
          <p className="mt-3 text-muted-foreground">
            Your host has been notified. Please wait by the lobby desk for approval.
          </p>
          <Button
            size="lg"
            className="mt-8"
            onClick={() => {
              setDone(false);
              setStep(0);
              setName("");
              setPhone("");
              setHostId("");
              setPhoto(null);
              setIdPhoto(null);
            }}
          >
            Start a new check-in
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Self check-in">
      <div className="panel mx-auto max-w-2xl p-8">
        <p className="label-caps">Step {step + 1} of 3</p>

        {step === 0 && (
          <div className="mt-6 space-y-5">
            <h2 className="text-2xl font-bold">Who is visiting?</h2>
            <div className="space-y-1.5">
              <Label htmlFor="kname">Full name</Label>
              <Input
                id="kname"
                className="h-14 text-lg"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kphone">Mobile number</Label>
              <Input
                id="kphone"
                className="h-14 text-lg"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button size="lg" className="h-14 w-full text-base" onClick={() => setStep(1)}>
              Continue <ArrowRight className="size-5" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 space-y-5">
            <h2 className="text-2xl font-bold">Who are you visiting?</h2>
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
              {hosts.data?.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHostId(h.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    hostId === h.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <span className="block font-medium">{h.full_name || "Occupant"}</span>
                  <span className="text-xs text-muted-foreground">{unitLabel}</span>
                </button>
              ))}
              {!hosts.data?.length && (
                <p className="text-sm text-muted-foreground">No hosts registered yet.</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button size="lg" variant="secondary" className="h-14" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button size="lg" className="h-14 flex-1 text-base" onClick={() => setStep(2)}>
                Continue <ArrowRight className="size-5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-5">
            <h2 className="text-2xl font-bold">Photo &amp; ID</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <CameraCapture label="Your photo" value={photo} onCapture={setPhoto} />
              <CameraCapture label="Your ID card" value={idPhoto} onCapture={setIdPhoto} />
            </div>
            <div className="flex gap-3">
              <Button size="lg" variant="secondary" className="h-14" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="lg" className="h-14 flex-1 text-base" onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="size-5 animate-spin" /> : null} Request entry
              </Button>
            </div>
          </div>
        )}
      </div>

      {me?.isStaff && (
        <div className="mx-auto mt-6 max-w-2xl">
          <DeviceStatusCard propertyId={propertyId} kind="KIOSK" gate="Kiosk" defaultName="Lobby kiosk" />
        </div>
      )}
    </AppShell>
  );
}
