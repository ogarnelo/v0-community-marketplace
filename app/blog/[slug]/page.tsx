import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, Clock } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import JsonLd from "@/components/seo/json-ld"
import { categoryColors, getPostBySlug, posts } from "@/lib/blog-data"

const SITE_URL = "https://www.wetudy.com"

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    return {
      title: "Artículo no encontrado",
      robots: { index: false, follow: false },
    }
  }

  const canonical = `${SITE_URL}/blog/${post.slug}`

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      section: post.category,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) notFound()

  const colorClass = categoryColors[post.category] ?? "bg-primary text-primary-foreground"
  const canonical = `${SITE_URL}/blog/${post.slug}`

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    inLanguage: "es-ES",
    mainEntityOfPage: canonical,
    author: {
      "@type": "Organization",
      name: "Wetudy",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Wetudy",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.svg`,
      },
    },
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={articleJsonLd} />
      <Navbar />
      <main className="flex-1">
        <div className="relative w-full border-b bg-gradient-to-br from-primary/10 via-background to-secondary/10">
          <div className="mx-auto flex max-w-4xl items-center justify-center px-4 py-16 sm:py-20">
            <div className="text-center">
              <Badge className={`rounded-md text-xs ${colorClass}`}>{post.category}</Badge>
              <h1 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-bold leading-tight text-foreground sm:text-5xl">
                {post.title}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                {post.description}
              </p>
            </div>
          </div>
        </div>

        <article className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al blog
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {post.readingTime}
            </span>
            {post.updatedAt ? <span>Actualizado el 18 Sep 2026</span> : null}
          </div>

          <div className="my-6 border-t border-border" />

          <div className="flex flex-col gap-5">
            {post.content.map((paragraph, index) => (
              <p key={index} className="text-[15px] leading-[1.8] text-foreground/90">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="my-10 border-t border-border" />

          <Card className="border-border bg-primary/5">
            <CardContent className="p-6 text-center sm:p-8">
              <h2 className="text-xl font-bold text-foreground">
                Busca material escolar que otra familia ya no necesita
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Explora libros, uniformes, mochilas y otros materiales. Contacta por chat y acuerda directamente los detalles.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/marketplace">Buscar material</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/marketplace/new">Publicar anuncio</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </article>
      </main>
      <Footer />
    </div>
  )
}
