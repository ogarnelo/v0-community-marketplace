
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ListingGallery from "@/components/marketplace/listing-gallery";
import ShareListingButton from "@/components/marketplace/share-listing-button";
import { Button } from "@/components/ui/button";

function formatPrice(value?: number | null) {
  if (typeof value !== "number") return "Consultar";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: listing, error: listingError }, { data: photosData }] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, description, category, grade_level, condition, type, listing_type, price, original_price, isbn, seller_id, school_id, status, created_at"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("listing_photos")
      .select("url, sort_order")
      .eq("listing_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (listingError || !listing) {
    notFound();
  }

  const { data: seller } = await supabase
    .from("profiles")
    .select("id, full_name, business_name, user_type")
    .eq("id", listing.seller_id)
    .maybeSingle();

  const photos = (photosData || []).map((item: { url: string }) => item.url).filter(Boolean);
  const displayTitle = listing.title || "Anuncio";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const shareUrl = appUrl
    ? `${appUrl}/marketplace/listing/${listing.id}`
    : `/marketplace/listing/${listing.id}`;

  const savings =
    typeof listing.original_price === "number" && typeof listing.price === "number"
      ? Math.max(0, listing.original_price - listing.price)
      : 0;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/marketplace" className="hover:underline">
          Marketplace
        </Link>
        <span>/</span>
        <span className="truncate">{displayTitle}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ListingGallery photos={photos} title={displayTitle} />

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {listing.category ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {listing.category}
                </span>
              ) : null}
              {listing.grade_level ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {listing.grade_level}
                </span>
              ) : null}
              {listing.condition ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {listing.condition}
                </span>
              ) : null}
            </div>

            <h1 className="text-3xl font-bold tracking-tight">{displayTitle}</h1>

            {listing.description ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {listing.description}
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                El vendedor no ha añadido una descripción todavía.
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">ISBN</p>
                <p className="mt-1 text-sm">{listing.isbn || "No indicado"}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Estado</p>
                <p className="mt-1 text-sm">{listing.status || "No indicado"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Precio</p>
              <p className="text-3xl font-bold">{formatPrice(listing.price)}</p>
              {typeof listing.original_price === "number" ? (
                <p className="text-sm text-muted-foreground">
                  Precio original: {formatPrice(listing.original_price)}
                </p>
              ) : null}
              {savings > 0 ? (
                <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  Ahorras {formatPrice(savings)}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link href={`/messages?listing=${listing.id}`}>
                <Button className="w-full">Hablar con el vendedor</Button>
              </Link>
              <ShareListingButton title={displayTitle} url={shareUrl} />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Vendedor</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium">
                {seller?.business_name || seller?.full_name || "Usuario"}
              </p>
              <p className="text-muted-foreground">
                {seller?.user_type === "business" ? "Negocio local" : "Miembro de la comunidad"}
              </p>
              {seller?.id ? (
                <Link href={`/profile/${seller.id}`} className="text-primary hover:underline">
                  Ver perfil
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Compra protegida en Wetudy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Usa el chat, negocia y completa el pago dentro de la plataforma para mantener
              el seguimiento de la operación y el historial de la compra.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
