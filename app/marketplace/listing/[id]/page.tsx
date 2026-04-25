
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ListingGallery from "@/components/marketplace/listing-gallery";
import ShareListingButton from "@/components/marketplace/share-listing-button";
import PostPublishShareCard from "@/components/marketplace/post-publish-share-card";
import RelatedListingsSection from "@/components/marketplace/related-listings-section";
import { Button } from "@/components/ui/button";
import { buildPhotosMap, type ListingPhotoRow, type MarketplaceListing } from "@/lib/types/marketplace";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();
  const authSupabase = await createClient();

  const [{ data: listing, error: listingError }, { data: photosData }, { data: authData }] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, description, category, grade_level, condition, type, listing_type, price, original_price, isbn, seller_id, school_id, status, created_at"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .eq("listing_id", id)
      .order("sort_order", { ascending: true }),
    authSupabase.auth.getUser(),
  ]);

  if (listingError || !listing) {
    notFound();
  }

  const currentUserId = authData?.user?.id || null;

  const [{ data: seller }, { data: viewerProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, business_name, user_type")
      .eq("id", listing.seller_id)
      .maybeSingle(),
    currentUserId
      ? supabase.from("profiles").select("school_id").eq("id", currentUserId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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

  const relatedQuery = supabase
    .from("listings")
    .select(
      "id, title, description, category, grade_level, condition, type, listing_type, isbn, price, original_price, estimated_retail_price, seller_id, school_id, status, created_at"
    )
    .eq("status", "available")
    .neq("id", listing.id)
    .limit(8);

  if (listing.isbn) {
    relatedQuery.eq("isbn", listing.isbn);
  } else if (listing.category && listing.grade_level) {
    relatedQuery.eq("category", listing.category).eq("grade_level", listing.grade_level);
  } else if (listing.category) {
    relatedQuery.eq("category", listing.category);
  } else if (listing.grade_level) {
    relatedQuery.eq("grade_level", listing.grade_level);
  }

  const { data: relatedRows } = await relatedQuery;
  const relatedIds = (relatedRows || []).map((item: any) => item.id);
  let relatedPhotosMap = new Map<string, string[]>();

  if (relatedIds.length > 0) {
    const { data: relatedPhotos } = await supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .in("listing_id", relatedIds)
      .order("sort_order", { ascending: true });

    relatedPhotosMap = buildPhotosMap((relatedPhotos || []) as ListingPhotoRow[]);
  }

  const relatedListings: MarketplaceListing[] = (relatedRows || []).map((item: any) => ({
    id: item.id,
    title: item.title || "Anuncio sin título",
    description: item.description || null,
    category: item.category,
    gradeLevel: item.grade_level,
    condition: item.condition,
    type: item.type || item.listing_type,
    isbn: item.isbn || null,
    price: item.price ?? undefined,
    originalPrice: item.original_price ?? item.estimated_retail_price ?? undefined,
    photos: relatedPhotosMap.get(item.id) || [],
    sellerId: item.seller_id || null,
    schoolId: item.school_id || null,
    status: item.status,
    createdAt: item.created_at || null,
    isFavorite: false,
  }));

  const isOwnListing = currentUserId && listing.seller_id === currentUserId;
  const currentSchoolId = viewerProfile?.school_id || "";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/marketplace" className="hover:underline">Marketplace</Link>
        <span>/</span>
        <span className="truncate">{displayTitle}</span>
      </div>

      {query.published === "1" && isOwnListing ? (
        <div className="mb-6">
          <PostPublishShareCard title={displayTitle} url={shareUrl} />
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ListingGallery photos={photos} title={displayTitle} />

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {listing.category ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{listing.category}</span> : null}
              {listing.grade_level ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{listing.grade_level}</span> : null}
              {listing.condition ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{listing.condition}</span> : null}
            </div>

            <h1 className="text-3xl font-bold tracking-tight">{displayTitle}</h1>

            {listing.description ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{listing.description}</p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">El vendedor no ha añadido una descripción todavía.</p>
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

          <RelatedListingsSection listings={relatedListings} currentSchoolId={currentSchoolId} />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Precio</p>
              <p className="text-3xl font-bold">{formatPrice(listing.price)}</p>
              {typeof listing.original_price === "number" ? (
                <p className="text-sm text-muted-foreground">Precio original: {formatPrice(listing.original_price)}</p>
              ) : null}
              {savings > 0 ? (
                <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Ahorras {formatPrice(savings)}</p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {!isOwnListing ? (
                <Link href={`/messages?listing=${listing.id}`}>
                  <Button className="w-full">Hablar con el vendedor</Button>
                </Link>
              ) : (
                <Link href={`/marketplace/edit/${listing.id}`}>
                  <Button className="w-full" variant="outline">Editar anuncio</Button>
                </Link>
              )}
              <ShareListingButton title={displayTitle} url={shareUrl} />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Vendedor</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium">{seller?.business_name || seller?.full_name || "Usuario"}</p>
              <p className="text-muted-foreground">{seller?.user_type === "business" ? "Negocio local" : "Miembro de la comunidad"}</p>
              {seller?.id ? <Link href={`/profile/${seller.id}`} className="text-primary hover:underline">Ver perfil</Link> : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Compra protegida en Wetudy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Usa el chat, negocia y completa el pago dentro de la plataforma para mantener el seguimiento de la operación y el historial de la compra.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
