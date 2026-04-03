import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gradeLevels } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  MapPin,
  GraduationCap,
  CalendarDays,
  Building2,
} from "lucide-react";
import AccountProfileForm from "@/components/account/account-profile-form";
import type {
  AccountProfileRow,
  SchoolRow,
} from "@/lib/types/marketplace";
import {
  getInitials,
  getUserTypeLabel,
} from "@/lib/marketplace/formatters";

type SafeUserMetadata = {
  full_name?: string;
  user_type?: string;
  grade_level?: string;
  postal_code?: string;
  school_name?: string;
};

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const metadata = (user.user_metadata || {}) as SafeUserMetadata;

  const [{ data: profile, error: profileError }, { data: schoolsData, error: schoolsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, user_type, grade_level, postal_code, school_id, created_at"
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("schools")
        .select("id, name, city, postal_code")
        .order("name", { ascending: true }),
    ]);

  if (profileError) {
    console.error("Error cargando profile:", profileError);
  }

  if (schoolsError) {
    console.error("Error cargando schools:", schoolsError);
  }

  const typedProfile = (profile || null) as AccountProfileRow | null;
  const schoolOptions: SchoolRow[] = Array.isArray(schoolsData)
    ? (schoolsData as SchoolRow[])
    : [];

  const fullName =
    typedProfile?.full_name || metadata.full_name || user.email || "Mi cuenta";
  const email = user.email || "Sin email";
  const userType = typedProfile?.user_type || metadata.user_type || null;
  const gradeLevel = typedProfile?.grade_level || metadata.grade_level || null;
  const postalCode = typedProfile?.postal_code || metadata.postal_code || null;
  const createdAt = typedProfile?.created_at || user.created_at || null;

  const selectedSchool =
    typedProfile?.school_id && typedProfile.school_id.trim().length > 0
      ? schoolOptions.find((school) => school.id === typedProfile.school_id) || null
      : null;

  const schoolName =
    selectedSchool?.name ||
    (typeof metadata.school_name === "string" && metadata.school_name.trim().length > 0
      ? metadata.school_name.trim()
      : "Centro no asignado");

  const normalizedGradeLevels = Array.from(new Set(gradeLevels)).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
          <p className="mt-2 text-muted-foreground">
            Gestiona tu perfil y revisa la información asociada a tu cuenta de
            Wetudy.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/account/activity">Ver actividad</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-start gap-5 p-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(fullName, email)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{fullName}</h2>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{getUserTypeLabel(userType)}</Badge>
                {user.email_confirmed_at ? <Badge>Email verificado</Badge> : null}
              </div>
            </div>

            <div className="w-full space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{email}</span>
              </div>

              {postalCode ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Código postal: {postalCode}</span>
                </div>
              ) : null}

              {gradeLevel ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GraduationCap className="h-4 w-4" />
                  <span>{gradeLevel}</span>
                </div>
              ) : null}

              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{schoolName}</span>
              </div>

              {createdAt ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    Miembro desde{" "}
                    {new Date(createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <AccountProfileForm
            initialFullName={typedProfile?.full_name || ""}
            initialUserType={
              typedProfile?.user_type === "parent" || typedProfile?.user_type === "student"
                ? typedProfile.user_type
                : ""
            }
            initialGradeLevel={typedProfile?.grade_level || ""}
            initialPostalCode={typedProfile?.postal_code || ""}
            initialSchoolId={typedProfile?.school_id || ""}
            email={email}
            gradeLevelOptions={normalizedGradeLevels}
            schoolOptions={schoolOptions.map((school) => ({
              id: school.id,
              name: school.name,
              city: school.city,
              postal_code: school.postal_code || null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}