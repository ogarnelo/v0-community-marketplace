"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, School, CheckCircle2, ArrowLeft } from "lucide-react";

const comunidades = [
  "Andalucia",
  "Aragon",
  "Asturias",
  "Baleares",
  "Canarias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y Leon",
  "Cataluna",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Madrid",
  "Murcia",
  "Navarra",
  "Pais Vasco",
  "Ceuta",
  "Melilla",
];

const SCHOOL_TYPE_OPTIONS = [
  { value: "school", label: "Colegio / Instituto" },
  { value: "academy", label: "Academia" },
  { value: "university", label: "Universidad" },
] as const;

export default function RegisterSchoolPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [region, setRegion] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const normalizedSchoolName = schoolName.trim();
      const normalizedSchoolType = schoolType.trim();
      const normalizedAddress = address.trim();
      const normalizedCity = city.trim();
      const normalizedPostalCode = postalCode.trim();
      const normalizedRegion = region.trim();
      const normalizedEmail = contactEmail.trim();
      const normalizedPhone = contactPhone.trim();

      if (!normalizedSchoolName) {
        throw new Error("Debes indicar el nombre del centro.");
      }

      if (!normalizedSchoolType) {
        throw new Error("Debes seleccionar el tipo de centro.");
      }

      if (
        !SCHOOL_TYPE_OPTIONS.some((option) => option.value === normalizedSchoolType)
      ) {
        throw new Error("El tipo de centro seleccionado no es válido.");
      }

      if (!normalizedAddress) {
        throw new Error("Debes indicar la dirección.");
      }

      if (!normalizedCity) {
        throw new Error("Debes indicar la ciudad.");
      }

      if (!/^[0-9]{5}$/.test(normalizedPostalCode)) {
        throw new Error("Debes indicar un código postal válido de 5 dígitos.");
      }

      if (!normalizedRegion) {
        throw new Error("Debes seleccionar una comunidad autónoma.");
      }

      if (!normalizedEmail) {
        throw new Error("Debes indicar un email de contacto.");
      }

      const supabase = createClient();

      const { error } = await supabase.from("school_registration_requests").insert({
        school_name: normalizedSchoolName,
        school_type: normalizedSchoolType,
        address: normalizedAddress,
        city: normalizedCity,
        postal_code: normalizedPostalCode,
        region: normalizedRegion,
        contact_email: normalizedEmail,
        contact_phone: normalizedPhone || null,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Error creando solicitud de centro:", error);
      setErrorMessage(
        error?.message ||
        error?.details ||
        "No se pudo enviar la solicitud. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-10 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          {submitted ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/15">
                  <CheckCircle2 className="h-8 w-8 text-secondary" />
                </div>
                <h2 className="mt-5 text-xl font-bold text-foreground">
                  Solicitud recibida
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Gracias. Hemos registrado tu solicitud y aparecerá en el panel de
                  superadmin para su revisión. Cuando se apruebe, enviaremos una invitación
                  al email del centro para activar el acceso admin.
                </p>
                <Link href="/" className="mt-6">
                  <Button variant="outline">Volver al inicio</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <School className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl text-foreground">
                  Registrar centro educativo
                </CardTitle>
                <CardDescription className="leading-relaxed">
                  Si tu centro o AMPA aun no tiene codigo de acceso, completa este
                  formulario y el superadmin podrá aprobar su alta. Tras la aprobación, el centro recibirá un email de invitación para activar su acceso.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="schoolName">Nombre del centro *</Label>
                    <Input
                      id="schoolName"
                      placeholder="CEIP San Miguel"
                      required
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Tipo de centro *</Label>
                    <Select value={schoolType} onValueChange={setSchoolType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHOOL_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="address">Direccion *</Label>
                    <Input
                      id="address"
                      placeholder="Calle de Alcala, 50"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="city">Ciudad *</Label>
                      <Input
                        id="city"
                        placeholder="Madrid"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="postalCode">Codigo Postal *</Label>
                      <Input
                        id="postalCode"
                        placeholder="28001"
                        required
                        maxLength={5}
                        pattern="[0-9]{5}"
                        title="Introduce un codigo postal valido de 5 digitos"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>C. Autonoma *</Label>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {comunidades.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email de contacto *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="direccion@colegio.es"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone">Telefono (opcional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="912 345 678"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>

                  {errorMessage ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {errorMessage}
                    </div>
                  ) : null}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar solicitud
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}