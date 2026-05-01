import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBoostPlan, getFeaturedUntil } from "@/lib/boosts/pricing";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function BoostSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  if (!sessionId) redirect("/account/listings");

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Stripe no está configurado</h1>
          <p className="mt-2 text-muted-foreground">
            No podemos confirmar el boost porque falta STRIPE_SECRET_KEY en este entorno.
          </p>
          <Link href="/account/listings" className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm font-medium">
            Volver a mis anuncios
          </Link>
        </div>
      </div>
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Pago pendiente</h1>
          <p className="mt-2 text-muted-foreground">
            Todavía no hemos recibido confirmación del pago. Vuelve a intentarlo en unos segundos.
          </p>
          <Link href="/account/listings" className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm font-medium">
            Volver a mis anuncios
          </Link>
        </div>
      </div>
    );
  }

  const listingId = session.metadata?.listing_id;
  const sessionUserId = session.metadata?.user_id;
  const plan = getBoostPlan(session.metadata?.plan_id);

  if (!listingId || sessionUserId !== user.id) {
    redirect("/account/listings");
  }

  const { data: existingBoost } = await admin
    .from("listing_boosts")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  const featuredUntil = getFeaturedUntil(plan.days);

  if (!existingBoost) {
    await admin.from("listing_boosts").insert({
      listing_id: listingId,
      user_id: user.id,
      boost_type: "paid",
      amount_paid: plan.amountCents / 100,
      currency: plan.currency,
      payment_status: "paid",
      stripe_checkout_session_id: session.id,
      featured_until: featuredUntil.toISOString(),
    });

    await createNotification(admin, {
      user_id: user.id,
      kind: "listing_boosted",
      title: "Anuncio destacado activado",
      body: `Tu anuncio tendrá visibilidad extra durante ${plan.days} días.`,
      href: `/marketplace/listing/${listingId}`,
      metadata: {
        listing_id: listingId,
        stripe_checkout_session_id: session.id,
        plan_id: plan.id,
      },
    });
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          Boost activado
        </span>
        <h1 className="mt-4 text-2xl font-bold">Tu anuncio ya está destacado</h1>
        <p className="mt-2 text-muted-foreground">
          Hemos activado la visibilidad extra. Tu anuncio tendrá prioridad hasta el{" "}
          {featuredUntil.toLocaleDateString("es-ES")}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/marketplace/listing/${listingId}`}
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Ver anuncio
          </Link>
          <Link href="/account/listings" className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium">
            Mis anuncios
          </Link>
        </div>
      </div>
    </div>
  );
}
