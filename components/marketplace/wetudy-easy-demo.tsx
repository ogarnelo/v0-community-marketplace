"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ImagePlus, LockKeyhole, Sparkles } from "lucide-react";

type Sample = "calculadora" | "libros";
const EXAMPLES = {
  calculadora: {
    title: "Calculadora científica para uso escolar",
    description: "Calculadora científica adecuada para actividades escolares. Comprueba el modelo exacto y su funcionamiento antes de publicar.",
    category: "Tecnología y calculadoras",
  },
  libros: {
    title: "Lote de libros de texto",
    description: "Conjunto de libros de texto escolares. Revisa curso, editorial e ISBN de cada libro antes de publicar.",
    category: "Libros de texto",
  },
};

export function WetudyEasyDemo() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sample, setSample] = useState<Sample>("calculadora");
  const [suggested, setSuggested] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const simulate = () => {
    const demo = EXAMPLES[sample];
    setTitle(demo.title);
    setDescription(demo.description);
    setCategory(demo.category);
    setSuggested(true);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-14 pt-6 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700">
          <ArrowLeft className="size-4" /> Wetudy
        </a>

        <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-blue-700">
          <Sparkles className="size-5" /> WETUDY EASY
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Así sería publicar con IA</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
          Demostración visual del flujo de publicación asistida, sin registrarte ni iniciar sesión.
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>Esta pantalla es una simulación.</strong> No analiza fotografías con una IA real:
          al pulsar el botón muestra un ejemplo preparado. Tus fotos se previsualizan únicamente en este navegador,
          no se envían a ningún servidor, no se guarda nada y no se crean anuncios.
        </div>

        <div className="mt-7 space-y-5">
          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><ImagePlus className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">1. Añade una foto</h2>
                <p className="text-sm text-slate-500">Opcional en esta demostración.</p>
              </div>
            </div>
            <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center hover:bg-blue-50">
              {preview ? (
                <img src={preview} alt="Previsualización local de la foto" className="max-h-60 max-w-full rounded-lg object-contain" />
              ) : (
                <><ImagePlus className="mb-2 size-9 text-slate-400" /><span className="text-sm font-medium">Elegir una fotografía de ejemplo</span><span className="mt-1 text-xs text-slate-500">Se queda en tu dispositivo</span></>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { const chosen=event.target.files?.[0]; if(chosen && chosen.type.startsWith("image/")) setFile(chosen); }} />
            </label>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Sparkles className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">2. El asistente prepara el anuncio</h2>
                <p className="text-sm text-slate-500">Elige un ejemplo para simular el resultado.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={()=>{setSample("calculadora");setSuggested(false);}} aria-pressed={sample==="calculadora"} className={`rounded-xl border p-4 text-left text-sm font-semibold ${sample==="calculadora"?"border-blue-600 bg-blue-50 text-blue-800":"border-slate-200"}`}>🧮 Calculadora</button>
              <button type="button" onClick={()=>{setSample("libros");setSuggested(false);}} aria-pressed={sample==="libros"} className={`rounded-xl border p-4 text-left text-sm font-semibold ${sample==="libros"?"border-blue-600 bg-blue-50 text-blue-800":"border-slate-200"}`}>📚 Libros escolares</button>
            </div>
            <button type="button" onClick={simulate} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800">
              <Sparkles className="size-5" /> Simular «Completar con IA»
            </button>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">3. Revisa y termina</h2>
                <p className="text-sm text-slate-500">Los campos siempre se pueden corregir.</p>
              </div>
            </div>
            {!suggested ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Pulsa «Simular Completar con IA» para ver los campos preparados.</p> : null}
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Título
                <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título del producto" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal" />
              </label>
              <label className="block text-sm font-medium">Descripción
                <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="Descripción" className="mt-2 w-full rounded-lg border border-slate-200 p-3 font-normal" />
              </label>
              <label className="block text-sm font-medium">Categoría
                <input value={category} onChange={e=>setCategory(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Estado (lo confirma la familia)
                  <select value={condition} onChange={e=>setCondition(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal">
                    <option value="">Seleccionar</option>
                    <option value="Muy bueno">Muy bueno</option><option value="Bueno">Bueno</option><option value="Satisfactorio">Satisfactorio</option>
                  </select>
                </label>
                <label className="block text-sm font-medium">Precio (€)
                  <input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Lo decide la familia" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal" />
                </label>
              </div>
            </div>
            <button type="button" disabled className="mt-6 flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 font-semibold text-slate-500">
              <LockKeyhole className="size-4" /> Publicación desactivada en esta demo
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">En la versión real, el botón publicará únicamente después de tu confirmación.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
