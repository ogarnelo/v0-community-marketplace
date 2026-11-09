"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Power, PowerOff, Trash2, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  schoolId: string;
  schoolName: string;
  isActive: boolean;
  isTest?: boolean;
  requestId?: string | null;
  contactEmail?: string | null;
  compact?: boolean;
};

export function SchoolManagementActions({
  schoolId,
  schoolName,
  isActive,
  isTest = false,
  requestId,
  contactEmail,
  compact = false,
}: Props) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState<"resend" | "toggle" | "delete" | "preview" | "link" | null>(null);
  const [status, setStatus] = useState("");
  const [officialCode, setOfficialCode] = useState("");
  const [directoryPreview, setDirectoryPreview] = useState<{
    ready: boolean;
    linked: boolean;
    checks: Record<string, boolean>;
    school: { name: string; postalCode: string | null; city: string | null };
    directory: { name: string; officialCode: string; postalCode: string; municipality: string };
  } | null>(null);



  const verifyDirectoryCode = async () => {
    setDirectoryPreview(null);
    setStatus("");
    setLoading("preview");
    try {
      const response = await fetch("/api/admin/link-directory-school", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, officialCode, mode: "preview" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Error verificando centro.");
      setDirectoryPreview(payload);
      if (!payload.ready) {
        setStatus("Los datos no coinciden o el centro aún no está autorizado. No se ha vinculado nada.");
      }
    } catch (error: any) {
      setStatus(error?.message || "No se pudo verificar el código.");
    } finally { setLoading(null); }
  };

  const confirmDirectoryLink = async () => {
    if (!directoryPreview?.ready || directoryPreview.linked) return;
    const confirmed = window.confirm(
      "¿Vincular oficialmente \"" + directoryPreview.directory.name +
      "\" (" + directoryPreview.directory.officialCode + ") a la comunidad \"" +
      directoryPreview.school.name + "\"? No se activará ningún colegio y no se modificarán anuncios."
    );
    if (!confirmed) return;
    setLoading("link");
    setStatus("");
    try {
      const response = await fetch("/api/admin/link-directory-school", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "link", schoolId,
          officialCode: directoryPreview.directory.officialCode, confirm: true,
          confirmedSchoolName: directoryPreview.school.name,
          confirmedDirectoryName: directoryPreview.directory.name }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "No se pudo vincular el centro.");
      setDirectoryPreview({ ...directoryPreview, linked: true });
      setStatus(payload.message || "Vinculación completada.");
      router.refresh();
    } catch (error: any) {
      setDirectoryPreview(null);
      setStatus(error?.message || "No se pudo completar la vinculación. Verifica de nuevo.");
    } finally { setLoading(null); }
  };

  const resendAccess = async () => {
    if (!requestId || !contactEmail) return;
    setStatus("");
    setLoading("resend");

    try {
      const response = await fetch("/api/admin/resend-school-admin-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo reenviar el acceso.");
      }

      setStatus(payload?.message || "Acceso enviado de nuevo.");
    } catch (error: any) {
      setStatus(error?.message || "No se pudo reenviar el acceso.");
    } finally {
      setLoading(null);
    }
  };

  const deleteSchool = async () => {
    if (active) {
      setStatus("Desactiva primero el centro antes de eliminarlo.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar definitivamente "${schoolName}"? Esta acción no se puede deshacer. Solo se eliminará si no tiene usuarios, administradores ni anuncios asociados.`
    );
    if (!confirmed) return;

    setStatus("");
    setLoading("delete");

    try {
      const response = await fetch("/api/admin/delete-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo eliminar el centro.");
      }

      setStatus(payload?.message || "Centro eliminado.");
      router.refresh();
    } catch (error: any) {
      setStatus(error?.message || "No se pudo eliminar el centro.");
    } finally {
      setLoading(null);
    }
  };

  const toggleSchool = async () => {
    if (
      active &&
      !window.confirm(
        `¿Desactivar ${schoolName}? El centro dejará de admitir nuevas vinculaciones y su panel de centro quedará suspendido hasta reactivarlo.`
      )
    ) {
      return;
    }

    setStatus("");
    setLoading("toggle");

    try {
      const response = await fetch("/api/admin/toggle-school-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, active: !active }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo actualizar el centro.");
      }

      setActive(!active);
      setStatus(payload?.message || "Centro actualizado.");
      router.refresh();
    } catch (error: any) {
      setStatus(error?.message || "No se pudo actualizar el centro.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={compact ? "mt-3 space-y-2" : "space-y-2"}>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {requestId && contactEmail && active ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={compact ? "w-full sm:w-auto" : ""}
            disabled={loading !== null}
            onClick={resendAccess}
          >
            {loading === "resend" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Reenviar acceso
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant={active ? "outline" : "default"}
          className={compact ? "w-full sm:w-auto" : ""}
          disabled={loading !== null}
          onClick={toggleSchool}
        >
          {loading === "toggle" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : active ? (
            <PowerOff className="mr-2 h-4 w-4" />
          ) : (
            <Power className="mr-2 h-4 w-4" />
          )}
          {active ? "Desactivar centro" : "Reactivar centro"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="destructive"
          className={compact ? "w-full sm:w-auto" : ""}
          disabled={loading !== null}
          onClick={deleteSchool}
        >
          {loading === "delete" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Eliminar centro
        </Button>
      </div>


      {!compact && active && !isTest ? (
        <div className="rounded-lg border border-border/70 p-3 space-y-2">
          <p className="text-xs font-medium">Vincular al directorio nacional</p>
          <p className="text-xs text-muted-foreground">
            Solo con el código oficial exacto de ocho cifras y una solicitud AMPA aprobada.
            Verifica antes de vincular; nunca se empareja por nombre automáticamente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Código oficial del colegio"
              value={officialCode} inputMode="numeric" maxLength={8}
              onChange={(event) => {
                setOfficialCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 8));
                setDirectoryPreview(null);
              }}
              placeholder="Código oficial de 8 cifras"
              className="h-9 w-full max-w-56" />
            <Button type="button" size="sm" variant="outline"
              onClick={verifyDirectoryCode} disabled={loading !== null || officialCode.length !== 8}>
              {loading === "preview" ? "Verificando..." : "Verificar código"}
            </Button>
          </div>
          {directoryPreview ? (
            <div className="space-y-2 text-xs" role="status">
              <p>Directorio: <strong>{directoryPreview.directory.name}</strong>,
                {" "}{directoryPreview.directory.municipality},
                {" "}{directoryPreview.directory.postalCode}</p>
              <p>Comunidad: <strong>{directoryPreview.school.name}</strong>,
                {" "}{directoryPreview.school.city},
                {" "}{directoryPreview.school.postalCode}</p>
              {directoryPreview.linked ? (
                <p className="text-primary">Ya están vinculados correctamente.</p>
              ) : directoryPreview.ready ? (
                <Button type="button" size="sm" onClick={confirmDirectoryLink}
                  disabled={loading !== null}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {loading === "link" ? "Vinculando..." : "Confirmar vinculación"}
                </Button>
              ) : (
                <p className="text-destructive">
                  No cumple todos los controles. Revisa aprobación, centro y dirección postal.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {status ? (
        <p className="text-xs text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
