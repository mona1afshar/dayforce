<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { zoom, zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'
import { org, expanded, ui, collapseAll } from '../store.js'
import { layoutVisible, cardHeight, CARD } from '../lib/layout.js'
import PersonCard from './PersonCard.vue'

const container = ref(null)
const layer = ref(null)
const size = shallowRef({ w: 1, h: 1 })
const view = shallowRef({ x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 })
const scale = ref(1)

let zoomer
let sel
let t = zoomIdentity
let raf = 0
let anim = 0
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const root = computed(() => org.value.roots[0])
const layout = computed(() => layoutVisible(org.value, root.value, expanded.value))

// Below this zoom level cards switch to a light, name-only rendering.
const LOD_SCALE = 0.45
const lod = computed(() => scale.value < LOD_SCALE)

/* ---------- viewport culling: only mount cards that are on screen ---------- */
const MARGIN = 320
const visibleNodes = computed(() => {
  const { x0, y0, x1, y1 } = view.value
  return layout.value.nodes.filter((n) => n.x + CARD.w > x0 && n.x < x1 && n.y + CARD.h > y0 && n.y < y1)
})

function updateView() {
  raf = 0
  const { w, h } = size.value
  view.value = {
    x0: -t.x / t.k - MARGIN,
    y0: -t.y / t.k - MARGIN,
    x1: (w - t.x) / t.k + MARGIN,
    y1: (h - t.y) / t.k + MARGIN,
  }
  scale.value = t.k
}
const scheduleView = () => raf || (raf = requestAnimationFrame(updateView))

/* ---------- pan & zoom ---------- */
// Read the live size: the chart may have just been un-hidden.
function measure() {
  const r = container.value.getBoundingClientRect()
  if (r.width && r.height) size.value = { w: r.width, h: r.height }
  return size.value
}

function applyTransform(next) {
  zoomer.transform(sel, next)
}

function animateTo(target, ms = 450) {
  cancelAnimationFrame(anim)
  if (reduceMotion) return applyTransform(target)
  const from = t
  const start = performance.now()
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms)
    const e = ease(p)
    applyTransform(
      zoomIdentity
        .translate(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e)
        .scale(from.k + (target.k - from.k) * e),
    )
    if (p < 1) anim = requestAnimationFrame(step)
  }
  anim = requestAnimationFrame(step)
}

function centerOn(v, { k = Math.max(t.k, 0.75), top = false } = {}) {
  const n = layout.value.pos.get(v)
  if (!n) return
  const { w, h } = measure()
  // Leave room for the details panel when it is docked on the right.
  const usable = ui.selected >= 0 && w >= 768 ? w - 380 : w
  const x = usable / 2 - (n.x + CARD.w / 2) * k
  const y = top ? 32 : h * 0.38 - (n.y + CARD.h / 2) * k
  animateTo(zoomIdentity.translate(x, y).scale(k))
}

function fit() {
  const { minX, maxX, minY, maxY } = layout.value.bounds
  const { w, h } = measure()
  const pad = 48
  const k = Math.max(0.15, Math.min(1, (w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY)))
  const x = (w - (maxX - minX) * k) / 2 - minX * k
  const y = pad - minY * k
  animateTo(zoomIdentity.translate(x, y).scale(k))
}

const zoomBy = (f) => {
  const { w, h } = size.value
  cancelAnimationFrame(anim)
  zoomer.scaleBy(sel, f, [w / 2, h / 2])
}

/** After an expand, pan just enough to bring the new row of cards on screen. */
function revealChildren(v) {
  const o = org.value
  const pos = layout.value.pos
  const kids = []
  for (let i = 0; i < o.childCount[v]; i++) {
    const n = pos.get(o.childList[o.childStart[v] + i])
    if (n) kids.push(n)
  }
  if (!kids.length) return
  const parent = pos.get(v)
  if (!parent) return
  const { w, h } = measure()
  const minX = Math.min(...kids.map((n) => n.x))
  const maxX = Math.max(...kids.map((n) => n.x + CARD.w))
  const maxY = kids[0].y + CARD.h
  // screen-space box we want visible
  const sx0 = minX * t.k + t.x
  const sx1 = maxX * t.k + t.x
  const sy1 = maxY * t.k + t.y
  const sTop = parent.y * t.k + t.y
  let dx = 0
  let dy = 0
  const pad = 32
  if (sx1 - sx0 < w - pad * 2) {
    if (sx0 < pad) dx = pad - sx0
    else if (sx1 > w - pad) dx = w - pad - sx1
  }
  if (sy1 > h - pad) dy = Math.max(h - pad - sy1, pad - sTop) // keep the parent on screen too
  if (dx || dy) animateTo(zoomIdentity.translate(t.x + dx, t.y + dy).scale(t.k), 380)
}

/* Keep the clicked card still while the layout around it shifts. */
watch(layout, (next, prev) => {
  const v = ui.anchor
  if (v < 0 || !prev) return
  const a = prev.pos.get(v)
  const b = next.pos.get(v)
  if (a && b && (a.x !== b.x || a.y !== b.y)) {
    cancelAnimationFrame(anim)
    zoomer.translateBy(sel, a.x - b.x, a.y - b.y)
  }
  ui.anchor = -1
  if (expanded.value.has(v)) nextTick(() => revealChildren(v))
})

watch(
  () => ui.focus.nonce,
  async () => {
    await nextTick()
    const v = ui.focus.v
    if (v === root.value && expanded.value.size <= 1) centerOn(v, { k: 1, top: true })
    else centerOn(v)
  },
)

// Clear the "just expanded" marker once the entrance animation has played.
let enterTimer
watch(
  () => ui.justExpanded,
  (v) => {
    clearTimeout(enterTimer)
    if (v >= 0) enterTimer = setTimeout(() => (ui.justExpanded = -1), 400)
  },
)

/* ---------- lifecycle ---------- */
let ro
function onWheel(e) {
  if (e.ctrlKey || e.metaKey) return // d3 handles pinch / ctrl-wheel zoom
  e.preventDefault()
  cancelAnimationFrame(anim)
  zoomer.translateBy(sel, -e.deltaX / t.k, -e.deltaY / t.k)
}

onMounted(() => {
  sel = select(container.value)
  zoomer = zoom()
    .scaleExtent([0.12, 1.6])
    .clickDistance(4)
    .filter((e) => (e.type === 'wheel' ? e.ctrlKey || e.metaKey : !e.button && !e.ctrlKey))
    .on('zoom', (e) => {
      t = e.transform
      layer.value.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.k})`
      scheduleView()
    })
  sel.call(zoomer).on('dblclick.zoom', null)
  container.value.addEventListener('wheel', onWheel, { passive: false })

  ro = new ResizeObserver(([entry]) => {
    size.value = { w: entry.contentRect.width, h: entry.contentRect.height }
    scheduleView()
  })
  ro.observe(container.value)
  const r = container.value.getBoundingClientRect()
  size.value = { w: r.width, h: r.height }

  // Initial view: the root, near the top.
  const n = layout.value.pos.get(root.value)
  const k = r.width < 640 ? 0.8 : 1
  applyTransform(zoomIdentity.translate(r.width / 2 - (n.x + CARD.w / 2) * k, 32).scale(k))
  // If we came back from the analysis view, centre on the selected person.
  if (ui.selected >= 0 && layout.value.pos.has(ui.selected)) centerOn(ui.selected)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  container.value?.removeEventListener('wheel', onWheel)
  cancelAnimationFrame(anim)
  cancelAnimationFrame(raf)
  clearTimeout(enterTimer)
})

const nodeStyle = (n) => ({ transform: `translate(${n.x}px,${n.y}px)` })
const visibleCount = computed(() => layout.value.nodes.length)
</script>

<template>
  <div class="relative h-full w-full overflow-hidden">
    <div
      ref="container"
      class="dot-grid absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
      role="tree"
      aria-label="Organization chart. Drag to pan, Ctrl or Command plus scroll to zoom."
    >
      <div ref="layer" class="absolute left-0 top-0 origin-top-left will-change-transform">
        <svg class="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
          <path
            v-for="l in layout.links"
            :key="l.v"
            :d="l.path"
            fill="none"
            class="stroke-line-strong"
            stroke-width="1.5"
          />
        </svg>

        <template v-if="!lod">
          <PersonCard
            v-for="n in visibleNodes"
            :key="n.v"
            :v="n.v"
            :open="expanded.has(n.v)"
            :enter="n.parent === ui.justExpanded"
            :style="nodeStyle(n)"
          />
        </template>
        <template v-else>
          <!-- Zoomed far out: lightweight blocks keep panning smooth. -->
          <button
            v-for="n in visibleNodes"
            :key="n.v"
            type="button"
            class="absolute left-0 top-0 flex items-center rounded-xl border bg-surface px-5 text-left"
            :class="ui.selected === n.v ? 'border-ink' : 'border-line'"
            :style="{ ...nodeStyle(n), width: CARD.w + 'px', height: cardHeight(org, n.v) + 'px' }"
            @click="ui.selected = n.v"
          >
            <span class="line-clamp-2 text-[26px] font-semibold leading-tight">{{ org.name[n.v] }}</span>
          </button>
        </template>
      </div>
    </div>

    <!-- First-run hint -->
    <p
      v-if="expanded.size <= 1"
      class="pointer-events-none absolute left-1/2 top-[248px] w-max max-w-[90%] -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1.5 text-center text-xs text-ink-2 ring-1 ring-line"
    >
      Open a team with the <b class="font-semibold text-ink">direct</b> button. Select a card for details.
    </p>

    <!-- Controls -->
    <div class="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl bg-surface p-1 text-sm ring-1 ring-line sm:bottom-4 sm:left-4">
      <button type="button" class="grid h-8 w-8 place-items-center rounded-lg hover:bg-sunken" aria-label="Zoom out" @click="zoomBy(1 / 1.25)">
        <svg class="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      </button>
      <span class="w-11 text-center text-xs tabular-nums text-ink-2" aria-live="polite">{{ Math.round(scale * 100) }}%</span>
      <button type="button" class="grid h-8 w-8 place-items-center rounded-lg hover:bg-sunken" aria-label="Zoom in" @click="zoomBy(1.25)">
        <svg class="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M8 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      </button>
      <span class="mx-0.5 h-5 w-px bg-line" />
      <button type="button" class="h-8 rounded-lg px-2.5 text-xs font-medium hover:bg-sunken" @click="fit">Fit</button>
      <button type="button" class="h-8 rounded-lg px-2.5 text-xs font-medium hover:bg-sunken" @click="collapseAll">Collapse all</button>
    </div>

    <!-- Legend -->
    <div class="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-4 rounded-xl bg-surface/90 px-3 py-2 text-xs text-ink-2 ring-1 ring-line md:flex md:bottom-4 md:right-4">
      <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-[3px] bg-mgmt" />Management cost</span>
      <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-[3px] bg-ic" />IC cost</span>
      <span class="text-ink-3">{{ visibleCount }} cards open</span>
    </div>
  </div>
</template>
