import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import JsonLd from "@/components/seo/json-ld";
import { categoryColors, getPostBySlug, posts } from "@/lib/blog-data";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import {
  createPublicMetadata,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Guía no encontrada",
      robots: { index: false, follow: true },
    };
  }

  const metadata = createPublicMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
  });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.publishedAt,
      authors: [SITE_NAME],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const colorClass =
    categoryColors[post.category] ?? "bg-primary text-primary-foreground";
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    inLanguage: "es-ES",
    mainEntityOfPage: canonicalUrl,
    image: [`${SITE_URL}${DEFAULT_OG_IMAGE}`],
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/wetudy-logo-512.png`,
      },
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={articleJsonLd} />
      <Navbar {...navbarData} />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a las guías
          </Link>

          <Badge className={`mt-6 block w-fit rounded-md text-xs ${colorClass}`}>
            {post.category}
          </Badge>

          <h1 className="mt-4 text-balance text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {post.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {post.readingTime}
            </span>
          </div>

          <div className="my-8 border-t border-border" />

          <div className="space-y-5 text-base leading-8 text-foreground/90">
            {post.content.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <section className="mt-10 rounded-3xl border bg-muted/30 p-6">
            <h2 className="text-xl font-bold">Busca antes de comprar nuevo</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Consulta material disponible o publica lo que tu familia ya no necesita.
              La entrega y el pago se acuerdan directamente entre las partes.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/marketplace">Buscar material</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/vende-tus-libros">Vender o donar libros</Link>
              </Button>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
