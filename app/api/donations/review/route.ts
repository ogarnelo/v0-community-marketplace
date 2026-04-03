import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import { getAdminFlags } from "@/lib/admin/roles";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    const adminFlags = getAdminFlags({
      email: user.email,
      roles: (roles || []) as Array<{ role: string; school_id: string | null }>,
    });

    if (!adminFlags.canAccessAdmin) {
      return NextResponse.json({ error: "Sin permisos." }, { status: 403 });
    }

    const body = await request.json();
    const donationRequestId =
      typeof body?.donationRequestId === "string" ? body.donationRequestId.trim() : "";
    const action = body?.action === "approve" ? "approve" : "reject";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!donationRequestId) {
      return NextResponse.json({ error: "Falta la solicitud." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: donationRequest } = await adminSupabase
      .from("donation_requests")
      .select("id, listing_id, requester_id, school_id, status")
      .eq("id", donationRequestId)
      .maybeSingle();

    if (!donationRequest || !donationRequest.listing_id) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }

    const allowedSchoolId = adminFlags.isSuperAdmin
      ? donationRequest.school_id
      : adminFlags.schoolAdminSchoolId;

    if (!adminFlags.isSuperAdmin && donationRequest.school_id !== allowedSchoolId) {
      return NextResponse.json({ error: "No puedes revisar solicitudes de otro centro." }, { status: 403 });
    }

    const { data: listing } = await adminSupabase
      .from("listings")
      .select("id, title, seller_id")
      .eq("id", donationRequest.listing_id)
      .maybeSingle();

    const { data: existingConversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", donationRequest.listing_id)
      .eq("buyer_id", donationRequest.requester_id)
      .eq("seller_id", listing?.seller_id || "")
      .maybeSingle();

    const conversationId = existingConversation?.id || null;

    if (action === "approve") {
      const now = new Date().toISOString();

      await adminSupabase
        .from("donation_requests")
        .update({
          status: "approved",
          assigned_to_requester_id: donationRequest.requester_id,
          approved_by_admin_id: user.id,
          note: note || null,
          updated_at: now,
        })
        .eq("id", donationRequestId);

      await adminSupabase
        .from("donation_requests")
        .update({
          status: "rejected",
          note: "La donación ya fue asignada a otro solicitante.",
          updated_at: now,
        })
        .eq("listing_id", donationRequest.listing_id)
        .neq("id", donationRequestId)
        .eq("status", "pending");

      await adminSupabase
        .from("listings")
        .update({ status: "archived" })
        .eq("id", donationRequest.listing_id);

      if (conversationId) {
        await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: listing?.seller_id || user.id,
          body: note
            ? `🎁 Donación aprobada por el centro. Nota: ${note}`
            : "🎁 Donación aprobada por el centro.",
        });

        await adminSupabase
          .from("conversations")
          .update({ updated_at: now })
          .eq("id", conversationId);
      }

      await createNotifications(adminSupabase, [
        donationRequest.requester_id
          ? {
            user_id: donationRequest.requester_id,
            kind: "donation_approved",
            title: "Han aprobado tu solicitud de donación",
            body: `${listing?.title || "La donación"} ha sido asignada a tu usuario.`,
            href: conversationId ? `/messages/${conversationId}` : "/messages",
            metadata: {
              donation_request_id: donationRequestId,
              listing_id: donationRequest.listing_id,
            },
          }
          : null,
        listing?.seller_id
          ? {
            user_id: listing.seller_id,
            kind: "donation_reviewed",
            title: "La donación ya tiene destinatario",
            body: `El centro ha aprobado la solicitud para ${listing.title || "tu anuncio"}.`,
            href: conversationId ? `/messages/${conversationId}` : "/messages",
            metadata: {
              donation_request_id: donationRequestId,
              listing_id: donationRequest.listing_id,
            },
          }
          : null,
      ].filter(Boolean) as Array<{
        user_id: string;
        kind: string;
        title: string;
        body: string;
        href: string;
        metadata: Record<string, unknown>;
      }>);
    } else {
      const now = new Date().toISOString();

      await adminSupabase
        .from("donation_requests")
        .update({
          status: "rejected",
          approved_by_admin_id: user.id,
          note: note || null,
          updated_at: now,
        })
        .eq("id", donationRequestId);

      if (conversationId) {
        await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: listing?.seller_id || user.id,
          body: note
            ? `❌ Solicitud de donación rechazada. Nota del centro: ${note}`
            : "❌ Solicitud de donación rechazada por el centro.",
        });

        await adminSupabase
          .from("conversations")
          .update({ updated_at: now })
          .eq("id", conversationId);
      }

      if (donationRequest.requester_id) {
        await createNotifications(adminSupabase, [
          {
            user_id: donationRequest.requester_id,
            kind: "donation_rejected",
            title: "Han rechazado tu solicitud de donación",
            body: note || `La solicitud para ${listing?.title || "la donación"} ha sido rechazada.`,
            href: conversationId ? `/messages/${conversationId}` : "/messages",
            metadata: {
              donation_request_id: donationRequestId,
              listing_id: donationRequest.listing_id,
            },
          },
        ]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || error?.details || "No se pudo revisar la solicitud.",
      },
      { status: 500 }
    );
  }
}
