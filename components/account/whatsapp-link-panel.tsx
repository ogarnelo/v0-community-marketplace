"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = { linked: boolean; linkedAt: string | null; pendingNumber: string | null };
export default function WhatsappLinkPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const response = await fetch("/api/whatsapp/link", { method: "GET", cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "No se pudo consultar la vinculación.");
    setStatus({ linked: Boolean(body.linked), linkedAt: body.linkedAt || null, pendingNumber: body.pendingNumber || null });
    if (body.linked) setLinkUrl("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try { await refresh(); } catch {
        if (!cancelled) setError("No se pudo consultar la vinculación.");
      }
    };
    void fetchStatus();
    return () => { cancelled = true; };
  }, [refresh]);

  const connect = async () => {
    if (!accepted) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo generar el enlace.");
      if (body.linked) { setStatus({ linked: true, linkedAt: body.linkedAt || null, pendingNumber: null }); setLinkUrl(""); }
      else { setLinkUrl(body.url || ""); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el enlace.");
    } finally { setLoading(false); }
  };

  const confirmNumber = async () => {
    if (!accepted || !status?.pendingNumber) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, confirm: true }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.linked) throw new Error(body.error || "No se pudo confirmar el número.");
      setStatus({ linked: true, linkedAt: null, pendingNumber: null });
      setLinkUrl("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo confirmar el número."); }
    finally { setLoading(false); }
  };

  const unlink = async () => {
    if (!window.confirm("¿Desvincular WhatsApp de tu cuenta Wetudy?")) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/link", { method: "DELETE", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo desvincular.");
      setStatus({ linked: false, linkedAt: null, pendingNumber: null });
      setLinkUrl("");
      setAccepted(false);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo desvincular."); }
    finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {status?.linked ? (
          <>
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">✅ WhatsApp vinculado correctamente.</p>
            <p className="text-sm text-muted-foreground">La conexión está activa, pero la creación de anuncios por WhatsApp todavía no está habilitada en este piloto técnico.</p>
            <Button variant="outline" onClick={unlink} disabled={loading}>Desvincular WhatsApp</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Wetudy asociará el identificador de WhatsApp desde el que envíes el mensaje con tu cuenta. Solo se utiliza para la vinculación y para las funciones del piloto que autorices. No compartas el enlace con otra persona.</p>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 size-4" />
              <span>Quiero vincular mi WhatsApp voluntariamente a mi cuenta de Wetudy. Entiendo que los mensajes y fotografías se procesan mediante Meta y Wetudy; cuando envíe una foto al número de Wetudy, Wetudy AI la analizará automáticamente para preparar un borrador de anuncio. Wetudy AI puede utilizar proveedores tecnológicos externos para este tratamiento. Debo evitar fotos que incluyan datos personales de terceros, especialmente de menores. Puedo desvincular el número cuando quiera.</span>
            </label>
            {status?.pendingNumber ? (
              <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
                <p className="font-semibold">Confirma que este es tu número de WhatsApp: {status.pendingNumber}</p>
                <p>Comprueba los últimos cuatro dígitos con tu teléfono antes de asociarlo a Wetudy. Si no coinciden, NO confirmes.</p>
                <Button onClick={confirmNumber} disabled={!accepted || loading}>Sí, es mi número · Confirmar vinculación</Button>
              </div>
            ) : null}
            <Button onClick={connect} disabled={!accepted || loading || Boolean(status?.pendingNumber)} className="w-full sm:w-auto">
              {loading ? "Preparando enlace…" : "Generar enlace seguro"}
            </Button>
            {linkUrl && (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium">Enlace válido durante 10 minutos.</p>
                <p className="text-sm text-muted-foreground">Abre WhatsApp y envía el mensaje que aparecerá escrito. No modifiques el código.</p>
                <Button asChild className="w-full sm:w-auto">
                  <a href={linkUrl} target="_blank" rel="noopener noreferrer">Abrir WhatsApp para vincular</a>
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => { void refresh().catch(()=>setError("No se pudo consultar el estado.")); }} disabled={loading} className="w-full sm:w-auto">
              Comprobar vinculación
            </Button>
            <p className="text-xs text-muted-foreground">La publicación por chat se habilitará únicamente tras las pruebas de seguridad y la confirmación de cada anuncio. No te enviaremos mensajes promocionales por el hecho de vincular tu cuenta.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
