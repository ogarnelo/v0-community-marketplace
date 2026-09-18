import { ImageResponse } from "next/og"

export const alt = "Wetudy · Material escolar de segunda mano entre familias"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 55%, #ECFDF5 100%)",
          color: "#0F172A",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              background: "#2563EB",
              color: "#FFFFFF",
              fontSize: 52,
              fontWeight: 800,
            }}
          >
            W
          </div>
          <div style={{ fontSize: 46, fontWeight: 800 }}>Wetudy</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
          <div style={{ fontSize: 70, lineHeight: 1.04, fontWeight: 800 }}>
            Material escolar de segunda mano entre familias
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.35, color: "#475569" }}>
            Compra, vende o dona libros, uniformes y material escolar. Contacta por chat y acuerda directamente.
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#2563EB", fontWeight: 700 }}>wetudy.com</div>
      </div>
    ),
    size
  )
}
