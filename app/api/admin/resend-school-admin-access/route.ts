import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionSchoolAdminAccess } from "@/lib/admin/school-admin-invitation";
import { getAuthPublicOrigin } from "@/lib/auth/public-origin";

type ApprovedSchoolRequest = {
  id: string;
  school_name: string;
  contact_email: string | null;
  approved_school_id: string | null;
  status: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    const body = (await request.json().catch(() => null)) as { requestId?: string } | null;
    const requestId = body?.requestId?.trim();

    if (!requestId) {
      return NextResponse.json({ error: "Falta la solicitud." }, { status: 400 });
    }

    const { data: schoolRequest, error: requestError } = await supabase
      .from("school_registration_requests")
      .select("id, school_name, contact_email, approved_school_id, status")
      .eq("id", requestId)
      .maybeSingle<ApprovedSchoolRequest>();

    if (requestError) throw requestError;

    if (
      !schoolRequest ||
      schoolRequest.status !== "approved" ||
      !schoolRequest.approved_school_id ||
      !schoolRequest.contact_email
    ) {
      return NextResponse.json(
        { error: "La solicitud aprobada no tiene un acceso de centro reenviable." },
        { status: 400 }
      );
    }

    const access = await provisionSchoolAdminAccess({
      email: schoolRequest.contact_email,
      schoolId: schoolRequest.approved_school_id,
      schoolName: schoolRequest.school_name,
      origin: getAuthPublicOrigin(),
      idempotencyKeyPrefix: `school-admin-resend-${schoolRequest.id}-${Date.now()}`,
    });

    return NextResponse.json({
      ok: true,
      activation_sent: access.activationSent,
      message: access.existingConfirmedUser
        ? "Acceso confirmado y email enviado."
        : "Nuevo enlace de activación enviado.",
    });
  } catch (error: any) {
    console.error("Error reenviando acceso de centro:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo reenviar el acceso del centro." },
      { status: 500 }
    );
  }
}
