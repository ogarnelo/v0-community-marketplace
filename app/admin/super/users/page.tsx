import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { ArrowLeft, Users } from "lucide-react";
import { normalizeNamePart, splitLegacyFullName } from "@/lib/users/person-name";


type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  school_id: string | null;
  created_at: string | null;
};

type SchoolRow = {
  id: string;
  name: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

async function listAllAuthUsers() {
  const navbarData = await getNavbarData(supabase);
  const admin = createAdminClient();
  const users = [] as Awaited<ReturnType<typeof admin.auth.admin.listUsers>>["data"]["users"];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
}

export default async function SuperAdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/super/users");

  const { data: superAdminRoles, error: superAdminRoleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (superAdminRoleError || !superAdminRoles?.length) redirect("/");

  const admin = createAdminClient();
  const [authUsers, profilesResult, schoolsResult] = await Promise.all([
    listAllAuthUsers(),
    admin.from("profiles").select("id, first_name, last_name, full_name, school_id, created_at").returns<ProfileRow[]>(),
    admin.from("schools").select("id, name").returns<SchoolRow[]>(),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (schoolsResult.error) throw schoolsResult.error;

  const profileById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const schoolById = new Map((schoolsResult.data || []).map((school) => [school.id, school.name]));

  const rows = authUsers
    .map((authUser) => {
      const profile = profileById.get(authUser.id);
      const metadataFirstName = typeof authUser.user_metadata?.first_name === "string" ? authUser.user_metadata.first_name : null;
      const metadataLastName = typeof authUser.user_metadata?.last_name === "string" ? authUser.user_metadata.last_name : null;
      const metadataFullName = typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : null;
      const legacy = splitLegacyFullName(profile?.full_name || metadataFullName || authUser.email?.split("@")[0] || "");
      const firstName = normalizeNamePart(profile?.first_name || metadataFirstName || legacy.firstName) || "—";
      const lastName = normalizeNamePart(profile?.last_name || metadataLastName || legacy.lastName) || "—";
      const metadataSchool = typeof authUser.user_metadata?.school_name === "string" ? authUser.user_metadata.school_name : null;

      return {
        id: authUser.id,
        firstName,
        lastName,
        email: authUser.email || "—",
        school: profile?.school_id ? schoolById.get(profile.school_id) || "Centro no encontrado" : metadataSchool || "Sin centro",
        createdAt: authUser.created_at || profile?.created_at || null,
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Navbar {...navbarData} />
      <main className="flex-1">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link href="/admin/super" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Volver al panel
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
                <p className="text-sm text-muted-foreground">Listado completo de cuentas registradas · {rows.length}</p>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto"><Link href="/admin/super/schools">Ver centros</Link></Button>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Apellidos</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Colegio</th>
                  <th className="px-4 py-3 font-semibold">Fecha de creación</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{row.firstName}</td>
                    <td className="px-4 py-3 text-foreground">{row.lastName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.school}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No hay usuarios registrados.</p> : null}
        </div>
      </div>
      </main>
      <Footer />
    </div>
  );
}
