-- Lock down the internal signup trigger function: nobody but the trigger owner may call it
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Role/tenant helper functions are required by RLS policies for signed-in users,
-- but must never be callable by anonymous visitors or via the public role.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_property_id() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_property_id() TO authenticated;

-- Only staff may write device heartbeat data
DROP POLICY IF EXISTS "devices heartbeat insert" ON public.devices;
DROP POLICY IF EXISTS "devices heartbeat update" ON public.devices;

CREATE POLICY "devices heartbeat insert" ON public.devices
FOR INSERT TO authenticated
WITH CHECK (is_staff() AND property_id = my_property_id());

CREATE POLICY "devices heartbeat update" ON public.devices
FOR UPDATE TO authenticated
USING (is_staff() AND property_id = my_property_id())
WITH CHECK (is_staff() AND property_id = my_property_id());