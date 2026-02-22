"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mail, Lock, ShieldCheck, ArrowLeft } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setTimeout(() => {
      setLoading(false)
      router.push("/admin/school")
    }, 1200)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="mx-auto w-full max-w-md px-4 py-10 lg:px-8">
          <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <Card className="border-border">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="mt-2 text-2xl text-foreground">Panel Colegio / AMPA</CardTitle>
              <CardDescription className="leading-relaxed">
                Accede al panel de administracion de tu centro educativo para gestionar anuncios, donaciones y miembros.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email del administrador</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="admin@colegio.es" className="pl-10" required />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Contrasena</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="********" className="pl-10" required />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Acceder al panel
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Tu centro aun no esta registrado?{" "}
                    <Link href="/register-school" className="font-medium text-primary hover:underline">
                      Solicitar acceso
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
