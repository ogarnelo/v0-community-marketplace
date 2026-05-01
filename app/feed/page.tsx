import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations } from "@/lib/marketplace/get-recommendations";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const recs = await getRecommendations(user.id);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Recomendado para ti</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {recs.map((l: any) => (
          <a key={l.id} href={`/marketplace/listing/${l.id}`} className="border p-4 rounded-xl">
            <h2 className="font-semibold">{l.title}</h2>
            <p className="text-sm text-muted-foreground">{l.price}€</p>
          </a>
        ))}
      </div>
    </div>
  );
}
