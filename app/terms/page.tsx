import Link from "next/link"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <Button asChild variant="ghost" className="-ml-3 mb-6">
          <Link href="/">Volver a Wetudy</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Términos de uso</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última actualización: 18 de septiembre de 2026.</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold">Qué ofrece Wetudy</h2>
            <p className="mt-2">Wetudy facilita la publicación y búsqueda de material escolar, el contacto por chat, el registro de acuerdos y herramientas de valoración, soporte y reporte.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Acuerdos entre usuarios</h2>
            <p className="mt-2">La entrega y el pago se acuerdan directamente entre las partes. Wetudy no procesa el pago ni organiza el envío dentro del flujo de lanzamiento actual.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Publicaciones</h2>
            <p className="mt-2">Quien publica debe describir el artículo de forma razonablemente fiel, utilizar fotos del artículo real y no publicar contenido ilegal, engañoso o que infrinja derechos de terceros.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Seguridad y convivencia</h2>
            <p className="mt-2">Los usuarios deben utilizar el chat y las herramientas de la plataforma de forma respetuosa. Wetudy puede revisar reportes y limitar o retirar contenido cuando sea necesario para proteger el servicio y su comunidad.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Centros educativos</h2>
            <p className="mt-2">La vinculación o alta de un centro sirve como referencia comunitaria. Las nuevas solicitudes de centro están sujetas a revisión antes de su activación.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Contacto y soporte</h2>
            <p className="mt-2">Para dudas sobre el servicio utiliza el <Link className="font-medium text-primary hover:underline" href="/help">centro de ayuda</Link>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
