import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gradeLevels } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
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

type AccountProfile = {
  id: string;
  full_name: string | null;
  user_type: string | null;
  grade_level: string | null;
  postal_code: string | null;
  school_id: string | null;
  created_at: string | null;
};

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
  postal_code: string | null;
};

type SafeUserMetadata = {
  full_name?: string;
  user_type?: string;
  grade_level?: string;
  postal_code?: string;
  school_name?: string;
};

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    return name
      .trim()
      .split(" ")
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("");
  }

  if (email && email.length > 0) {
    return email[0].toUpperCase();
  }

  return "U";
}

function formatUserType(userType?: string | null) {
  switch (userType) {
    case "parent":
      return "Familia / Tutor legal";
    case "student":
      return "Estudiante";
    case "school_admin":
      return "Administrador de centro";
    case "super_admin":
      return "Super admin";
    default:
      return "Usuario";
  }
}

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const metadata = (user.user_metadata || {}) as SafeUserMetadata;

  const profileResponse = await supabase
    .from("profiles")
    .select("id, full_name, user_type, grade_level, postal_code, school_id, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const schoolsResponse = await supabase
    .from("schools")
    .select("id, name, city, postal_code")
    .order("name", { ascending: true });

  const profile = (profileResponse.data || null) as AccountProfile | null;

  const schools: SchoolOption[] = ((schoolsResponse.data || []) as any[]).map((school) => ({
    id: school.id,
    name: school.name,
    city: school.city ?? null,
    postal_code: school.postal_code ?? null,
  }));

  const gradeLevelOptions = [
    ...gradeLevels.filter((level) => level !== "Otros"),
    "Otros",
  ];

  const fullName =
    profile?.full_name || metadata.full_name || user.email || "Mi cuenta";
  const email = user.email || "Sin email";
  const userType = profile?.user_type || metadata.user_type || "student";
  const gradeLevel = profile?.grade_level || metadata.grade_level || "";
  const postalCode = profile?.postal_code || metadata.postal_code || "";
  const createdAt = profile?.created_at || user.created_at || null;

  const selectedSchool =
    profile?.school_id && profile.school_id.trim().length > 0
      ? schools.find((school) => school.id === profile.school_id) || null
      : null;

  const schoolName =
    selectedSchool?.name ||
    (typeof metadata.school_name === "string" &&
      metadata.school_name.trim().length > 0
      ? metadata.school_name.trim()
      : "Centro no asignado");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona tu perfil y revisa la información asociada a tu cuenta de
          Wetudy.
        </p>
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
                <Badge variant="secondary">{formatUserType(userType)}</Badge>
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
            initialFullName={profile?.full_name || ""}
            initialUserType={
              profile?.user_type === "parent" || profile?.user_type === "student"
                ? profile.user_type
                : "student"
            }
            initialGradeLevel={profile?.grade_level || ""}
            initialPostalCode={profile?.postal_code || ""}
            initialSchoolId={profile?.school_id || ""}
            email={email}
            gradeLevelOptions={gradeLevelOptions}
            schoolOptions={schools}
          />
        </div>
      </div>
    </div>
  );
}
