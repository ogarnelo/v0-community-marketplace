"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Clock, Calendar, CheckCircle2 } from "lucide-react"
import { getPostBySlug, categoryColors } from "@/lib/blog-data"

export default function BlogPostPage() {
  const params = useParams()
  const slug = typeof params.slug === "string" ? params.slug : ""
  const post = getPostBySlug(slug)

  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    setSubscribed(true)
    setEmail("")
  }

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-2xl font-bold text-foreground">Articulo no encontrado</h1>
            <p className="mt-2 text-muted-foreground">El articulo que buscas no existe o ha sido eliminado.</p>
            <Link href="/blog" className="mt-6 inline-block">
              <Button variant="outline">Volver al blog</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const colorClass = categoryColors[post.category] ?? "bg-primary text-primary-foreground"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Hero image area */}
        <div className="relative w-full bg-muted">
          <div className="mx-auto max-w-4xl aspect-[21/9] flex items-center justify-center">
            <span className="text-6xl text-muted-foreground/10 font-mono select-none">{post.category.charAt(0)}</span>
          </div>
          <Badge className={`absolute left-1/2 -translate-x-1/2 bottom-4 text-xs rounded-md ${colorClass}`}>
            {post.category}
          </Badge>
        </div>

        <article className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al blog
          </Link>

          {/* Title */}
          <h1 className="mt-6 text-2xl font-bold text-foreground leading-tight sm:text-3xl text-balance">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {post.readingTime}
            </span>
          </div>

          {/* Separator */}
          <div className="my-6 border-t border-border" />

          {/* Content */}
          <div className="flex flex-col gap-5">
            {post.content.map((paragraph, i) => (
              <p key={i} className="text-foreground/90 leading-[1.75] text-[15px]">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Separator */}
          <div className="my-10 border-t border-border" />

          {/* Newsletter CTA */}
          <Card className="border-border bg-primary/5">
            <CardContent className="flex flex-col items-center p-8 text-center">
              {subscribed ? (
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-10 w-10 text-[#7EBA28]" />
                  <p className="font-semibold text-foreground">Te has suscrito correctamente</p>
                  <p className="text-sm text-muted-foreground">Recibiras nuestras novedades en tu bandeja de entrada.</p>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-foreground">Te ha gustado este articulo?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Suscribete para recibir mas consejos de ahorro y sostenibilidad escolar.</p>
                  <form onSubmit={handleSubscribe} className="mt-4 flex w-full max-w-md gap-2">
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="flex-1 bg-card"
                    />
                    <Button type="submit">Suscribirse</Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          {/* Back to blog */}
          <div className="mt-8 flex justify-center">
            <Link href="/blog">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Ver todos los articulos
              </Button>
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
