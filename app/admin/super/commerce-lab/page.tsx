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
import { RefundPaymentButton, ReleaseTransferButton, SimulateLabelButton } from "@/components/admin/commerce-lab-actions";

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
  const [
    { data: payments },
    { data: shipments },
    { data: connectAccounts },
    { data: transfers },
    { data: refunds },
  ] = await Promise.all([
    admin
      .from("payment_intents")
      .select("id, status, amount, currency, provider, created_at, seller_net_amount, seller_id, buyer_id, metadata")
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("shipments")
      .select("id, payment_intent_id, status, provider, tracking_code, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("seller_connect_accounts")
      .select("user_id, stripe_account_id, onboarding_status, transfers_active, payouts_enabled, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
    admin
      .from("commerce_transfers")
      .select("id, payment_intent_id, provider_transfer_id, amount, currency, status, released_at, reversed_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("commerce_refunds")
      .select("id, payment_intent_id, provider_refund_id, amount, currency, status, transfer_reversal_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const shipmentByPaymentId = new Map(
    (shipments || [])
      .filter((shipment: any) => shipment.payment_intent_id)
      .map((shipment: any) => [shipment.payment_intent_id, shipment])
  );
  const transferByPaymentId = new Map(
    (transfers || []).map((transfer: any) => [transfer.payment_intent_id, transfer])
  );
  const refundByPaymentId = new Map(
    (refunds || []).map((refund: any) => [refund.payment_intent_id, refund])
  );

  const previewEnabled = isPrivateCommercePreviewEnabled();
  const publicEnabled = isPublicCommerceEnabled();
  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  const stripePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const stripeTestReady =
    stripeSecret.startsWith("sk_test_") && stripePublic.startsWith("pk_test_");
  const webhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const sendcloudReady = isSendcloudConfigured();
  const labelCreationEnabled = isPrivateShippingLabelCreationEnabled();

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
                (payments || []).map((payment: any) => {
                  const shipment = shipmentByPaymentId.get(payment.id) as any;
                  const transfer = transferByPaymentId.get(payment.id) as any;
                  const refund = refundByPaymentId.get(payment.id) as any;
                  const deliveryMethod = payment.metadata?.delivery_method || "sin dato";
                  const canRelease =
                    payment.status === "succeeded" &&
                    !refund &&
                    !transfer?.provider_transfer_id &&
                    (deliveryMethod !== "shipping" || shipment?.status === "delivered");
                  const canRefund = payment.status === "succeeded" && !refund;

                  return (
                    <div key={payment.id} className="rounded-xl border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{Number(payment.amount || 0).toFixed(2)} {payment.currency || "EUR"}</span>
                        <Badge variant="outline">{payment.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{payment.provider || "stripe"} · {payment.id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Entrega: {deliveryMethod}
                        {shipment ? ` · envío ${shipment.status}` : ""}
                        {transfer ? ` · transferencia ${transfer.status}` : ""}
                        {refund ? ` · refund ${refund.status}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canRelease ? <ReleaseTransferButton paymentIntentId={payment.id} /> : null}
                        {canRefund ? <RefundPaymentButton paymentIntentId={payment.id} /> : null}
                      </div>
                    </div>
                  );
                })
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

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendedores Connect test</CardTitle>
              <CardDescription>Estado del onboarding y capacidad de recibir transferencias.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(connectAccounts || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún tester ha iniciado Connect todavía.</p>
              ) : (
                (connectAccounts || []).map((account: any) => (
                  <div key={account.user_id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs">{account.stripe_account_id}</span>
                      <Badge variant="outline">{account.onboarding_status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      transfers {account.transfers_active ? "active" : "pending"} · payouts {account.payouts_enabled ? "active" : "pending"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transferencias test</CardTitle>
              <CardDescription>Fondos liberados o revertidos hacia vendedores Connect.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(transfers || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay transferencias.</p>
              ) : (
                (transfers || []).map((transfer: any) => (
                  <div key={transfer.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{Number(transfer.amount || 0).toFixed(2)} {transfer.currency || "EUR"}</span>
                      <Badge variant="outline">{transfer.status}</Badge>
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {transfer.provider_transfer_id || "Pendiente de Stripe"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Refunds test</CardTitle>
              <CardDescription>Reembolsos completos y reversión asociada si existía transferencia.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(refunds || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay refunds.</p>
              ) : (
                (refunds || []).map((refund: any) => (
                  <div key={refund.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{Number(refund.amount || 0).toFixed(2)} {refund.currency || "EUR"}</span>
                      <Badge variant="outline">{refund.status}</Badge>
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {refund.provider_refund_id || "Pendiente de Stripe"}
                    </p>
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
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Connect test: onboarding del vendedor, capabilities y cuenta persistida.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Transferencia test manual tras entrega, con source_transaction e idempotencia.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Refund test completo con reversión previa de transferencia cuando corresponde.</p>
            <p className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 text-amber-600" /> La liberación sigue siendo manual y exclusiva del lab; no existe payout automático ni activación pública.</p>
            <p className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 text-amber-600" /> Etiquetas Sendcloud reales permanecen bloqueadas hasta prueba controlada.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
