import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!(await canAccessSuperadmin(user.id, user.email))) {
    redirect("/account");
  }

  return children;
}
