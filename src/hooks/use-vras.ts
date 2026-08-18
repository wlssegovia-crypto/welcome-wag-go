import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/vras";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useMe() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, rolesRes, credRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
        supabase.from("qr_credentials").select("*").eq("user_id", userId!).maybeSingle(),
      ]);
      const profile = profileRes.data;
      const roles = (rolesRes.data ?? []).map((r) => r.role as Role);
      let property = null;
      if (profile?.property_id) {
        const { data } = await supabase
          .from("properties")
          .select("*")
          .eq("id", profile.property_id)
          .maybeSingle();
        property = data;
      }
      return {
        userId: userId!,
        email: session?.user.email ?? null,
        profile,
        roles,
        property,
        credential: credRes.data,
        isStaff: roles.some((r) =>
          ["super_admin", "property_admin", "security_guard"].includes(r),
        ),
        isAdmin: roles.some((r) => ["super_admin", "property_admin"].includes(r)),
      };
    },
  });
}
