import { parseCSV } from './csv.js'

/*
 * Org engine
 * ----------
 * Turns the people CSV into a flat, index-based tree and computes every
 * per-node aggregate in ONE linear pass.
 *
 *   1. Map Employee Id -> row index                         O(n)
 *   2. Build children as a CSR adjacency (typed arrays)     O(n)
 *   3. Iterative pre-order DFS -> order[], tin/tout, depth  O(n)
 *      (no recursion, so any depth is safe; subtree of v is the contiguous
 *       slice order[tin[v] .. tout[v]) which makes sub-org analytics O(size))
 *   4. Walk order[] backwards. In pre-order a node always appears before its
 *      descendants, so the reverse is a valid post-order: every child is final
 *      before its parent reads it. Each node pushes its totals up ONCE:
 *
 *        desc[p]    += 1 + desc[c]
 *        nonLeaf[p] += isManager(c) + nonLeaf[c]
 *        mgmt[p]    += (isManager(c) ? salary[c] : 0) + mgmt[c]
 *        ic[p]      += (isManager(c) ? 0 : salary[c]) + ic[c]
 *
 *      Total work is O(n) for all 40k nodes, versus O(n * depth) or worse for
 *      recomputing each node's subtree on demand. Expanding any path in the UI
 *      afterwards is an O(1) lookup per node.
 */

const COLS = {
  id: 'Employee Id',
  name: 'Name',
  title: 'Job Title',
  email: 'Email',
  manager: 'Manager',
  startDate: 'Start Date',
  department: 'Department',
  location: 'Location',
  salary: 'Salary',
  performance: 'Performance',
  project: 'Project',
  entity: 'Entity',
  level: 'level',
}

export function buildOrgFromCSV(text) {
  const t0 = now()
  const { header, rows } = parseCSV(text)
  const t1 = now()
  const org = buildOrg(header, rows)
  org.timings = { parseMs: t1 - t0, buildMs: now() - t1 }
  return org
}

export function buildOrg(header, rows) {
  const col = {}
  for (const [key, label] of Object.entries(COLS)) {
    const i = header.findIndex((h) => h.toLowerCase() === label.toLowerCase())
    col[key] = i
  }
  for (const required of ['id', 'name', 'manager', 'salary']) {
    if (col[required] === -1) {
      throw new Error(`The CSV needs a "${COLS[required]}" column.`)
    }
  }

  const n = rows.length
  const get = (r, key) => (col[key] === -1 ? '' : (r[col[key]] ?? '').trim())

  // ---- 1. columns + id index -------------------------------------------
  const id = new Array(n)
  const name = new Array(n)
  const title = new Array(n)
  const email = new Array(n)
  const department = new Array(n)
  const location = new Array(n)
  const entity = new Array(n)
  const performance = new Array(n)
  const project = new Array(n)
  const startDate = new Array(n)
  const level = new Int16Array(n)
  const salary = new Float64Array(n)
  const indexById = new Map()
  const issues = { duplicateIds: 0, unknownManagers: 0, cyclesBroken: 0, badSalaries: 0 }

  for (let i = 0; i < n; i++) {
    const r = rows[i]
    id[i] = get(r, 'id')
    name[i] = get(r, 'name')
    title[i] = get(r, 'title')
    email[i] = get(r, 'email')
    department[i] = get(r, 'department') || 'Unassigned'
    location[i] = get(r, 'location') || 'Unknown'
    entity[i] = get(r, 'entity') || 'Unknown'
    performance[i] = get(r, 'performance') || 'Not rated'
    project[i] = get(r, 'project') || 'None'
    startDate[i] = get(r, 'startDate')
    level[i] = parseInt(get(r, 'level'), 10) || 0
    const s = parseFloat(get(r, 'salary'))
    if (Number.isFinite(s)) salary[i] = s
    else issues.badSalaries++
    if (indexById.has(id[i])) issues.duplicateIds++
    else indexById.set(id[i], i)
  }

  // ---- 2. parent + CSR children ----------------------------------------
  const parent = new Int32Array(n).fill(-1)
  const childCount = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const m = get(rows[i], 'manager')
    if (!m) continue
    const p = indexById.get(m)
    if (p === undefined || p === i) {
      issues.unknownManagers++
      continue
    }
    parent[i] = p
    childCount[p]++
  }

  const childStart = new Int32Array(n + 1)
  for (let i = 0; i < n; i++) childStart[i + 1] = childStart[i] + childCount[i]
  const childList = new Int32Array(childStart[n])
  const cursor = childStart.slice(0, n)
  for (let i = 0; i < n; i++) {
    const p = parent[i]
    if (p !== -1) childList[cursor[p]++] = i
  }

  // ---- 3. iterative pre-order DFS ----------------------------------------
  const order = new Int32Array(n)
  const tin = new Int32Array(n).fill(-1)
  const tout = new Int32Array(n)
  const depth = new Int32Array(n)
  const roots = []
  const stack = new Int32Array(n)
  let pos = 0

  // nextChild[v] = cursor into v's children while v is on the stack.
  const nextChild = new Int32Array(n)

  const dfs = (root) => {
    // A frame stays on the stack until all its children are done, so we can
    // record tout (the end of v's subtree slice in order[]).
    let top = 0
    stack[top++] = root
    depth[root] = 0
    while (top > 0) {
      const v = stack[top - 1]
      if (tin[v] === -1) {
        tin[v] = pos
        order[pos++] = v
        nextChild[v] = childStart[v]
      }
      const k = nextChild[v]
      if (k < childStart[v] + childCount[v]) {
        nextChild[v] = k + 1
        const c = childList[k]
        if (tin[c] !== -1) continue // safety: already visited
        depth[c] = depth[v] + 1
        stack[top++] = c
      } else {
        tout[v] = pos
        top--
      }
    }
  }

  for (let i = 0; i < n; i++) if (parent[i] === -1) roots.push(i)
  for (const r of roots) dfs(r)

  // Anything not reached sits on a reporting cycle (A -> B -> A). Cut the
  // first unvisited node loose as a root so the data still renders.
  for (let i = 0; i < n; i++) {
    if (tin[i] !== -1) continue
    const p = parent[i]
    if (p !== -1) {
      removeChild(childStart, childList, childCount, p, i)
      parent[i] = -1
    }
    issues.cyclesBroken++
    roots.push(i)
    dfs(i)
  }

  // ---- 4. single bottom-up pass ------------------------------------------
  const desc = new Int32Array(n)
  const nonLeaf = new Int32Array(n)
  const mgmtCost = new Float64Array(n)
  const icCost = new Float64Array(n)

  for (let k = n - 1; k >= 0; k--) {
    const c = order[k]
    const p = parent[c]
    if (p === -1) continue
    const isManager = childCount[c] > 0
    desc[p] += 1 + desc[c]
    nonLeaf[p] += (isManager ? 1 : 0) + nonLeaf[c]
    if (isManager) mgmtCost[p] += salary[c]
    else icCost[p] += salary[c]
    mgmtCost[p] += mgmtCost[c]
    icCost[p] += icCost[c]
  }

  return {
    n,
    roots,
    issues,
    // person fields
    id, name, title, email, department, location, entity, performance, project, startDate, level, salary,
    // structure
    parent, childStart, childList, childCount, order, tin, tout, depth,
    // aggregates
    desc, nonLeaf, mgmtCost, icCost,
  }
}

function removeChild(childStart, childList, childCount, p, c) {
  const s = childStart[p]
  const e = s + childCount[p]
  for (let k = s; k < e; k++) {
    if (childList[k] === c) {
      childList[k] = childList[e - 1]
      childList[e - 1] = c
      break
    }
  }
  // The removed child is parked past the new end; every reader bounds its
  // loop with childStart[p] + childCount[p], so it is never visited.
  childCount[p]--
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/* ---------------- derived helpers used by the UI ---------------- */

export const totalCost = (org, v) => org.mgmtCost[v] + org.icCost[v]

/** Management cost ratio = management cost / IC cost (null when no ICs). */
export const mgmtRatio = (org, v) => (org.icCost[v] > 0 ? org.mgmtCost[v] / org.icCost[v] : null)

export function children(org, v) {
  const out = []
  for (let k = org.childStart[v]; k < org.childStart[v] + org.childCount[v]; k++) out.push(org.childList[k])
  return out
}

export function pathToRoot(org, v) {
  const path = []
  for (let x = v; x !== -1; x = org.parent[x]) path.push(x)
  return path.reverse()
}

/** Fields that cross the worker boundary as transferable buffers. */
export const TYPED_FIELDS = [
  'level', 'salary', 'parent', 'childStart', 'childList', 'childCount',
  'order', 'tin', 'tout', 'depth', 'desc', 'nonLeaf', 'mgmtCost', 'icCost',
]
