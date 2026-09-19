"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  schoolId: string;
  schoolName: string;
  isActive: boolean;
  requestId?: string | null;
  contactEmail?: string | null;
  compact?: boolean;
};

export function SchoolManagementActions({
  schoolId,
  schoolName,
  isActive,
  requestId,
  contactEmail,
  compact = false,
}: Props) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState<"resend" | "toggle" | null>(null);
  const [status, setStatus] = useState("");

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
      </div>

      {status ? (
        <p className="text-xs text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
