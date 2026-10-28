import { hierarchy, tree } from 'd3-hierarchy'

export const CARD = { w: 236, h: 188, leafH: 132, gapX: 24, gapY: 64 }

/**
 * Tidy-tree layout of only the *visible* part of the org (expanded nodes and
 * their direct reports). Cost is O(visible), independent of the 40k total.
 */
export function layoutVisible(org, root, expanded) {
  const kids = (v) => {
    if (!expanded.has(v) || org.childCount[v] === 0) return null
    const out = new Array(org.childCount[v])
    const s = org.childStart[v]
    for (let i = 0; i < out.length; i++) out[i] = org.childList[s + i]
    return out
  }

  const h = hierarchy(root, kids)
  tree()
    .nodeSize([CARD.w + CARD.gapX, CARD.h + CARD.gapY])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.12))(h)

  const nodes = []
  const pos = new Map()
  let minX = Infinity
  let maxX = -Infinity
  let maxY = 0
  h.each((d) => {
    const x = d.x - CARD.w / 2 // left edge
    const node = { v: d.data, x, y: d.y, parent: d.parent ? d.parent.data : -1 }
    nodes.push(node)
    pos.set(d.data, node)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x + CARD.w)
    maxY = Math.max(maxY, d.y + CARD.h)
  })

  // One elbow connector per expanded parent: a stem down from the parent,
  // a horizontal bus across its reports, and a drop into each card.
  const links = []
  h.each((d) => {
    if (!d.children) return
    const px = d.x
    const py = d.y + cardHeight(org, d.data)
    const midY = d.y + CARD.h + CARD.gapY / 2
    const xs = d.children.map((c) => c.x)
    let path = `M${px},${py}V${midY}`
    path += `M${Math.min(...xs)},${midY}H${Math.max(...xs)}`
    for (const c of d.children) path += `M${c.x},${midY}V${c.y}`
    links.push({ v: d.data, path })
  })

  return { nodes, links, pos, bounds: { minX, maxX, minY: 0, maxY } }
}

export const cardHeight = (org, v) => (org.childCount[v] > 0 ? CARD.h : CARD.leafH)
