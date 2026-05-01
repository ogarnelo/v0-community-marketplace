"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const GRADE_LEVELS = [
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

const CATEGORIES = [
  "Libros",
  "Uniformes",
  "Material escolar",
  "Calculadoras",
  "Tecnología",
  "Apuntes",
  "Otros",
];

const LOOKING_FOR = [
  "Comprar libros",
  "Comprar uniforme",
  "Encontrar material barato",
  "Solicitar donaciones",
  "Seguir negocios locales",
];

const SELLING_INTENT = [
  "Vender libros usados",
  "Vender uniformes",
  "Donar material",
  "Publicar productos de negocio",
];

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

export default function MarketplacePreferencesForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [roleContext, setRoleContext] = useState("family");
  const [preferredGradeLevel, setPreferredGradeLevel] = useState("");
  const [preferredCategories, setPreferredCategories] = useState<string[]>(["Libros"]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [sellingIntent, setSellingIntent] = useState<string[]>([]);
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(
    () => preferredGradeLevel || preferredCategories.length > 0 || lookingFor.length > 0 || sellingIntent.length > 0,
    [lookingFor.length, preferredCategories.length, preferredGradeLevel, sellingIntent.length]
  );

  const toggle = (value: string, list: string[], setter: (value: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");

        if (!canSubmit) {
          setError("Elige al menos una preferencia para personalizar Wetudy.");
          return;
        }

        startTransition(async () => {
          const response = await fetch("/api/preferences/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roleContext,
              preferredGradeLevel,
              preferredCategories,
              lookingFor,
              sellingIntent,
              postalCode,
              city,
            }),
          });

          const result = await response.json().catch(() => null);

          if (!response.ok) {
            setError(result?.error || "No se pudieron guardar tus preferencias.");
            return;
          }

          router.push("/marketplace");
          router.refresh();
        });
      }}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">¿Cómo vas a usar Wetudy?</h2>
        <div className="flex flex-wrap gap-2">
          {[
            ["family", "Familia"],
            ["student", "Estudiante"],
            ["business", "Negocio local"],
          ].map(([value, label]) => (
            <TogglePill
              key={value}
              label={label}
              active={roleContext === value}
              onClick={() => setRoleContext(value)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Curso o etapa principal</h2>
        <select
          value={preferredGradeLevel}
          onChange={(event) => setPreferredGradeLevel(event.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">Elegir curso</option>
          {GRADE_LEVELS.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Categorías que te interesan</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <TogglePill
              key={category}
              label={category}
              active={preferredCategories.includes(category)}
              onClick={() => toggle(category, preferredCategories, setPreferredCategories)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Qué quieres encontrar</h2>
        <div className="flex flex-wrap gap-2">
          {LOOKING_FOR.map((item) => (
            <TogglePill
              key={item}
              label={item}
              active={lookingFor.includes(item)}
              onClick={() => toggle(item, lookingFor, setLookingFor)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Qué podrías publicar</h2>
        <div className="flex flex-wrap gap-2">
          {SELLING_INTENT.map((item) => (
            <TogglePill
              key={item}
              label={item}
              active={sellingIntent.includes(item)}
              onClick={() => toggle(item, sellingIntent, setSellingIntent)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Código postal</label>
          <input
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Ej. 28001"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Ciudad</label>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Ej. Madrid"
          />
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar y explorar"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/marketplace")}>
          Saltar por ahora
        </Button>
      </div>
    </form>
  );
}
