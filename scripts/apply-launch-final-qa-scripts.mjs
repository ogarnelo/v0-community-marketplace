import fs from 'node:fs'
import path from 'node:path'

const packageJsonPath = path.join(process.cwd(), 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

packageJson.scripts ||= {}

const scripts = {
  'final:qa': 'node scripts/launch-final-qa.mjs https://www.wetudy.com',
  'final:qa:local': 'node scripts/launch-final-qa.mjs http://localhost:3000',
  'launch:final': 'npm run test:contracts && npm run build && npm run test:smoke -- https://www.wetudy.com && npm run final:qa',
}

for (const [name, command] of Object.entries(scripts)) {
  packageJson.scripts[name] = command
}

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

console.log('✅ Final QA scripts merged into package.json')
console.log('Added/updated:')
for (const name of Object.keys(scripts)) {
  console.log(`- ${name}`)
}
