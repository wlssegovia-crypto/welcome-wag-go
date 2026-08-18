import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["super_admin", "property_admin", "security_guard", "host_resident", "visitor"]),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => roleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    if (data.role === "super_admin") {
      const { data: isSuper } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "super_admin",
      });
      if (!isSuper) throw new Error("Only a super admin can designate another super admin");
    }



    const { data: caller } = await context.supabase
      .from("profiles")
      .select("property_id")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: target } = await context.supabase
      .from("profiles")
      .select("property_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!caller?.property_id || caller.property_id !== target?.property_id) {
      throw new Error("User is not in your property");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
