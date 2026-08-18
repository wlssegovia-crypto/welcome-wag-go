
CREATE TYPE public.property_type AS ENUM ('RESIDENTIAL_CONDO','SUBDIVISION','OFFICE_TOWER','MALL','HOSPITAL','SCHOOL','FACTORY','RESORT_HOTEL','SPORTS_CLUB','OTHER');
CREATE TYPE public.app_role AS ENUM ('super_admin','property_admin','security_guard','host_resident','visitor');
CREATE TYPE public.category_type AS ENUM ('RESIDENT','EMPLOYEE','WORKER','GUEST','TRANSIENT');
CREATE TYPE public.access_status AS ENUM ('GRANTED','DENIED','PENDING_HOST_APPROVAL','EXPIRED');

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.property_type NOT NULL DEFAULT 'RESIDENTIAL_CONDO',
  address text NOT NULL DEFAULT '',
  zone_label text NOT NULL DEFAULT 'Zone',
  unit_label text NOT NULL DEFAULT 'Unit',
  gates text[] NOT NULL DEFAULT ARRAY['Main Gate'],
  require_host_approval boolean NOT NULL DEFAULT true,
  mask_contacts_in_logs boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  category public.category_type NOT NULL DEFAULT 'RESIDENT',
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.qr_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  qr_token text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.guest_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  guest_name text NOT NULL,
  guest_phone text,
  vehicle_plate text,
  purpose text,
  access_code text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid,
  host_id uuid,
  invite_id uuid REFERENCES public.guest_invites(id) ON DELETE SET NULL,
  visitor_name text,
  visitor_phone text,
  vehicle_plate text,
  category public.category_type NOT NULL DEFAULT 'TRANSIENT',
  entry_gate text NOT NULL DEFAULT 'Main Gate',
  direction text NOT NULL DEFAULT 'IN',
  status public.access_status NOT NULL DEFAULT 'PENDING_HOST_APPROVAL',
  photo_captured text,
  id_document_url text,
  id_document_text text,
  notes text,
  client_ref text UNIQUE,
  synced_from_offline boolean NOT NULL DEFAULT false,
  created_by uuid,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  recipient_id uuid,
  courier_name text NOT NULL,
  tracking_no text,
  photo_url text,
  claim_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties, public.zones, public.units, public.profiles, public.qr_credentials, public.guest_invites, public.access_logs, public.parcels TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.properties, public.zones, public.units, public.profiles, public.user_roles, public.qr_credentials, public.guest_invites, public.access_logs, public.parcels TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.my_property_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT property_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('super_admin','property_admin','security_guard'));
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('super_admin','property_admin'));
$$;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles readable by owner and admins" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "properties visible to members" ON public.properties FOR SELECT TO authenticated
  USING (id = public.my_property_id() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "properties managed by admins" ON public.properties FOR UPDATE TO authenticated
  USING (public.is_admin() AND (id = public.my_property_id() OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "properties created by admins" ON public.properties FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "zones visible to members" ON public.zones FOR SELECT TO authenticated
  USING (property_id = public.my_property_id() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "zones managed by admins" ON public.zones FOR ALL TO authenticated
  USING (public.is_admin() AND property_id = public.my_property_id())
  WITH CHECK (public.is_admin() AND property_id = public.my_property_id());

CREATE POLICY "units visible to members" ON public.units FOR SELECT TO authenticated
  USING (property_id = public.my_property_id() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "units managed by admins" ON public.units FOR ALL TO authenticated
  USING (public.is_admin() AND property_id = public.my_property_id())
  WITH CHECK (public.is_admin() AND property_id = public.my_property_id());

CREATE POLICY "own profile readable" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (public.is_staff() AND property_id = public.my_property_id()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (public.is_admin() AND property_id = public.my_property_id()))
  WITH CHECK (id = auth.uid() OR (public.is_admin() AND property_id = public.my_property_id()));

CREATE POLICY "credentials readable" ON public.qr_credentials FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "credentials self manage" ON public.qr_credentials FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "invites readable" ON public.guest_invites FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR (public.is_staff() AND property_id = public.my_property_id()));
CREATE POLICY "invites created by host" ON public.guest_invites FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid() AND property_id = public.my_property_id());
CREATE POLICY "invites updated by host or staff" ON public.guest_invites FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR (public.is_staff() AND property_id = public.my_property_id()))
  WITH CHECK (host_id = auth.uid() OR (public.is_staff() AND property_id = public.my_property_id()));
CREATE POLICY "invites deleted by host" ON public.guest_invites FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CREATE POLICY "logs readable" ON public.access_logs FOR SELECT TO authenticated
  USING ((public.is_staff() AND property_id = public.my_property_id())
    OR host_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "logs created by staff" ON public.access_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND property_id = public.my_property_id());
CREATE POLICY "logs updated by staff or host" ON public.access_logs FOR UPDATE TO authenticated
  USING ((public.is_staff() AND property_id = public.my_property_id()) OR host_id = auth.uid())
  WITH CHECK ((public.is_staff() AND property_id = public.my_property_id()) OR host_id = auth.uid());

CREATE POLICY "parcels readable" ON public.parcels FOR SELECT TO authenticated
  USING ((public.is_staff() AND property_id = public.my_property_id())
    OR recipient_id = auth.uid()
    OR unit_id = (SELECT unit_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "parcels managed by staff" ON public.parcels FOR ALL TO authenticated
  USING (public.is_staff() AND property_id = public.my_property_id())
  WITH CHECK (public.is_staff() AND property_id = public.my_property_id());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_property uuid;
BEGIN
  SELECT id INTO default_property FROM public.properties ORDER BY created_at LIMIT 1;
  INSERT INTO public.profiles (id, property_id, full_name, email)
  VALUES (NEW.id, default_property, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'host_resident');
  INSERT INTO public.qr_credentials (user_id, qr_token)
  VALUES (NEW.id, 'VRAS-' || upper(replace(gen_random_uuid()::text,'-','')));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcels;

INSERT INTO public.properties (id, name, type, address, zone_label, unit_label, gates)
VALUES ('11111111-1111-1111-1111-111111111111','Northgate Residences','RESIDENTIAL_CONDO','12 Northgate Ave, Metro Manila','Tower','Unit', ARRAY['Main Gate','Service Gate','Lobby A']);

INSERT INTO public.zones (id, property_id, name) VALUES
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111111','Tower 1'),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111111','Tower 2');

INSERT INTO public.units (zone_id, property_id, unit_number) VALUES
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111111','1001'),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111111','1002'),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111111','1003'),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111111','2001'),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111111','2002');
