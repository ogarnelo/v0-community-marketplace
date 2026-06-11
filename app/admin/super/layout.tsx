import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";

export const dynamic = "force-dynamic";

const adminLinks = [
  ["Panel", "/admin/super"],
  ["Launch", "/admin/super/launch"],
  ["Insights", "/admin/super/insights"],
  ["Campañas", "/admin/super/campaigns"],
  ["SEO", "/admin/super/seo"],
  ["Automation", "/admin/super/automation"],
  ["Autopilot", "/admin/super/autopilot"],
  ["Moderación", "/admin/super/moderation"],
  ["Operaciones", "/admin/super/transaction-velocity"],
] as const;

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

  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <div className="border-b bg-card/80 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 text-sm lg:px-8">
          {adminLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full border bg-background px-3 py-1.5 font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
