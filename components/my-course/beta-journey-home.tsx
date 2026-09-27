"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, PackagePlus, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StoredState = {
  learners?: Array<{ id: string }>;
  needs?: Array<{ id: string }>;
};

const STORAGE_KEY = "wetudy_my_course_beta_v0";

export default function BetaflujoHome() {
  const [configured, setConfigured] = useState(false);
  const [learnerCount, setLearnerCount] = useState(0);
  const [needCount, setNeedCount] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredState;
      const learners = Array.isArray(parsed.learners) ? parsed.learners : [];
      const needs = Array.isArray(parsed.needs) ? parsed.needs : [];
      setLearnerCount(learners.length);
      setNeedCount(needs.length);
      setConfigured(learners.length > 0);
    } catch {
      // No bloquear el flujo si el estado local está corrupto.
    }
  }, []);

  return (
    <div className="min-h-screen bg-muted/20">
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-6 rounded-3xl border bg-background p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">flujo Beta</Badge>
            <Badge variant="outline">Solo Preview</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            ¿Qué quieres resolver hoy?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Elige lo que quieres hacer y Wetudy te lleva directamente al sitio adecuado.
          </p>
        </div>

        {configured ? (
          <Card className="mb-5 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="font-semibold">Continúa preparando el curso</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {learnerCount} curso{learnerCount === 1 ? "" : "s"} · {needCount} necesidad{needCount === 1 ? "" : "es"} guardada{needCount === 1 ? "" : "s"} en este navegador.
                </p>
              </div>
              <Button asChild>
                <Link href="/beta/mi-curso">Continuar Mi curso</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/beta/mi-curso" className="group">
            <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-lg font-semibold">Preparar el curso</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Organiza lo que necesitarán tus hijos y deja que Wetudy compruebe qué puede resolver ya.
                </p>
                <p className="mt-4 text-sm font-medium text-primary">
                  {configured ? "Ir a Mi curso →" : "Empezar →"}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/marketplace" className="group">
            <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/10">
                  <Search className="h-5 w-5 text-secondary" />
                </div>
                <p className="mt-4 text-lg font-semibold">Encontrar algo concreto</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Si ya sabes exactamente qué buscas, entra directamente al marketplace.
                </p>
                <p className="mt-4 text-sm font-medium text-primary">Buscar ahora →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/marketplace/new" className="group">
            <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                  <PackagePlus className="h-5 w-5 text-foreground" />
                </div>
                <p className="mt-4 text-lg font-semibold">Vender o donar</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Da salida al material que ya no utilizáis usando el flujo actual de publicación.
                </p>
                <p className="mt-4 text-sm font-medium text-primary">Publicar material →</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-6 rounded-3xl border border-dashed bg-background p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">¿No sabes por dónde empezar?</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Si estás preparando varias cosas del curso, entra en Mi curso. Si buscas una sola cosa, ve al Marketplace.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
