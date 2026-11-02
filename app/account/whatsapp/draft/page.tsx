import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isWhatsappPilotConfigured, isWhatsappPilotUserAllowed } from "@/lib/whatsapp/pilot";
import WhatsappDraftEditor from "@/components/whatsapp/whatsapp-draft-editor";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function WhatsappDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  if (!isWhatsappPilotConfigured() ||
      process.env.WHATSAPP_PUBLISH_ENABLED !== "true" ||
      process.env.WHATSAPP_AI_ENABLED !== "true" ||
      process.env.VERCEL_ENV !== "preview") notFound();

  const params = await searchParams;
  const draftId = params.draft || "";
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(draftId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/account/whatsapp/draft?draft=${draftId}`)}`);
  if (!user.email_confirmed_at || !isWhatsappPilotUserAllowed(user.id)) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/account" className="text-sm font-medium text-emerald-700 hover:underline">← Volver a Wetudy</Link>
        <WhatsappDraftEditor draftId={draftId} />
      </div>
    </main>
  );
}
