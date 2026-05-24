import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const requiredFiles = [
  'app/account/transactions/page.tsx',
  'app/account/seller/velocity/page.tsx',
  'app/account/seller/inventory/page.tsx',
  'app/account/business/import/page.tsx',
  'app/admin/super/automation/page.tsx',
  'app/admin/super/autopilot/page.tsx',
  'app/admin/super/seo/page.tsx',
  'app/admin/super/transaction-velocity/page.tsx',
  'app/api/cron/daily/route.ts',
  'app/api/cron/transaction-velocity/route.ts',
  'app/api/launch/final-check/route.ts',
  'components/navigation/mobile-bottom-navigation.tsx',
  'scripts/launch-final-qa.mjs',
]

test('final launch critical files exist', () => {
  for (const file of requiredFiles) {
    assert.ok(fs.existsSync(file), `${file} should exist before launch`)
  }
})

test('final launch routes keep default exports where required', () => {
  const pages = [
    'app/account/transactions/page.tsx',
    'app/account/seller/velocity/page.tsx',
    'app/account/seller/inventory/page.tsx',
    'app/admin/super/launch/page.tsx',
  ]

  for (const page of pages) {
    assert.match(fs.readFileSync(page, 'utf8'), /export\s+default\s+/, `${page} must have a default export`)
  }
})

test('final launch protected endpoints keep authorization checks', () => {
  const protectedRoutes = [
    'app/api/cron/daily/route.ts',
    'app/api/cron/transaction-velocity/route.ts',
    'app/api/launch/final-check/route.ts',
  ]

  for (const route of protectedRoutes) {
    const source = fs.readFileSync(route, 'utf8')
    assert.match(source, /hasValidAutomationSecret|canAccessSuperadmin/, `${route} must keep authorization checks`)
    assert.match(source, /401/, `${route} must return 401 for unauthorized access`)
  }
})
