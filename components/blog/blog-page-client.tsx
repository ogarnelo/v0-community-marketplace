"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Leaf, ListChecks, PiggyBank, Clock } from "lucide-react";
import { posts, categoryColors } from "@/lib/blog-data";

const topics = [
  {
    icon: BookOpen,
    title: "Vuelta al cole",
    description: "Listas y consejos para preparar libros y material sin compras innecesarias.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Leaf,
    title: "Sostenibilidad",
    description: "Ideas prácticas para alargar la vida útil de libros, uniformes y otros materiales.",
    color: "bg-[#7EBA28]/10 text-[#5a9010]",
  },
  {
    icon: ListChecks,
    title: "Organización",
    description: "Guías sencillas para organizar el estudio, el material y los acuerdos entre familias.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: PiggyBank,
    title: "Ahorro familiar",
    description: "Cómo reutilizar mejor antes de comprar material escolar nuevo.",
    color: "bg-[#7EBA28]/10 text-[#5a9010]",
  },
];

export function BlogPageClient() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <div className="text-center">
        <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
          Guías Wetudy
        </Badge>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ideas para reutilizar mejor el material escolar
        </h1>
        <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Recursos prácticos sobre libros usados, uniformes, organización y consumo
          responsable. Evitamos publicar cifras de impacto que no podamos respaldar.
        </p>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold text-foreground">Temas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <Card key={topic.title} className="border-border">
                <CardContent className="p-5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${topic.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground">{topic.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {topic.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold text-foreground">Guías recientes</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <Card className="group h-full overflow-hidden border-border transition-shadow duration-200 hover:shadow-lg">
                <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-muted">
                  <span className="select-none font-mono text-4xl text-muted-foreground/15">
                    {post.category.charAt(0)}
                  </span>
                  <Badge
                    className={`absolute left-3 top-3 rounded-md text-[10px] ${
                      categoryColors[post.category] ?? "bg-primary text-primary-foreground"
                    }`}
                  >
                    {post.category}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <h3 className="line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                    {post.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
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
