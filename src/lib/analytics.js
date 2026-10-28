/*
 * Sub-org analytics.
 * Thanks to the pre-order layout, everyone below v is the contiguous slice
 * order[tin[v]+1 .. tout[v]). One scan of that slice builds every breakdown,
 * so analysing the whole company or a 12-person team costs O(team size).
 */

export const DIMENSIONS = [
  { key: 'department', label: 'Department' },
  { key: 'location', label: 'Location' },
  { key: 'entity', label: 'Legal entity' },
  { key: 'project', label: 'Project' },
  { key: 'performance', label: 'Performance' },
]

export function analyzeScope(org, v) {
  const { order, tin, tout, childCount, salary, depth } = org
  const start = tin[v] + 1
  const end = tout[v]

  const groups = Object.fromEntries(DIMENSIONS.map((d) => [d.key, new Map()]))
  const layers = []
  const spanCounts = new Map() // direct reports -> number of managers
  const managers = []
  let mgrSalary = 0
  let icSalary = 0
  let mgrN = 0
  let icN = 0

  const bump = (layer, isMgr, s) => {
    let L = layers[layer]
    if (!L) L = layers[layer] = { layer, headcount: 0, managers: 0, mgmt: 0, ic: 0 }
    L.headcount++
    if (isMgr) {
      L.managers++
      L.mgmt += s
    } else L.ic += s
  }

  // The leader's own span counts toward span-of-control stats.
  if (childCount[v] > 0) spanCounts.set(childCount[v], 1)

  for (let k = start; k < end; k++) {
    const u = order[k]
    const s = salary[u]
    const isMgr = childCount[u] > 0

    for (const d of DIMENSIONS) {
      const key = org[d.key][u]
      const m = groups[d.key]
      let g = m.get(key)
      if (!g) m.set(key, (g = { key, headcount: 0, mgmt: 0, ic: 0 }))
      g.headcount++
      if (isMgr) g.mgmt += s
      else g.ic += s
    }

    bump(depth[u] - depth[v], isMgr, s)

    if (isMgr) {
      managers.push(u)
      spanCounts.set(childCount[u], (spanCounts.get(childCount[u]) || 0) + 1)
      mgrSalary += s
      mgrN++
    } else {
      icSalary += s
      icN++
    }
  }

  const mgmt = org.mgmtCost[v]
  const ic = org.icCost[v]
  const headcount = org.desc[v]
  const managerCount = org.nonLeaf[v]

  const spans = [...spanCounts.entries()].sort((a, b) => a[0] - b[0]).map(([span, count]) => ({ span, count }))

  return {
    v,
    headcount,
    managerCount,
    icCount: headcount - managerCount,
    mgmt,
    ic,
    total: mgmt + ic,
    ratio: ic > 0 ? mgmt / ic : null,
    // every descendant reports to exactly one of {leader} ∪ managers below
    avgSpan: headcount / (managerCount + 1),
    layers: layers.filter(Boolean),
    spans,
    singleReportManagers: managers.filter((u) => childCount[u] === 1).length + (childCount[v] === 1 ? 1 : 0),
    avgManagerSalary: mgrN ? mgrSalary / mgrN : 0,
    avgIcSalary: icN ? icSalary / icN : 0,
    groups: Object.fromEntries(
      Object.entries(groups).map(([k, m]) => [
        k,
        [...m.values()].map((g) => ({ ...g, total: g.mgmt + g.ic })).sort((a, b) => b.total - a.total),
      ]),
    ),
    managers,
  }
}
