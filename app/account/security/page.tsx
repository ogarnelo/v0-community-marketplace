import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChangePasswordForm from "@/components/account/change-password-form";
import { ArrowLeft } from "lucide-react";

export default async function AccountSecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/security");

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-8">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Mi cuenta
        </Link>

        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Seguridad</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Contraseña</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Actualiza la contraseña que utilizas para iniciar sesión en Wetudy.
          </p>
        </div>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
