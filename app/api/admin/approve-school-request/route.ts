import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserByEmail, grantSchoolAdminRole } from "@/lib/admin/school-admin-role";

type SchoolRequestRow = {
  id: string;
  school_name: string;
  contact_email: string | null;
  approved_school_id: string | null;
  status: string | null;
};

type ApproveSchoolResult = {
  school_id: string | null;
  access_code: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: superAdminRoles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError || !superAdminRoles?.length) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      requestId?: string;
    } | null;

    const requestId = body?.requestId?.trim();

    if (!requestId) {
      return NextResponse.json(
        { error: "Falta el identificador de la solicitud." },
        { status: 400 }
      );
    }

    const { data: schoolRequest, error: requestError } = await supabase
      .from("school_registration_requests")
      .select("id, school_name, contact_email, approved_school_id, status")
      .eq("id", requestId)
      .maybeSingle<SchoolRequestRow>();

    if (requestError) {
      throw requestError;
    }

    if (!schoolRequest) {
      return NextResponse.json(
        { error: "No se ha encontrado la solicitud indicada." },
        { status: 404 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc(
      "approve_school_registration_request",
      { request_id: requestId }
    );

    if (error) {
      throw error;
    }

    const result = (Array.isArray(data) ? data[0] : data) as ApproveSchoolResult | null;
    const approvedSchoolId =
      result?.school_id || schoolRequest.approved_school_id || null;
    const accessCode = result?.access_code || null;

    let inviteSent = false;
    let inviteMessage: string | null = null;

    const normalizedContactEmail = schoolRequest.contact_email?.trim().toLowerCase() || null;

    if (normalizedContactEmail && approvedSchoolId) {
      const existingUser = await findAuthUserByEmail(normalizedContactEmail);

      if (existingUser) {
        await grantSchoolAdminRole({
          userId: existingUser.id,
          schoolId: approvedSchoolId,
        });
        inviteMessage =
          "La cuenta ya existía. Se le ha concedido acceso de administración del centro.";
      } else {
        const origin = new URL(request.url).origin;

        const { data: inviteData, error: inviteError } =
          await adminSupabase.auth.admin.inviteUserByEmail(normalizedContactEmail, {
            data: {
              school_name: schoolRequest.school_name,
            },
            redirectTo: `${origin}/auth/callback?next=/admin/school`,
          });

        if (inviteError) throw inviteError;

        const invitedUserId = inviteData.user?.id;

        if (!invitedUserId) {
          throw new Error("La invitación se creó sin un usuario asociado.");
        }

        await grantSchoolAdminRole({
          userId: invitedUserId,
          schoolId: approvedSchoolId,
        });
        inviteSent = true;
      }
    }

    return NextResponse.json({
      ok: true,
      school_id: approvedSchoolId,
      access_code: accessCode,
      invite_sent: inviteSent,
      invite_message: inviteMessage,
    });
  } catch (error: any) {
    console.error("Error aprobando solicitud de centro:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.details ||
          "No se pudo aprobar la solicitud de centro.",
      },
      { status: 500 }
    );
  }
}
