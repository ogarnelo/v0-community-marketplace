import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, CircleAlert, FlaskConical, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUserAccessPrivateCommercePreview } from "@/lib/commerce/private-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectPreviewActions } from "@/components/account/connect-preview-actions";

export const dynamic = "force-dynamic";

export default async function PrivateCommerceAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/commerce");
  if (!(await canUserAccessPrivateCommercePreview(user))) redirect("/account");

  const query = await searchParams;
  const admin = createAdminClient();
  const connectedAccountResult = await admin
    .from("commerce_connected_accounts")
    .select("provider_account_id, onboarding_status, transfers_enabled, requirements_due, disabled_reason, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const connectedAccount = connectedAccountResult.data as
    | {
        provider_account_id: string;
        onboarding_status: string;
        transfers_enabled: boolean;
        requirements_due: string[];
        disabled_reason: string | null;
        updated_at: string;
      }
    | null;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/account">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Mi cuenta
          </Link>
        </Button>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Cobros · preview privado</h1>
            <Badge variant="outline" className="gap-1">
              <FlaskConical className="h-3.5 w-3.5" />
              Stripe test
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Esta pantalla no forma parte del producto público. Sirve para probar el onboarding del vendedor y futuras transferencias sin dinero real.
          </p>
        </div>

        {query.connect === "returned" ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            Has vuelto de Stripe. Pulsa <strong>Actualizar estado</strong>; salir del formulario no garantiza que todos los requisitos estén completos.
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WalletCards className="h-4 w-4" />
              Cuenta conectada
            </CardTitle>
            <CardDescription>
              Wetudy solo almacena el ID técnico y el estado. Los datos KYC permanecen en Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectedAccount ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="mt-1 font-medium">{connectedAccount.onboarding_status}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Transferencias</p>
                    <p className="mt-1 flex items-center gap-2 font-medium">
                      {connectedAccount.transfers_enabled ? (
                        <BadgeCheck className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CircleAlert className="h-4 w-4 text-amber-600" />
                      )}
                      {connectedAccount.transfers_enabled ? "Habilitadas en test" : "Pendientes"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Stripe account</p>
                  <p className="mt-1 break-all font-mono text-xs">{connectedAccount.provider_account_id}</p>
                </div>

                {connectedAccount.requirements_due?.length ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-950">Requisitos pendientes</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
                      {connectedAccount.requirements_due.map((item: string) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {connectedAccount.disabled_reason ? (
                  <p className="text-xs text-rose-700">{connectedAccount.disabled_reason}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no existe una cuenta Stripe Connect test asociada a este usuario.
              </p>
            )}

            <ConnectPreviewActions hasAccount={Boolean(connectedAccount)} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
