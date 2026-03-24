"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Leaf, Cpu, PiggyBank, CheckCircle2, Clock } from "lucide-react";
import { posts, categoryColors } from "@/lib/blog-data";

const topics = [
  {
    icon: BookOpen,
    title: "Vuelta al cole",
    description:
      "Consejos para preparar la vuelta al cole ahorrando dinero y cuidando el planeta.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Leaf,
    title: "Sostenibilidad",
    description:
      "Ideas para una vida escolar mas sostenible y respetuosa con el medio ambiente.",
    color: "bg-[#7EBA28]/10 text-[#5a9010]",
  },
  {
    icon: Cpu,
    title: "Tecnologia educativa",
    description:
      "Las mejores herramientas tecnologicas para complementar la educacion de tus hijos.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: PiggyBank,
    title: "Ahorro familiar",
    description:
      "Estrategias para reducir el gasto escolar sin renunciar a la calidad educativa.",
    color: "bg-[#7EBA28]/10 text-[#5a9010]",
  },
];

export function BlogPageClient() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribed(true);
    setEmail("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <div className="text-center">
        <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
          Blog
        </Badge>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Noticias, consejos y recursos educativos
        </h1>
        <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Todo lo que necesitas saber sobre ahorro escolar, sostenibilidad y
          comunidad educativa.
        </p>
      </div>

      <Card className="mt-10 border-border bg-primary/5">
        <CardContent className="flex flex-col items-center p-8 text-center">
          {subscribed ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-[#7EBA28]" />
              <p className="font-semibold text-foreground">
                Te has suscrito correctamente
              </p>
              <p className="text-sm text-muted-foreground">
                Recibiras nuestras novedades en tu bandeja de entrada.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground">
                Suscribete a nuestra newsletter
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recibe consejos de ahorro y sostenibilidad escolar directamente en tu
                email.
              </p>
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

      <div className="mt-12">
        <h2 className="text-xl font-bold text-foreground">Temas populares</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topics.map((t) => (
            <Card
              key={t.title}
              className="cursor-pointer border-border transition-shadow duration-200 hover:shadow-md"
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
        <h2 className="text-xl font-bold text-foreground">Ultimos articulos</h2>
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