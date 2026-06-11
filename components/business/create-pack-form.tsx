"use client";

import { useState } from "react";

export default function CreatePackForm() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");

  const submit = async () => {
    const res = await fetch("/api/packs/create", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ title, price }),
    });

    if (res.ok) alert("Pack creado");
    else alert("Error");
  };

  return (
    <div className="space-y-3">
      <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Pack 3 ESO" />
      <input value={price} onChange={(e)=>setPrice(e.target.value)} placeholder="Precio" />
      <button onClick={submit}>Crear pack</button>
    </div>
  );
}
