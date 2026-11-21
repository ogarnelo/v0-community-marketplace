import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) },
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeSuperAdminRange } from "@/lib/reports/super-admin-report";

const ALLOWED_FREQUENCIES = new Set([7, 15, 30]);
const ALLOWED_FORMATS = new Set(["pdf", "csv", "both"]);

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function nextSendAt(frequencyDays: number) {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + frequencyDays);
  return next.toISOString();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: guest ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: guest ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

    if (roleError || !roles?.length) {
      return privateJson({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          enabled?: boolean;
          email?: string;
          frequencyDays?: number;
          range?: string;
          format?: string;
        }
      | null;

    if (!body || typeof body.enabled !== "boolean" || (body.email !== undefined && typeof body.email !== "string")) {
      return privateJson({ error: "Configuración inválida." }, { status: 400 });
    }
    const enabled = body.enabled;
    const email = (body?.email || user.email || "").trim().toLowerCase();
    const frequencyDays = Number(body?.frequencyDays || 30);
    const reportRange = normalizeSuperAdminRange(body?.range);
    const reportFormat = ALLOWED_FORMATS.has(String(body?.format))
      ? String(body?.format)
      : "both";

    const verifiedEmail = user.email_confirmed_at ? (user.email || "").trim().toLowerCase() : "";
    if (!verifiedEmail || verifiedEmail !== email) {
      return privateJson({ error: "Solo puedes usar el correo verificado de tu cuenta." }, { status: 403 });
    }
    if (!isEmail(email)) {
      return privateJson({ error: "Introduce un email válido." }, { status: 400 });
    }

    if (!ALLOWED_FREQUENCIES.has(frequencyDays)) {
      return privateJson(
        { error: "La frecuencia debe ser de 7, 15 o 30 días." },
        { status: 400 }
      );
    }

    const fresh = await supabase.auth.getUser();
    if (fresh.error) return privateJson({ error: "No se pudo comprobar tu sesión." }, { status: 503 });
    const current = fresh.data?.user;
    if (!current || current.id !== user.id || !current.email_confirmed_at || (current.email || "").trim().toLowerCase() !== email) {
      return privateJson({ error: "Sesión o dirección verificada modificada." }, { status: 403 });
    }
    const freshRoles = await supabase.from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "super_admin").limit(1);
    if (freshRoles.error) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });
    if (!freshRoles.data?.length) return privateJson({ error: "Permiso revocado." }, { status: 403 });
    const admin = createAdminClient();
    const { error } = await admin
      .from("super_admin_report_subscriptions")
      .upsert(
        {
          user_id: user.id,
          email,
          enabled,
          frequency_days: frequencyDays,
          report_range: reportRange,
          report_format: reportFormat,
          next_send_at: enabled ? nextSendAt(frequencyDays) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;

    return privateJson({
      ok: true,
      message: enabled
        ? `Informe activado cada ${frequencyDays} días.`
        : "Envío periódico desactivado.",
    });
  } catch {
    console.error("super_admin_report_subscription_failed");
    return privateJson({ error: "No se pudo guardar la configuración." }, { status: 500 });
  }
}
