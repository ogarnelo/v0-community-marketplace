import { NextResponse } from "next/server";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError || !roles?.length) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
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

    const enabled = body?.enabled === true;
    const email = (body?.email || user.email || "").trim().toLowerCase();
    const frequencyDays = Number(body?.frequencyDays || 30);
    const reportRange = normalizeSuperAdminRange(body?.range);
    const reportFormat = ALLOWED_FORMATS.has(String(body?.format))
      ? String(body?.format)
      : "both";

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Introduce un email válido." }, { status: 400 });
    }

    if (!ALLOWED_FREQUENCIES.has(frequencyDays)) {
      return NextResponse.json(
        { error: "La frecuencia debe ser de 7, 15 o 30 días." },
        { status: 400 }
      );
    }

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

    return NextResponse.json({
      ok: true,
      message: enabled
        ? `Informe activado cada ${frequencyDays} días.`
        : "Envío periódico desactivado.",
    });
  } catch (error: any) {
    console.error("Error guardando suscripción global:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo guardar la configuración." },
      { status: 500 }
    );
  }
}
