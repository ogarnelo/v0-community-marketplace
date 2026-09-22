import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  assertStripeTestMode,
  canUserAccessPrivateCommercePreview,
} from "@/lib/commerce/private-access";
import { SellerConnectPreviewCard } from "@/components/commerce/seller-connect-preview-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PrivateCommerceAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/commerce-preview");
  if (!(await canUserAccessPrivateCommercePreview(user))) redirect("/account");
  assertStripeTestMode();

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 lg:px-8">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/account">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Mi cuenta
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-primary">Beta privada</p>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Pagos del vendedor
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Entorno de prueba para preparar Stripe Connect. No forma parte del
            flujo público de Wetudy y utiliza exclusivamente claves Stripe test.
          </p>
        </div>

        <SellerConnectPreviewCard />
      </div>
    </main>
  );
}
