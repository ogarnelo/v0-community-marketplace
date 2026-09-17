import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wetudy",
    short_name: "Wetudy",
    description:
      "Material escolar entre familias: encuentra, publica, vende o dona libros, uniformes y otros materiales.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1D9FDA",
    lang: "es",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
