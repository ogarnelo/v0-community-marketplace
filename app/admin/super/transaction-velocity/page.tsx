import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";
import TransactionVelocityRunButton from "@/components/transaction/transaction-velocity-run-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Handshake } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transaction Velocity | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

function priorityClassName(priority: string) {
  switch (priority) {
    case "urgent":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "medium":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default async function AdminTransactionVelocityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const isSuperadmin = await canAccessSuperadmin(user.id, user.email);

  if (!isSuperadmin) {
    redirect("/account");
  }

  const admin = createAdminClient();

  const { data: actions } = await admin
    .from("transaction_velocity_events")
    .select("id, user_id, related_offer_id, listing_id, event_type, priority, status, title, message, href, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const pending = (actions || []).filter((action: any) => action.status === "pending");
  const urgent = pending.filter((action: any) => action.priority === "urgent" || action.priority === "high");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
        <Link href="/admin/super">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
      </Button>

      <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Handshake className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Transaction Velocity</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Motor de acciones para convertir ofertas aceptadas, contraofertas y chats en transacciones cerradas.
            </p>
          </div>

          <TransactionVelocityRunButton />
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Acciones totales</p>
          <p className="mt-2 text-3xl font-bold">{(actions || []).length}</p>
        </div>
        <div className="rounded-3xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="mt-2 text-3xl font-bold">{pending.length}</p>
        </div>
        <div className="rounded-3xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Alta prioridad</p>
          <p className="mt-2 text-3xl font-bold">{urgent.length}</p>
        </div>
      </section>

      <div className="grid gap-4">
        {(actions || []).map((action: any) => (
          <article key={action.id} className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={priorityClassName(action.priority)}>
                    {action.priority}
                  </Badge>
                  <Badge variant="secondary">{action.event_type}</Badge>
                  <Badge variant="outline">{action.status}</Badge>
                </div>

                <h2 className="mt-3 text-lg font-semibold">{action.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{action.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Usuario: {action.user_id} · Oferta: {action.related_offer_id || "sin oferta"}
                </p>
              </div>

              {action.href ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={action.href}>Abrir</Link>
                </Button>
              ) : null}
            </div>
          </article>
        ))}

        {(actions || []).length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">Aún no hay acciones</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ejecuta el motor para generar acciones a partir de ofertas y chats.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
