import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserByEmail, grantSchoolAdminRole } from "@/lib/admin/school-admin-role";
import {
  sendSchoolAdminAccessGrantedEmail,
  sendSchoolAdminInviteEmail,
} from "@/lib/emails/school-admin-invite-email";

function buildActivationUrl(origin: string, hashedToken: string, type: "invite" | "magiclink") {
  const next = "/auth/complete-invite?next=/admin/school";
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type,
    next,
  });

  return `${origin}/auth/confirm?${params.toString()}`;
}

export async function provisionSchoolAdminAccess(params: {
  email: string;
  schoolId: string;
  schoolName: string;
  origin: string;
  idempotencyKeyPrefix: string;
}) {
  const admin = createAdminClient();
  const normalizedEmail = params.email.trim().toLowerCase();
  let authUser = await findAuthUserByEmail(normalizedEmail);

  if (!authUser) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: normalizedEmail,
      options: {
        data: {
          school_name: params.schoolName,
          account_context: "school_admin",
        },
      },
    });

    if (error) throw error;
    authUser = data.user;

    await grantSchoolAdminRole({
      userId: authUser.id,
      schoolId: params.schoolId,
    });

    const activationUrl = buildActivationUrl(
      params.origin,
      data.properties.hashed_token,
      "invite"
    );

    await sendSchoolAdminInviteEmail({
      to: normalizedEmail,
      schoolName: params.schoolName,
      inviteUrl: activationUrl,
      idempotencyKey: `${params.idempotencyKeyPrefix}-invite-${authUser.id}`,
    });

    return {
      userId: authUser.id,
      activationSent: true,
      existingConfirmedUser: false,
    };
  }

  await grantSchoolAdminRole({
    userId: authUser.id,
    schoolId: params.schoolId,
  });

  const schoolInviteCompleted =
    authUser.user_metadata?.school_admin_onboarding_complete === true;
  const cameFromSchoolInvite =
    authUser.user_metadata?.account_context === "school_admin" ||
    (Boolean(authUser.invited_at) &&
      typeof authUser.user_metadata?.school_name === "string");

  if (
    !authUser.email_confirmed_at ||
    (cameFromSchoolInvite && !schoolInviteCompleted)
  ) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        data: {
          school_name: params.schoolName,
          account_context: "school_admin",
        },
      },
    });

    if (error) throw error;

    const activationUrl = buildActivationUrl(
      params.origin,
      data.properties.hashed_token,
      "magiclink"
    );

    await sendSchoolAdminInviteEmail({
      to: normalizedEmail,
      schoolName: params.schoolName,
      inviteUrl: activationUrl,
      idempotencyKey: `${params.idempotencyKeyPrefix}-activate-${authUser.id}`,
    });

    return {
      userId: authUser.id,
      activationSent: true,
      existingConfirmedUser: false,
    };
  }

  await sendSchoolAdminAccessGrantedEmail({
    to: normalizedEmail,
    schoolName: params.schoolName,
    idempotencyKey: `${params.idempotencyKeyPrefix}-access-${authUser.id}`,
  });

  return {
    userId: authUser.id,
    activationSent: false,
    existingConfirmedUser: true,
  };
}
