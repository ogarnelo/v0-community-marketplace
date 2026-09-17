import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft, School } from "lucide-react";


type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  school_type: string | null;
};

type ProfileRow = { id: string; school_id: string | null };
type ListingRow = { id: string; school_id: string | null };

function schoolTypeLabel(value?: string | null) {
  if (value === "school") return "Colegio / Instituto";
  if (value === "academy") return "Academia";
  if (value === "university") return "Universidad";
  return "Sin definir";
}

export default async function SuperAdminSchoolsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/super/schools");

  const { data: superAdminRoles, error: superAdminRoleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (superAdminRoleError || !superAdminRoles?.length) redirect("/");

  const admin = createAdminClient();
  const [schoolsResult, profilesResult, listingsResult] = await Promise.all([
    admin.from("schools").select("id, name, city, region, school_type").order("name", { ascending: true }).returns<SchoolRow[]>(),
    admin.from("profiles").select("id, school_id").returns<ProfileRow[]>(),
    admin.from("listings").select("id, school_id").returns<ListingRow[]>(),
  ]);

  if (schoolsResult.error) throw schoolsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (listingsResult.error) throw listingsResult.error;

  const memberCounts = new Map<string, number>();
  const listingCounts = new Map<string, number>();

  for (const profile of profilesResult.data || []) {
    if (!profile.school_id) continue;
    memberCounts.set(profile.school_id, (memberCounts.get(profile.school_id) || 0) + 1);
  }

  for (const listing of listingsResult.data || []) {
    if (!listing.school_id) continue;
    listingCounts.set(listing.school_id, (listingCounts.get(listing.school_id) || 0) + 1);
  }

  const schools = schoolsResult.data || [];

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/super" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Volver al panel
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <School className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Centros</h1>
                <p className="text-sm text-muted-foreground">Listado completo de centros activos · {schools.length}</p>
              </div>
            </div>
          </div>
          <Button asChild variant="outline"><Link href="/admin/super/users">Ver usuarios</Link></Button>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Centro</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Ciudad</th>
                  <th className="px-4 py-3 font-semibold">Región</th>
                  <th className="px-4 py-3 text-right font-semibold">Usuarios</th>
                  <th className="px-4 py-3 text-right font-semibold">Anuncios</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {schools.map((school) => (
                  <tr key={school.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{school.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{schoolTypeLabel(school.school_type)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{school.city || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{school.region || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{memberCounts.get(school.id) || 0}</td>
                    <td className="px-4 py-3 text-right font-medium">{listingCounts.get(school.id) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {schools.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No hay centros registrados.</p> : null}
        </div>
      </div>
    </div>
  );
}
