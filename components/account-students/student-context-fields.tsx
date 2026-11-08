"use client";

import { useEffect, useMemo, useState } from "react";
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

type DirectorySchoolOption = {
  official_code: string;
  name: string;
  municipality: string;
  province: string;
  postal_code: string;
};

export default function StudentContextFields({
  showAlias,
  alias,
  onAliasChange,
  schoolId,
  onSchoolIdChange,
  directorySchoolCode,
  onDirectorySchoolCodeChange,
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
  directorySchoolCode: string;
  onDirectorySchoolCodeChange: (value: string) => void;
  gradeLevel: string;
  onGradeLevelChange: (value: string) => void;
  schools: StudentContextSchoolOption[];
  gradeLevels: string[];
  disabled?: boolean;
}) {
  const [schoolSearch, setSchoolSearch] = useState("");
  const [directoryResults, setDirectoryResults] = useState<DirectorySchoolOption[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [selectedDirectory, setSelectedDirectory] = useState<DirectorySchoolOption | null>(null);
  const [schoolPopoverOpen, setSchoolPopoverOpen] = useState(false);
  const [schoolAccessCode, setSchoolAccessCode] = useState("");
  const [accessCodeLoading, setAccessCodeLoading] = useState(false);
  const [resolvedSchool, setResolvedSchool] = useState<StudentContextSchoolOption | null>(null);
  const [codeMessage, setCodeMessage] = useState("");
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    const query = schoolSearch.trim();
    if (!schoolPopoverOpen || query.length < 3) {
      setDirectoryResults([]);
      setDirectoryLoading(false);
      setDirectoryError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDirectoryLoading(true);
      setDirectoryError("");
      try {
        const response = await fetch(
          "/api/account/schools/directory?q=" + encodeURIComponent(query),
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) throw new Error("No se pudo consultar el directorio.");
        const data = await response.json();
        if (!controller.signal.aborted) setDirectoryResults(data.centres || []);
      } catch {
        if (!controller.signal.aborted) {
          setDirectoryResults([]);
          setDirectoryError("No se pudo completar la búsqueda. Inténtalo de nuevo.");
        }
      } finally {
        if (!controller.signal.aborted) setDirectoryLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [schoolPopoverOpen, schoolSearch]);

  useEffect(() => {
    if (!directorySchoolCode || selectedDirectory?.official_code === directorySchoolCode) return;
    const controller = new AbortController();
    void fetch("/api/account/schools/directory?code=" + encodeURIComponent(directorySchoolCode), {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      if (!controller.signal.aborted) setSelectedDirectory(payload.centre || null);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [directorySchoolCode, selectedDirectory?.official_code]);

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();
    if (!query) return schools.slice(0, 20);

    return schools.filter(
      (school) =>
        school.name.toLowerCase().includes(query) ||
        (school.city || "").toLowerCase().includes(query) ||
        (school.postal_code || "").toLowerCase().includes(query)
    ).slice(0, 20);
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
      onDirectorySchoolCodeChange("");
      setSelectedDirectory(null);
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
                    : directorySchoolCode
                      ? selectedDirectory?.official_code === directorySchoolCode
                        ? `${selectedDirectory.name} · ${selectedDirectory.municipality}`
                        : `Centro del directorio · ${directorySchoolCode}`
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
                          onDirectorySchoolCodeChange("");
                          setSelectedDirectory(null);
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
                              .join(" · ")} · Comunidad activa
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
                <div className="border-t pt-2">
                  <p className="mb-1 px-3 text-xs font-semibold text-muted-foreground">
                    Directorio nacional (no implica comunidad activa)
                  </p>
                  {schoolSearch.trim().length < 3 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Escribe al menos 3 caracteres para buscar entre los centros de España.
                    </p>
                  ) : directoryLoading ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Buscando colegios…</p>
                  ) : directoryError ? (
                    <p className="px-3 py-2 text-xs text-destructive">{directoryError}</p>
                  ) : directoryResults.length ? (
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {directoryResults.map((centre) => (
                        <button
                          key={centre.official_code}
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted"
                          onClick={() => {
                            onDirectorySchoolCodeChange(centre.official_code);
                            onSchoolIdChange("");
                            setSelectedDirectory(centre);
                            setResolvedSchool(null);
                            setSchoolPopoverOpen(false);
                            setSchoolSearch("");
                            setCodeMessage("");
                            setCodeError("");
                          }}
                        >
                          <p className="truncate font-medium">{centre.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {centre.municipality} · {centre.province} · CP {centre.postal_code} · {centre.official_code}
                          </p>
                        </button>
                      ))}
                      {directoryResults.length === 20 ? (
                        <p className="px-3 text-xs text-muted-foreground">Afina la búsqueda para ver más resultados.</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No hay coincidencias. Comprueba el nombre o prueba con el código postal.
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {schoolId || directorySchoolCode ? (
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
                onDirectorySchoolCodeChange("");
                setSelectedDirectory(null);
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
          Puedes identificar tu colegio aunque todavía no tenga comunidad Wetudy. Elegirlo no activa el centro ni concede permisos. El campo es opcional.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-context-school-code">Código de acceso de comunidad (si lo tienes)</Label>
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
