"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Mail, Lock, User, MapPin } from "lucide-react"
import { gradeLevels } from "@/lib/mock-data"
import Link from "next/link"

type AuthMode = "login" | "signup" | "forgot"

export function AuthForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login"
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Simulate auth
    setTimeout(() => {
      setLoading(false)
      if (mode === "forgot") {
        setMode("login")
        return
      }
      if (mode === "signup") {
        router.push("/onboarding/join-school")
      } else {
        router.push("/marketplace")
      }
    }, 1200)
  }

  if (mode === "forgot") {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Recuperar contrasena</CardTitle>
          <CardDescription>Introduce tu email y te enviaremos un enlace para restablecer tu contrasena.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="tu@email.com" className="pl-10" required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar enlace
            </Button>
            <Button variant="ghost" type="button" className="w-full text-sm" onClick={() => setMode("login")}>
              Volver a iniciar sesion
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl text-foreground">
          {mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Accede a tu cuenta para explorar el marketplace de tu centro"
            : "Registrate gratis y unete a tu comunidad educativa"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === "signup" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="name" placeholder="Tu nombre" className="pl-10" required />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" placeholder="tu@email.com" className="pl-10" required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contrasena</Label>
              {mode === "login" && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMode("forgot")}>
                  Olvidaste tu contrasena?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" placeholder="••••••••" className="pl-10" required />
            </div>
          </div>

          {mode === "signup" && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Tipo de usuario *</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Familia | Tutor legal</SelectItem>
                    <SelectItem value="student">Estudiante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Curso / Etapa *</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLevels.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="postalCode">Codigo postal *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="postalCode"
                    placeholder="28001"
                    className="pl-10"
                    required
                    maxLength={5}
                    pattern="[0-9]{5}"
                    title="Introduce un codigo postal valido de 5 digitos"
                  />
                </div>
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                No tienes cuenta?{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode("signup")}>
                  Crear cuenta
                </button>
              </>
            ) : (
              <>
                Ya tienes cuenta?{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode("login")}>
                  Iniciar sesion
                </button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
