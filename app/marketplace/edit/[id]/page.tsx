import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import EditListingForm, { type EditableListing } from "@/components/marketplace/edit-listing-form";

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The primary key is a PostgreSQL UUID. Bad URLs must not invoke SQL or
  // privileged school-directory reads.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }
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
      "id, title, description, category, grade_level, condition, type, listing_type, isbn, book_edition_id, author, publisher, format, language, subject, specific_type, size_label, brand, model, season, price, original_price, seller_id, school_id, directory_school_code, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (listingError) throw new Error("listing_edit_load_failed");
  if (!listing) notFound();

  const typedListing = listing as EditableListing;

  if (typedListing.seller_id !== user.id) {
    redirect("/account/listings");
  }

  const [{ data: school, error: schoolError }, { data: photos, error: photosError }] = await Promise.all([
    typedListing.school_id
      ? supabase
          .from("schools")
          .select("id, name, city")
          .eq("id", typedListing.school_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("listing_photos")
      .select("id, url, sort_order")
      .eq("listing_id", typedListing.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (schoolError || photosError) throw new Error("listing_edit_related_data_unavailable");
  const { data: directorySchool, error: directoryError } = typedListing.directory_school_code
    ? await createAdminClient()
        .from("school_directory")
        .select("name,municipality")
        .eq("official_code", typedListing.directory_school_code)
        .maybeSingle()
    : { data: null, error: null };
  if (directoryError) throw new Error("listing_edit_school_directory_unavailable");

  const schoolLabel = school
    ? school.city
      ? `${school.name}, ${school.city}`
      : school.name
    : directorySchool
      ? `${directorySchool.name}, ${directorySchool.municipality} · directorio nacional`
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
