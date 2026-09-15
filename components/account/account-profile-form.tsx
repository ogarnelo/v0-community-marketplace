"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Save, School, Mail, User2, Search, Check, KeyRound, BriefcaseBusiness, Globe, FileText, MapPin, Phone } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  initialPhone: string;
  initialShippingAddressLine1: string;
  initialShippingAddressLine2: string;
  initialShippingCity: string;
  initialShippingRegion: string;
  initialShippingCountryCode: string;
  email: string;
  gradeLevelOptions: string[];
  schoolOptions: SchoolOption[];
};

type SchoolAccessCodeResult = {
  school_id: string;
  schools: { id: string; name: string; city: string | null; postal_code: string | null } | null;
};

export default function AccountProfileForm(props: AccountProfileFormProps) {
  const {
    initialFullName,
    initialUserType,
    initialGradeLevel,
    initialPostalCode,
    initialSchoolId,
    initialBusinessName,
    initialBusinessDescription,
    initialWebsite,
    initialPhone,
    initialShippingAddressLine1,
    initialShippingAddressLine2,
    initialShippingCity,
    initialShippingRegion,
    initialShippingCountryCode,
    email,
    gradeLevelOptions,
    schoolOptions,
  } = props;

  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [userType, setUserType] = useState<"parent" | "student" | "business" | "">(initialUserType);
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
  const [phone, setPhone] = useState(initialPhone);
  const [contactAddress, setContactAddress] = useState(initialShippingAddressLine1);
  const [contactNotes, setContactNotes] = useState(initialShippingAddressLine2);
  const [contactCity, setContactCity] = useState(initialShippingCity);
  const [contactRegion, setContactRegion] = useState(initialShippingRegion);
  const [countryCode, setCountryCode] = useState(initialShippingCountryCode || "ES");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isBusiness = userType === "business";

  const normalizedGradeLevelOptions = useMemo(() => Array.from(new Set(gradeLevelOptions)).filter(Boolean), [gradeLevelOptions]);

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

  const selectedSchool = selectedSchoolId ? schoolOptions.find((school) => school.id === selectedSchoolId) || null : null;
  const currentUserTypeLabel = userType ? getUserTypeLabel(userType) : "Selecciona un tipo de usuario";

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
      if (error) throw error;
      const result = (data as SchoolAccessCodeResult | null) ?? null;
      if (!result?.schools?.id) throw new Error("Ese código de centro no existe o ya no está activo.");
      setSelectedSchoolId(result.schools.id);
      setSuccessMessage(`Código aplicado correctamente. Nuevo centro: ${result.schools.name}.`);
    } catch (error: any) {
      setErrorMessage(error?.message || error?.details || "No se pudo validar el código del centro.");
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/auth");
        return;
      }

      const normalizedPostalCode = postalCode.trim();
      const normalizedSchoolId = selectedSchoolId.trim();
      const selectedSchoolName = normalizedSchoolId.length > 0 ? schoolOptions.find((school) => school.id === normalizedSchoolId)?.name || null : null;
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
        phone: phone.trim() || null,
        shipping_address_line1: contactAddress.trim() || null,
        shipping_address_line2: contactNotes.trim() || null,
        shipping_city: contactCity.trim() || null,
        shipping_region: contactRegion.trim() || null,
        shipping_country_code: countryCode.trim().toUpperCase() || "ES",
      };

      const { error: profileError } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (profileError) throw profileError;

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
      if (authError) throw authError;

      setSuccessMessage("Perfil actualizado correctamente.");
      router.refresh();
    } catch (error: any) {
      setErrorMessage(error?.message || error?.details || "No se pudo actualizar tu perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar perfil</CardTitle>
        <CardDescription>
          Añade solo lo necesario para que otros usuarios te reconozcan y puedas coordinar acuerdos con menos fricción.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="full_name">Nombre</Label>
              <div className="relative">
                <User2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-9" placeholder="Tu nombre" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input value={email} readOnly className="bg-muted/40 pl-9" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de usuario</Label>
              <Select value={userType} onValueChange={(value) => setUserType(value as any)}>
                <SelectTrigger><SelectValue placeholder={currentUserTypeLabel} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Familia / Tutor legal</SelectItem>
                  <SelectItem value="student">Estudiante</SelectItem>
                  <SelectItem value="business">Negocio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isBusiness ? (
              <div className="space-y-2">
                <Label>Curso / nivel</Label>
                <Select value={gradeLevel || undefined} onValueChange={setGradeLevel}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un curso" /></SelectTrigger>
                  <SelectContent>
                    {normalizedGradeLevelOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="postal_code">Código postal</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input id="postal_code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="pl-9" placeholder="28001" />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Centro educativo</Label>
              <Popover open={schoolPopoverOpen} onOpenChange={setSchoolPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between">
                    <span className="truncate">{selectedSchool ? `${selectedSchool.name}${selectedSchool.city ? ` · ${selectedSchool.city}` : ""}` : "Selecciona un centro"}</span>
                    <School className="ml-2 h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-3" align="start">
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)} className="pl-9" placeholder="Busca por nombre, ciudad o CP" />
                    </div>
                    <div className="max-h-60 space-y-1 overflow-y-auto">
                      {filteredSchools.map((school) => (
                        <button
                          key={school.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-muted"
                          onClick={() => {
                            setSelectedSchoolId(school.id);
                            setSchoolPopoverOpen(false);
                          }}
                        >
                          <div>
                            <p className="font-medium">{school.name}</p>
                            <p className="text-xs text-muted-foreground">{[school.city, school.postal_code].filter(Boolean).join(" · ")}</p>
                          </div>
                          {selectedSchoolId === school.id ? <Check className="h-4 w-4 text-[#7EBA28]" /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="school_code">Código de centro</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input id="school_code" value={schoolAccessCode} onChange={(e) => setSchoolAccessCode(e.target.value)} className="pl-9 uppercase" placeholder="Introduce un código" />
                </div>
                <Button type="button" variant="outline" onClick={applySchoolAccessCode} disabled={accessCodeLoading}>
                  {accessCodeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Aplicar
                </Button>
              </div>
            </div>
          </div>

          {isBusiness ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="business_name">Nombre comercial</Label>
                <div className="relative">
                  <BriefcaseBusiness className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input id="business_name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="pl-9" placeholder="Librería Barrio Centro" />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="business_description">Descripción</Label>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Textarea id="business_description" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} className="min-h-[120px] pl-9" placeholder="Cuéntanos qué vendes y cómo ayudas a la comunidad educativa" />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="website">Web</Label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="pl-9" placeholder="https://..." />
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border bg-slate-50 p-4">
            <div>
              <h3 className="text-base font-semibold">Datos opcionales de contacto</h3>
              <p className="text-sm text-muted-foreground">
                No son obligatorios. Puedes guardarlos para acordar entregas con menos mensajes cuando tú decidas compartirlos.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">Teléfono</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-9" placeholder="Opcional" />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact_address">Zona o dirección orientativa</Label>
                <Input id="contact_address" value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} placeholder="Opcional. Ej: barrio, zona o dirección si quieres guardarla" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact_notes">Notas de entrega</Label>
                <Input id="contact_notes" value={contactNotes} onChange={(e) => setContactNotes(e.target.value)} placeholder="Opcional. Ej: tardes, portería, punto de encuentro..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_city">Ciudad</Label>
                <Input id="contact_city" value={contactCity} onChange={(e) => setContactCity(e.target.value)} placeholder="Madrid" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_region">Provincia / región</Label>
                <Input id="contact_region" value={contactRegion} onChange={(e) => setContactRegion(e.target.value)} placeholder="Madrid" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country_code">País</Label>
                <Input id="country_code" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="ES" maxLength={2} />
              </div>
            </div>
          </div>

          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
