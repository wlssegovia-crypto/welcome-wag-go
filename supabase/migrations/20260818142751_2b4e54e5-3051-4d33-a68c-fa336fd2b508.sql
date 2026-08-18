CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  device_key text NOT NULL,
  name text NOT NULL DEFAULT 'Device',
  kind text NOT NULL DEFAULT 'GATE_TERMINAL',
  gate text,
  app_version text,
  user_agent text,
  online boolean NOT NULL DEFAULT true,
  queue_depth integer NOT NULL DEFAULT 0,
  battery_percent integer,
  last_error text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, device_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices readable by staff" ON public.devices
  FOR SELECT TO authenticated
  USING (public.is_staff() AND property_id = public.my_property_id());

CREATE POLICY "devices heartbeat insert" ON public.devices
  FOR INSERT TO authenticated
  WITH CHECK (property_id = public.my_property_id());

CREATE POLICY "devices heartbeat update" ON public.devices
  FOR UPDATE TO authenticated
  USING (property_id = public.my_property_id())
  WITH CHECK (property_id = public.my_property_id());

CREATE POLICY "devices removable by admins" ON public.devices
  FOR DELETE TO authenticated
  USING (public.is_admin() AND property_id = public.my_property_id());

CREATE INDEX devices_property_last_seen_idx ON public.devices (property_id, last_seen_at DESC);