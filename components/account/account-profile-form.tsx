"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Save,
  School,
  Mail,
  User2,
  Search,
  Check,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
  postal_code: string | null;
};

type AccountProfileFormProps = {
  initialFullName: string;
  initialUserType: "parent" | "student";
  initialGradeLevel: string;
  initialPostalCode: string;
  initialSchoolId: string;
  email: string;
  gradeLevelOptions: string[];
  schoolOptions: SchoolOption[];
};

function formatUserType(userType: "parent" | "student") {
  return userType === "parent" ? "Familia / Tutor legal" : "Estudiante";
}

export default function AccountProfileForm({
  initialFullName,
  initialUserType,
  initialGradeLevel,
  initialPostalCode,
  initialSchoolId,
  email,
  gradeLevelOptions,
  schoolOptions,
}: AccountProfileFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialFullName);
  const [userType, setUserType] = useState<"parent" | "student">(initialUserType);
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [selectedSchoolId, setSelectedSchoolId] = useState(initialSchoolId);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolPopoverOpen, setSchoolPopoverOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();

    if (!query) return schoolOptions;

    return schoolOptions.filter((school) => {
      return (
        school.name.toLowerCase().includes(query) ||
        (school.city || "").toLowerCase().includes(query) ||
        (school.postal_code || "").toLowerCase().includes(query)
      );
    });
  }, [schoolOptions, schoolSearch]);

  const selectedSchool =
    selectedSchoolId && selectedSchoolId.trim().length > 0
      ? schoolOptions.find((school) => school.id === selectedSchoolId) || null
      : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth");
        return;
      }

      const normalizedFullName = fullName.trim();
      const normalizedGradeLevel = gradeLevel.trim();
      const normalizedPostalCode = postalCode.trim();
      const normalizedSchoolId = selectedSchoolId.trim();

      const selectedSchoolName =
        normalizedSchoolId.length > 0
          ? schoolOptions.find((school) => school.id === normalizedSchoolId)?.name || null
          : null;

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: normalizedFullName || null,
          user_type: userType || null,
          grade_level: normalizedGradeLevel || null,
          postal_code: normalizedPostalCode || null,
          school_id: normalizedSchoolId || null,
        },
        {
          onConflict: "id",
        }
      );

      if (profileError) {
        throw profileError;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: normalizedFullName || null,
          user_type: userType || null,
          grade_level: normalizedGradeLevel || null,
          postal_code: normalizedPostalCode || null,
          school_name: selectedSchoolName,
        },
      });

      if (authError) {
        throw authError;
      }

      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: {
            full_name: normalizedFullName || "Mi cuenta",
            user_type: userType || null,
          },
        })
      );

      setSuccessMessage("Perfil actualizado correctamente.");
      router.refresh();
    } catch (error: any) {
      console.error("Error actualizando perfil:", error);

      setErrorMessage(
        error?.message ||
        error?.error_description ||
        error?.details ||
        "No se pudo guardar el perfil."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar perfil</CardTitle>
        <CardDescription>
          Actualiza tu información visible dentro de Wetudy.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <User2 className="h-4 w-4" />
                Tipo de usuario actual
              </div>
              <p className="text-sm text-muted-foreground">
                {formatUserType(userType)}
              </p>
            </div>

            <div className="rounded-xl border p-4 sm:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <School className="h-4 w-4" />
                Colegio actual
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedSchool
                  ? `${selectedSchool.name}${selectedSchool.city ? ` · ${selectedSchool.city}` : ""}`
                  : schoolOptions.length === 0
                    ? "No hay centros disponibles todavía"
                    : "Sin centro asignado"}
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre y apellidos"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tipo de usuario</Label>
              <Select
                value={userType}
                onValueChange={(value) => setUserType(value as "parent" | "student")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo de usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Familia / Tutor legal</SelectItem>
                  <SelectItem value="student">Estudiante</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Curso / etapa</Label>
              <Select
                value={gradeLevel || "unset"}
                onValueChange={(value) => setGradeLevel(value === "unset" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Sin indicar</SelectItem>
                  {gradeLevelOptions.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Colegio</Label>

              <Popover open={schoolPopoverOpen} onOpenChange={setSchoolPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedSchool
                        ? `${selectedSchool.name}${selectedSchool.city ? ` · ${selectedSchool.city}` : ""}`
                        : schoolOptions.length === 0
                          ? "No hay centros disponibles todavía"
                          : "Selecciona tu centro o déjalo vacío"}
                    </span>
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[360px] p-3" align="start">
                  <div className="space-y-3">
                    <Input
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      placeholder="Buscar por nombre, ciudad o código postal..."
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSchoolId("");
                        setSchoolPopoverOpen(false);
                        setSchoolSearch("");
                      }}
                      className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted"
                    >
                      <span>Sin centro asignado</span>
                      {!selectedSchoolId ? <Check className="h-4 w-4" /> : null}
                    </button>

                    <div className="max-h-64 overflow-y-auto rounded-lg border">
                      {filteredSchools.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground">
                          {schoolOptions.length === 0
                            ? "Todavía no hay centros cargados en la base de datos."
                            : "No se encontraron centros."}
                        </div>
                      ) : (
                        filteredSchools.map((school) => {
                          const isSelected = selectedSchoolId === school.id;

                          return (
                            <button
                              key={school.id}
                              type="button"
                              onClick={() => {
                                setSelectedSchoolId(school.id);
                                setSchoolPopoverOpen(false);
                                setSchoolSearch("");
                              }}
                              className="flex w-full items-center justify-between border-b px-3 py-3 text-left transition last:border-b-0 hover:bg-muted"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {school.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {[school.city, school.postal_code].filter(Boolean).join(" · ")}
                                </p>
                              </div>

                              {isSelected ? (
                                <Check className="ml-3 h-4 w-4 shrink-0" />
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">Código postal</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Ej: 28001"
                maxLength={5}
              />
            </div>
          </div>

          {successMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 rounded-full bg-emerald-600 px-5 hover:bg-emerald-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}