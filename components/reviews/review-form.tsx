"use client";

import { useState } from "react";

export default function ReviewForm({ paymentIntentId }: { paymentIntentId: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const submit = async () => {
    const res = await fetch("/api/reviews/create", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ paymentIntentId, rating, comment }),
    });

    if (res.ok) {
      alert("Review enviada");
    } else {
      alert("Error");
    }
  };

  return (
    <div className="space-y-3">
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
        {[5,4,3,2,1].map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <textarea value={comment} onChange={(e)=>setComment(e.target.value)} />
      <button onClick={submit}>Enviar review</button>
    </div>
  );
}
