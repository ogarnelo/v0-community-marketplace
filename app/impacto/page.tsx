import { permanentRedirect } from "next/navigation"

export default function LegacyImpactPage() {
  permanentRedirect("/about")
}
