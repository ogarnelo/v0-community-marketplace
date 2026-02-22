"use client"

import { useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Loader2, HelpCircle, CheckCircle2, ShoppingBag, Gift, ArrowLeft } from "lucide-react"

const marketplaceFAQs = [
  {
    q: "Como publico un anuncio de venta?",
    a: "Accede a tu cuenta, haz clic en 'Publicar anuncio' desde el marketplace o la barra de navegacion. Rellena el formulario con titulo, descripcion, fotos, categoria, estado y precio. Tu anuncio sera visible inmediatamente para los miembros de tu centro.",
  },
  {
    q: "Como funciona el sistema de favoritos?",
    a: "Puedes guardar anuncios que te interesen haciendo clic en el icono de corazon en la tarjeta del producto. Los favoritos se guardan en tu cuenta para que puedas consultarlos mas tarde.",
  },
  {
    q: "Puedo chatear con el vendedor antes de comprar?",
    a: "Si, cada anuncio tiene un boton 'Contactar vendedor' que abre un chat privado entre comprador y vendedor. Ahi podeis acordar precio, punto de encuentro y cualquier detalle sobre el articulo.",
  },
  {
    q: "Como busco articulos cerca de mi?",
    a: "Activa el modo 'Cerca de mi' en el marketplace. Esto amplia la busqueda a centros de tu zona, mostrando la distancia en kilometros a cada anuncio.",
  },
  {
    q: "Que hago si un articulo no coincide con la descripcion?",
    a: "Contacta directamente con el vendedor a traves del chat. Si no llegais a un acuerdo, puedes reportar el anuncio usando el boton de reportar en la pagina del producto. Nuestro equipo revisara el caso.",
  },
]

const donationFAQs = [
  {
    q: "Como funcionan las solicitudes de donacion?",
    a: "Cuando un usuario publica un articulo como donacion, otros miembros del centro pueden solicitar recibirlo. El administrador del centro (AMPA) revisa las solicitudes y decide a quien asignar el articulo, priorizando las familias con mayor necesidad.",
  },
  {
    q: "Quien aprueba las solicitudes de donacion?",
    a: "El administrador del centro educativo o el representante del AMPA revisa y aprueba cada solicitud. Esto garantiza que las donaciones lleguen a quien mas las necesita de forma justa y transparente.",
  },
  {
    q: "Puedo donar material aunque no sea de mi centro?",
    a: "Si, puedes publicar una donacion y esta sera visible para los miembros de tu centro. Si activas el modo 'Cerca de mi', tambien podra ser vista por familias de centros cercanos.",
  },
  {
    q: "Que tipo de material se puede donar?",
    a: "Se puede donar cualquier material escolar en buen estado: libros de texto, uniformes, mochilas, material de escritura, instrumentos musicales, calculadoras, etc. Solo pedimos que el articulo este en condiciones de ser utilizado.",
  },
]

export default function HelpPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1000)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
          <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <HelpCircle className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Centro de ayuda</h1>
            <p className="mt-2 text-muted-foreground">Encuentra respuestas a las preguntas mas frecuentes.</p>
          </div>

          {/* Marketplace FAQs */}
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Marketplace</h2>
            </div>
            <Card className="border-border">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {marketplaceFAQs.map((faq, i) => (
                    <AccordionItem key={i} value={`mp-${i}`} className="px-5">
                      <AccordionTrigger className="text-sm font-medium text-foreground text-left">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* Donation FAQs */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-5 w-5 text-secondary" />
              <h2 className="text-xl font-bold text-foreground">Donaciones</h2>
            </div>
            <Card className="border-border">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {donationFAQs.map((faq, i) => (
                    <AccordionItem key={i} value={`dn-${i}`} className="px-5">
                      <AccordionTrigger className="text-sm font-medium text-foreground text-left">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="mt-10">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">No encuentras lo que buscas?</CardTitle>
                <CardDescription>Escribenos y te responderemos por email lo antes posible.</CardDescription>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15">
                      <CheckCircle2 className="h-7 w-7 text-secondary" />
                    </div>
                    <p className="mt-4 font-semibold text-foreground">Mensaje enviado</p>
                    <p className="mt-1 text-sm text-muted-foreground">Te responderemos por email.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="name">Nombre *</Label>
                        <Input id="name" placeholder="Tu nombre" required />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" type="email" placeholder="tu@email.com" required />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="message">Mensaje *</Label>
                      <Textarea id="message" placeholder="Describe tu consulta..." rows={5} required />
                    </div>
                    <Button type="submit" className="w-fit" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enviar mensaje
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
