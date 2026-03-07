import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Cuenta</h1>

      <div className="mt-6 space-y-2">
        <p className="text-sm text-muted-foreground">
          Usuario autenticado con Supabase:
        </p>

        <div className="rounded-lg border p-4">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>ID:</strong> {user.id}</p>
        </div>

        <pre className="mt-4 rounded bg-muted p-4 text-xs">
          {JSON.stringify(user.user_metadata, null, 2)}
        </pre>
      </div>
    </div>
  )
}