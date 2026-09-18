const PRODUCTION_AUTH_ORIGIN = "https://www.wetudy.com";

export function getAuthPublicOrigin() {
  if (typeof window === "undefined") {
    return PRODUCTION_AUTH_ORIGIN;
  }

  const hostname = window.location.hostname.toLowerCase();

  if (hostname === "wetudy.com" || hostname === "www.wetudy.com") {
    return PRODUCTION_AUTH_ORIGIN;
  }

  return window.location.origin;
}
