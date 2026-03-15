import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewListingForm from "@/components/marketplace/new-listing-form";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/marketplace/new");
  }

  return <NewListingForm />;
}
