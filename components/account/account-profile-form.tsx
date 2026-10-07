"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  BriefcaseBusiness,
  Copy,
  FileText,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  School,
  Share2,
  User2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUserTypeLabel } from "@/lib/marketplace/formatters";
import { buildFullName, normalizeNamePart } from "@/lib/users/person-name";

type AccountUserType = "parent" | "student" | "business" | "";

type AccountProfileFormProps = {
  initialFirstName: string;
  initialLastName: string;
  initialUserType: AccountUserType;
  initialPostalCode: string;
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
  isSchoolAdmin: boolean;
  managedSchoolId: string;
  managedSchoolName: string;
  managedSchoolAccessCode: string;
};

function isPersonalAccountType(value: AccountUserType): value is "parent" | "student" {
  return value === "parent" || value === "student";
}

export default function AccountProfileForm(props: AccountProfileFormProps) {
  const {
    initialFirstName,
    initialLastName,
    initialUserType,
    initialPostalCode,
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
    isSchoolAdmin,
    managedSchoolId,
    managedSchoolName,
    managedSchoolAccessCode,
  } = props;

  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [userType, setUserType] = useState<AccountUserType>(initialUserType);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [managedCodeCopied, setManagedCodeCopied] = useState(false);
  const [managedLinkCopied, setManagedLinkCopied] = useState(false);
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
  const currentUserTypeLabel = userType
    ? getUserTypeLabel(userType)
    : "Selecciona un tipo de usuario";

  const copyManagedSchoolCode = async () => {
    if (!managedSchoolAccessCode) return;
    await navigator.clipboard.writeText(managedSchoolAccessCode);
    setManagedCodeCopied(true);
    window.setTimeout(() => setManagedCodeCopied(false), 1800);
  };

  const getManagedSchoolShareUrl = () => {
    if (!managedSchoolId || typeof window === "undefined") return "";
    const url = new URL("/onboarding/join-school", window.location.origin);
    url.searchParams.set("school", managedSchoolId);
    return url.toString();
  };

  const copyManagedSchoolLink = async () => {
    const url = getManagedSchoolShareUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setManagedLinkCopied(true);
    window.setTimeout(() => setManagedLinkCopied(false), 1800);
  };

  const shareManagedSchoolCode = async () => {
    const url = getManagedSchoolShareUrl();
    if (!url) return;

    const shareText =
      `Únete a ${managedSchoolName || "nuestro centro"} en Wetudy. El centro aparecerá ya seleccionado.`;

    if (typeof navigator.share === "function") {
      await navigator.share({
        title: `Wetudy · ${managedSchoolName || "Centro"}`,
        text: shareText,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(`${shareText} ${url}`);
    setManagedLinkCopied(true);
    window.setTimeout(() => setManagedLinkCopied(false), 1800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    const normalizedFirstName = normalizeNamePart(firstName);
    const normalizedLastName = normalizeNamePart(lastName);

    if (!normalizedFirstName) {
      setErrorMessage("El nombre es obligatorio.");
      return;
    }

    if (!normalizedLastName) {
      setErrorMessage("Los apellidos son obligatorios.");
      return;
    }

    if (!userType) {
      setErrorMessage("Debes seleccionar un tipo de usuario antes de guardar.");
      return;
    }

    const normalizedPostalCode = postalCode.trim();
    const postalPrefix = /^[0-9]{5}$/.test(normalizedPostalCode)
      ? Number(normalizedPostalCode.slice(0, 2))
      : NaN;

    if (
      !Number.isInteger(postalPrefix) ||
      postalPrefix < 1 ||
      postalPrefix > 52
    ) {
      setErrorMessage("Debes indicar un código postal español válido.");
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

      if (
        initialUserType !== userType &&
        isPersonalAccountType(initialUserType) &&
        isPersonalAccountType(userType)
      ) {
        const response = await fetch("/api/account/type", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userType }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error || "No se pudo cambiar el tipo de cuenta."
          );
        }
      }

      const normalizedFullName = buildFullName(
        normalizedFirstName,
        normalizedLastName
      );
      const payload = {
        id: user.id,
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        full_name: normalizedFullName,
        user_type: userType,
        postal_code: normalizedPostalCode || null,
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

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          full_name: normalizedFullName,
          user_type: userType,
          postal_code: normalizedPostalCode || null,
          business_name: isBusiness ? businessName.trim() || null : null,
          business_description: isBusiness
            ? businessDescription.trim() || null
            : null,
          website: isBusiness ? website.trim() || null : null,
        },
      });

      if (authError) throw authError;

      setSuccessMessage("Perfil actualizado correctamente.");
      router.refresh();
    } catch (error: any) {
      setErrorMessage(
        error?.message || error?.details || "No se pudo actualizar tu perfil."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi perfil</CardTitle>
        <CardDescription>
          Datos del titular de la cuenta y, si quieres, información opcional para facilitar las entregas.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre</Label>
              <div className="relative">
                <User2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="first_name"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="pl-9"
                  placeholder="Nombre"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Apellidos</Label>
              <div className="relative">
                <User2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="last_name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="pl-9"
                  placeholder="Apellidos"
                  required
                />
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
              <Label>Tipo de cuenta</Label>
              {isSchoolAdmin ? (
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                  AMPA / centro educativo
                </div>
              ) : (
                <>
                  <Select
                    value={userType}
                    onValueChange={(value) => setUserType(value as AccountUserType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={currentUserTypeLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Familia / tutor</SelectItem>
                      <SelectItem value="student">Estudiante</SelectItem>
                      {initialUserType === "business" ? (
                        <SelectItem value="business">Negocio</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                  {initialUserType !== userType &&
                  isPersonalAccountType(initialUserType) &&
                  isPersonalAccountType(userType) ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Al guardar, Wetudy adaptará automáticamente tu contexto educativo al nuevo tipo de cuenta.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">
                Código postal <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="postal_code"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={postalCode}
                  onChange={(e) =>
                    setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  className="pl-9"
                  placeholder="28001"
                  maxLength={5}
                  minLength={5}
                  pattern="[0-9]{5}"
                  required
                  aria-describedby="postal-code-help"
                />
              </div>
              <p
                id="postal-code-help"
                className="text-xs leading-5 text-muted-foreground"
              >
                Es obligatorio. Lo usamos para calcular cercanía y ordenar mejor los resultados.
              </p>
            </div>

            {isSchoolAdmin ? (
              <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <School className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Tu centro en Wetudy
                    </p>
                    <p className="mt-1 break-words text-base font-bold text-foreground">
                      {managedSchoolName || "Centro"}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Esta cuenta representa a una AMPA o centro. No necesita curso ni estudiantes asociados; el centro gestionado es su contexto institucional.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-blue-200 bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Código de tu centro
                  </p>
                  {managedSchoolAccessCode ? (
                    <>
                      <p className="mt-2 break-all font-mono text-2xl font-bold tracking-[0.16em] text-foreground">
                        {managedSchoolAccessCode}
                      </p>
                      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                        <Button
                          type="button"
                          className="w-full sm:w-auto"
                          onClick={shareManagedSchoolCode}
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Compartir centro
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={copyManagedSchoolLink}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {managedLinkCopied ? "Enlace copiado" : "Copiar enlace"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={copyManagedSchoolCode}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          {managedCodeCopied ? "Código copiado" : "Copiar código"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No hay un código activo. Puedes revisarlo desde el Panel del centro.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {isBusiness ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="business_name">Nombre comercial</Label>
                <div className="relative">
                  <BriefcaseBusiness className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="business_name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="pl-9"
                    placeholder="Librería Barrio Centro"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="business_description">Descripción</Label>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="business_description"
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    className="min-h-[120px] pl-9"
                    placeholder="Cuéntanos qué vendes y cómo ayudas a la comunidad educativa"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="website">Web</Label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="pl-9"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border bg-slate-50 p-4">
            <div>
              <h3 className="text-base font-semibold">
                Datos opcionales de contacto
              </h3>
              <p className="text-sm text-muted-foreground">
                No son obligatorios. Puedes guardarlos para acordar entregas con menos mensajes cuando tú decidas compartirlos.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">Teléfono</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact_address">Zona o dirección orientativa</Label>
                <Input
                  id="contact_address"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="Opcional. Ej: barrio, zona o dirección si quieres guardarla"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact_notes">Notas de entrega</Label>
                <Input
                  id="contact_notes"
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  placeholder="Opcional. Ej: tardes, portería, punto de encuentro..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_city">Ciudad</Label>
                <Input
                  id="contact_city"
                  value={contactCity}
                  onChange={(e) => setContactCity(e.target.value)}
                  placeholder="Madrid"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_region">Provincia / región</Label>
                <Input
                  id="contact_region"
                  value={contactRegion}
                  onChange={(e) => setContactRegion(e.target.value)}
                  placeholder="Madrid"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country_code">País</Label>
                <Input
                  id="country_code"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="ES"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {successMessage ? (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          ) : null}
          {errorMessage ? (
            <p className="text-sm text-rose-600">{errorMessage}</p>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
