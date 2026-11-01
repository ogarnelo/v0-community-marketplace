import { notFound } from "next/navigation";
import { WetudyEasyDemo } from "@/components/marketplace/wetudy-easy-demo";

export const dynamic = "force-dynamic";

// No public production demo route, and no access to user accounts or listing data.
export default function DemoWetudyEasyPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  return <WetudyEasyDemo />;
}
