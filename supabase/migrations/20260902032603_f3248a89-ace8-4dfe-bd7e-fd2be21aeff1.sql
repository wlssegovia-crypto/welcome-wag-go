
-- 1) profiles: block self-service changes to property_id / unit_id for non-admins
CREATE OR REPLACE FUNCTION public.guard_profile_tenant_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  IF (NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.unit_id IS DISTINCT FROM OLD.unit_id)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only property admins can change property or unit assignment';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS guard_profile_tenant ON public.profiles;
CREATE TRIGGER guard_profile_tenant
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_tenant_assignment();

-- 2) qr_credentials: scope staff reads to their own property
DROP POLICY IF EXISTS "credentials readable" ON public.qr_credentials;
CREATE POLICY "credentials readable" ON public.qr_credentials
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (public.is_staff() AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = qr_credentials.user_id
      AND p.property_id = public.my_property_id()
  ))
);

-- 3) handle_new_user: no automatic property membership or resident role on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  INSERT INTO public.profiles (id, property_id, full_name, email)
  VALUES (NEW.id, NULL, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  INSERT INTO public.qr_credentials (user_id, qr_token)
  VALUES (NEW.id, 'VRAS-' || upper(replace(gen_random_uuid()::text,'-','')));
  RETURN NEW;
END;
$func$;

-- 4) user_roles: scope admin reads to their own property (super_admin sees all)
DROP POLICY IF EXISTS "roles readable by owner and admins" ON public.user_roles;
CREATE POLICY "roles readable by owner and admins" ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (public.is_admin() AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.property_id = public.my_property_id()
  ))
);
