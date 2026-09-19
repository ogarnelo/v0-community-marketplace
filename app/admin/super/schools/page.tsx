import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SchoolManagementActions } from "@/components/admin/school-management-actions";
import { ArrowLeft, School } from "lucide-react";


type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  school_type: string | null;
  is_active: boolean | null;
};

type SchoolRequestRow = {
  id: string;
  approved_school_id: string | null;
  contact_email: string | null;
  status: string | null;
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
  const [schoolsResult, profilesResult, listingsResult, requestsResult] = await Promise.all([
    admin.from("schools").select("id, name, city, region, school_type, is_active").order("name", { ascending: true }).returns<SchoolRow[]>(),
    admin.from("profiles").select("id, school_id").returns<ProfileRow[]>(),
    admin.from("listings").select("id, school_id").returns<ListingRow[]>(),
    admin
      .from("school_registration_requests")
      .select("id, approved_school_id, contact_email, status")
      .eq("status", "approved")
      .returns<SchoolRequestRow[]>(),
  ]);

  if (schoolsResult.error) throw schoolsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (listingsResult.error) throw listingsResult.error;
  if (requestsResult.error) throw requestsResult.error;

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
  const approvedRequestBySchoolId = new Map<string, SchoolRequestRow>();

  for (const request of requestsResult.data || []) {
    if (request.approved_school_id && !approvedRequestBySchoolId.has(request.approved_school_id)) {
      approvedRequestBySchoolId.set(request.approved_school_id, request);
    }
  }

  const activeCount = schools.filter((school) => school.is_active !== false).length;

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
                <p className="text-sm text-muted-foreground">
                  {activeCount} activos · {schools.length - activeCount} desactivados · {schools.length} total
                </p>
              </div>
            </div>
          </div>
          <Button asChild variant="outline"><Link href="/admin/super/users">Ver usuarios</Link></Button>
        </div>

        {schools.length === 0 ? (
          <div className="rounded-2xl border bg-background p-8 text-center text-sm text-muted-foreground shadow-sm">
            No hay centros registrados.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {schools.map((school) => {
              const request = approvedRequestBySchoolId.get(school.id);

              return (
                <div
                  key={school.id}
                  id={`school-${school.id}`}
                  className="scroll-mt-24 rounded-2xl border bg-background p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold">{school.name}</h2>
                        <Badge variant={school.is_active === false ? "secondary" : "outline"}>
                          {school.is_active === false ? "Desactivado" : "Activo"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {schoolTypeLabel(school.school_type)} · {school.city || "Sin ciudad"}
                        {school.region ? ` · ${school.region}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Miembros</p>
                      <p className="mt-1 text-xl font-semibold">{memberCounts.get(school.id) || 0}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Anuncios</p>
                      <p className="mt-1 text-xl font-semibold">{listingCounts.get(school.id) || 0}</p>
                    </div>
                  </div>

                  <SchoolManagementActions
                    schoolId={school.id}
                    schoolName={school.name}
                    isActive={school.is_active !== false}
                    requestId={request?.id}
                    contactEmail={request?.contact_email}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
