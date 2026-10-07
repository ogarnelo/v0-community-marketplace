import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSchoolRegistrationAdminEmail } from "@/lib/emails/admin-alert-emails";

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

    const body = await request.json().catch(() => ({}));
    const requestedSchoolId = clean(body?.existingSchoolId, 64);
    let schoolName = clean(body?.schoolName, 160);
    let schoolType = clean(body?.schoolType, 30);
    const organizationName = clean(body?.organizationName, 160);
    const contactName = clean(body?.contactName, 160);
    const contactRole = clean(body?.contactRole, 120);
    const organizationUrl = clean(body?.organizationUrl, 300);
    let address = clean(body?.address, 250);
    let city = clean(body?.city, 100);
    let postalCode = clean(body?.postalCode, 5);
    let region = clean(body?.region, 80);
    const contactEmail = clean(body?.contactEmail, 320).toLowerCase();
    const contactPhone = clean(body?.contactPhone, 40);

    const admin = createAdminClient();

    if (requestedSchoolId) {
      const { data: existingSchool, error: existingSchoolError } = await admin
        .from("schools")
        .select("id, name, school_type, address, city, postal_code, region")
        .eq("id", requestedSchoolId)
        .eq("is_active", true)
        .maybeSingle();

      if (existingSchoolError) throw existingSchoolError;
      if (!existingSchool) {
        return NextResponse.json(
          { error: "El centro seleccionado no existe o ya no está activo." },
          { status: 400 }
        );
      }

      schoolName = existingSchool.name;
      schoolType = existingSchool.school_type;
      address = existingSchool.address || "";
      city = existingSchool.city || "";
      postalCode = existingSchool.postal_code || "";
      region = existingSchool.region || "";
    } else {
      if (schoolName.length < 2) {
        return NextResponse.json({ error: "Debes indicar un nombre de centro válido." }, { status: 400 });
      }
      if (!SCHOOL_TYPES.has(schoolType)) {
        return NextResponse.json({ error: "El tipo de centro seleccionado no es válido." }, { status: 400 });
      }
    }

    if (organizationName.length < 2) {
      return NextResponse.json({ error: "Debes indicar el nombre de la AMPA, AFA o entidad." }, { status: 400 });
    }
    if (contactName.length < 2) {
      return NextResponse.json({ error: "Debes indicar una persona de contacto." }, { status: 400 });
    }
    if (contactRole.length < 2) {
      return NextResponse.json({ error: "Debes indicar el cargo o función de la persona de contacto." }, { status: 400 });
    }
    if (organizationUrl) {
      try {
        const parsedUrl = new URL(organizationUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("invalid");
      } catch {
        return NextResponse.json({ error: "La web o red oficial no tiene una URL válida." }, { status: 400 });
      }
    }
    if (!requestedSchoolId) {
      if (address.length < 3 || city.length < 2) {
        return NextResponse.json({ error: "Revisa la dirección y la ciudad." }, { status: 400 });
      }
      if (!/^[0-9]{5}$/.test(postalCode)) {
        return NextResponse.json({ error: "Debes indicar un código postal válido de 5 dígitos." }, { status: 400 });
      }
      if (!REGIONS.has(region)) {
        return NextResponse.json({ error: "La comunidad autónoma seleccionada no es válida." }, { status: 400 });
      }
    }
    if (!isEmail(contactEmail)) {
      return NextResponse.json({ error: "Debes indicar un email de contacto válido." }, { status: 400 });
    }
    if (contactPhone.length < 6) {
      return NextResponse.json({ error: "Debes indicar un teléfono de contacto válido." }, { status: 400 });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: recentEmailRequests, error: emailRateError }, { count: recentPhoneRequests, error: phoneRateError }] =
      await Promise.all([
        admin
          .from("school_registration_requests")
          .select("id", { count: "exact", head: true })
          .eq("contact_email", contactEmail)
          .gte("created_at", oneDayAgo),
        admin
          .from("school_registration_requests")
          .select("id", { count: "exact", head: true })
          .eq("contact_phone", contactPhone)
          .gte("created_at", oneDayAgo),
      ]);

    if (emailRateError) throw emailRateError;
    if (phoneRateError) throw phoneRateError;

    if (
      (recentEmailRequests || 0) >= MAX_REQUESTS_PER_DAY ||
      (recentPhoneRequests || 0) >= MAX_REQUESTS_PER_DAY
    ) {
      return NextResponse.json(
        { error: "Ya has enviado varias solicitudes hoy. Espera antes de enviar otra." },
        { status: 429 }
      );
    }

    const { data: schoolRequest, error: insertError } = await admin
      .from("school_registration_requests")
      .insert({
        requested_by: user?.id || null,
        requested_school_id: requestedSchoolId || null,
        school_name: schoolName,
        school_type: schoolType,
        organization_name: organizationName,
        contact_name: contactName,
        contact_role: contactRole,
        organization_url: organizationUrl || null,
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
            requesterEmail: user?.email?.trim() || contactEmail,
            schoolName,
            schoolType,
            organizationName,
            contactName,
            contactRole,
            contactPhone,
            organizationUrl: organizationUrl || null,
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
