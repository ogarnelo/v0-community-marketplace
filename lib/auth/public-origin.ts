const PRODUCTION_AUTH_ORIGIN = "https://www.wetudy.com";

export function getAuthPublicOrigin() {
  if (typeof window === "undefined") {
    return PRODUCTION_AUTH_ORIGIN;
  }

  return window.location.origin;
}
