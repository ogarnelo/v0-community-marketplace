// Stable PUBLIC directory identity, not an invitation credential.
// Access to live communities is independently managed by school_access_codes.
export const SCHOOL_DIRECTORY_BASE_URL = "https://www.wetudy.com";

export function validOfficialSchoolCode(code: string): boolean {
  return /^[0-9]{8}$/.test(code);
}

export function getWetudyDirectoryCode(officialCode: string): string {
  if (!validOfficialSchoolCode(officialCode)) {
    throw new Error("Código oficial de centro no válido");
  }
  return `WET-${officialCode}`;
}

export function getSchoolDirectoryUrl(officialCode: string): string {
  getWetudyDirectoryCode(officialCode);
  return `${SCHOOL_DIRECTORY_BASE_URL}/centros/${officialCode}`;
}
