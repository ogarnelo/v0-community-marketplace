import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessSuperadmin, hasValidAutomationSecret } from '@/lib/admin/superadmin-access'

export const dynamic = 'force-dynamic'

type Check = {
  name: string
  ok: boolean
  severity: 'critical' | 'warning' | 'info'
  message: string
  count?: number
}

const REQUIRED_ENV = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
]

const RECOMMENDED_ENV = [
  'LAUNCH_HEALTH_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
]

async function tableCount(table: string): Promise<Check> {
  const admin = createAdminClient()
  const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true })

  if (error) {
    return {
      name: `table.${table}`,
      ok: false,
      severity: 'critical',
      message: error.message,
    }
  }

  return {
    name: `table.${table}`,
    ok: true,
    severity: 'info',
    message: 'OK',
    count: count || 0,
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const bySecret = hasValidAutomationSecret(request)
  const bySuperadmin = user ? await canAccessSuperadmin(user.id, user.email) : false

  if (!bySecret && !bySuperadmin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized launch final check' }, { status: 401 })
  }

  const checks: Check[] = []

  const missingRequired = REQUIRED_ENV.filter((key) => !process.env[key])
  const missingRecommended = RECOMMENDED_ENV.filter((key) => !process.env[key])

  checks.push({
    name: 'environment.required',
    ok: missingRequired.length === 0,
    severity: 'critical',
    message: missingRequired.length === 0 ? 'Variables obligatorias presentes' : `Faltan: ${missingRequired.join(', ')}`,
  })

  checks.push({
    name: 'environment.recommended',
    ok: missingRecommended.length === 0,
    severity: missingRecommended.length === 0 ? 'info' : 'warning',
    message: missingRecommended.length === 0 ? 'Variables recomendadas presentes' : `Revisar: ${missingRecommended.join(', ')}`,
  })

  const coreTables = [
    'profiles',
    'listings',
    'listing_photos',
    'conversations',
    'messages',
    'listing_offers',
    'payment_intents',
    'notifications',
    'marketplace_events',
    'transaction_velocity_events',
    'autopilot_recommendations',
    'automation_runs',
    'seo_programmatic_pages',
  ]

  for (const table of coreTables) {
    checks.push(await tableCount(table))
  }

  const criticalFailed = checks.filter((check) => !check.ok && check.severity === 'critical')
  const warnings = checks.filter((check) => !check.ok && check.severity === 'warning')

  return NextResponse.json({
    ok: criticalFailed.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      criticalFailed: criticalFailed.length,
      warnings: warnings.length,
    },
    checks,
  }, { status: criticalFailed.length === 0 ? 200 : 500 })
}
