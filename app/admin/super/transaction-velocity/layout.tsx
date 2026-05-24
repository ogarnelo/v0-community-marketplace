import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";

export const dynamic = "force-dynamic";

export default async function TransactionVelocityAdminGuardLayout({
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

  const allowed = await canAccessSuperadmin(user.id, user.email);

  if (!allowed) {
    redirect("/account");
  }

  return <>{children}</>;
}
