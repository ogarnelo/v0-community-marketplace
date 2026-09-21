import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Leaf, Cpu, PiggyBank, Clock } from "lucide-react";
import { posts, categoryColors } from "@/lib/blog-data";

const topics = [
  {
    icon: BookOpen,
    title: "Vuelta al cole",
    description:
      "Ideas para preparar el curso, revisar listas y reutilizar material antes de comprar.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Leaf,
    title: "Sostenibilidad",
    description:
      "Ideas para alargar la vida útil de libros, uniformes y otros materiales escolares.",
    color: "bg-[#7EBA28]/10 text-[#5a9010]",
  },
  {
    icon: Cpu,
    title: "Tecnología educativa",
    description:
      "Criterios para elegir herramientas digitales de organización y estudio.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: PiggyBank,
    title: "Ahorro familiar",
    description:
      "Formas prácticas de planificar compras y aprovechar material que todavía sirve.",
    color: "bg-[#7EBA28]/10 text-[#5a9010]",
  },
];

export function BlogPageClient() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <div className="text-center">
        <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
          Blog
        </Badge>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Guías y consejos sobre material escolar
        </h1>
        <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Todo lo que necesitas saber sobre ahorro escolar, sostenibilidad y
          comunidad educativa.
        </p>
      </div>

      <Card className="mt-10 border-border bg-primary/5">
        <CardContent className="p-6 text-center sm:p-8">
          <h2 className="text-xl font-bold text-foreground">
            Guías útiles para comprar menos y reutilizar más
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Publicamos contenido práctico sobre libros usados, uniformes, organización escolar y reutilización, con recomendaciones claras y útiles para las familias.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild><Link href="/marketplace">Buscar material</Link></Button>
            <Button asChild variant="outline"><Link href="/como-funciona">Cómo funciona Wetudy</Link></Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12">
        <h2 className="text-xl font-bold text-foreground">Temas populares</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topics.map((t) => (
            <Card
              key={t.title}
              className="border-border transition-shadow duration-200 hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.color}`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold text-foreground">Últimos artículos</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <Card className="group h-full overflow-hidden border-border transition-shadow duration-200 hover:shadow-lg">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <div className="flex h-full items-center justify-center">
                    <span className="select-none font-mono text-3xl text-muted-foreground/15">
                      {post.category.charAt(0)}
                    </span>
                  </div>
                  <Badge
                    className={`absolute left-3 top-3 rounded-md text-[10px] ${categoryColors[post.category] ?? "bg-primary text-primary-foreground"
                      }`}
                  >
                    {post.category}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <h3 className="line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                    {post.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {post.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{post.date}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readingTime}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}