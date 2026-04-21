import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gradeLevels } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserBadgePills } from "@/components/profile/user-badge-pills";
import { Mail, MapPin, GraduationCap, CalendarDays, Building2, BriefcaseBusiness, Globe, Star, Truck, Phone } from "lucide-react";
import AccountProfileForm from "@/components/account/account-profile-form";
import type { AccountProfileRow, SchoolRow } from "@/lib/types/marketplace";
import { getInitials, getUserTypeLabel } from "@/lib/marketplace/formatters";
import { getUserProfileStats } from "@/lib/users/get-user-profile-stats";
import InviteFriendsCard from "@/components/account/invite-friends-card";

type SafeUserMetadata = {
  full_name?: string;
  user_type?: string;
  grade_level?: string;
  postal_code?: string;
  school_name?: string;
  business_name?: string;
  business_description?: string;
  website?: string;
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const metadata = (user.user_metadata || {}) as SafeUserMetadata;

  const [{ data: profile, error: profileError }, { data: schoolsData, error: schoolsError }, stats] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, user_type, grade_level, postal_code, school_id, business_name, business_description, website, is_business_verified, shipping_address_line1, shipping_address_line2, shipping_city, shipping_region, shipping_country_code, phone, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("schools").select("id, name, city, postal_code").order("name", { ascending: true }),
    getUserProfileStats(supabase, user.id),
  ]);

  if (profileError) console.error("Error cargando profile:", profileError);
  if (schoolsError) console.error("Error cargando schools:", schoolsError);

  const typedProfile = (profile || null) as AccountProfileRow | null;
  const schoolOptions: SchoolRow[] = Array.isArray(schoolsData) ? (schoolsData as SchoolRow[]) : [];

  const fullName = typedProfile?.full_name || metadata.full_name || user.email || "Mi cuenta";
  const email = user.email || "Sin email";
  const userType = typedProfile?.user_type || metadata.user_type || null;
  const gradeLevel = typedProfile?.grade_level || metadata.grade_level || null;
  const postalCode = typedProfile?.postal_code || metadata.postal_code || null;
  const createdAt = typedProfile?.created_at || user.created_at || null;
  const businessName = typedProfile?.business_name || metadata.business_name || null;
  const businessDescription = typedProfile?.business_description || metadata.business_description || null;
  const website = typedProfile?.website || metadata.website || null;
  const isBusiness = userType === "business";

  const selectedSchool = typedProfile?.school_id && typedProfile.school_id.trim().length > 0
    ? schoolOptions.find((school) => school.id === typedProfile.school_id) || null
    : null;

  const schoolName = selectedSchool?.name || (typeof metadata.school_name === "string" && metadata.school_name.trim().length > 0 ? metadata.school_name.trim() : "Centro no asignado");
  const normalizedGradeLevels = Array.from(new Set(gradeLevels)).filter(Boolean);
  const averageRatingLabel = typeof stats.averageRating === "number" ? stats.averageRating.toFixed(1) : "—";
  const badges = stats.badgesForUserType(userType);
  const shippingReady = Boolean(typedProfile?.shipping_address_line1 && typedProfile?.shipping_city && typedProfile?.postal_code && typedProfile?.shipping_country_code);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
          <p className="mt-2 text-muted-foreground">Gestiona tu perfil, tu reputación y tus datos de envío en Wetudy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/account/activity">Ver actividad</Link></Button>
          <Button asChild variant="outline"><Link href="/account/listings">Mis anuncios</Link></Button>
          <Button asChild variant="outline"><Link href="/account/reviews">Mis opiniones</Link></Button>
        </div>
      </div>

      <div className="mb-6">
        <InviteFriendsCard appUrl={appUrl} referralCode={user.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-start gap-5 p-6">
            <Avatar className="h-20 w-20"><AvatarFallback className="text-lg font-semibold">{getInitials(fullName, email)}</AvatarFallback></Avatar>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{businessName || fullName}</h2>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{getUserTypeLabel(userType)}</Badge>
                {user.email_confirmed_at ? <Badge>Email verificado</Badge> : null}
                {isBusiness && typedProfile?.is_business_verified ? <Badge>Negocio verificado</Badge> : null}
                {shippingReady ? <Badge variant="outline">Listo para envíos</Badge> : null}
              </div>
            </div>

            <UserBadgePills badges={badges} />

            <div className="grid w-full gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /><span>{email}</span></div>
              {typedProfile?.phone ? <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span>{typedProfile.phone}</span></div> : null}
              {postalCode ? <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span>Código postal: {postalCode}</span></div> : null}
              {!isBusiness && gradeLevel ? <div className="flex items-center gap-2 text-muted-foreground"><GraduationCap className="h-4 w-4" /><span>{gradeLevel}</span></div> : null}
              <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" /><span>{schoolName}</span></div>
              {isBusiness && businessName ? <div className="flex items-center gap-2 text-muted-foreground"><BriefcaseBusiness className="h-4 w-4" /><span>{businessName}</span></div> : null}
              {isBusiness && website ? <div className="flex items-center gap-2 text-muted-foreground"><Globe className="h-4 w-4" /><a href={website} target="_blank" rel="noreferrer" className="hover:text-foreground">{website}</a></div> : null}
              {shippingReady ? <div className="flex items-center gap-2 text-muted-foreground"><Truck className="h-4 w-4" /><span>{typedProfile?.shipping_city}, {typedProfile?.shipping_country_code}</span></div> : null}
              {createdAt ? <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /><span>Miembro desde {new Date(createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}</span></div> : null}
            </div>

            {isBusiness && businessDescription ? <div className="w-full rounded-2xl border p-4 text-sm text-muted-foreground">{businessDescription}</div> : null}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="p-5"><div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Star className="h-4 w-4" />Valoración media</div><p className="text-3xl font-bold">{averageRatingLabel}</p></CardContent></Card>
            <Card><CardContent className="p-5"><div className="mb-2 text-sm font-medium text-muted-foreground">Opiniones</div><p className="text-3xl font-bold">{stats.reviewCount}</p></CardContent></Card>
            <Card><CardContent className="p-5"><div className="mb-2 text-sm font-medium text-muted-foreground">Ventas cerradas</div><p className="text-3xl font-bold">{stats.soldListingsCount}</p></CardContent></Card>
            <Card><CardContent className="p-5"><div className="mb-2 text-sm font-medium text-muted-foreground">Compras realizadas</div><p className="text-3xl font-bold">{stats.purchasesCount}</p></CardContent></Card>
          </div>

          <AccountProfileForm
            initialFullName={typedProfile?.full_name || ""}
            initialUserType={userType === "parent" || userType === "student" || userType === "business" ? userType : ""}
            initialGradeLevel={typedProfile?.grade_level || ""}
            initialPostalCode={typedProfile?.postal_code || ""}
            initialSchoolId={typedProfile?.school_id || ""}
            initialBusinessName={typedProfile?.business_name || ""}
            initialBusinessDescription={typedProfile?.business_description || ""}
            initialWebsite={typedProfile?.website || ""}
            initialPhone={typedProfile?.phone || ""}
            initialShippingAddressLine1={typedProfile?.shipping_address_line1 || ""}
            initialShippingAddressLine2={typedProfile?.shipping_address_line2 || ""}
            initialShippingCity={typedProfile?.shipping_city || ""}
            initialShippingRegion={typedProfile?.shipping_region || ""}
            initialShippingCountryCode={typedProfile?.shipping_country_code || "ES"}
            email={email}
            gradeLevelOptions={normalizedGradeLevels}
            schoolOptions={schoolOptions}
          />
        </div>
      </div>
    </div>
  );
}
