import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Mail, MapPin, GraduationCap, Users, ShieldCheck, CalendarDays } from "lucide-react"

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    return name
      .trim()
      .split(" ")
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("")
  }

  if (email && email.length > 0) {
    return email[0].toUpperCase()
  }

  return "U"
}

function formatUserType(userType?: string | null) {
  switch (userType) {
    case "parent":
      return "Familia / Tutor legal"
    case "student":
      return "Estudiante"
    case "school_admin":
      return "Administrador de centro"
    case "super_admin":
      return "Super admin"
    default:
      return "Usuario"
  }
}

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  const fullName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Mi cuenta"

  const email = user.email || "Sin email"
  const userType = profile?.user_type || user.user_metadata?.user_type || null
  const gradeLevel = profile?.grade_level || user.user_metadata?.grade_level || null
  const postalCode = profile?.postal_code || user.user_metadata?.postal_code || null
  const createdAt = profile?.created_at || user.created_at || null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona tu perfil y revisa la información asociada a tu cuenta de Wetudy.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-start gap-5 p-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(fullName, email)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{fullName}</h2>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{formatUserType(userType)}</Badge>
                {user.email_verified && <Badge>Email verificado</Badge>}
              </div>
            </div>

            <div className="w-full space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{email}</span>
              </div>

              {postalCode && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Código postal: {postalCode}</span>
                </div>
              )}

              {gradeLevel && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GraduationCap className="h-4 w-4" />
                  <span>{gradeLevel}</span>
                </div>
              )}

              {createdAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    Miembro desde{" "}
                    {new Date(createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Resumen del perfil</CardTitle>
              <CardDescription>
                Esta información proviene de tu cuenta real en Wetudy.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Tipo de usuario
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatUserType(userType)}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Estado de la cuenta
                </div>
                <p className="text-sm text-muted-foreground">
                  {user.email_verified ? "Verificada" : "Pendiente de verificación"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 text-sm font-medium">Curso / etapa</div>
                <p className="text-sm text-muted-foreground">
                  {gradeLevel || "Todavía no indicado"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 text-sm font-medium">Código postal</div>
                <p className="text-sm text-muted-foreground">
                  {postalCode || "Todavía no indicado"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}