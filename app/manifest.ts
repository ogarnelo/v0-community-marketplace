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
        src: "/wetudy-icon-192.png?v=20260923-2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/wetudy-icon-512.png?v=20260923-2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon.svg?v=20260923-2",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  }
}
