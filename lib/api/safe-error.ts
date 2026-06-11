import { NextResponse } from "next/server";

export function logApiError(context: string, error: unknown) {
  console.error(context, error);
}

export function safeErrorMessage(fallback = "No se pudo completar la operación.") {
  return fallback;
}

export function safeApiError(error: unknown, fallback = "No se pudo completar la operación.", status = 500) {
  logApiError(fallback, error);
  return NextResponse.json({ error: fallback }, { status });
}

export function isPostgresUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
  );
}
