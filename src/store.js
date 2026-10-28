import { reactive, shallowRef, markRaw } from 'vue'
import { buildOrgFromCSV, pathToRoot } from './lib/orgEngine.js'

/** The parsed org (typed arrays). Never made deeply reactive. */
export const org = shallowRef(null)

/** Ids of expanded nodes. Replaced (not mutated) so watchers fire once. */
export const expanded = shallowRef(new Set())

export const ui = reactive({
  status: 'loading', // loading | ready | error
  error: '',
  sourceName: 'Giga Corp',
  timings: null,
  loadId: 0, // bumps on every successful load so views remount cleanly
  view: 'chart', // chart | analysis
  selected: -1, // person shown in the side panel
  scope: -1, // leader whose org the analysis view covers
  focus: { v: -1, nonce: 0 }, // ask the chart to centre on someone
  anchor: -1, // keep this card still on screen across the next re-layout
  justExpanded: -1, // cards under this parent animate in
})

export const DEFAULT_CSV = '/data.csv'

/* ---------------- loading ---------------- */

export async function loadOrg({ url, file } = {}) {
  ui.status = 'loading'
  ui.error = ''
  try {
    const text = file ? await file.text() : undefined
    const result = await runInWorker({ url: url ?? DEFAULT_CSV, text })
    if (!result.n) throw new Error('That file has no rows.')
    org.value = markRaw(result)
    ui.timings = result.timings
    ui.sourceName = file ? file.name.replace(/\.csv$/i, '') : 'Giga Corp'
    const root = result.roots[0]
    expanded.value = new Set([root])
    ui.selected = -1
    ui.scope = root
    ui.view = 'chart'
    ui.loadId++
    ui.status = 'ready'
    requestFocus(root)
  } catch (err) {
    ui.status = 'error'
    ui.error = err?.message || String(err)
  }
}

function runInWorker(payload) {
  return new Promise((resolve, reject) => {
    let worker
    try {
      worker = new Worker(new URL('./lib/org.worker.js', import.meta.url), { type: 'module' })
    } catch {
      return resolve(runOnMainThread(payload)) // e.g. sandboxed iframes
    }
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.org)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      e.preventDefault?.()
      resolve(runOnMainThread(payload))
    }
    worker.postMessage(payload)
  })
}

async function runOnMainThread({ url, text }) {
  const csv = text ?? (await (await fetch(url)).text())
  return buildOrgFromCSV(csv)
}

/* ---------------- chart actions ---------------- */

export function toggle(v) {
  const next = new Set(expanded.value)
  if (next.has(v)) {
    next.delete(v)
  } else {
    next.add(v)
    ui.justExpanded = v
  }
  ui.anchor = v
  expanded.value = next
}

/** Expand every manager below v, if the result stays readable. */
export const EXPAND_ALL_LIMIT = 400
export function expandAllBelow(v) {
  const o = org.value
  if (o.desc[v] > EXPAND_ALL_LIMIT) return false
  const next = new Set(expanded.value)
  for (let k = o.tin[v]; k < o.tout[v]; k++) {
    const u = o.order[k]
    if (o.childCount[u] > 0) next.add(u)
  }
  ui.anchor = v
  ui.justExpanded = -1
  expanded.value = next
  return true
}

export function collapseAll() {
  const root = org.value.roots[0]
  expanded.value = new Set([root])
  ui.anchor = -1
  requestFocus(root)
}

/** Open the path down to v, select v and centre it. */
export function reveal(v, { select = true } = {}) {
  const path = pathToRoot(org.value, v)
  const next = new Set(expanded.value)
  for (let i = 0; i < path.length - 1; i++) next.add(path[i])
  expanded.value = next
  ui.anchor = -1
  if (select) ui.selected = v
  ui.view = 'chart'
  requestFocus(v)
}

export function requestFocus(v) {
  ui.focus = { v, nonce: ui.focus.nonce + 1 }
}

export function analyze(v) {
  ui.scope = v
  ui.view = 'analysis'
}
