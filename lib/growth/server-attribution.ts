import "server-only";

type AdminClient = any;

type ConversionEventType =
  | "listing_published"
  | "agreement_confirmed"
  | "school_joined";

export async function recordAttributedConversion(
  admin: AdminClient,
  params: {
    userId: string;
    eventType: ConversionEventType;
    entityId: string;
  }
) {
  const { data: attribution, error: attributionError } = await admin
    .from("growth_acquisition_events")
    .select("source, medium, campaign, content, landing_path, referrer_host")
    .eq("event_type", "attributed_user")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (attributionError) {
    throw attributionError;
  }

  if (!attribution?.source) {
    return false;
  }

  const { error } = await admin.from("growth_acquisition_events").insert({
    event_type: params.eventType,
    user_id: params.userId,
    entity_id: params.entityId,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    content: attribution.content,
    landing_path: attribution.landing_path,
    referrer_host: attribution.referrer_host,
  });

  if (error?.code === "23505") {
    return true;
  }

  if (error) {
    throw error;
  }

  return true;
}
