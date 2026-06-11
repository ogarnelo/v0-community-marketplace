import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessSuperadmin } from '@/lib/admin/superadmin-access'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle2, Rocket, ShieldCheck, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Launch Control | Wetudy',
  robots: {
    index: false,
    follow: false,
  },
}

async function safeCount(table: string, filter?: { column: string; value: string }) {
  try {
    const admin = createAdminClient()
    let query = admin.from(table).select('id', { count: 'exact', head: true })
    if (filter) query = query.eq(filter.column, filter.value)
    const { count } = await query
    return count || 0
  } catch {
    return null
  }
}

export default async function LaunchControlPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')
  if (!(await canAccessSuperadmin(user.id, user.email))) redirect('/account')

  const [
    activeListings,
    openVelocityActions,
    openAutopilot,
    openModeration,
    publishedSeoPages,
    automationRuns,
  ] = await Promise.all([
    safeCount('listings', { column: 'status', value: 'available' }),
    safeCount('transaction_velocity_events', { column: 'status', value: 'pending' }),
    safeCount('autopilot_recommendations', { column: 'status', value: 'open' }),
    safeCount('moderation_flags', { column: 'status', value: 'open' }),
    safeCount('seo_programmatic_pages', { column: 'status', value: 'published' }),
    safeCount('automation_runs'),
  ])

  const cards = [
    {
      title: 'Inventario activo',
      value: activeListings,
      href: '/marketplace',
      label: 'Ver marketplace',
    },
    {
      title: 'Acciones de operación',
      value: openVelocityActions,
      href: '/admin/super/transaction-velocity',
      label: 'Transaction Velocity',
    },
    {
      title: 'Recomendaciones growth',
      value: openAutopilot,
      href: '/admin/super/autopilot',
      label: 'Autopilot',
    },
    {
      title: 'Moderación pendiente',
      value: openModeration,
      href: '/admin/super/moderation',
      label: 'Moderación',
    },
    {
      title: 'Páginas SEO publicadas',
      value: publishedSeoPages,
      href: '/admin/super/seo',
      label: 'SEO',
    },
    {
      title: 'Automatizaciones registradas',
      value: automationRuns,
      href: '/admin/super/automation',
      label: 'Automation Center',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
        <Link href="/admin/super">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
      </Button>

      <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Launch Control</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Panel final para vigilar lo crítico antes de mover tráfico real: inventario, operaciones, automatizaciones, SEO, moderación y seguridad.
            </p>
          </div>

          <Button asChild>
            <Link href="/api/launch/final-check">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Ejecutar final check
            </Link>
          </Button>
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="mt-2 text-3xl font-bold">{card.value === null ? '—' : card.value}</p>
              </div>
              <Badge variant="secondary">launch</Badge>
            </div>
            <Button asChild variant="link" className="mt-3 h-auto px-0">
              <Link href={card.href}>{card.label}</Link>
            </Button>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border bg-card p-5">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-3 font-semibold">QA técnico</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ejecuta contracts, build, smoke y final:qa antes de cada despliegue importante.
          </p>
        </article>
        <article className="rounded-3xl border bg-card p-5">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold">Growth operativo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisa Autopilot y Demand Intelligence a diario para priorizar captación e inventario.
          </p>
        </article>
        <article className="rounded-3xl border bg-card p-5">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold">Confianza</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mantén fotos obligatorias, moderación pendiente baja y operaciones bloqueadas visibles.
          </p>
        </article>
      </section>
    </div>
  )
}
