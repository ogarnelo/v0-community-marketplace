import { notFound } from "next/navigation";
import WhatsappJourneyDemo from "@/components/whatsapp/whatsapp-journey-demo";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function PreviewWhatsappJourney() {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  return <WhatsappJourneyDemo />;
}
