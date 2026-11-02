import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isWhatsappPilotConfigured, isWhatsappPilotUserAllowed } from "@/lib/whatsapp/pilot";
import WhatsappLinkPanel from "@/components/account/whatsapp-link-panel";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function WhatsappAccountPage() {
  // Hide the entire pilot unless its secure provider integration is ready.
  if (!isWhatsappPilotConfigured()) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/account/whatsapp");
  if (!user.email_confirmed_at || !isWhatsappPilotUserAllowed(user.id)) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <Link href="/account" className="text-sm text-primary hover:underline">← Volver a mi cuenta</Link>
      <div>
        <p className="text-sm font-medium text-primary">Piloto privado · Wetudy</p>
        <h1 className="mt-2 text-3xl font-bold">Conecta tu WhatsApp</h1>
        <p className="mt-3 text-muted-foreground">Vincula voluntariamente tu número para probar la publicación asistida cuando esté disponible.</p>
      </div>
      <WhatsappLinkPanel />
    </div>
  );
}
