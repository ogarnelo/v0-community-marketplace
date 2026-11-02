"use client";

import { useEffect, useRef, useState } from "react";

type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

export default function WhatsappPhotoPrivacyReview({
  draftId,
  onApproved,
}: {
  draftId: string;
  onApproved: (draft: Record<string, unknown>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const rectsRef = useRef<Rect[]>([]);
  const originRef = useRef<Point | null>(null);
  const [ready, setReady] = useState(false);
  const [masked, setMasked] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const draw = (preview?: Rect) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (const r of [...rectsRef.current, ...(preview ? [preview] : [])]) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      imageRef.current = img;
      rectsRef.current = [];
      draw();
      setReady(true);
    };
    img.onerror = () => { if (!cancelled) setError("No se pudo cargar la fotografía. Comprueba tu sesión de Wetudy."); };
    // Same-origin private endpoint, checked against the signed-in user and draft.
    img.src = `/api/whatsapp/photo?draft=${encodeURIComponent(draftId)}`;
    return () => { cancelled = true; imageRef.current = null; };
  }, [draftId]);

  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)),
    };
  }

  function makeRect(a: Point, b: Point): Rect {
    return { x: Math.min(a.x,b.x), y: Math.min(a.y,b.y), w: Math.abs(a.x-b.x), h: Math.abs(a.y-b.y) };
  }

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (busy || !ready) return;
    originRef.current = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!originRef.current) return;
    draw(makeRect(originRef.current, point(event)));
  }
  function up(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!originRef.current) return;
    const rect = makeRect(originRef.current, point(event));
    originRef.current = null;
    if (rect.w >= 3 && rect.h >= 3) {
      rectsRef.current.push(rect);
      setMasked(rectsRef.current.length);
      setConfirmed(false);
    }
    draw();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function reset() {
    rectsRef.current = [];
    setMasked(0);
    setConfirmed(false);
    draw();
  }

  async function approve() {
    if (!ready || !confirmed || busy || !canvasRef.current) return;
    setBusy(true); setError("");
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current?.toBlob(resolve, "image/jpeg", 0.78));
      if (!blob || blob.size < 100 || blob.size > 3 * 1024 * 1024) {
        throw new Error("No se pudo preparar la fotografía protegida. Prueba con otra foto.");
      }
      // Re-encoding the canvas strips image metadata. Black rectangles are
      // baked into pixels before the server and OpenAI receive the file.
      const data = new FormData();
      data.set("draftId", draftId);
      data.set("privacyConfirmed", "yes");
      data.set("photo", new File([blob], "articulo-revisado.jpg", { type: "image/jpeg" }));
      const response = await fetch("/api/whatsapp/analyze", { method: "POST", body: data, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.draft) throw new Error(result.error || "No se pudo analizar esta fotografía.");
      onApproved(result.draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo analizar la foto.");
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <p className="text-sm font-semibold text-emerald-700">Privacidad · Antes de utilizar IA</p>
      <h1 className="text-2xl font-bold">Revisa la fotografía</h1>
      <p className="text-sm leading-relaxed text-slate-700">
        La imagen está guardada en privado. <strong>Todavía no se ha enviado a OpenAI.</strong>
        Si aparecen nombres, etiquetas escolares, caras, teléfonos u otros datos personales,
        arrastra el dedo sobre ellos para taparlos en negro.
      </p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="rounded-xl bg-slate-100 p-2">
        <canvas
          ref={canvasRef}
          aria-label="Fotografía privada. Arrastra el dedo para cubrir datos personales con rectángulos negros."
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { originRef.current = null; draw(); }}
          className="mx-auto block h-auto w-full touch-none cursor-crosshair rounded-xl bg-white"
        />
        {!ready && !error && <p role="status" className="p-5 text-center text-sm">Preparando imagen…</p>}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
        <span>{masked} zonas ocultadas</span>
        <button type="button" onClick={reset} disabled={!ready || busy} className="rounded-lg border p-2 font-medium">Deshacer todas las marcas</button>
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)} disabled={!ready || busy} />
        <span>He revisado la foto y ocultado los datos personales que puedo reconocer. Autorizo el análisis de esta imagen revisada mediante OpenAI para preparar mi borrador.</span>
      </label>
      <button type="button" onClick={approve} disabled={!ready || !confirmed || busy}
        className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Analizando fotografía revisada…" : "Continuar con IA y preparar formulario"}
      </button>
      <p className="text-xs text-slate-500">
        El sistema no detecta automáticamente todos los datos personales: la revisión manual
        puede fallar. Si no puedes ocultarlos, no continúes con el análisis.
        La fotografía original ya se envió por WhatsApp a Meta antes de llegar aquí.
      </p>
    </section>
  );
}
