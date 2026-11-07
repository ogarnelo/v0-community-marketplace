import "server-only";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeFederationKpis } from "@/lib/fanpa/federation-kpis";

type Params = { federation?: string; school?: string };
type Entity = { id: string; name: string };
type SchoolLink = { federation_id: string; school_id: string };
const ROW_LIMIT = 20_000;

function requireQuery<T>(result: { data: T[] | null; error: { message: string } | null }, name: string): T[] {
  if (result.error) throw new Error(`Error consultando ${name}.`);
  if ((result.data || []).length >= ROW_LIMIT) {
    // Never return an incomplete report as though it were an accurate total.
    throw new Error(`El conjunto de ${name} supera el límite de seguridad del informe.`);
  }
  return result.data || [];
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-white p-4 shadow-sm">
    <div className="text-sm text-slate-600">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900">{value.toLocaleString("es-ES")}</div>
  </div>;
}

export default async function FanpaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { federation: selectedFederation, school: selectedSchool } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/");
  const admin = createAdminClient();

  // A global fanpa_admin role alone does NOT grant access to any federation.
  const [{ data: role, error: roleError }, { data: memberships, error: membershipsError }] = await Promise.all([
    admin.from("user_roles").select("id").eq("user_id", user.id).eq("role", "fanpa_admin").maybeSingle(),
    admin.from("federation_admins").select("federation_id").eq("user_id", user.id).limit(ROW_LIMIT),
  ]);
  if (roleError || membershipsError || !role) redirect("/");
  const federationIds = Array.from(new Set((memberships || []).map((membership) => membership.federation_id)));
  if (federationIds.length === 0) return <main className="mx-auto max-w-4xl px-5 py-12"><h1 className="text-2xl font-bold">Panel FANPA</h1><p className="mt-3">Todavía no tienes ninguna federación asignada.</p></main>;

  const federationRows = await admin.from("federations")
    .select("id,name").in("id", federationIds).eq("is_active",true).eq("is_test",false).limit(ROW_LIMIT);
  const federations = requireQuery<Entity>(federationRows, "federaciones");
  const federation = federations.find((item) => item.id === selectedFederation) || federations[0];
  if (!federation) return <main className="mx-auto max-w-4xl px-5 py-12">No hay federaciones activas asignadas.</main>;

  const linksResult = await admin.from("federation_schools").select("federation_id,school_id")
    .eq("federation_id", federation.id).limit(ROW_LIMIT);
  const links = requireQuery<SchoolLink>(linksResult, "colegios asociados");
  const schoolIds = Array.from(new Set(links.map((link) => link.school_id)));
  const schoolRows = schoolIds.length
    ? await admin.from("schools").select("id,name").in("id",schoolIds).eq("is_active",true).eq("is_test",false).limit(ROW_LIMIT)
    : { data: [], error: null };
  const schools = requireQuery<Entity>(schoolRows, "centros");
  const validIds = schools.map((school) => school.id);

  if (validIds.length === 0) {
    return <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-semibold">{federation.name}</h1>
      <p className="mt-4 text-slate-600">Aún no hay centros reales activos asociados.</p>
    </main>;
  }

  // Fetch only minimal identifiers and nonpersonal KPI rows. Do not send
  // names, emails, student aliases or individual needs to the UI.
  const [
    profilesRes, studentsRes, schoolAdminsRes, listingsRes, demandsRes, agreementsRes
  ] = await Promise.all([
    admin.from("profiles").select("id,school_id").in("school_id", validIds).limit(ROW_LIMIT),
    admin.from("account_students").select("owner_user_id,school_id").eq("active",true).limit(ROW_LIMIT),
    admin.from("user_roles").select("user_id,school_id").eq("role","school_admin").in("school_id",validIds).limit(ROW_LIMIT),
    admin.from("listings").select("id,school_id,status").in("school_id",validIds).limit(ROW_LIMIT),
    admin.from("demand_requests").select("id,school_id,status").in("school_id",validIds).limit(ROW_LIMIT),
    admin.from("agreements").select("id,school_id,status").in("school_id",validIds).limit(ROW_LIMIT),
  ]);
  const metrics = computeFederationKpis({
    schools,
    profiles: requireQuery(profilesRes, "cuentas"),
    students: requireQuery(studentsRes, "estudiantes"),
    admins: requireQuery(schoolAdminsRes, "administradores de centro"),
    listings: requireQuery(listingsRes, "anuncios"),
    demands: requireQuery(demandsRes, "necesidades"),
    agreements: requireQuery(agreementsRes, "intercambios"),
  });

  const specific = selectedSchool ? metrics.schools.find((school) => school.id === selectedSchool) : null;
  const displayed = specific ? {
    totalSchools: 1,
    uniqueUsers: specific.users,
    students: specific.students,
    activeListings: specific.activeListings,
    totalListings: specific.totalListings,
    openDemands: specific.openDemands,
    confirmedExchanges: specific.confirmedExchanges,
  } : metrics;

  return <main className="mx-auto max-w-6xl px-4 py-10 text-slate-900 sm:px-6">
    <header className="mb-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Wetudy · Inteligencia de comunidades educativas</p>
      <h1 className="mt-2 text-3xl font-bold">Panel FANPA · {federation.name}</h1>
      <p className="mt-3 text-slate-600">Estadísticas agregadas de los centros asignados. Sin acceso a perfiles, conversaciones ni datos identificativos de estudiantes.</p>
    </header>

    {federations.length > 1 && <nav aria-label="Federaciones autorizadas" className="mb-5 flex flex-wrap gap-2">
      {federations.map((item) => <Link key={item.id} className="rounded-lg border px-3 py-2 text-sm" href={`/admin/fanpa?federation=${encodeURIComponent(item.id)}`}>{item.name}</Link>)}
    </nav>}
    {specific && <div className="mb-5">
      <Link className="text-sm font-medium text-emerald-700 underline" href={`/admin/fanpa?federation=${encodeURIComponent(federation.id)}`}>← Ver todos los colegios</Link>
      <h2 className="mt-3 text-xl font-semibold">{specific.name}</h2>
    </div>}

    <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Indicadores agregados">
      <Stat label="Colegios" value={displayed.totalSchools}/>
      <Stat label="Usuarios únicos" value={displayed.uniqueUsers}/>
      <Stat label="Estudiantes" value={displayed.students}/>
      <Stat label="Anuncios activos" value={displayed.activeListings}/>
      <Stat label="Anuncios totales" value={displayed.totalListings}/>
      <Stat label="Necesidades abiertas" value={displayed.openDemands}/>
      <Stat label="Intercambios confirmados" value={displayed.confirmedExchanges}/>
    </section>

    {!specific && <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold">Detalle por colegio</h2>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[740px] text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-700"><tr>
            <th className="p-3">Colegio</th><th className="p-3">Usuarios</th><th className="p-3">Estudiantes</th>
            <th className="p-3">Anuncios activos</th><th className="p-3">Necesidades abiertas</th><th className="p-3">Intercambios</th>
          </tr></thead>
          <tbody>{metrics.schools.map((row) => <tr key={row.id} className="border-b last:border-0">
            <td className="p-3"><Link className="font-medium text-emerald-700 underline" href={`/admin/fanpa?federation=${encodeURIComponent(federation.id)}&school=${encodeURIComponent(row.id)}`}>{row.name}</Link></td>
            <td className="p-3">{row.users}</td><td className="p-3">{row.students}</td><td className="p-3">{row.activeListings}</td>
            <td className="p-3">{row.openDemands}</td><td className="p-3">{row.confirmedExchanges}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
    <p className="mt-8 text-xs text-slate-500">Solo se incluyen colegios reales activos. Las cuentas se deduplican en el total FANPA. Estos valores no incluyen información demo y no sustituyen a indicadores de necesidades resueltas.</p>
  </main>;
}
