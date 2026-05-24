'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function SaveTemplateForm() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    title: '',
    description: '',
    category: '',
    grade_level: '',
    condition: 'good',
    price: '',
    original_price: '',
  });

  async function submit() {
    setStatus('loading');
    setMessage(null);

    try {
      const response = await fetch('/api/seller/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'No se pudo guardar.');

      setStatus('done');
      setMessage('Plantilla guardada. Recarga la página para verla en tu lista.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Crear plantilla propia
      </Button>
    );
  }

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Nueva plantilla</h2>
      <p className="mt-1 text-sm text-muted-foreground">Guarda una estructura reutilizable para publicar más rápido.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Nombre de plantilla</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Libro ESO" />
        </div>
        <div className="space-y-2">
          <Label>Título base</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Libro Matemáticas" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Descripción base</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Libros de texto" />
        </div>
        <div className="space-y-2">
          <Label>Curso</Label>
          <Input value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} placeholder="3 ESO" />
        </div>
        <div className="space-y-2">
          <Label>Precio</Label>
          <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="10" />
        </div>
        <div className="space-y-2">
          <Label>Precio original</Label>
          <Input value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="35" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={submit} disabled={status === 'loading'}>
          {status === 'loading' ? 'Guardando...' : 'Guardar plantilla'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>

      {message ? <p className={`mt-3 text-sm ${status === 'error' ? 'text-rose-600' : 'text-emerald-700'}`}>{message}</p> : null}
    </div>
  );
}
