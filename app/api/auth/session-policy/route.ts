import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ADMIN_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const USER_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: roles, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["super_admin", "school_admin"]);

  if (error) {
    return NextResponse.json(
      { timeoutMs: ADMIN_TIMEOUT_MS, policy: "admin-safe-fallback" },
      { status: 200 }
    );
  }

  const isAdmin = (roles || []).some(
    (row) => row.role === "super_admin" || row.role === "school_admin"
  );

  return NextResponse.json(
    {
      timeoutMs: isAdmin ? ADMIN_TIMEOUT_MS : USER_TIMEOUT_MS,
      policy: isAdmin ? "admin-2h" : "user-8h",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
