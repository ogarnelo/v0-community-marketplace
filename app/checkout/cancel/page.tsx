import Link from "next/link";
import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Card className="border-slate-200">
          <CardHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <XCircle className="size-7" />
            </div>
            <CardTitle className="text-2xl">Pago cancelado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-slate-600">
              No se ha realizado ningún cargo. Puedes volver al checkout cuando quieras o continuar la conversación con el vendedor.
            </p>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/messages">Volver a mensajes</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/account/activity">Ver actividad</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
