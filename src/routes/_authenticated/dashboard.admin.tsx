import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Layers, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-vras";
import { AppShell } from "@/components/vras/AppShell";
import { DeviceHealthPanel } from "@/components/vras/DeviceHealthPanel";
import { setUserRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  ROLES,
  ROLE_LABELS,
  maskEmail,
  type PropertyType,
  type Role,
} from "@/lib/vras";

export const Route = createFileRoute("/_authenticated/dashboard/admin")({
  head: () => ({
    meta: [
      { title: "Property administration — VRAS" },
      {
        name: "description",
        content: "Configure property type, zone and unit labels, gates, guard accounts and access policies.",
      },
      { property: "og:title", content: "Property administration — VRAS" },
      { property: "og:description", content: "Tenant configuration, zones, units and role assignment." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: me, refetch: refetchMe } = useMe();
  const propertyId = me?.profile?.property_id ?? null;
  const property = me?.property;

  const [form, setForm] = useState({
    name: "",
    type: "RESIDENTIAL_CONDO" as PropertyType,
    address: "",
    zoneLabel: "Zone",
    unitLabel: "Unit",
    gates: "Main Gate",
    requireHostApproval: true,
    maskContacts: true,
  });

  useEffect(() => {
    if (!property) return;
    setForm({
      name: property.name,
      type: property.type as PropertyType,
      address: property.address ?? "",
      zoneLabel: property.zone_label,
      unitLabel: property.unit_label,
      gates: (property.gates ?? []).join(", "),
      requireHostApproval: property.require_host_approval,
      maskContacts: property.mask_contacts_in_logs,
    });
  }, [property]);

  const zones = useQuery({
    queryKey: ["zones", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("zones")
        .select("id, name, units(id, unit_number)")
        .eq("property_id", propertyId!)
        .order("name");
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["people", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("property_id", propertyId!).order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.id)?.role as Role | undefined,
      }));
    },
  });

  async function saveProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId) return;
    const { error } = await supabase
      .from("properties")
      .update({
        name: form.name.trim().slice(0, 120),
        type: form.type,
        address: form.address.trim().slice(0, 200),
        zone_label: form.zoneLabel.trim().slice(0, 30) || "Zone",
        unit_label: form.unitLabel.trim().slice(0, 30) || "Unit",
        gates: form.gates
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
          .slice(0, 20),
        require_host_approval: form.requireHostApproval,
        mask_contacts_in_logs: form.maskContacts,
      })
      .eq("id", propertyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Property configuration saved");
    void refetchMe();
  }

  return (
    <AppShell title="Property administration">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-4 text-primary" /> Facility configuration
          </h2>
          <form onSubmit={saveProperty} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pname">Property name</Label>
              <Input
                id="pname"
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Property type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as PropertyType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PROPERTY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paddr">Address</Label>
              <Input
                id="paddr"
                maxLength={200}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zlabel">Zone label</Label>
              <Input
                id="zlabel"
                maxLength={30}
                value={form.zoneLabel}
                onChange={(e) => setForm((f) => ({ ...f, zoneLabel: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ulabel">Unit label</Label>
              <Input
                id="ulabel"
                maxLength={30}
                value={form.unitLabel}
                onChange={(e) => setForm((f) => ({ ...f, unitLabel: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="gates">Gates (comma separated)</Label>
              <Input
                id="gates"
                value={form.gates}
                onChange={(e) => setForm((f) => ({ ...f, gates: e.target.value }))}
              />
            </div>
            <label className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
              <span className="text-sm">Require host approval for walk-ins</span>
              <Switch
                checked={form.requireHostApproval}
                onCheckedChange={(v) => setForm((f) => ({ ...f, requireHostApproval: v }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
              <span className="text-sm">Mask contact details in guard logs</span>
              <Switch
                checked={form.maskContacts}
                onCheckedChange={(v) => setForm((f) => ({ ...f, maskContacts: v }))}
              />
            </label>
            <Button type="submit" className="sm:col-span-2">
              Save configuration
            </Button>
          </form>
        </section>

        <div className="space-y-6">
          <DeviceHealthPanel propertyId={propertyId} />

          <ZoneManager
            propertyId={propertyId}
            zoneLabel={form.zoneLabel}
            unitLabel={form.unitLabel}
            zones={zones.data ?? []}
            onChange={() => void zones.refetch()}
          />

          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="size-4 text-primary" /> People, roles &amp; QR IDs
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Assign roles, set a position/title and issue a digital QR ID with an expiry date.
              {isSuper ? " As super admin you can also designate other super admins." : ""}
            </p>
            <div className="mt-3 space-y-2">
              {people.data?.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  canGrantSuper={isSuper}
                  onChange={() => void people.refetch()}
                />
              ))}
              {!people.data?.length && (
                <p className="text-sm text-muted-foreground">No people registered yet.</p>
              )}
            </div>
          </section>

        </div>
      </div>
    </AppShell>
  );
}

type ZoneRow = { id: string; name: string; units: { id: string; unit_number: string }[] };

function ZoneManager({
  propertyId,
  zoneLabel,
  unitLabel,
  zones,
  onChange,
}: {
  propertyId: string | null;
  zoneLabel: string;
  unitLabel: string;
  zones: ZoneRow[];
  onChange: () => void;
}) {
  const [zoneName, setZoneName] = useState("");
  const [batch, setBatch] = useState<Record<string, string>>({});

  async function addZone() {
    if (!propertyId || zoneName.trim().length < 1) return;
    const { error } = await supabase
      .from("zones")
      .insert({ property_id: propertyId, name: zoneName.trim().slice(0, 60) });
    if (error) {
      toast.error(error.message);
      return;
    }
    setZoneName("");
    onChange();
  }

  async function addUnits(zoneId: string) {
    if (!propertyId) return;
    const raw = batch[zoneId] ?? "";
    const numbers = raw
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 200);
    if (!numbers.length) return;
    const { error } = await supabase.from("units").insert(
      numbers.map((unit_number) => ({
        property_id: propertyId,
        zone_id: zoneId,
        unit_number: unit_number.slice(0, 30),
      })),
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    setBatch((b) => ({ ...b, [zoneId]: "" }));
    toast.success(`${numbers.length} ${unitLabel.toLowerCase()}s added`);
    onChange();
  }

  return (
    <section className="panel p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Layers className="size-4 text-primary" /> {zoneLabel}s &amp; {unitLabel}s
      </h2>
      <div className="mt-4 flex gap-2">
        <Input
          placeholder={`New ${zoneLabel.toLowerCase()} name`}
          maxLength={60}
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
        />
        <Button type="button" onClick={addZone}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {zones.map((z) => (
          <div key={z.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{z.name}</p>
              <Badge variant="secondary">
                {z.units.length} {unitLabel.toLowerCase()}s
              </Badge>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder={`Batch add: 101, 102, 103`}
                value={batch[z.id] ?? ""}
                onChange={(e) => setBatch((b) => ({ ...b, [z.id]: e.target.value }))}
              />
              <Button type="button" variant="secondary" onClick={() => addUnits(z.id)}>
                Add
              </Button>
            </div>
            {z.units.length > 0 && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {z.units.map((u) => u.unit_number).join(" · ")}
              </p>
            )}
          </div>
        ))}
        {!zones.length && (
          <p className="text-sm text-muted-foreground">No {zoneLabel.toLowerCase()}s configured yet.</p>
        )}
      </div>
    </section>
  );
}
