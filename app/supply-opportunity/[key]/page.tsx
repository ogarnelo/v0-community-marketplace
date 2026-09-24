import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { SupplyOpportunityResponse } from "@/components/demand/supply-opportunity-response";

export const dynamic = "force-dynamic";

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default async function SupplyOpportunityPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=/supply-opportunity/${encodeURIComponent(key)}`);

  const admin = createAdminClient();
  const [navbarData, actionResult, campaignResult] = await Promise.all([
    getNavbarData(supabase),
    admin
      .from("demand_opportunity_actions")
      .select("id,message,response,responded_at")
      .eq("opportunity_key", key)
      .eq("target_user_id", user.id)
      .eq("action_type", "seller_contacted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("demand_campaigns")
      .select("title,category,grade_level,metadata")
      .eq("opportunity_key", key)
      .maybeSingle(),
  ]);

  const action = actionResult.data;
  const campaign = campaignResult.data;
  if (!action || !campaign) notFound();

  const metadata = (campaign.metadata || {}) as Record<string, unknown>;
  const schoolName = stringValue(metadata.school_name);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PackageSearch className="h-5 w-5" />
              </div>
              <CardTitle>Hay demanda de material que quizá tengas</CardTitle>
              <CardDescription>
                Wetudy te muestra esta oportunidad porque anteriormente publicaste material relacionado. Tu respuesta es voluntaria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="font-medium">{campaign.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[schoolName, campaign.category, campaign.grade_level].filter(Boolean).join(" · ")}
                </p>
                {action.message ? <p className="mt-3 text-sm leading-relaxed">{action.message}</p> : null}
              </div>

              <SupplyOpportunityResponse
                opportunityKey={key}
                initialResponse={action.response}
              />

              <p className="text-xs leading-relaxed text-muted-foreground">
                Si publicas, el anuncio seguirá siendo un anuncio normal de Wetudy y podrás revisar todos los campos antes de hacerlo.
              </p>
              <Button asChild variant="ghost" size="sm"><Link href="/marketplace">Ahora no</Link></Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
