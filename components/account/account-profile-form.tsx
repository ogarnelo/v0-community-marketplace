"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  KeyRound,
  BriefcaseBusiness,
  Globe,
  FileText,
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
import { getUserTypeLabel } from "@/lib/marketplace/formatters";

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
  postal_code: string | null;
};

type AccountProfileFormProps = {
  initialFullName: string;
  initialUserType: "parent" | "student" | "business" | "";
  initialGradeLevel: string;
  initialPostalCode: string;
  initialSchoolId: string;
  initialBusinessName: string;
  initialBusinessDescription: string;
  initialWebsite: string;
  email: string;
  gradeLevelOptions: string[];
  schoolOptions: SchoolOption[];
};

type SchoolAccessCodeResult = {
  school_id: string;
  schools: {
    id: string;
    name: string;
    city: string | null;
    postal_code: string | null;
  } | null;
};

export default function AccountProfileForm({
  initialFullName,
  initialUserType,
  initialGradeLevel,
  initialPostalCode,
  initialSchoolId,
  initialBusinessName,
  initialBusinessDescription,
  initialWebsite,
  email,
  gradeLevelOptions,
  schoolOptions,
}: AccountProfileFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialFullName);
  const [userType, setUserType] = useState<"parent" | "student" | "business" | "">(
    initialUserType
  );
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [selectedSchoolId, setSelectedSchoolId] = useState(initialSchoolId);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolPopoverOpen, setSchoolPopoverOpen] = useState(false);
  const [schoolAccessCode, setSchoolAccessCode] = useState("");
  const [accessCodeLoading, setAccessCodeLoading] = useState(false);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [businessDescription, setBusinessDescription] = useState(initialBusinessDescription);
  const [website, setWebsite] = useState(initialWebsite);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isBusiness = userType === "business";

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();

    if (!query) return schoolOptions;

    return schoolOptions.filter(
      (school) =>
        school.name.toLowerCase().includes(query) ||
        (school.city || "").toLowerCase().includes(query) ||
        (school.postal_code || "").toLowerCase().includes(query)
    );
  }, [schoolOptions, schoolSearch]);

  const selectedSchool =
    selectedSchoolId && selectedSchoolId.trim().length > 0
      ? schoolOptions.find((school) => school.id === selectedSchoolId) || null
      : null;

  const currentUserTypeLabel = userType
    ? getUserTypeLabel(userType)
    : "Selecciona un tipo de usuario";

  const normalizedGradeLevelOptions = useMemo(
    () => Array.from(new Set(gradeLevelOptions)).filter(Boolean),
    [gradeLevelOptions]
  );

  const applySchoolAccessCode = async () => {
    setSuccessMessage("");
    setErrorMessage("");

    const normalizedCode = schoolAccessCode.trim().toUpperCase();

    if (!normalizedCode) {
      setErrorMessage("Introduce un código de centro para validarlo.");
      return;
    }

    setAccessCodeLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("school_access_codes")
        .select("school_id, schools(id, name, city, postal_code)")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const result = (data as SchoolAccessCodeResult | null) ?? null;

      if (!result?.schools?.id) {
        throw new Error("Ese código de centro no existe o ya no está activo.");
      }

      setSelectedSchoolId(result.schools.id);
      setSuccessMessage(
        `Código aplicado correctamente. Nuevo centro: ${result.schools.name}.`
      );
    } catch (error: any) {
      console.error("Error validando código de centro:", error);
      setErrorMessage(
        error?.message ||
        error?.details ||
        "No se pudo validar el código del centro."
      );
    } finally {
      setAccessCodeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!userType) {
      setErrorMessage("Debes seleccionar un tipo de usuario antes de guardar.");
      return;
    }

    if (isBusiness && !businessName.trim()) {
      setErrorMessage("Añade el nombre comercial para activar el perfil profesional.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth");
        return;
      }

      const normalizedPostalCode = postalCode.trim();
      const normalizedSchoolId = selectedSchoolId.trim();
      const selectedSchoolName =
        normalizedSchoolId.length > 0
          ? schoolOptions.find((school) => school.id === normalizedSchoolId)?.name ||
          null
          : null;

      const payload = {
        id: user.id,
        full_name: fullName.trim() || null,
        user_type: userType,
        grade_level: isBusiness ? null : gradeLevel.trim() || null,
        postal_code: normalizedPostalCode || null,
        school_id: normalizedSchoolId || null,
        business_name: isBusiness ? businessName.trim() || null : null,
        business_description: isBusiness ? businessDescription.trim() || null : null,
        website: isBusiness ? website.trim() || null : null,
      };

      const { error: profileError } = await supabase.from("profiles").upsert(payload, {
        onConflict: "id",
      });

      if (profileError) {
        throw profileError;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim() || null,
          user_type: userType,
          grade_level: isBusiness ? null : gradeLevel.trim() || null,
          postal_code: normalizedPostalCode || null,
          school_name: selectedSchoolName,
          school_id: normalizedSchoolId || null,
          business_name: isBusiness ? businessName.trim() || null : null,
          business_description: isBusiness ? businessDescription.trim() || null : null,
          website: isBusiness ? website.trim() || null : null,
        },
      });

      if (authError) {
        throw authError;
      }

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
              <p className="text-sm text-muted-foreground">{currentUserTypeLabel}</p>
            </div>

            <div className="rounded-xl border p-4 sm:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <School className="h-4 w-4" />
                Comunidad actual
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedSchool
                  ? `${selectedSchool.name}${selectedSchool.city ? ` · ${selectedSchool.city}` : ""}`
                  : "Sin centro asignado"}
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="fullName">Nombre visible</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre y apellidos o nombre visible"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tipo de usuario</Label>
              <Select
                value={userType || undefined}
                onValueChange={(value) =>
                  setUserType(value as "parent" | "student" | "business")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo de usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Familia / Tutor legal</SelectItem>
                  <SelectItem value="student">Estudiante</SelectItem>
                  <SelectItem value="business">Negocio local</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">Código postal</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="28001"
                inputMode="numeric"
                maxLength={5}
              />
            </div>

            {!isBusiness ? (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Curso / etapa</Label>
                <Select
                  value={gradeLevel || undefined}
                  onValueChange={(value) => setGradeLevel(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona curso o etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {normalizedGradeLevelOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {isBusiness ? (
              <>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="businessName">Nombre del negocio</Label>
                  <div className="relative">
                    <BriefcaseBusiness className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="businessName"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="pl-10"
                      placeholder="Librería Aurora"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="website">Web o Instagram</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="pl-10"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="businessDescription">Descripción profesional</Label>
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="businessDescription"
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      className="min-h-[110px] pl-10"
                      placeholder="Cuéntales qué vendes y por qué tu catálogo es útil para familias y estudiantes."
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Centro educativo</p>
                <p className="text-sm text-muted-foreground">
                  Puedes encontrar tu comunidad por nombre, ciudad o código postal.
                </p>
              </div>

              <Popover open={schoolPopoverOpen} onOpenChange={setSchoolPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="justify-start">
                    <Search className="mr-2 h-4 w-4" />
                    {selectedSchool ? selectedSchool.name : "Buscar centro"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-3" align="start">
                  <div className="space-y-3">
                    <Input
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      placeholder="Buscar por nombre, ciudad o CP"
                    />
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {filteredSchools.length === 0 ? (
                        <p className="px-2 py-4 text-sm text-muted-foreground">
                          No hay centros que coincidan con tu búsqueda.
                        </p>
                      ) : (
                        filteredSchools.map((school) => {
                          const isSelected = school.id === selectedSchoolId;

                          return (
                            <button
                              key={school.id}
                              type="button"
                              onClick={() => {
                                setSelectedSchoolId(school.id);
                                setSchoolPopoverOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition hover:bg-muted"
                            >
                              <div>
                                <p className="text-sm font-medium">{school.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[school.city, school.postal_code].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="schoolAccessCode">Código de acceso del centro</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="schoolAccessCode"
                    value={schoolAccessCode}
                    onChange={(e) => setSchoolAccessCode(e.target.value.toUpperCase())}
                    className="pl-10"
                    placeholder="Ej. MADRID2025"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={applySchoolAccessCode}
                  disabled={accessCodeLoading}
                  className="w-full sm:w-auto"
                >
                  {accessCodeLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Aplicar código
                </Button>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="min-w-40">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
