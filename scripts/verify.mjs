// Sanity check: compare the single-pass aggregates against a naive
// per-node subtree walk. Run with `npm test` (no dependencies needed).
import { readFileSync } from 'node:fs'
import { buildOrgFromCSV, children } from '../src/lib/orgEngine.js'
import { analyzeScope } from '../src/lib/analytics.js'

const text = readFileSync(new URL('../public/data.csv', import.meta.url), 'utf8')
const org = buildOrgFromCSV(text)
console.log(`Parsed ${org.n} people in ${org.timings.parseMs.toFixed(0)} ms, aggregated in ${org.timings.buildMs.toFixed(0)} ms`)
console.log('Roots:', org.roots.map((r) => org.name[r]).join(', '), '| issues:', org.issues)

function naive(v) {
  let desc = 0, nonLeaf = 0, mgmt = 0, ic = 0
  const stack = children(org, v)
  while (stack.length) {
    const u = stack.pop()
    const kids = children(org, u)
    desc++
    if (kids.length) { nonLeaf++; mgmt += org.salary[u] } else ic += org.salary[u]
    stack.push(...kids)
  }
  return { desc, nonLeaf, mgmt, ic }
}

const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
const sample = [...org.roots]
for (let i = 0; i < 2000; i++) sample.push(Math.floor(Math.random() * org.n))
let bad = 0
for (const v of sample) {
  const e = naive(v)
  if (e.desc !== org.desc[v] || e.nonLeaf !== org.nonLeaf[v] || !close(e.mgmt, org.mgmtCost[v]) || !close(e.ic, org.icCost[v])) {
    bad++
    if (bad < 5) console.error('Mismatch at', org.name[v], e, { desc: org.desc[v], nonLeaf: org.nonLeaf[v], mgmt: org.mgmtCost[v], ic: org.icCost[v] })
  }
}
console.log(`Checked ${sample.length} nodes against a naive walk: ${bad ? bad + ' mismatches' : 'all match'}`)

const r = org.roots[0]
const t = performance.now()
const a = analyzeScope(org, r)
console.log(`Whole-company analysis in ${(performance.now() - t).toFixed(1)} ms`)
console.log({ headcount: a.headcount, managers: a.managerCount, mgmt: Math.round(a.mgmt), ic: Math.round(a.ic), ratio: a.ratio?.toFixed(3), avgSpan: a.avgSpan.toFixed(2), layers: a.layers.length, singleReport: a.singleReportManagers })
process.exit(bad ? 1 : 0)
