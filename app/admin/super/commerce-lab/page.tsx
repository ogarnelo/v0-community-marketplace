import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, FlaskConical, LockKeyhole, Truck, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  isPrivateCommercePreviewEnabled,
  isPrivateShippingLabelCreationEnabled,
  isPublicCommerceEnabled,
} from "@/lib/commerce/private-access";
import { isSendcloudConfigured } from "@/lib/logistics/sendcloud";
import { SimulateLabelButton } from "@/components/admin/commerce-lab-actions";
import { ReleaseTransferButton } from "@/components/admin/commerce-transfer-actions";

export const dynamic = "force-dynamic";

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={ok ? "secondary" : "outline"}>{ok ? "OK" : "Pendiente"}</Badge>
    </div>
  );
}

export default async function CommerceLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/super/commerce-lab");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roles?.length) redirect("/");

  const admin = createAdminClient();
  const [{ data: payments }, { data: shipments }, { data: transfers }, { data: connectedAccounts }] = await Promise.all([
    admin
      .from("payment_intents")
      .select("id, status, amount, currency, provider, seller_id, seller_net_amount, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("shipments")
      .select("id, payment_intent_id, status, provider, tracking_code, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("commerce_transfers")
      .select("id, payment_intent_id, status, provider_transfer_id, amount, currency, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("commerce_connected_accounts")
      .select("user_id, onboarding_status, transfers_enabled")
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const previewEnabled = isPrivateCommercePreviewEnabled();
  const publicEnabled = isPublicCommerceEnabled();
  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  const stripePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const stripeTestReady =
    stripeSecret.startsWith("sk_test_") && stripePublic.startsWith("pk_test_");
  const webhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const sendcloudReady = isSendcloudConfigured();
  const labelCreationEnabled = isPrivateShippingLabelCreationEnabled();
  const deliveredPaymentIds = new Set(
    (shipments || [])
      .filter((shipment: any) => shipment.status === "delivered" && shipment.payment_intent_id)
      .map((shipment: any) => shipment.payment_intent_id)
  );
  const transferByPaymentId = new Map<string, any>(
    (transfers || []).map(
      (transfer: any) =>
        [String(transfer.payment_intent_id), transfer] as [string, any]
    )
  );
  const connectReadyCount = (connectedAccounts || []).filter(
    (account: any) => account.transfers_enabled
  ).length;

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/admin/super">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Super Admin
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Commerce Lab</h1>
            <Badge variant="outline" className="gap-1">
              <LockKeyhole className="h-3.5 w-3.5" />
              Solo Super Admin
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Entorno privado para preparar pagos y logística. No activa checkout público y bloquea Stripe live mientras el comercio público siga deshabilitado.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/account/commerce">Configurar mi cuenta Connect test</Link>
            </Button>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" />
              Estado de activación
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <StatusRow
              label="Comercio público"
              ok={!publicEnabled}
              detail={publicEnabled ? "ATENCIÓN: ENABLE_LEGACY_COMMERCE está activo." : "Desactivado. Los usuarios normales siguen en el flujo directo actual."}
            />
            <StatusRow
              label="Preview privado"
              ok={previewEnabled}
              detail="Requiere ENABLE_PRIVATE_COMMERCE_PREVIEW=true. Solo Super Admin o emails allowlisted pueden usarlo."
            />
            <StatusRow
              label="Stripe test"
              ok={stripeTestReady}
              detail="Se exigen sk_test_ y pk_test_. Las claves live se rechazan en este preview."
            />
            <StatusRow
              label="Webhook Stripe"
              ok={webhookReady}
              detail="Debe usar un endpoint de test y secreto de webhook de test."
            />
            <StatusRow
              label="Stripe Connect"
              ok={connectReadyCount > 0}
              detail={connectReadyCount > 0 ? `${connectReadyCount} cuenta(s) test pueden recibir transferencias.` : "Ninguna cuenta test tiene transferencias habilitadas todavía."}
            />
            <StatusRow
              label="Sendcloud configurado"
              ok={sendcloudReady}
              detail="La integración puede preparar etiquetas cuando existan credenciales válidas."
            />
            <StatusRow
              label="Creación real de etiquetas"
              ok={!labelCreationEnabled}
              detail={labelCreationEnabled ? "Activada explícitamente para el preview." : "Bloqueada para evitar costes accidentales. Es el estado recomendado mientras probamos."}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WalletCards className="h-4 w-4" />
                Pagos recientes
              </CardTitle>
              <CardDescription>Lectura interna de los últimos intents registrados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(payments || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
              ) : (
                (payments || []).map((payment: any) => (
                  <div key={payment.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{Number(payment.amount || 0).toFixed(2)} {payment.currency || "EUR"}</span>
                      <Badge variant="outline">{payment.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{payment.provider || "stripe"} · {payment.id}</p>
                    {payment.status === "succeeded" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Neto vendedor: {Number(payment.seller_net_amount || payment.amount || 0).toFixed(2)} {payment.currency || "EUR"}
                      </p>
                    ) : null}
                    {transferByPaymentId.get(payment.id) ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        Transferencia: {(transferByPaymentId.get(payment.id) as any).status}
                        {(transferByPaymentId.get(payment.id) as any).provider_transfer_id
                          ? ` · ${(transferByPaymentId.get(payment.id) as any).provider_transfer_id}`
                          : ""}
                      </p>
                    ) : null}
                    {payment.status === "succeeded" && deliveredPaymentIds.has(payment.id) ? (
                      <ReleaseTransferButton paymentId={payment.id} />
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4" />
                Envíos recientes
              </CardTitle>
              <CardDescription>Estados internos sin crear etiquetas automáticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(shipments || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay envíos registrados.</p>
              ) : (
                (shipments || []).map((shipment: any) => (
                  <div key={shipment.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{shipment.provider || "sin proveedor"}</span>
                      <Badge variant="outline">{shipment.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {shipment.tracking_code || "Sin tracking"} · {shipment.id}
                    </p>
                    {["draft", "quoted", "label_pending"].includes(String(shipment.status)) ? (
                      <SimulateLabelButton shipmentId={shipment.id} />
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Siguiente validación del lab</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Pago Stripe test con importe calculado server-side e idempotencia.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Webhook firmado y estado interno <code>succeeded</code>.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Connect recipient y liberación manual están preparados en modo test; el payout público/automático sigue bloqueado.</p>
            <p className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 text-amber-600" /> Etiquetas Sendcloud reales permanecen bloqueadas hasta prueba controlada.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
