"use client";

import { useState } from "react";
import { categories, conditions, gradeLevels } from "@/lib/mock-data";
import { detailFieldsForCategory } from "@/lib/whatsapp/category-fields";
import { normalizeWhatsappForm } from "@/lib/whatsapp/form";
import type { WhatsappDraft } from "@/lib/whatsapp/conversation";

type Props = {
  initialDraft: WhatsappDraft;
  photoUrl?: string | null;
  onPublish: (draft: WhatsappDraft) => Promise<void>;
  onSave?: (draft: WhatsappDraft) => Promise<void>;
  isDemo?: boolean;
};

const fieldClass = "mt-1.5 w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";
const helpClass = "mt-1 text-xs text-slate-500";
const required = <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Obligatorio</span>;
const optional = <span className="text-xs font-normal text-slate-500">Opcional</span>;

export default function WhatsappListingForm({ initialDraft, photoUrl, onPublish, onSave, isDemo = false }: Props) {
  const [draft, setDraft] = useState<WhatsappDraft>(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const details = detailFieldsForCategory(draft.category);
  const courseRequired = draft.category === "Libros de texto" || draft.category === "Lectura y literatura";

  function setValue(key: keyof WhatsappDraft, value: string | number | null) {
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setSaved(false);
    setDraft((previous) => {
      if (key === "category") {
        // Switching category must discard fields that do not belong to that category.
        const cleaned: WhatsappDraft = {
          listingId: previous.listingId,
          title: previous.title,
          description: previous.description,
          category: String(value),
          gradeLevel: previous.gradeLevel,
          condition: previous.condition,
          kind: previous.kind,
          price: previous.price,
          originalPrice: previous.originalPrice,
        };
        for (const field of detailFieldsForCategory(String(value))) {
          if (previous.category === value) cleaned[field.key] = previous[field.key];
        }
        if (!courseRequired && (value === "Libros de texto" || value === "Lectura y literatura")) {
          cleaned.gradeLevel = undefined;
        }
        return cleaned;
      }
      return { ...previous, [key]: value };
    });
  }

  const confirm = async () => {
    setErrors({});
    const parsed = normalizeWhatsappForm(draft, draft.listingId || "", photoUrl || "demo/confirmed-photo.jpg");
    if (Object.keys(parsed.errors).length) {
      setErrors(parsed.errors);
      document.getElementById("wetudy-form-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setBusy(true);
    try { await onPublish(parsed.draft); }
    catch (error) { setErrors({ form: error instanceof Error ? error.message : "No se pudo publicar." }); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!onSave) return;
    setBusy(true); setSaved(false);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "No se pudo guardar." });
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-5 rounded-3xl bg-white p-4 text-slate-900 shadow-sm sm:p-6" aria-labelledby="wetudy-form-heading">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-emerald-700">WETUDY EASY · Propuesta asistida</p>
        <h2 id="wetudy-form-heading" className="text-2xl font-bold tracking-tight">Revisa tu anuncio</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Hemos rellenado lo que hemos podido reconocer. Comprueba los datos, completa los campos obligatorios y publica cuando esté listo.
        </p>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          Antes de publicar, revisa también la fotografía. No incluyas datos personales de otras personas, especialmente de menores. Puedes cancelar el anuncio si la imagen no es adecuada.
        </p>
        {isDemo && <p className="text-xs font-medium text-amber-800">Ejemplo simulado: los valores no proceden de analizar tu fotografía.</p>}
      </div>

      {photoUrl && (
        <div className="overflow-hidden rounded-2xl border bg-slate-50 p-3">
          <img src={photoUrl} alt="Fotografía del artículo pendiente de publicar" className="mx-auto max-h-56 w-auto rounded-xl object-contain" />
          <p className="mt-2 text-center text-xs text-slate-500">Fotografía del artículo</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="wa-category" className="flex items-center gap-2 text-sm font-semibold">Categoría {required}</label>
          <select id="wa-category" className={fieldClass} value={draft.category || ""} onChange={(event) => setValue("category", event.target.value)}>
            <option value="">Selecciona una categoría</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {errors.category && <p role="alert" className="mt-1 text-xs text-red-700">{errors.category}</p>}
        </div>
        <div>
          <label htmlFor="wa-title" className="flex items-center gap-2 text-sm font-semibold">Título {required}</label>
          <input id="wa-title" className={fieldClass} value={draft.title || ""} maxLength={110}
            onChange={(event) => setValue("title", event.target.value)} placeholder="Ej. Calculadora científica Casio" />
          {errors.title && <p role="alert" className="mt-1 text-xs text-red-700">{errors.title}</p>}
        </div>
        <div>
          <label htmlFor="wa-description" className="flex items-center gap-2 text-sm font-semibold">Descripción {required}</label>
          <textarea id="wa-description" className={fieldClass} rows={4} maxLength={750}
            value={draft.description || ""} onChange={(event) => setValue("description", event.target.value)}
            placeholder="Describe qué incluye, marcas de uso y cualquier dato útil." />
          <p className={helpClass}>Mínimo 40 caracteres · {draft.description?.length || 0}/750</p>
          {errors.description && <p role="alert" className="mt-1 text-xs text-red-700">{errors.description}</p>}
        </div>

        <div>
          <label htmlFor="wa-grade" className="flex items-center gap-2 text-sm font-semibold">Curso / etapa {courseRequired ? required : optional}</label>
          <select id="wa-grade" className={fieldClass} value={draft.gradeLevel || ""} onChange={(event) => setValue("gradeLevel", event.target.value)}>
            <option value="">Varios cursos / Sin especificar</option>
            {gradeLevels.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {errors.gradeLevel && <p role="alert" className="mt-1 text-xs text-red-700">{errors.gradeLevel}</p>}
        </div>

        {details.length > 0 && (
          <div className="space-y-4 rounded-2xl bg-emerald-50/70 p-4">
            <div>
              <h3 className="font-semibold text-emerald-900">Datos específicos de {draft.category}</h3>
              <p className="text-xs text-emerald-800">Opcionales: ayudan a que otras familias encuentren tu artículo. Los que no conozcas pueden quedar vacíos.</p>
            </div>
            {details.map((field) => (
              <div key={field.key}>
                <label htmlFor={`wa-${field.key}`} className="flex items-center gap-2 text-sm font-semibold">{field.label} {optional}</label>
                {field.options ? (
                  <select id={`wa-${field.key}`} className={fieldClass} value={draft[field.key] || ""}
                    onChange={(event) => setValue(field.key, event.target.value)}>
                    <option value="">No especificado</option>
                    {field.options.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                ) : (
                  <input id={`wa-${field.key}`} className={fieldClass}
                    value={draft[field.key] || ""} maxLength={field.limit}
                    placeholder={field.prompt}
                    onChange={(event) => setValue(field.key, event.target.value)} />
                )}
                {errors[field.key] && <p role="alert" className="mt-1 text-xs text-red-700">{errors[field.key]}</p>}
              </div>
            ))}
          </div>
        )}

        <div>
          <label htmlFor="wa-condition" className="flex items-center gap-2 text-sm font-semibold">Estado real {required}</label>
          <select id="wa-condition" className={fieldClass} value={draft.condition || ""}
            onChange={(event) => setValue("condition", event.target.value)}>
            <option value="">Selecciona el estado</option>
            {conditions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <p className={helpClass}>El estado debe indicarlo la familia: no se deduce solo de una foto.</p>
          {errors.condition && <p role="alert" className="mt-1 text-xs text-red-700">{errors.condition}</p>}
        </div>
        <div>
          <label htmlFor="wa-kind" className="flex items-center gap-2 text-sm font-semibold">Venta o donación {required}</label>
          <select id="wa-kind" className={fieldClass} value={draft.kind || ""}
            onChange={(event) => setValue("kind", event.target.value)}>
            <option value="">Selecciona una opción</option>
            <option value="sale">Vender</option><option value="donation">Donar</option>
          </select>
          {errors.kind && <p role="alert" className="mt-1 text-xs text-red-700">{errors.kind}</p>}
        </div>
        {draft.kind === "sale" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wa-price" className="flex items-center gap-2 text-sm font-semibold">Precio (€) {required}</label>
              <input id="wa-price" className={fieldClass} type="number" min="0.01" max="10000" step="0.01"
                value={draft.price ?? ""} onChange={(event) => setValue("price", event.target.value === "" ? null : Number(event.target.value))} placeholder="12" />
              {errors.price && <p role="alert" className="mt-1 text-xs text-red-700">{errors.price}</p>}
            </div>
            <div>
              <label htmlFor="wa-original-price" className="flex items-center gap-2 text-sm font-semibold">Precio original (€) {optional}</label>
              <input id="wa-original-price" className={fieldClass} type="number" min="0" max="10000" step="0.01"
                value={draft.originalPrice ?? ""}
                onChange={(event) => setValue("originalPrice", event.target.value === "" ? null : Number(event.target.value))}
                placeholder="Sin especificar" />
              {errors.originalPrice && <p role="alert" className="mt-1 text-xs text-red-700">{errors.originalPrice}</p>}
            </div>
          </div>
        )}
      </div>

      {errors.form && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errors.form}</p>}
      {saved && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Borrador guardado. Puedes volver a revisarlo.</p>}
      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row">
        {onSave && <button type="button" onClick={save} disabled={busy}
          className="min-h-12 rounded-xl border border-emerald-700 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">
          Guardar borrador
        </button>}
        <button type="button" onClick={confirm} disabled={busy}
          className="min-h-12 flex-1 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Procesando…" : "Confirmar y publicar"}
        </button>
      </div>
      <p className="text-center text-xs text-slate-500">No se publica nada hasta pulsar «Confirmar y publicar».</p>
    </section>
  );
}
