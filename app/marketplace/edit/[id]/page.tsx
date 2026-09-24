import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditListingForm, { type EditableListing } from "@/components/marketplace/edit-listing-form";

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/marketplace/edit/${encodeURIComponent(id)}`);
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, title, description, category, grade_level, condition, type, listing_type, isbn, book_edition_id, author, publisher, format, language, subject, specific_type, size_label, brand, model, season, price, original_price, seller_id, school_id, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (listingError) throw listingError;
  if (!listing) notFound();

  const typedListing = listing as EditableListing;

  if (typedListing.seller_id !== user.id) {
    redirect("/account/listings");
  }

  const [{ data: school }, { data: photos, error: photosError }] = await Promise.all([
    typedListing.school_id
      ? supabase
          .from("schools")
          .select("id, name, city")
          .eq("id", typedListing.school_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("listing_photos")
      .select("id, url, sort_order")
      .eq("listing_id", typedListing.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (photosError) throw photosError;

  const schoolLabel = school
    ? school.city
      ? `${school.name}, ${school.city}`
      : school.name
    : "Centro no asignado";

  return (
    <EditListingForm
      currentUserId={user.id}
      initialListing={typedListing}
      initialSchoolLabel={schoolLabel}
      initialPhotos={(photos || []).map((photo, index) => ({
        id: photo.id,
        url: photo.url,
        sortOrder: typeof photo.sort_order === "number" ? photo.sort_order : index,
      }))}
    />
  );
}
