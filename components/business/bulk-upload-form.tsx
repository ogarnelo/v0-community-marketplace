"use client";

import { useState } from "react";

export default function BulkUploadForm() {
  const [json, setJson] = useState("");

  const submit = async () => {
    try {
      const listings = JSON.parse(json);

      const res = await fetch("/api/listings/bulk-create", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ listings }),
      });

      if (res.ok) alert("Subida completada");
      else alert("Error");
    } catch {
      alert("JSON inválido");
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        className="w-full border p-2"
        rows={10}
        placeholder='[{"title":"Libro","price":10}]'
        value={json}
        onChange={(e)=>setJson(e.target.value)}
      />
      <button onClick={submit} className="border px-4 py-2">Subir lote</button>
    </div>
  );
}
