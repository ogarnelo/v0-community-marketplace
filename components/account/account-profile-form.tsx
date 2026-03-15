"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, School, Mail, User2 } from "lucide-react";

type AccountProfileFormProps = {
  initialFullName: string;
  initialGradeLevel: string;
  initialPostalCode: string;
  email: string;
  userTypeLabel: string;
  schoolName: string | null;
};

export default function AccountProfileForm({
  initialFullName,
  initialGradeLevel,
  initialPostalCode,
  email,
  userTypeLabel,
  schoolName,
}: AccountProfileFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
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

      const payload = {
        id: user.id,
        full_name: fullName.trim() || null,
        grade_level: gradeLevel.trim() || null,
        postal_code: postalCode.trim() || null,
      };

      const { error } = await supabase.from("profiles").upsert(payload, {
        onConflict: "id",
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("Perfil actualizado correctamente.");
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
                Tipo de usuario
              </div>
              <Badge variant="secondary">{userTypeLabel}</Badge>
            </div>

            <div className="rounded-xl border p-4 sm:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <School className="h-4 w-4" />
                Colegio
              </div>
              <p className="text-sm text-muted-foreground">
                {schoolName || "Todavía no tienes un centro asignado"}
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
              <Label htmlFor="gradeLevel">Curso / etapa</Label>
              <Input
                id="gradeLevel"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="Ej: 3º ESO"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">Código postal</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Ej: 28001"
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
