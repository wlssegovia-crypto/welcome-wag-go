import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Package, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-vras";
import { AppShell } from "@/components/vras/AppShell";
import { QrPass } from "@/components/vras/QrPass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, formatDateTime, randomCode } from "@/lib/vras";

export const Route = createFileRoute("/_authenticated/portal/resident")({
  head: () => ({
    meta: [
      { title: "My access portal — VRAS" },
      {
        name: "description",
        content: "Show your digital pass, pre-register guests, approve gate arrivals and claim parcels.",
      },
      { property: "og:title", content: "My access portal — VRAS" },
      { property: "og:description", content: "Digital pass, guest invites, parcels and live gate approvals." },
    ],
  }),
  component: ResidentPortal,
});

const inviteSchema = z.object({
  guestName: z.string().trim().min(2, "Guest name is required").max(100),
  guestPhone: z.string().trim().max(30).optional(),
  vehiclePlate: z.string().trim().max(15).optional(),
  purpose: z.string().trim().max(140).optional(),
  validUntil: z.string().min(1, "Choose an expiry"),
});

function ResidentPortal() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    vehiclePlate: "",
    purpose: "",
    validUntil: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  });

  const invites = useQuery({
    queryKey: ["invites", me?.userId],
    enabled: !!me?.userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("guest_invites")
        .select("*")
        .eq("host_id", me!.userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const approvals = useQuery({
    queryKey: ["approvals", me?.userId],
    enabled: !!me?.userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("access_logs")
        .select("*")
        .eq("host_id", me!.userId)
        .eq("status", "PENDING_HOST_APPROVAL")
        .order("timestamp", { ascending: false });
      return data ?? [];
    },
  });

  const parcels = useQuery({
    queryKey: ["my-parcels", me?.userId],
    enabled: !!me?.userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("parcels")
        .select("*")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!me?.userId) return;
    const channel = supabase
      .channel("resident-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "access_logs" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["approvals", me.userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "parcels" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["my-parcels", me.userId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me?.userId, queryClient]);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inviteSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (!me?.profile?.property_id) {
      toast.error("Your account is not assigned to a property yet");
      return;
    }
    const { error } = await supabase.from("guest_invites").insert({
      property_id: me.profile.property_id,
      host_id: me.userId,
      guest_name: parsed.data.guestName,
      guest_phone: parsed.data.guestPhone || null,
      vehicle_plate: parsed.data.vehiclePlate || null,
      purpose: parsed.data.purpose || null,
      access_code: randomCode("G-"),
      valid_until: new Date(parsed.data.validUntil).toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Guest pre-registered");
    setForm((f) => ({ ...f, guestName: "", guestPhone: "", vehiclePlate: "", purpose: "" }));
    void invites.refetch();
  }

  async function decide(id: string, status: "GRANTED" | "DENIED") {
    const { error } = await supabase.from("access_logs").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "GRANTED" ? "Entry approved" : "Entry denied");
    void approvals.refetch();
  }

  return (
    <AppShell title="My access portal">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          {me?.credential ? (
            <QrPass
              token={me.credential.qr_token}
              name={me.profile?.full_name || me.email || "Resident"}
              subtitle={[
                me.profile?.position,
                CATEGORY_LABELS[(me.profile?.category ?? "RESIDENT") as keyof typeof CATEGORY_LABELS],
                me.property?.name,
              ]
                .filter(Boolean)
                .join(" · ")}

              validUntil={me.credential.valid_until}
            />
          ) : (
            <div className="panel p-6 text-sm text-muted-foreground">Your pass is being provisioned.</div>
          )}

          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Package className="size-4 text-primary" /> Parcels waiting
            </h2>
            <div className="mt-3 space-y-2">
              {parcels.data?.length ? (
                parcels.data.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.courier_name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {p.claim_code}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.tracking_no ?? "No tracking"} · {formatDateTime(p.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nothing waiting at the desk.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BellRing className="size-4 text-accent" /> Gate approvals
              {approvals.data?.length ? (
                <span className="live-dot rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  {approvals.data.length}
                </span>
              ) : null}
            </h2>
            <div className="mt-3 space-y-2">
              {approvals.data?.length ? (
                approvals.data.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 p-3"
                  >
                    {log.photo_captured && (
                      <img src={log.photo_captured} alt="" className="size-12 rounded-md object-cover" />
                    )}
                    <div className="min-w-40 flex-1">
                      <p className="font-medium">{log.visitor_name ?? "Visitor"}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.entry_gate} · {formatDateTime(log.timestamp)}
                        {log.vehicle_plate ? ` · ${log.vehicle_plate}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(log.id, "GRANTED")}>
                        <Check className="size-4" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(log.id, "DENIED")}>
                        <X className="size-4" /> Deny
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No one is waiting at the gate.</p>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Pre-register a guest</h2>
            <form onSubmit={createInvite} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guestName">Guest name</Label>
                <Input
                  id="guestName"
                  maxLength={100}
                  value={form.guestName}
                  onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guestPhone">Mobile</Label>
                <Input
                  id="guestPhone"
                  maxLength={30}
                  value={form.guestPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plate">Vehicle plate</Label>
                <Input
                  id="plate"
                  maxLength={15}
                  value={form.vehiclePlate}
                  onChange={(e) => setForm((f) => ({ ...f, vehiclePlate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validUntil">Valid until</Label>
                <Input
                  id="validUntil"
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Input
                  id="purpose"
                  maxLength={140}
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                />
              </div>
              <Button type="submit" className="sm:col-span-2">
                <Plus className="size-4" /> Issue guest pass
              </Button>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">My guest passes</h2>
            <div className="mt-3 space-y-2">
              {invites.data?.length ? (
                invites.data.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{invite.guest_name}</p>
                      <p className="text-xs text-muted-foreground">
                        expires {formatDateTime(invite.valid_until)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-secondary px-2 py-1 font-mono text-xs">
                        {invite.access_code}
                      </code>
                      <Badge variant={invite.is_used ? "secondary" : "outline"}>
                        {invite.is_used ? "Used" : "Active"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            `${invite.guest_name}, your gate code for ${me?.property?.name ?? "the property"} is ${invite.access_code}`,
                          );
                          toast.success("SMS text copied");
                        }}
                      >
                        Copy SMS
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No guest passes yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
