import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type CommerceLabAuth =
  | { user: User; error?: never; status?: never }
  | { user?: never; error: string; status: 401 | 403 | 503 };

// Never trust data.user when getUser() reported an error.
// Use the database role as the exclusive source of superadmin authority.
export async function requireCommerceLabSuperAdmin(): Promise<CommerceLabAuth> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return guest
        ? { error: "No autenticado.", status: 401 }
        : { error: "No se pudo comprobar tu sesión.", status: 503 };
    }
    const user = authData?.user ?? null;
    if (!user) return { error: "No autenticado.", status: 401 };
    const { data: roles, error: roleError } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "super_admin").limit(1);
    if (roleError) return { error: "No se pudo comprobar tu permiso.", status: 503 };
    if (!roles?.length) return { error: "No autorizado.", status: 403 };
    return { user };
  } catch {
    return { error: "No se pudo comprobar tu sesión.", status: 503 };
  }
}
