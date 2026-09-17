import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Eye, Flag, MessageCircle, Package, School, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  full_name: string | null;
  user_type: string | null;
  grade_level: string | null;
  school_id: string | null;
  created_at: string;
};

type ListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  category: string | null;
  grade_level: string | null;
  school_id: string | null;
  created_at: string;
  photos: string[] | null;
};

type ConversationRow = {
  id: string;
  listing_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  created_at: string;
};

type AgreementRow = {
  id: string;
  listing_id: string | null;
  conversation_id: string | null;
  status: string | null;
  agreement_type: string | null;
  amount: number | null;
  created_at: string;
  confirmed_at: string | null;
};

type ReportRow = {
  id: string;
  target_type: string | null;
  status: string | null;
  reason: string | null;
  created_at: string;
};

type ViewRow = {
  id: string;
  listing_id: string | null;
  viewer_id: string | null;
  viewed_at: string;
};

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

type ActivityItem = {
  date: string;
  type: string;
  title: string;
  detail: string;
};

const TEST_NAMES = new Set(["test", "oscar garnelo"]);

function toDate(value?: string | null) {
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function since<T extends { created_at?: string; viewed_at?: string }>(rows: T[], days: number) {
  const start = daysAgo(days);
  return rows.filter((row) => toDate(row.created_at || row.viewed_at) >= start);
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row)?.trim() || "Sin clasificar";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function StatCard({ title, value, description, icon: Icon }: { title: string; value: string | number; description: string; icon: typeof Users }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleList({ title, items, empty = "Sin datos todavía" }: { title: string; items: Array<{ label: string; count: number }>; empty?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
        {items.slice(0, 6).map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span className="truncate text-sm text-foreground">{item.label}</span>
            <Badge variant="secondary">{item.count}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function MvpSuperAdminDashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect("/auth?next=/admin/super/mvp");
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roleRows?.length) {
    redirect("/");
  }

  const [
    profilesResult,
    listingsResult,
    conversationsResult,
    messagesResult,
    agreementsResult,
    reportsResult,
    viewsResult,
    schoolsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, user_type, grade_level, school_id, created_at").returns<ProfileRow[]>(),
    supabase.from("listings").select("id, title, type, status, category, grade_level, school_id, created_at, photos").returns<ListingRow[]>(),
    supabase.from("conversations").select("id, listing_id, buyer_id, seller_id, created_at, updated_at").returns<ConversationRow[]>(),
    supabase.from("messages").select("id, conversation_id, sender_id, created_at").returns<MessageRow[]>(),
    supabase.from("agreements").select("id, listing_id, conversation_id, status, agreement_type, amount, created_at, confirmed_at").returns<AgreementRow[]>(),
    supabase.from("reports").select("id, target_type, status, reason, created_at").returns<ReportRow[]>(),
    supabase.from("listing_views").select("id, listing_id, viewer_id, viewed_at").returns<ViewRow[]>(),
    supabase.from("schools").select("id, name, city, region").returns<SchoolRow[]>(),
  ]);

  const profiles = profilesResult.data || [];
  const listings = listingsResult.data || [];
  const conversations = conversationsResult.data || [];
  const messages = messagesResult.data || [];
  const agreements = agreementsResult.data || [];
  const reports = reportsResult.data || [];
  const views = viewsResult.data || [];
  const schools = schoolsResult.data || [];

  const users7d = since(profiles, 7).length;
  const users30d = since(profiles, 30).length;
  const listings7d = since(listings, 7).length;
  const conversations7d = since(conversations, 7).length;
  const agreements7d = since(agreements, 7).length;
  const views7d = since(views, 7).length;

  const activeListings = listings.filter((item) => item.status === "available");
  const reservedListings = listings.filter((item) => item.status === "reserved");
  const closedListings = listings.filter((item) => ["sold", "donated", "archived"].includes(item.status || ""));
  const openReports = reports.filter((item) => ["open", "reviewing"].includes(item.status || ""));
  const disputedAgreements = agreements.filter((item) => item.status === "disputed");
  const confirmedAgreements = agreements.filter((item) => item.status === "confirmed" || Boolean(item.confirmed_at));
  const contactedListingIds = new Set(conversations.map((item) => item.listing_id).filter(Boolean));
  const confirmedListingIds = new Set(confirmedAgreements.map((item) => item.listing_id).filter(Boolean));
  const listingsWithoutPhoto = listings.filter((item) => !item.photos || item.photos.length === 0);

  const schoolById = new Map(schools.map((school) => [school.id, school]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));

  const organicUsers = profiles.filter((profile) => {
    const name = profile.full_name?.trim().toLowerCase() || "";
    return !TEST_NAMES.has(name);
  });

  const topSchools = countBy(profiles, (profile) => {
    if (!profile.school_id) return "Sin colegio";
    const school = schoolById.get(profile.school_id);
    return school ? `${school.name}${school.city ? ` · ${school.city}` : ""}` : "Colegio desconocido";
  });

  const categoryDemand = countBy(conversations, (conversation) => {
    const listing = conversation.listing_id ? listingById.get(conversation.listing_id) : null;
    return listing?.category || "Sin categoría";
  });

  const recentActivity: ActivityItem[] = [
    ...profiles.map((profile) => ({
      date: profile.created_at,
      type: "Usuario",
      title: profile.full_name || "Nuevo usuario",
      detail: `${profile.user_type || "perfil"}${profile.school_id ? " · con colegio" : " · sin colegio"}`,
    })),
    ...listings.map((listing) => ({
      date: listing.created_at,
      type: "Anuncio",
      title: listing.title || "Nuevo anuncio",
      detail: `${listing.type || "tipo"} · ${listing.status || "estado"}`,
    })),
    ...conversations.map((conversation) => ({
      date: conversation.created_at,
      type: "Contacto",
      title: conversation.listing_id ? listingById.get(conversation.listing_id)?.title || "Conversación" : "Conversación",
      detail: "Nueva conversación iniciada",
    })),
    ...agreements.map((agreement) => ({
      date: agreement.created_at,
      type: "Acuerdo",
      title: agreement.listing_id ? listingById.get(agreement.listing_id)?.title || "Acuerdo" : "Acuerdo",
      detail: `${agreement.agreement_type || "tipo"} · ${agreement.status || "estado"}`,
    })),
    ...reports.map((report) => ({
      date: report.created_at,
      type: "Reporte",
      title: report.reason || "Reporte abierto",
      detail: `${report.target_type || "elemento"} · ${report.status || "estado"}`,
    })),
  ].sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime()).slice(0, 20);

  const usersNeedingAttention = organicUsers.filter((profile) => !profile.school_id).slice(0, 8);
  const listingsWithViewsNoContact = listings
    .filter((listing) => views.some((view) => view.listing_id === listing.id) && !contactedListingIds.has(listing.id))
    .slice(0, 8);

  const navbarUserName = profileById.get(user.id)?.full_name || user.email || "Super Admin";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName={navbarUserName} isAdmin isSuperAdmin adminHref="/admin/super" currentUserId={user.id} />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3 gap-2">
                <Link href="/admin/super"><ArrowLeft className="h-4 w-4" /> Volver al super admin</Link>
              </Button>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard MVP</h1>
              <p className="text-sm text-muted-foreground">
                Vista rápida para revisar Wetudy en 5 minutos: actividad, embudo, comunidad y alertas.
              </p>
            </div>
            <Badge variant={openReports.length || disputedAgreements.length ? "destructive" : "secondary"} className="w-fit gap-2 px-3 py-1">
              {openReports.length || disputedAgreements.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {openReports.length || disputedAgreements.length ? "Revisar incidencias" : "Sin incidencias críticas"}
            </Badge>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Usuarios" value={profiles.length} description={`+${users7d} últimos 7 días · +${users30d} últimos 30 días`} icon={Users} />
            <StatCard title="Anuncios activos" value={activeListings.length} description={`+${listings7d} nuevos esta semana · ${reservedListings.length} reservados`} icon={Package} />
            <StatCard title="Contactos" value={conversations.length} description={`+${conversations7d} esta semana · ${pct(contactedListingIds.size, listings.length)} anuncios contactados`} icon={MessageCircle} />
            <StatCard title="Acuerdos" value={agreements.length} description={`+${agreements7d} esta semana · ${pct(confirmedListingIds.size, listings.length)} cierre sobre anuncios`} icon={TrendingUp} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Panel de atención</CardTitle>
                <CardDescription>Lo que conviene revisar antes de seguir trabajando en otra cosa.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><Flag className="h-4 w-4" /> Reportes abiertos</div>
                  <p className="mt-2 text-3xl font-bold">{openReports.length}</p>
                  <p className="text-xs text-muted-foreground">Spam, fraude, contenido inapropiado o conflictos.</p>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4" /> Acuerdos disputados</div>
                  <p className="mt-2 text-3xl font-bold">{disputedAgreements.length}</p>
                  <p className="text-xs text-muted-foreground">Requieren revisión manual antes de escalar.</p>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4" /> Visitas a anuncios</div>
                  <p className="mt-2 text-3xl font-bold">{views.length}</p>
                  <p className="text-xs text-muted-foreground">+{views7d} últimos 7 días.</p>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><Package className="h-4 w-4" /> Anuncios sin foto</div>
                  <p className="mt-2 text-3xl font-bold">{listingsWithoutPhoto.length}</p>
                  <p className="text-xs text-muted-foreground">La foto debería ser obligatoria para conversión.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Embudo MVP</CardTitle>
                <CardDescription>Señales de que el producto está conectando oferta y demanda.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span>Usuarios → anuncios</span><strong>{pct(listings.length, profiles.length)}</strong></div>
                <div className="flex justify-between"><span>Anuncios → contacto</span><strong>{pct(contactedListingIds.size, listings.length)}</strong></div>
                <div className="flex justify-between"><span>Contactos → acuerdo</span><strong>{pct(agreements.length, conversations.length)}</strong></div>
                <div className="flex justify-between"><span>Acuerdos → confirmados</span><strong>{pct(confirmedAgreements.length, agreements.length)}</strong></div>
                <div className="flex justify-between"><span>Anuncios cerrados</span><strong>{closedListings.length}</strong></div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <SimpleList title="Usuarios por comunidad" items={topSchools} />
            <SimpleList title="Demanda por categoría" items={categoryDemand} />
            <SimpleList title="Tipos de usuario" items={countBy(profiles, (profile) => profile.user_type === "parent" ? "Familias" : profile.user_type === "student" ? "Estudiantes" : "Otros")} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Usuarios orgánicos a seguir</CardTitle>
                <CardDescription>Usuarios no marcados como test/admin que quizá necesitan ayuda para completar el onboarding.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {usersNeedingAttention.length === 0 ? <p className="text-sm text-muted-foreground">No hay usuarios orgánicos pendientes de colegio.</p> : null}
                {usersNeedingAttention.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{profile.full_name || "Usuario sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{profile.user_type || "perfil"} · creado {formatDate(profile.created_at)}</p>
                    </div>
                    <Badge variant="outline">Sin colegio</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Anuncios con visitas y sin contacto</CardTitle>
                <CardDescription>Buen sitio para mejorar precio, foto, título o inventario relacionado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {listingsWithViewsNoContact.length === 0 ? <p className="text-sm text-muted-foreground">Sin anuncios en esta situación.</p> : null}
                {listingsWithViewsNoContact.map((listing) => (
                  <div key={listing.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{listing.title || "Anuncio"}</p>
                      <p className="text-xs text-muted-foreground">{listing.category || "Sin categoría"} · {listing.status || "estado"}</p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/marketplace/listing/${listing.id}`}>Ver</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <CardDescription>Registro simple para entender qué está pasando sin entrar en Supabase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.map((item) => (
                <div key={`${item.type}-${item.date}-${item.title}`} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.type}</Badge>
                      <p className="truncate text-sm font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {formatDate(item.date)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Siguiente evolución recomendada</CardTitle>
              <CardDescription>Cuando haya más tráfico, añadir eventos explícitos para búsquedas sin resultados, clicks en contactar y errores de publicación.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg border p-3"><School className="mb-2 h-4 w-4" /> Comunidad activa: usuarios, anuncios y contactos por colegio.</div>
              <div className="rounded-lg border p-3"><MessageCircle className="mb-2 h-4 w-4" /> Conversión: detalle visto → contacto → acuerdo confirmado.</div>
              <div className="rounded-lg border p-3"><AlertTriangle className="mb-2 h-4 w-4" /> Alertas: reportes, disputas, errores 500 y registros orgánicos nuevos.</div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
