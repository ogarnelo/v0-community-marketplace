"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ImagePlus, MessageCircle, Sparkles } from "lucide-react";
import { bookFormats, categories } from "@/lib/mock-data";
import WhatsappListingForm from "@/components/whatsapp/whatsapp-listing-form";
import type { WhatsappDraft } from "@/lib/whatsapp/conversation";

type Stage = "unlinked" | "linked" | "photo" | "form" | "complete";

const examples: Record<string, Partial<WhatsappDraft>> = {
  "Libros de texto": {
    title: "Libro de Matemáticas para 3º de ESO",
    description: "Libro de matemáticas para educación secundaria. Comprueba la edición, el ISBN y las marcas de uso antes de publicar.",
    gradeLevel: "3o ESO",
    subject: "Matemáticas",
    publisher: "SM",
    format: bookFormats[0],
    language: "Español",
  },
  "Lectura y literatura": {
    title: "Libro de lectura para estudiantes",
    description: "Libro de lectura escolar con cubierta de tapa blanda. Confirma el ISBN y el estado de las páginas antes de publicarlo.",
    gradeLevel: "1o ESO",
    format: bookFormats[0],
    language: "Español",
  },
  "Uniformes": {
    title: "Jersey de uniforme escolar",
    description: "Jersey de uniforme para uso escolar. Revisa la talla, los colores y el estado de la prenda antes de confirmar la ficha.",
    specificType: "Sudadera o jersey",
    sizeLabel: "10",
    season: "Invierno",
  },
  "Tecnología y calculadoras": {
    title: "Calculadora científica escolar",
    description: "Calculadora científica para uso escolar con pantalla y teclado numérico. Revisa el modelo y confirma que funciona antes de publicarla.",
    specificType: "Calculadora científica",
    brand: "Casio",
    model: "fx-82SP CW",
  },
  "Mochilas y estuches": {
    title: "Mochila escolar con dos compartimentos",
    description: "Mochila para uso escolar con asas acolchadas y varios compartimentos. Comprueba cremalleras y desgaste antes de publicar.",
    specificType: "Mochila",
    brand: "Eastpak",
  },
  "Material escolar": {
    title: "Lote de material de dibujo escolar",
    description: "Lote de material para clases de dibujo. Comprueba las piezas incluidas y su estado antes de publicar el anuncio.",
    specificType: "Material de dibujo",
  },
};

const demoId = "12345678-1234-4123-8123-123456789abc";
function getExample(category: string): WhatsappDraft {
  return {
    listingId: demoId,
    category,
    title: "Material escolar de segunda mano",
    description: "Artículo para uso escolar en buen estado de conservación. Comprueba todos sus detalles antes de publicarlo en Wetudy.",
    ...examples[category],
    // The condition, sale/donation decision and price are NOT invented by the AI.
    condition: undefined,
    kind: undefined,
    price: null,
    originalPrice: null,
  };
}

function Bubble({ author, children }: { author: "wetudy" | "family"; children: React.ReactNode }) {
  return <div className={`flex ${author === "family" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[90%] rounded-2xl p-3.5 text-sm leading-relaxed ${author === "family" ? "rounded-tr-sm bg-emerald-100" : "rounded-tl-sm bg-white shadow-sm"}`}>
      {children}
    </div>
  </div>;
}

export default function WhatsappJourneyDemo() {
  const [stage, setStage] = useState<Stage>("unlinked");
  const [category, setCategory] = useState("Tecnología y calculadoras");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    if (!photo) { setPhotoUrl(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const startOver = () => {
    setCategory("Tecnología y calculadoras");
    setPhoto(null);
    setStage("unlinked");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <ArrowLeft className="size-4" /> Wetudy
        </a>
        <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <MessageCircle className="size-5" /> WETUDY + WHATSAPP
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Publicar una foto. Revisar un formulario. Listo.</h1>
        <p className="mt-3 text-slate-600">
          Simula cómo Wetudy identifica el material y prepara un formulario móvil para que la familia solo revise lo que falta.
        </p>
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Simulación sin conexión real.</strong> Los valores son ejemplos fijos: la imagen que elijas no se analiza, no se guarda ni se envía. Tampoco se publica ningún anuncio.
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-100 bg-[#e7f0e9] shadow-sm">
          <header className="flex items-center gap-3 bg-[#075e54] px-5 py-4 text-white">
            <div className="grid size-11 place-items-center rounded-full bg-white/15">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h2 className="font-semibold">Wetudy · Publicación fácil</h2>
              <p className="text-xs text-emerald-100">Chat simulado · No es WhatsApp real</p>
            </div>
          </header>
          <div className="min-h-60 space-y-4 p-4 sm:p-6">
            <Bubble author="wetudy">¡Hola! 👋 Conecta tu cuenta y envía una foto del material escolar que quieras publicar.</Bubble>
            {stage === "unlinked" && (
              <div className="flex justify-center">
                <button onClick={() => setStage("linked")} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">
                  Simular vinculación de cuenta
                </button>
              </div>
            )}

            {stage !== "unlinked" && (
              <>
                <Bubble author="family">Vincular mi cuenta de Wetudy</Bubble>
                <Bubble author="wetudy">✅ ¡Cuenta vinculada! Envíame una foto.</Bubble>
              </>
            )}
            {stage === "linked" && (
              <div className="space-y-3 rounded-xl bg-white p-4">
                <label htmlFor="demo-category" className="block text-sm font-semibold">Ejemplo que quieres probar</label>
                <select id="demo-category" value={category} onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-base">
                  {categories.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-emerald-200 p-4 text-sm">
                  <ImagePlus className="size-6 text-emerald-700" />
                  Elegir foto (opcional en la demo)
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
                </label>
                {photoUrl && <img src={photoUrl} alt="Fotografía seleccionada solo en este navegador"
                  className="mx-auto max-h-40 rounded-lg object-contain" />}
                <button onClick={() => setStage("photo")} className="w-full rounded-xl bg-emerald-700 p-3 text-sm font-semibold text-white">
                  Simular envío de foto
                </button>
              </div>
            )}
            {(stage === "photo" || stage === "form" || stage === "complete") && (
              <>
                <Bubble author="family">
                  {photoUrl ? <img src={photoUrl} alt="Foto simulada en el chat" className="max-h-44 rounded-lg object-contain" /> : "📸 Fotografía de ejemplo"}
                </Bubble>
                <Bubble author="wetudy">
                  <strong>📦 ¡Tu propuesta está lista!</strong>
                  <p className="mt-2">{getExample(category).title}</p>
                  <p className="mt-2">He rellenado el formulario con los datos que pude identificar. Revisa la fotografía, completa lo obligatorio y confirma.</p>
                  <p className="mt-2 text-emerald-800"><strong>👉 Abrir formulario de anuncio</strong></p>
                </Bubble>
              </>
            )}
            {stage === "photo" && (
              <div className="flex justify-center">
                <button onClick={() => setStage("form")} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">
                  Abrir formulario de anuncio
                </button>
              </div>
            )}
            {stage === "complete" && (
              <>
                <Bubble author="family">Confirmar y publicar</Bubble>
                <Bubble author="wetudy">✅ ¡Publicación simulada! En la integración real aparecerá el anuncio en Wetudy. Aquí no se ha publicado nada.</Bubble>
                <div className="flex justify-center">
                  <button onClick={startOver} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-emerald-700" /> Probar otro artículo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {stage === "form" && (
          <div className="mt-6">
            <WhatsappListingForm
              key={category}
              initialDraft={getExample(category)}
              photoUrl={photoUrl || undefined}
              isDemo
              onPublish={async () => { setStage("complete"); }}
            />
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-500">
          Simulación: no hay mensajes enviados ni llamadas a la IA, Meta o Supabase.
        </p>
      </div>
    </main>
  );
}
