import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FederationDashboardLocalDemo } from "@/components/admin/federation-dashboard-local-demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Ensayo local de reporting federativo | WETUDY",
  robots: {index:false,follow:false},
};

/**
 * This QA-only route is NEVER visible in Vercel preview or production builds:
 * NODE_ENV is "production" for both. No environment flag can override it.
 * Its data are hardcoded and synthetic; do not wire a privileged backend here.
 */
export default function LocalFederationReportPreview() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <FederationDashboardLocalDemo />
    </main>
  );
}
