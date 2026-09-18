import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wetudy",
    short_name: "Wetudy",
    description:
      "Material escolar de segunda mano entre familias: libros, uniformes, mochilas y más.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563EB",
    lang: "es",
    categories: ["education", "shopping"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  }
}
