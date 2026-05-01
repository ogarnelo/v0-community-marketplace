"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const GRADES = [
  "Infantil",
  "Primaria",
  "1 ESO",
  "2 ESO",
  "3 ESO",
  "4 ESO",
  "1 Bachillerato",
  "2 Bachillerato",
  "Universidad",
  "Academia",
];

export default function CourseMaterialForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("Libros");
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");

        startTransition(async () => {
          const response = await fetch("/api/course-materials/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              gradeLevel,
              subject,
              isbn,
              category,
            }),
          });

          const result = await response.json().catch(() => null);

          if (!response.ok) {
            setError(result?.error || "No se pudo añadir el material.");
            return;
          }

          setTitle("");
          setGradeLevel("");
          setSubject("");
          setIsbn("");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Título del material</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Ej. Matemáticas 3 ESO"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Curso</label>
          <select
            value={gradeLevel}
            onChange={(event) => setGradeLevel(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Elegir curso</option>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Asignatura</label>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Ej. Matemáticas"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">ISBN</label>
          <input
            value={isbn}
            onChange={(event) => setIsbn(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Opcional"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Categoría</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option>Libros</option>
            <option>Uniformes</option>
            <option>Material escolar</option>
            <option>Tecnología</option>
            <option>Otros</option>
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Añadiendo..." : "Añadir al catálogo"}
      </Button>
    </form>
  );
}
