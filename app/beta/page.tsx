import { notFound } from "next/navigation";
import BetaJourneyHome from "@/components/my-course/beta-journey-home";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Journey Beta | Wetudy",
  robots: { index: false, follow: false },
};

export default function BetaHomePage() {
  const enabled =
    process.env.VERCEL_ENV === "preview" ||
    process.env.WETUDY_MY_COURSE_BETA_ENABLED === "true";

  if (!enabled) notFound();

  return <BetaJourneyHome />;
}
