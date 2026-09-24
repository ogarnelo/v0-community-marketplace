import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NewListingForm from "@/components/marketplace/new-listing-form";
import type { ProfileRow, SchoolRow } from "@/lib/types/marketplace";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string | string[] }>;
}) {
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
  const requestedParams = await searchParams;
  const opportunityKey =
    typeof requestedParams.opportunity === "string" ? requestedParams.opportunity.trim() : "";

  let activationOpportunityKey: string | null = null;
  let initialPrefill: {
    title?: string;
    category?: string;
    gradeLevel?: string;
    isbn?: string;
    specificType?: string;
    sizeLabel?: string;
    brand?: string;
    model?: string;
  } | null = null;

  if (opportunityKey) {
    const admin = createAdminClient();
    const [{ data: action }, { data: campaign }] = await Promise.all([
      admin
        .from("demand_opportunity_actions")
        .select("id,response")
        .eq("opportunity_key", opportunityKey)
        .eq("target_user_id", user.id)
        .eq("action_type", "seller_contacted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("demand_campaigns")
        .select("title,category,grade_level,isbn,specific_type,size_label,brand,model,metadata")
        .eq("opportunity_key", opportunityKey)
        .maybeSingle(),
    ]);

    if (action && campaign) {
      const metadata = (campaign.metadata || {}) as Record<string, unknown>;
      activationOpportunityKey = opportunityKey;
      initialPrefill = {
        title: campaign.title || metadataString(metadata, "title") || undefined,
        category: campaign.category || metadataString(metadata, "category") || undefined,
        gradeLevel: campaign.grade_level || metadataString(metadata, "grade_level") || undefined,
        isbn: campaign.isbn || metadataString(metadata, "isbn") || undefined,
        specificType: campaign.specific_type || metadataString(metadata, "specific_type") || undefined,
        sizeLabel: campaign.size_label || metadataString(metadata, "size_label") || undefined,
        brand: campaign.brand || metadataString(metadata, "brand") || undefined,
        model: campaign.model || metadataString(metadata, "model") || undefined,
      };
    }
  }

  if (typedProfile?.user_type === "business") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center lg:px-8">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <p className="text-sm font-semibold text-primary">Cuenta profesional</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">La publicación para cuentas profesionales no está disponible</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Wetudy está orientado a familias y estudiantes. Las cuentas profesionales no pueden publicar anuncios.
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
      .eq("is_active", true)
      .maybeSingle();

    if (schoolError) {
      console.error("Error cargando school real:", schoolError);
    }

    selectedSchool = (school as SchoolRow | null) ?? null;
  }

  return (
    <NewListingForm
      currentUserId={user.id}
      initialSchoolId={selectedSchool?.id || ""}
      initialSchoolName={selectedSchool?.name || "Centro no asignado"}
      initialSchoolCity={selectedSchool?.city || ""}
      initialPrefill={initialPrefill}
      activationOpportunityKey={activationOpportunityKey}
    />
  );
}
