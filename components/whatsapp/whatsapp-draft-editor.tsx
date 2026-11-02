"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WhatsappListingForm from "@/components/whatsapp/whatsapp-listing-form";
import type { WhatsappDraft } from "@/lib/whatsapp/conversation";

type DraftResponse = { step: "form"; draft: WhatsappDraft; photoUrl: string; error?: string };
type PublishResponse = { published: boolean; url: string; error?: string; fields?: Record<string, string> };

export default function WhatsappDraftEditor({ draftId }: { draftId: string }) {
  const [data, setData] = useState<DraftResponse | null>(null);
  const [error, setError] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/whatsapp/draft?draft=${encodeURIComponent(draftId)}`, {
      cache: "no-store",
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo abrir el borrador.");
      if (active) setData(result as DraftResponse);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el anuncio.");
    });
    return () => { active = false; };
  }, [draftId]);

  async function send(action: "save" | "publish", draft: WhatsappDraft) {
    const response = await fetch("/api/whatsapp/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, draftId, draft }),
      cache: "no-store",
    });
    const result: PublishResponse = await response.json().catch(() => ({
      error: "No se pudo guardar la respuesta.",
      published: false, url: "",
    }));
    if (!response.ok) {
      if (result.fields) {
        throw new Error(`Revisa los campos: ${Object.values(result.fields).join(" ")}`);
      }
      throw new Error(result.error || "Error al procesar el anuncio.");
    }
    if (action === "publish") {
      if (!result.url) throw new Error("Se publicó el anuncio, pero falta su enlace.");
      setPublishedUrl(result.url);
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">No se pudo abrir el borrador</h1>
        <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
        <p className="mt-3 text-sm text-slate-600">Comprueba que estás usando la cuenta Wetudy vinculada a tu WhatsApp y que el anuncio no haya caducado.</p>
      </div>
    );
  }
  if (publishedUrl) {
    return (
      <section className="rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-emerald-800">✅ ¡Anuncio publicado!</h1>
        <p className="mt-3 text-sm text-slate-600">Ya está asociado a tu cuenta de Wetudy.</p>
        <Link href={publishedUrl} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-5 font-semibold text-white">Ver mi anuncio</Link>
      </section>
    );
  }
  if (!data) {
    return <div role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-600">Cargando propuesta de anuncio…</div>;
  }
  return (
    <WhatsappListingForm
      initialDraft={data.draft}
      photoUrl={data.photoUrl}
      onSave={async (draft) => { await send("save", draft); }}
      onPublish={async (draft) => { await send("publish", draft); }}
    />
  );
}
