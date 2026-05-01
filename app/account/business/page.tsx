import BulkUploadForm from "@/components/business/bulk-upload-form";
import CreatePackForm from "@/components/business/create-pack-form";

export default function BusinessPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Panel de negocio</h1>

      <div>
        <h2 className="font-semibold">Subir productos en lote</h2>
        <BulkUploadForm />
      </div>

      <div>
        <h2 className="font-semibold">Crear packs educativos</h2>
        <CreatePackForm />
      </div>
    </div>
  );
}
