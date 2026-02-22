"use client"

import { useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, School, CheckCircle2, ArrowLeft } from "lucide-react"

const comunidades = [
  "Andalucia", "Aragon", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y Leon", "Cataluna", "Comunidad Valenciana",
  "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarra", "Pais Vasco", "Ceuta", "Melilla",
]

export default function RegisterSchoolPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1200)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-10 lg:px-8">
          <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          {submitted ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/15">
                  <CheckCircle2 className="h-8 w-8 text-secondary" />
                </div>
                <h2 className="mt-5 text-xl font-bold text-foreground">Solicitud recibida</h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Gracias. Hemos recibido tu solicitud. Te enviaremos el codigo por email.
                </p>
                <Link href="/" className="mt-6">
                  <Button variant="outline">Volver al inicio</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <School className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl text-foreground">Registrar centro educativo</CardTitle>
                <CardDescription className="leading-relaxed">
                  Si tu centro o AMPA aun no tiene codigo de acceso, completa este formulario y nos pondremos en contacto contigo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="schoolName">Nombre del centro *</Label>
                    <Input id="schoolName" placeholder="CEIP San Miguel" required />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="address">Direccion *</Label>
                    <Input id="address" placeholder="Calle de Alcala, 50" required />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="city">Ciudad *</Label>
                      <Input id="city" placeholder="Madrid" required />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="postalCode">Codigo Postal *</Label>
                      <Input id="postalCode" placeholder="28001" required maxLength={5} pattern="[0-9]{5}" title="Introduce un codigo postal valido de 5 digitos" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>C. Autonoma *</Label>
                      <Select required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {comunidades.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email de contacto *</Label>
                    <Input id="email" type="email" placeholder="direccion@colegio.es" required />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone">Telefono (opcional)</Label>
                    <Input id="phone" type="tel" placeholder="912 345 678" />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar solicitud
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
