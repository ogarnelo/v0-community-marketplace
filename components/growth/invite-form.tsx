"use client";

import { useState } from "react";

export default function InviteForm() {
  const [email, setEmail] = useState("");

  const send = async () => {
    const res = await fetch("/api/referrals/invite", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email }),
    });

    if (res.ok) alert("Invitación enviada");
    else alert("Error");
  };

  return (
    <div className="flex gap-2">
      <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email amigo" className="border px-2"/>
      <button onClick={send} className="border px-3">Invitar</button>
    </div>
  );
}
