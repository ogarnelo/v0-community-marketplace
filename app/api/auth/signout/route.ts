import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error && error.name !== "AuthSessionMissingError") {
      console.error("No se pudo cerrar la sesión en servidor", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } catch (error: any) {
    if (error?.name !== "AuthSessionMissingError") {
      console.error("No se pudo cerrar la sesión en servidor", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
