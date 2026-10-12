import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Vite and the tests forgive imports without '.js'; Node on the server does
// not, and a server function that can't load fails every request. Load each
// one in plain Node exactly as Vercel will.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const files = readdirSync(path.join(root, 'api')).filter((f) => f.endsWith('.js'))

describe('server functions load in plain Node', () => {
  for (const f of files) {
    it(`api/${f}`, () => {
      const out = execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(path.join(root, 'api', f))}); console.log('ok')`], { cwd: root, encoding: 'utf8' })
      expect(out.trim()).toBe('ok')
    })
  }
})
