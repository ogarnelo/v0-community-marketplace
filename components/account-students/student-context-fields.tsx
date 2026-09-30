"use client";

import { useMemo, useState } from "react";
import { Check, KeyRound, Loader2, School, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type StudentContextSchoolOption = {
  id: string;
  name: string;
  city: string | null;
  postal_code?: string | null;
};

export default function StudentContextFields({
  showAlias,
  alias,
  onAliasChange,
  schoolId,
  onSchoolIdChange,
  gradeLevel,
  onGradeLevelChange,
  schools,
  gradeLevels,
  disabled = false,
}: {
  showAlias: boolean;
  alias: string;
  onAliasChange: (value: string) => void;
  schoolId: string;
  onSchoolIdChange: (value: string) => void;
  gradeLevel: string;
  onGradeLevelChange: (value: string) => void;
  schools: StudentContextSchoolOption[];
  gradeLevels: string[];
  disabled?: boolean;
}) {
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolPopoverOpen, setSchoolPopoverOpen] = useState(false);
  const [schoolAccessCode, setSchoolAccessCode] = useState("");
  const [accessCodeLoading, setAccessCodeLoading] = useState(false);
  const [resolvedSchool, setResolvedSchool] = useState<StudentContextSchoolOption | null>(null);
  const [codeMessage, setCodeMessage] = useState("");
  const [codeError, setCodeError] = useState("");

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();
    if (!query) return schools;

    return schools.filter(
      (school) =>
        school.name.toLowerCase().includes(query) ||
        (school.city || "").toLowerCase().includes(query) ||
        (school.postal_code || "").toLowerCase().includes(query)
    );
  }, [schools, schoolSearch]);

  const selectedSchool =
    (schoolId ? schools.find((school) => school.id === schoolId) : null) ||
    (resolvedSchool?.id === schoolId ? resolvedSchool : null);

  async function applySchoolAccessCode() {
    const normalizedCode = schoolAccessCode.trim().toUpperCase();

    setCodeMessage("");
    setCodeError("");

    if (!normalizedCode) {
      setCodeError("Introduce un código de centro para validarlo.");
      return;
    }

    setAccessCodeLoading(true);

    try {
      const response = await fetch("/api/schools/resolve-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });

      const payload = (await response.json().catch(() => null)) as {
        school?: StudentContextSchoolOption;
        error?: string;
      } | null;

      if (!response.ok || !payload?.school?.id) {
        throw new Error(
          payload?.error || "Ese código de centro no existe o ya no está activo."
        );
      }

      setResolvedSchool(payload.school);
      onSchoolIdChange(payload.school.id);
      setSchoolSearch("");
      setCodeMessage("Centro aplicado correctamente.");
    } catch (cause: any) {
      setCodeError(
        cause?.message || "No se pudo validar el código del centro."
      );
    } finally {
      setAccessCodeLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {showAlias ? (
        <div className="space-y-2">
          <Label htmlFor="student-context-alias">
            Nombre o alias{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="student-context-alias"
            value={alias}
            onChange={(event) => onAliasChange(event.target.value.slice(0, 80))}
            placeholder="Ej. Ana, Mayor, ESO…"
            autoComplete="off"
            disabled={disabled}
            className="text-base sm:text-sm"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Centro educativo</Label>
        <div className="flex items-center gap-2">
          <Popover open={schoolPopoverOpen} onOpenChange={setSchoolPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-0 flex-1 justify-between px-3 text-base font-normal sm:text-sm"
                disabled={disabled}
              >
                <span className="truncate text-left">
                  {selectedSchool
                    ? `${selectedSchool.name}${selectedSchool.city ? ` · ${selectedSchool.city}` : ""}`
                    : "Selecciona un centro"}
                </span>
                <School className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[min(420px,calc(100vw-2rem))] p-3"
              align="start"
            >
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={schoolSearch}
                    onChange={(event) => setSchoolSearch(event.target.value)}
                    className="pl-9 text-base sm:text-sm"
                    placeholder="Busca por nombre, ciudad o CP"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {filteredSchools.length > 0 ? (
                    filteredSchools.map((school) => (
                      <button
                        key={school.id}
                        type="button"
                        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted"
                        onClick={() => {
                          onSchoolIdChange(school.id);
                          setResolvedSchool(null);
                          setSchoolPopoverOpen(false);
                          setSchoolSearch("");
                          setCodeMessage("");
                          setCodeError("");
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{school.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[school.city, school.postal_code]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {schoolId === school.id ? (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      No hemos encontrado centros con esa búsqueda.
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {schoolId ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label="Quitar centro educativo"
              title="Quitar centro educativo"
              disabled={disabled}
              onClick={() => {
                onSchoolIdChange("");
                setResolvedSchool(null);
                setSchoolSearch("");
                setSchoolAccessCode("");
                setCodeMessage("");
                setCodeError("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          Puedes dejar este campo vacío y guardar para no pertenecer a ningún centro.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-context-school-code">Código de centro</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="student-context-school-code"
              value={schoolAccessCode}
              onChange={(event) =>
                setSchoolAccessCode(event.target.value.toUpperCase())
              }
              className="h-11 pl-9 text-base uppercase sm:text-sm"
              placeholder="Introduce un código"
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            onClick={() => void applySchoolAccessCode()}
            disabled={disabled || accessCodeLoading}
          >
            {accessCodeLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Aplicar
          </Button>
        </div>
        {codeMessage ? (
          <p className="text-xs text-emerald-600">{codeMessage}</p>
        ) : null}
        {codeError ? (
          <p className="text-xs text-destructive">{codeError}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Curso</Label>
        <Select
          value={gradeLevel || undefined}
          onValueChange={onGradeLevelChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-11 w-full text-base sm:text-sm">
            <SelectValue placeholder="Selecciona un curso" />
          </SelectTrigger>
          <SelectContent>
            {gradeLevels.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
