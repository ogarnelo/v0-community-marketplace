import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewListingForm from "@/components/marketplace/new-listing-form";
import type { ProfileRow, SchoolRow } from "@/lib/types/marketplace";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/marketplace/new");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, user_type, school_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error cargando school_id del perfil:", profileError);
  }

  const typedProfile = (profile as ProfileRow | null) ?? null;

  if (typedProfile?.user_type === "business") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center lg:px-8">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <p className="text-sm font-semibold text-primary">MVP familias</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Los vendedores profesionales aún no están activos</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            En esta primera etapa Wetudy se centra en familias y estudiantes. Las cuentas profesionales se revisarán más adelante, cuando el flujo comunitario esté validado.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/marketplace">Ver marketplace</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account">Ir a mi cuenta</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  let selectedSchool: SchoolRow | null = null;

  if (typedProfile?.school_id && typedProfile.school_id.trim().length > 0) {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, city")
      .eq("id", typedProfile.school_id)
      .maybeSingle();

    if (schoolError) {
      console.error("Error cargando school real:", schoolError);
    }

    selectedSchool = (school as SchoolRow | null) ?? null;
  }

  return (
    <NewListingForm
      initialSchoolId={selectedSchool?.id || ""}
      initialSchoolName={selectedSchool?.name || "Centro no asignado"}
      initialSchoolCity={selectedSchool?.city || ""}
    />
  );
}
