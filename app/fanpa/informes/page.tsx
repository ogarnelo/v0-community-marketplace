import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FederationReportingDashboard } from "@/components/fanpa/federation-reporting-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Informes de federación",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FederationReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ federationId?: string | string[] }>;
}) {
  // Server gate: do not render the reporting client unless both flags are
  // explicitly enabled. The API performs its own independent authorization.
  if (process.env.WETUDY_FANPA_REPORTING_ENABLED !== "true" ||
      process.env.WETUDY_FANPA_KPI_ENABLED !== "true") {
    notFound();
  }
  const { federationId } = await searchParams;
  if (typeof federationId !== "string" || !UUID.test(federationId)) {
    notFound();
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    notFound();
  }
  return <FederationReportingDashboard federationId={federationId} />;
}
