export type GrowthAttribution = {
  source: string;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  landingPath?: string | null;
  referrerHost?: string | null;
};

const SITE_URL = "https://www.wetudy.com";

export function cleanGrowthLabel(value: unknown, maxLength = 160) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\r\n\t]+/g, " ").slice(0, maxLength);
  return cleaned || null;
}

export function cleanGrowthPath(value: unknown) {
  const cleaned = cleanGrowthLabel(value, 500);
  if (!cleaned || !cleaned.startsWith("/")) return null;
  return cleaned;
}

export function cleanReferrerHost(value: unknown) {
  const cleaned = cleanGrowthLabel(value, 255);
  if (!cleaned) return null;
  return /^[a-z0-9.-]+(?::\d+)?$/i.test(cleaned) ? cleaned.toLowerCase() : null;
}

export function attributionFromSearchParams(
  params: Pick<URLSearchParams, "get">,
  fallback?: { landingPath?: string | null; referrerHost?: string | null }
): GrowthAttribution | null {
  const source = cleanGrowthLabel(params.get("utm_source"), 120);
  if (!source) return null;

  return {
    source,
    medium: cleanGrowthLabel(params.get("utm_medium"), 120),
    campaign: cleanGrowthLabel(params.get("utm_campaign"), 160),
    content: cleanGrowthLabel(params.get("utm_content"), 160),
    landingPath: cleanGrowthPath(fallback?.landingPath),
    referrerHost: cleanReferrerHost(fallback?.referrerHost),
  };
}

export function appendGrowthUtm(
  url: string,
  params: {
    source: string;
    medium: string;
    campaign: string;
    content?: string | null;
  },
  origin = SITE_URL
) {
  const parsed = new URL(url, origin);
  parsed.searchParams.set("utm_source", params.source);
  parsed.searchParams.set("utm_medium", params.medium);
  parsed.searchParams.set("utm_campaign", params.campaign);
  if (params.content) parsed.searchParams.set("utm_content", params.content);
  return parsed.toString();
}
