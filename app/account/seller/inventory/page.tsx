import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import InventoryExpansionPanel from "@/components/seller/inventory-expansion-panel";
import { ArrowLeft, Layers3, PackagePlus } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inventario inteligente | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SellerInventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/seller/inventory");

  const admin = createAdminClient();

  const { data: listings } = await admin
    .from("listings")
    .select("id, title, price, category, grade_level, status, created_at")
    .eq("seller_id", user.id)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(100);

  await admin.from("inventory_expansion_events").insert({
    user_id: user.id,
    event_type: "inventory_panel_opened",
    metadata: {
      listings_count: (listings || []).length,
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
          <Link href="/account/seller/velocity">
            <ArrowLeft className="h-4 w-4" />
            Volver a Seller Velocity
          </Link>
        </Button>

        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Layers3 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">Inventario inteligente</h1>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                Multiplica inventario sin empezar de cero: duplica anuncios con foto, crea packs y genera variaciones.
              </p>
            </div>

            <Button asChild>
              <Link href="/marketplace/new/quick" className="gap-2">
                <PackagePlus className="h-4 w-4" />
                Publicar rápido
              </Link>
            </Button>
          </div>
        </section>

        <InventoryExpansionPanel listings={(listings || []) as any} />
    </main>
  );
}
