"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ImagePlus, MessageCircle, Send, Sparkles } from "lucide-react";

type Stage = "unlinked" | "linked" | "photo" | "details" | "review" | "complete";

function Bubble({ author, children }: { author: "bot" | "you"; children: React.ReactNode }) {
  return <div className={`flex ${author === "you" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[87%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${author === "you" ? "rounded-tr-sm bg-emerald-100" : "rounded-tl-sm bg-white shadow-sm"}`}>{children}</div>
  </div>;
}

export default function WhatsappJourneyDemo() {
  const [stage, setStage] = useState<Stage>("unlinked");
  const [picture, setPicture] = useState<File | null>(null);
  const [pictureUrl, setPictureUrl] = useState("");
  const [condition, setCondition] = useState("Bueno");
  const [price, setPrice] = useState("12");
  const [title, setTitle] = useState("Calculadora científica escolar");
  const [mode, setMode] = useState<"venta" | "donacion">("venta");

  useEffect(() => {
    if (!picture) { setPictureUrl(""); return; }
    const src = URL.createObjectURL(picture);
    setPictureUrl(src);
    return () => URL.revokeObjectURL(src);
  }, [picture]);

  const reset = () => {
    setStage("unlinked"); setPicture(null); setCondition("Bueno"); setPrice("12");
    setTitle("Calculadora científica escolar"); setMode("venta");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft className="size-4" /> Wetudy</a>
        <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-emerald-700"><MessageCircle className="size-5" /> WETUDY + WHATSAPP</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Así publicarías desde una conversación</h1>
        <p className="mt-3 text-slate-600">Una demo interactiva del journey: vincular la cuenta, enviar una foto, revisar el anuncio y confirmar.</p>

        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Simulación de experiencia.</strong> No se conecta a WhatsApp, no usa IA real, no sube fotos ni publica anuncios. La fotografía elegida permanece en tu navegador.
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-100 bg-[#e7f0e9] shadow-sm">
          <header className="flex items-center gap-3 bg-[#075e54] px-5 py-4 text-white">
            <div className="grid size-11 place-items-center rounded-full bg-white/15"><Sparkles className="size-6" /></div>
            <div>
              <h2 className="font-semibold">Wetudy · Publicación asistida</h2>
              <p className="text-xs text-emerald-100">Prototipo · No es WhatsApp real</p>
            </div>
          </header>
          <div className="min-h-80 space-y-4 p-4 sm:p-6">
            <Bubble author="bot">¡Hola! 👋 Puedes vincular tu cuenta Wetudy y preparar anuncios desde este chat.</Bubble>
            {stage === "unlinked" ? <div className="flex justify-center"><button onClick={()=>setStage("linked")} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Simular vinculación con mi cuenta</button></div> : null}
            {stage !== "unlinked" ? <>
              <Bubble author="you">VINCULAR WETUDY ···</Bubble>
              <Bubble author="bot">✅ ¡Cuenta vinculada! Envíame una fotografía del artículo que quieras publicar.</Bubble>
            </> : null}
            {stage === "linked" ? (
              <div className="rounded-xl bg-white/80 p-4">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-emerald-200 p-4">
                  <ImagePlus className="size-6 text-emerald-700" />
                  <span className="text-sm">Añadir foto (opcional)</span>
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setPicture(event.target.files?.[0]||null)} />
                </label>
                {pictureUrl ? <img src={pictureUrl} className="mx-auto mt-3 max-h-44 rounded-lg object-contain" alt="Fotografía previsualizada localmente" /> : null}
                <button onClick={()=>setStage("photo")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 p-3 text-sm font-semibold text-white">
                  <Send className="size-4" /> Simular envío de foto
                </button>
              </div>
            ) : null}
            {["photo","details","review","complete"].includes(stage) ? (
              <Bubble author="you">{pictureUrl ? <img src={pictureUrl} className="max-h-48 rounded-lg object-contain" alt="Fotografía local" /> : "📷 [Foto de una calculadora]"}</Bubble>
            ) : null}
            {["photo","details","review","complete"].includes(stage) ? (
              <Bubble author="bot">Parece una calculadora científica escolar. He preparado un borrador de ejemplo. ¿Me confirmas el estado, si la vendes o donas y su precio?</Bubble>
            ) : null}
            {stage === "photo" ? <div className="flex justify-center"><button onClick={()=>setStage("details")} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Revisar datos</button></div> : null}
            {stage === "details" ? <div className="space-y-3 rounded-xl bg-white p-4 text-sm">
              <label className="block font-medium">Título<input className="mt-1 w-full rounded-md border p-2 font-normal" value={title} onChange={event=>setTitle(event.target.value)} /></label>
              <label className="block font-medium">Estado<select className="mt-1 w-full rounded-md border p-2 font-normal" value={condition} onChange={event=>setCondition(event.target.value)}><option>Nuevo</option><option>Muy bueno</option><option>Bueno</option><option>Aceptable</option></select></label>
              <label className="block font-medium">Operación<select className="mt-1 w-full rounded-md border p-2 font-normal" value={mode} onChange={event=>setMode(event.target.value as "venta"|"donacion")}><option value="venta">Vender</option><option value="donacion">Donar</option></select></label>
              {mode === "venta" ? <label className="block font-medium">Precio (€)<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border p-2 font-normal" value={price} onChange={event=>setPrice(event.target.value)} /></label> : null}
              <button onClick={()=>setStage("review")} disabled={!title.trim()||(mode==="venta"&&(!price||Number(price)<0))} className="w-full rounded-lg bg-emerald-700 p-3 font-semibold text-white disabled:opacity-40">Ver resumen</button>
            </div> : null}
            {stage === "review" || stage === "complete" ? <>
              <Bubble author="you">{condition} · {mode==="venta" ? price+" €" : "Donación"}</Bubble>
              <Bubble author="bot"><strong>Revisa tu anuncio:</strong><br />📦 {title}<br />📚 Tecnología y calculadoras<br />⭐ Estado: {condition}<br />💚 {mode==="venta" ? price+" €" : "Donación"}<br /><br />¿Lo publicamos?</Bubble>
            </> : null}
            {stage === "review" ? <div className="flex justify-center gap-3">
              <button onClick={()=>setStage("details")} className="rounded-lg bg-white px-4 py-3 text-sm font-semibold">Editar</button>
              <button onClick={()=>setStage("complete")} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Simular confirmación</button>
            </div> : null}
            {stage === "complete" ? <>
              <Bubble author="you">Publicar</Bubble>
              <Bubble author="bot">✅ En una integración real, tu anuncio aparecería ahora en Wetudy y recibirías un enlace. <strong>En esta demo no se ha publicado nada.</strong></Bubble>
              <div className="flex justify-center"><button onClick={reset} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold"><Check className="size-4" /> Volver a empezar</button></div>
            </> : null}
          </div>
          <footer className="border-t border-emerald-100 bg-[#f0f3f0] px-5 py-3 text-xs text-slate-500">Experiencia simulada: los mensajes no salen de tu navegador.</footer>
        </div>
      </div>
    </main>
  );
}
