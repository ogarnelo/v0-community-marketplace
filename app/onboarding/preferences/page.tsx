import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MarketplacePreferencesForm from "@/components/onboarding/marketplace-preferences-form";

export default async function MarketplacePreferencesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Personaliza Wetudy
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Encuentra antes lo que necesitas
        </h1>
        <p className="mt-2 text-muted-foreground">
          Dinos qué curso, categorías y necesidades tienes para preparar alertas, recomendaciones y búsquedas útiles.
        </p>
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <MarketplacePreferencesForm />
      </div>
    </div>
  );
}
