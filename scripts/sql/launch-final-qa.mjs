#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || 'https://www.wetudy.com').replace(/\/$/, '')
const secret = process.env.LAUNCH_HEALTH_SECRET || process.argv[3] || ''

const publicRoutes = [
  '/',
  '/marketplace',
  '/seguridad',
  '/negocios',
  '/negocios/demanda',
  '/impacto',
  '/legal/privacidad',
  '/legal/terminos',
  '/material',
]

const authenticatedRoutes = [
  '/account',
  '/account/transactions',
  '/account/seller/velocity',
  '/account/seller/inventory',
  '/account/business/import',
  '/messages',
  '/favorites',
  '/feed',
]

const protectedEndpoints = [
  '/api/health/full',
  '/api/health/supabase-keepalive',
  '/api/cron/daily',
  '/api/cron/transaction-velocity',
  '/api/launch/final-check',
]

const adminRoutes = [
  '/admin/super',
  '/admin/super/health',
  '/admin/super/automation',
  '/admin/super/autopilot',
  '/admin/super/insights',
  '/admin/super/moderation',
  '/admin/super/seo',
  '/admin/super/transaction-velocity',
  '/admin/super/launch',
]

function ms(start) {
  return `${Date.now() - start}ms`
}

async function check(path, options = {}) {
  const url = `${baseUrl}${path}`
  const start = Date.now()
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      redirect: options.redirect || 'follow',
      headers: {
        accept: 'text/html,application/json',
        ...(options.headers || {}),
      },
    })

    const finalUrl = response.url && response.url !== url ? ` → ${response.url}` : ''
    return {
      path,
      status: response.status,
      ok: options.accept ? options.accept(response) : response.ok,
      ms: ms(start),
      finalUrl,
    }
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      ms: ms(start),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function printResult(result) {
  const icon = result.ok ? '✅' : '❌'
  const extra = result.error ? ` ${result.error}` : result.finalUrl || ''
  console.log(`${icon} ${result.status} ${result.path} ${result.ms}${extra}`)
}

console.log(`\nWetudy final launch QA: ${baseUrl}\n`)

const results = []

console.log('Public routes')
for (const route of publicRoutes) {
  const result = await check(route, { accept: (res) => res.status === 200 })
  printResult(result)
  results.push(result)
}

console.log('\nAuthenticated routes')
for (const route of authenticatedRoutes) {
  const result = await check(route, {
    accept: (res) => res.status === 200 || res.status === 307 || res.status === 308,
  })
  printResult(result)
  results.push(result)
}

console.log('\nAdmin routes')
for (const route of adminRoutes) {
  const result = await check(route, {
    accept: (res) => res.status === 200 || res.status === 307 || res.status === 308,
  })
  printResult(result)
  results.push(result)
}

console.log('\nProtected endpoints without secret')
for (const endpoint of protectedEndpoints) {
  const result = await check(endpoint, {
    accept: (res) => res.status === 401,
  })
  printResult(result)
  results.push(result)
}

if (secret) {
  console.log('\nProtected final check with secret')
  const result = await check(`/api/launch/final-check?secret=${encodeURIComponent(secret)}`, {
    accept: (res) => res.status === 200,
  })
  printResult(result)
  results.push(result)
}

const failed = results.filter((result) => !result.ok)

console.log(`\nFinal QA summary: ${results.length - failed.length}/${results.length} passed`)

if (failed.length > 0) {
  console.error('\nFailed checks:')
  for (const result of failed) {
    console.error(`- ${result.status} ${result.path}${result.error ? `: ${result.error}` : ''}`)
  }
  process.exit(1)
}

console.log('\n✅ Final launch QA passed.\n')
