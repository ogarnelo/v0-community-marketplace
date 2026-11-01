"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ImagePlus, MessageCircle, Send, Sparkles } from "lucide-react";
import { bookFormats, bookLanguages, categories, conditions, gradeLevels } from "@/lib/mock-data";
import {
  detailFieldsForCategory, type WhatsappDetailKey,
} from "@/lib/whatsapp/category-fields";

type Stage = "unlinked" | "linked" | "photo" | "details" | "review" | "complete";
type Kind = "sale" | "donation";
type DemoForm = {
  category: string;
  title: string;
  description: string;
  gradeLevel: string;
  condition: string;
  kind: Kind;
  price: string;
  originalPrice: string;
  details: Partial<Record<WhatsappDetailKey, string>>;
};

const SAMPLES: Record<string, Pick<DemoForm, "title" | "description" | "gradeLevel" | "details">> = {
  "Libros de texto": {
    title: "Libro de Matemáticas para 3º de ESO",
    description: "Libro de matemáticas para educación secundaria. Comprueba la edición, el ISBN y las marcas de uso antes de publicar.",
    gradeLevel: "3o ESO",
    details: { subject: "Matemáticas", publisher: "SM", format: bookFormats[0], language: "Español" },
  },
  "Lectura y literatura": {
    title: "Libro de lectura para estudiantes",
    description: "Libro de lectura escolar con cubierta de tapa blanda. Confirma el ISBN y el estado de las páginas antes de publicarlo.",
    gradeLevel: "1o ESO",
    details: { format: bookFormats[0], language: "Español" },
  },
  "Uniformes": {
    title: "Jersey de uniforme escolar",
    description: "Jersey de uniforme para uso escolar. Revisa la talla, los colores y el estado de la prenda antes de confirmar la ficha.",
    gradeLevel: "",
    details: { specificType: "Sudadera o jersey", sizeLabel: "10", season: "Invierno" },
  },
  "Tecnología y calculadoras": {
    title: "Calculadora científica escolar",
    description: "Calculadora científica para uso escolar con pantalla y teclado numérico. Revisa el modelo y confirma que funciona antes de publicarla.",
    gradeLevel: "",
    details: { specificType: "Calculadora científica", brand: "Casio", model: "fx-82SP CW" },
  },
  "Mochilas y estuches": {
    title: "Mochila escolar con dos compartimentos",
    description: "Mochila para uso escolar con asas acolchadas y varios compartimentos. Comprueba cremalleras y desgaste antes de publicar.",
    gradeLevel: "",
    details: { specificType: "Mochila", brand: "Eastpak" },
  },
  "Material escolar": {
    title: "Lote de material de dibujo escolar",
    description: "Lote de material para clases de dibujo. Comprueba las piezas incluidas y su estado antes de publicar el anuncio.",
    gradeLevel: "",
    details: { specificType: "Material de dibujo" },
  },
};
const exampleFor = (category: string) => SAMPLES[category] ?? {
  title: "Material escolar para reutilizar",
  description: "Artículo para uso educativo que puede aprovechar otra familia. Confirma sus características y el estado antes de publicar.",
  gradeLevel: "",
  details: {},
};
const makeForm = (category: string): DemoForm => ({
  category,
  ...exampleFor(category),
  condition: "good",
  kind: "sale",
  price: "12",
  originalPrice: "",
});

function Bubble({ author, children }: { author: "bot" | "you"; children: React.ReactNode }) {
  return (
    <div className={`flex ${author === "you" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[94%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${author === "you" ? "rounded-tr-sm bg-emerald-100" : "rounded-tl-sm bg-white shadow-sm"}`}>
        {children}
      </div>
    </div>
  );
}

const needsCourse = (category: string) => category === "Libros de texto" || category === "Lectura y literatura";

export default function WhatsappJourneyDemo() {
  const [stage, setStage] = useState<Stage>("unlinked");
  const [picture, setPicture] = useState<File | null>(null);
  const [pictureUrl, setPictureUrl] = useState("");
  const [form, setForm] = useState<DemoForm>(() => makeForm("Tecnología y calculadoras"));

  useEffect(() => {
    if (!picture) { setPictureUrl(""); return; }
    const src = URL.createObjectURL(picture);
    setPictureUrl(src);
    return () => URL.revokeObjectURL(src);
  }, [picture]);

  const reset = () => {
    setStage("unlinked");
    setPicture(null);
    setForm(makeForm("Tecnología y calculadoras"));
  };

  const update = <K extends keyof DemoForm>(key: K, value: DemoForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateDetail = (key: WhatsappDetailKey, value: string) => {
    setForm((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  };
  const details = detailFieldsForCategory(form.category);
  const missing = [
    ...(form.title.trim().length < 12 ? ["Título de al menos 12 caracteres"] : []),
    ...(form.description.trim().length < 40 ? ["Descripción de al menos 40 caracteres"] : []),
    ...(!categories.includes(form.category) ? ["Categoría"] : []),
    ...(needsCourse(form.category) && !gradeLevels.includes(form.gradeLevel) ? ["Curso o etapa"] : []),
    ...(!conditions.some((condition) => condition.value === form.condition) ? ["Estado"] : []),
    ...(form.kind === "sale" && (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) ? ["Precio de venta"] : []),
    ...(form.kind === "sale" && form.originalPrice.trim() &&
      (!Number.isFinite(Number(form.originalPrice)) || Number(form.originalPrice) < 0) ? ["Precio original válido"] : []),
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft className="size-4" /> Wetudy</a>
        <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-emerald-700"><MessageCircle className="size-5" /> WETUDY + WHATSAPP</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Publicar desde WhatsApp, con todos los detalles</h1>
        <p className="mt-3 text-slate-600">Simula un anuncio de libros, uniformes, tecnología, mochilas o material escolar. Verás cómo cambian las preguntas según la categoría.</p>
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Simulación de experiencia.</strong> No se conecta a WhatsApp, no usa IA real, no sube fotos ni publica anuncios. Los textos y campos precargados son ejemplos, no resultados del análisis de tu fotografía. La imagen elegida permanece en este navegador.
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-100 bg-[#e7f0e9] shadow-sm">
          <header className="flex items-center gap-3 bg-[#075e54] px-5 py-4 text-white">
            <div className="grid size-11 place-items-center rounded-full bg-white/15"><Sparkles className="size-6" /></div>
            <div>
              <h2 className="font-semibold">Wetudy · Publicación asistida</h2>
              <p className="text-xs text-emerald-100">Prototipo interactivo · No es WhatsApp real</p>
            </div>
          </header>

          <div className="min-h-80 space-y-4 p-4 sm:p-6">
            <Bubble author="bot">¡Hola! 👋 Vincula tu cuenta y envía una foto para preparar un anuncio. Siempre podrás editar lo que proponga la IA.</Bubble>
            {stage === "unlinked" && (
              <div className="flex justify-center"><button onClick={() => setStage("linked")} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Simular vinculación de cuenta</button></div>
            )}
            {stage !== "unlinked" && (
              <>
                <Bubble author="you">VINCULAR WETUDY ···</Bubble>
                <Bubble author="bot">✅ Cuenta vinculada. Envíame una foto del artículo que quieras publicar.</Bubble>
              </>
            )}
            {stage === "linked" && (
              <div className="rounded-xl bg-white/90 p-4">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-emerald-200 p-4">
                  <ImagePlus className="size-6 text-emerald-700" />
                  <span className="text-sm">Elegir foto (opcional en esta demo)</span>
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPicture(event.target.files?.[0] || null)} />
                </label>
                {pictureUrl && <img src={pictureUrl} className="mx-auto mt-3 max-h-44 rounded-lg object-contain" alt="Fotografía local de prueba" />}
                <button onClick={() => setStage("photo")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 p-3 text-sm font-semibold text-white">
                  <Send className="size-4" /> Simular envío de foto
                </button>
              </div>
            )}
            {["photo", "details", "review", "complete"].includes(stage) && (
              <Bubble author="you">{pictureUrl ? <img src={pictureUrl} className="max-h-48 rounded-lg object-contain" alt="Fotografía local" /> : "📷 [Foto de ejemplo]"}</Bubble>
            )}
            {["photo", "details", "review", "complete"].includes(stage) && (
              <Bubble author="bot">He preparado una propuesta de ejemplo. Primero confirmamos la categoría, el título y la descripción. Después revisamos los filtros propios de ese artículo, su estado y el precio o donación.</Bubble>
            )}
            {stage === "photo" && (
              <div className="flex justify-center">
                <button onClick={() => setStage("details")} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Revisar todos los campos</button>
              </div>
            )}

            {stage === "details" && (
              <div className="space-y-4 rounded-xl bg-white p-4 text-sm">
                <p className="font-semibold text-emerald-800">📝 Propuesta de anuncio · Revisión de datos</p>
                <p className="text-xs text-slate-500">En WhatsApp real el asistente preguntará estos datos en mensajes sucesivos y permitirá contestar OMITIR en los campos opcionales. Aquí puedes cambiar de categoría para explorar qué filtros aparecen.</p>
                <label className="block font-medium">Categoría *
                  <select className="mt-1 w-full rounded-md border p-2 font-normal" value={form.category}
                    onChange={(event) => setForm(makeForm(event.target.value))}>
                    {categories.map((category) => <option value={category} key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block font-medium">Título *
                  <input className="mt-1 w-full rounded-md border p-2 font-normal" value={form.title} maxLength={110} onChange={(event) => update("title", event.target.value)} />
                </label>
                <label className="block font-medium">Descripción * <span className="text-xs font-normal text-slate-500">(mínimo 40 caracteres)</span>
                  <textarea rows={4} className="mt-1 w-full rounded-md border p-2 font-normal" value={form.description} maxLength={750}
                    onChange={(event) => update("description", event.target.value)} />
                  <span className="mt-1 block text-xs font-normal text-slate-500">{form.description.length}/750 · Confirma los detalles y las marcas de uso antes de publicar</span>
                </label>
                <label className="block font-medium">Curso o etapa {needsCourse(form.category) ? "*" : "(opcional)"}
                  <select className="mt-1 w-full rounded-md border p-2 font-normal" value={form.gradeLevel} onChange={(event) => update("gradeLevel", event.target.value)}>
                    <option value="">Varios cursos / Sin especificar</option>
                    {gradeLevels.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                </label>
                {details.length > 0 && (
                  <div className="space-y-3 rounded-lg bg-emerald-50 p-3">
                    <p className="font-semibold">🔎 Filtros recomendados para {form.category}</p>
                    <p className="text-xs text-slate-600">No son obligatorios, pero mejoran la búsqueda. Puedes dejarlos vacíos si no los conoces.</p>
                    {details.map((field) => (
                      <label key={field.key} className="block font-medium">{field.label}
                        {field.options ? (
                          <select className="mt-1 w-full rounded-md border bg-white p-2 font-normal" value={form.details[field.key] || ""}
                            onChange={(event) => updateDetail(field.key, event.target.value)}>
                            <option value="">Sin especificar</option>
                            {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : (
                          <input className="mt-1 w-full rounded-md border bg-white p-2 font-normal"
                            value={form.details[field.key] || ""} maxLength={field.limit}
                            onChange={(event) => updateDetail(field.key, event.target.value)} />
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <label className="block font-medium">Estado real del artículo *
                  <select className="mt-1 w-full rounded-md border p-2 font-normal" value={form.condition} onChange={(event) => update("condition", event.target.value)}>
                    {conditions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block font-medium">Modalidad *
                  <select className="mt-1 w-full rounded-md border p-2 font-normal" value={form.kind} onChange={(event) => update("kind", event.target.value as Kind)}>
                    <option value="sale">Venta</option><option value="donation">Donación</option>
                  </select>
                </label>
                {form.kind === "sale" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block font-medium">Precio (€) *
                      <input type="number" min="0.01" max="10000" step="0.01" className="mt-1 w-full rounded-md border p-2 font-normal" value={form.price} onChange={(event) => update("price", event.target.value)} />
                    </label>
                    <label className="block font-medium">Precio original (€) (opcional)
                      <input type="number" min="0" max="10000" step="0.01" className="mt-1 w-full rounded-md border p-2 font-normal" value={form.originalPrice} onChange={(event) => update("originalPrice", event.target.value)} placeholder="Omitir" />
                    </label>
                  </div>
                )}
                {missing.length > 0 && (
                  <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Antes de confirmar: {missing.join(", ")}.</p>
                )}
                <button onClick={() => setStage("review")} disabled={missing.length > 0}
                  className="w-full rounded-lg bg-emerald-700 p-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Ver ficha completa</button>
              </div>
            )}

            {(stage === "review" || stage === "complete") && (
              <>
                <Bubble author="you">He revisado la ficha. Mostrar resumen.</Bubble>
                <Bubble author="bot">
                  <strong>📝 Ficha completa (ejemplo)</strong>
                  <div className="mt-2 space-y-1">
                    <p><strong>Título:</strong> {form.title}</p>
                    <p><strong>Descripción:</strong> {form.description}</p>
                    <p><strong>Categoría:</strong> {form.category}</p>
                    <p><strong>Curso:</strong> {form.gradeLevel || "Varios cursos"}</p>
                    {details.filter((field) => form.details[field.key]).map((field) =>
                      <p key={field.key}><strong>{field.label}:</strong> {form.details[field.key]}</p>)}
                    <p><strong>Estado:</strong> {conditions.find((option) => option.value === form.condition)?.label}</p>
                    <p><strong>{form.kind === "sale" ? "Precio:" : "Modalidad:"}</strong> {form.kind === "sale" ? `${form.price} €` : "Donación gratuita"}</p>
                    {form.kind === "sale" && form.originalPrice && <p><strong>Precio original:</strong> {form.originalPrice} €</p>}
                  </div>
                  <p className="mt-3">¿Confirmas todos los datos y publicamos?</p>
                </Bubble>
              </>
            )}
            {stage === "review" && (
              <div className="flex justify-center gap-3">
                <button onClick={() => setStage("details")} className="rounded-lg bg-white px-4 py-3 text-sm font-semibold">EDITAR</button>
                <button onClick={() => setStage("complete")} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Simular PUBLICAR</button>
              </div>
            )}
            {stage === "complete" && (
              <>
                <Bubble author="you">PUBLICAR</Bubble>
                <Bubble author="bot">✅ En una integración real, este anuncio aparecería ahora en Wetudy con todos los filtros confirmados. <strong>En esta demo no se ha publicado nada.</strong></Bubble>
                <div className="flex justify-center"><button onClick={reset} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold"><Check className="size-4" /> Probar otra categoría</button></div>
              </>
            )}
          </div>
          <footer className="border-t border-emerald-100 bg-[#f0f3f0] px-5 py-3 text-xs text-slate-500">Experiencia simulada · Los datos no salen del navegador.</footer>
        </div>
      </div>
    </main>
  );
}
