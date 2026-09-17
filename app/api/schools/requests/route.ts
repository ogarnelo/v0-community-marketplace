import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSchoolRegistrationAdminEmail } from "@/lib/emails/admin-alert-emails";

const MIN_ACCOUNT_AGE_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_DAY = 2;
const SCHOOL_TYPES = new Set(["school", "academy", "university"]);
const REGIONS = new Set([
  "Andalucia",
  "Aragon",
  "Asturias",
  "Baleares",
  "Canarias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y Leon",
  "Cataluna",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Madrid",
  "Murcia",
  "Navarra",
  "Pais Vasco",
  "Ceuta",
  "Melilla",
]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión para solicitar un centro." }, { status: 401 });
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: "Confirma tu email antes de solicitar un centro." }, { status: 403 });
    }

    const createdAt = Date.parse(user.created_at || "");
    if (!Number.isFinite(createdAt) || Date.now() - createdAt < MIN_ACCOUNT_AGE_MS) {
      return NextResponse.json(
        { error: "Por seguridad, espera unos minutos tras activar tu cuenta antes de solicitar un centro." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const schoolName = clean(body?.schoolName, 160);
    const schoolType = clean(body?.schoolType, 30);
    const address = clean(body?.address, 250);
    const city = clean(body?.city, 100);
    const postalCode = clean(body?.postalCode, 5);
    const region = clean(body?.region, 80);
    const contactEmail = clean(body?.contactEmail, 320).toLowerCase();
    const contactPhone = clean(body?.contactPhone, 40);

    if (schoolName.length < 2) {
      return NextResponse.json({ error: "Debes indicar un nombre de centro válido." }, { status: 400 });
    }
    if (!SCHOOL_TYPES.has(schoolType)) {
      return NextResponse.json({ error: "El tipo de centro seleccionado no es válido." }, { status: 400 });
    }
    if (address.length < 3 || city.length < 2) {
      return NextResponse.json({ error: "Revisa la dirección y la ciudad." }, { status: 400 });
    }
    if (!/^[0-9]{5}$/.test(postalCode)) {
      return NextResponse.json({ error: "Debes indicar un código postal válido de 5 dígitos." }, { status: 400 });
    }
    if (!REGIONS.has(region)) {
      return NextResponse.json({ error: "La comunidad autónoma seleccionada no es válida." }, { status: 400 });
    }
    if (!isEmail(contactEmail)) {
      return NextResponse.json({ error: "Debes indicar un email de contacto válido." }, { status: 400 });
    }

    const admin = createAdminClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentRequests, error: rateError } = await admin
      .from("school_registration_requests")
      .select("id", { count: "exact", head: true })
      .eq("requested_by", user.id)
      .gte("created_at", oneDayAgo);

    if (rateError) throw rateError;

    if ((recentRequests || 0) >= MAX_REQUESTS_PER_DAY) {
      return NextResponse.json(
        { error: "Ya has enviado varias solicitudes hoy. Espera antes de enviar otra." },
        { status: 429 }
      );
    }

    const { data: schoolRequest, error: insertError } = await admin
      .from("school_registration_requests")
      .insert({
        requested_by: user.id,
        school_name: schoolName,
        school_type: schoolType,
        address,
        city,
        postal_code: postalCode,
        region,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    try {
      const { data: superAdminRoles, error: rolesError } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      if (rolesError) throw rolesError;

      const deliveries = await Promise.allSettled(
        (superAdminRoles || []).map(async ({ user_id: superAdminUserId }) => {
          const {
            data: { user: superAdminUser },
            error: adminUserError,
          } = await admin.auth.admin.getUserById(superAdminUserId);

          if (adminUserError) throw adminUserError;
          const to = superAdminUser?.email?.trim();
          if (!to) return;

          await sendSchoolRegistrationAdminEmail({
            to,
            requestId: schoolRequest.id,
            requesterEmail: user.email?.trim() || contactEmail,
            schoolName,
            schoolType,
            city,
            region,
            idempotencyKey: `school-request-${schoolRequest.id}-${superAdminUserId}`,
          });
        })
      );

      deliveries.forEach((delivery) => {
        if (delivery.status === "rejected") {
          console.error("Error enviando aviso de nueva solicitud de centro:", delivery.reason);
        }
      });
    } catch (emailError) {
      console.error("Error preparando avisos de solicitud de centro:", emailError);
    }

    return NextResponse.json({ ok: true, requestId: schoolRequest.id });
  } catch (error: any) {
    console.error("Error creando solicitud de centro:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo enviar la solicitud. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
