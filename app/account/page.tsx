import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gradeLevels } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserBadgePills } from "@/components/profile/user-badge-pills";
import {
  Bell,
  Building2,
  CalendarDays,
  GraduationCap,
  Heart,
  KeyRound,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
  NotebookTabs,
  Phone,
  PlusCircle,
  Search,
  Star,
} from "lucide-react";
import AccountProfileForm from "@/components/account/account-profile-form";
import type { AccountProfileRow, SchoolRow } from "@/lib/types/marketplace";
import { getInitials, getUserTypeLabel } from "@/lib/marketplace/formatters";
import { getUserProfileStats } from "@/lib/users/get-user-profile-stats";
import { buildFullName, normalizeNamePart, splitLegacyFullName } from "@/lib/users/person-name";

type SafeUserMetadata = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  user_type?: string;
  grade_level?: string;
  postal_code?: string;
  school_name?: string;
};

type AccountProfileWithNames = AccountProfileRow & {
  first_name?: string | null;
  last_name?: string | null;
};

const quickActions = [
  { href: "/marketplace/new", label: "Publicar", helper: "Sube material", icon: PlusCircle },
  { href: "/account/listings", label: "Mis anuncios", helper: "Gestiona tu catálogo", icon: NotebookTabs },
  { href: "/messages", label: "Mensajes", helper: "Habla por chat", icon: MessageCircle },
  { href: "/favorites", label: "Favoritos", helper: "Guarda material", icon: Heart },
  { href: "/account/saved-searches", label: "Mis búsquedas", helper: "Reabre avisos", icon: Search },
  { href: "/account/activity", label: "Mis acuerdos", helper: "Actividad MVP", icon: Bell },
  { href: "/account/security", label: "Seguridad", helper: "Cambia tu contraseña", icon: KeyRound },
  { href: "/help", label: "Soporte", helper: "Centro de ayuda", icon: LifeBuoy },
];

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const metadata = (user.user_metadata || {}) as SafeUserMetadata;

  const [{ data: profile, error: profileError }, { data: schoolsData, error: schoolsError }, stats] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, user_type, grade_level, postal_code, school_id, shipping_city, phone, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("schools").select("id, name, city, postal_code").order("name", { ascending: true }),
    getUserProfileStats(supabase, user.id),
  ]);

  if (profileError) console.error("Error cargando profile:", profileError);
  if (schoolsError) console.error("Error cargando schools:", schoolsError);

  const typedProfile = (profile || null) as AccountProfileWithNames | null;
  const schoolOptions: SchoolRow[] = Array.isArray(schoolsData) ? (schoolsData as SchoolRow[]) : [];
  const legacyName = splitLegacyFullName(typedProfile?.full_name || metadata.full_name || null);
  const firstName = normalizeNamePart(typedProfile?.first_name || metadata.first_name || legacyName.firstName);
  const lastName = normalizeNamePart(typedProfile?.last_name || metadata.last_name || legacyName.lastName);
  const fullName = buildFullName(firstName, lastName) || typedProfile?.full_name || metadata.full_name || user.email || "Mi cuenta";
  const email = user.email || "Sin email";
  const userType = typedProfile?.user_type || metadata.user_type || null;
  const gradeLevel = typedProfile?.grade_level || metadata.grade_level || null;
  const postalCode = typedProfile?.postal_code || metadata.postal_code || null;
  const createdAt = typedProfile?.created_at || user.created_at || null;

  const selectedSchool = typedProfile?.school_id && typedProfile.school_id.trim().length > 0
    ? schoolOptions.find((school) => school.id === typedProfile.school_id) || null
    : null;

  const schoolName = selectedSchool?.name || (typeof metadata.school_name === "string" && metadata.school_name.trim().length > 0 ? metadata.school_name.trim() : "Centro no asignado");
  const normalizedGradeLevels = Array.from(new Set(gradeLevels)).filter(Boolean);
  const averageRatingLabel = typeof stats.averageRating === "number" ? stats.averageRating.toFixed(1) : "—";
  const badges = stats.badgesForUserType(userType);
  const contactReady = Boolean(typedProfile?.phone || typedProfile?.shipping_city || typedProfile?.postal_code);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:py-8 lg:px-8">
        <div className="mb-5 overflow-hidden rounded-3xl border bg-background shadow-sm sm:mb-8">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="h-16 w-16 shrink-0 border-4 border-background shadow-sm sm:h-20 sm:w-20">
                  <AvatarFallback className="text-lg font-semibold">{getInitials(fullName, email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">Mi perfil</p>
                  <h1 className="break-words text-2xl font-bold tracking-tight sm:truncate sm:text-3xl">{fullName}</h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{getUserTypeLabel(userType)}</Badge>
                    {user.email_confirmed_at ? <Badge>Email verificado</Badge> : null}
                    {contactReady ? <Badge variant="outline">Contacto opcional</Badge> : null}
                  </div>
                </div>
              </div>
              <Button asChild className="min-h-11 w-full rounded-full sm:w-auto sm:px-6">
                <Link href="/marketplace/new">Publicar anuncio</Link>
              </Button>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/80 p-3"><Mail className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{email}</span></div>
              {typedProfile?.phone ? <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/80 p-3"><Phone className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{typedProfile.phone}</span></div> : null}
              <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/80 p-3"><Building2 className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{schoolName}</span></div>
              {postalCode ? <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/80 p-3"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">CP {postalCode}</span></div> : null}
              {gradeLevel ? <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/80 p-3"><GraduationCap className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{gradeLevel}</span></div> : null}
              {createdAt ? <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/80 p-3"><CalendarDays className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">Desde {new Date(createdAt).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}</span></div> : null}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="min-w-0 rounded-2xl border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <Icon className="mb-3 h-5 w-5 text-primary" />
                <p className="break-words font-semibold leading-tight">{action.label}</p>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{action.helper}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Star className="h-4 w-4" />Valoración media</div><p className="text-3xl font-bold">{averageRatingLabel}</p></CardContent></Card>
          <Card><CardContent className="p-5"><div className="mb-2 text-sm font-medium text-muted-foreground">Opiniones</div><p className="text-3xl font-bold">{stats.reviewCount}</p></CardContent></Card>
          <Card><CardContent className="p-5"><div className="mb-2 text-sm font-medium text-muted-foreground">Acuerdos como vendedor</div><p className="text-3xl font-bold">{stats.soldListingsCount}</p></CardContent></Card>
          <Card><CardContent className="p-5"><div className="mb-2 text-sm font-medium text-muted-foreground">Acuerdos como comprador</div><p className="text-3xl font-bold">{stats.purchasesCount}</p></CardContent></Card>
        </div>

        <div className="mt-6">
          <UserBadgePills badges={badges} />
        </div>

        <div className="mt-6">
          <AccountProfileForm
            initialFirstName={firstName}
            initialLastName={lastName}
            initialUserType={userType === "parent" || userType === "student" || userType === "business" ? userType : ""}
            initialGradeLevel={typedProfile?.grade_level || ""}
            initialPostalCode={typedProfile?.postal_code || ""}
            initialSchoolId={typedProfile?.school_id || ""}
            initialBusinessName=""
            initialBusinessDescription=""
            initialWebsite=""
            initialPhone={typedProfile?.phone || ""}
            initialShippingAddressLine1=""
            initialShippingAddressLine2=""
            initialShippingCity={typedProfile?.shipping_city || ""}
            initialShippingRegion=""
            initialShippingCountryCode="ES"
            email={email}
            gradeLevelOptions={normalizedGradeLevels}
            schoolOptions={schoolOptions}
          />
        </div>
      </div>
    </div>
  );
}
