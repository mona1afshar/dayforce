<script setup>
import { computed } from 'vue'
import { org, ui, toggle } from '../store.js'
import { money, ratio, num } from '../lib/format.js'
import { CARD } from '../lib/layout.js'
import Avatar from './Avatar.vue'
import CostSplit from './CostSplit.vue'

const props = defineProps({
  v: { type: Number, required: true },
  open: { type: Boolean, default: false },
  enter: { type: Boolean, default: false },
})

const p = computed(() => {
  const o = org.value
  const v = props.v
  const isManager = o.childCount[v] > 0
  return {
    name: o.name[v],
    title: o.title[v],
    department: o.department[v],
    city: o.location[v].split(',')[0],
    location: o.location[v],
    level: o.level[v],
    salary: o.salary[v],
    isManager,
    direct: o.childCount[v],
    desc: o.desc[v],
    nonLeaf: o.nonLeaf[v],
    mgmt: o.mgmtCost[v],
    ic: o.icCost[v],
    ratio: o.icCost[v] > 0 ? o.mgmtCost[v] / o.icCost[v] : null,
  }
})
const selected = computed(() => ui.selected === props.v)
</script>

<template>
  <article
    class="absolute left-0 top-0 rounded-xl border bg-surface text-left transition-[border-color,box-shadow] duration-150"
    :class="[
      selected ? 'border-ink shadow-[0_0_0_1px_rgb(var(--ink))]' : 'border-line hover:border-line-strong',
      enter && 'card-enter',
    ]"
    :style="{ width: CARD.w + 'px', height: (p.isManager ? CARD.h : CARD.leafH) + 'px' }"
  >
    <!-- The whole card opens the detail panel; the toggle sits above it. -->
    <button
      type="button"
      class="absolute inset-0 rounded-xl"
      :aria-label="`Show details for ${p.name}`"
      :aria-pressed="selected"
      @click="ui.selected = v"
    />

    <div class="pointer-events-none relative flex h-full flex-col p-3">
      <div class="flex items-center gap-2.5">
        <Avatar :name="p.name" :manager="p.isManager" :size="34" />
        <div class="min-w-0">
          <div class="truncate text-[13px] font-semibold leading-tight">{{ p.name }}</div>
          <div class="truncate text-xs leading-tight text-ink-3">{{ p.title }}</div>
        </div>
      </div>

      <div class="mt-2.5 flex min-w-0 gap-1 overflow-hidden text-2xs text-ink-2">
        <span class="truncate rounded-md bg-sunken px-1.5 py-0.5" :title="p.department">{{ p.department }}</span>
        <span class="shrink-0 rounded-md bg-sunken px-1.5 py-0.5" :title="p.location">{{ p.city }}</span>
        <span class="shrink-0 rounded-md bg-sunken px-1.5 py-0.5">L{{ p.level }}</span>
      </div>

      <template v-if="p.isManager">
        <dl class="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <div class="flex justify-between">
            <dt class="flex items-center gap-1 text-ink-3"><i class="h-2 w-2 rounded-[2px] bg-mgmt" />Mgmt</dt>
            <dd class="font-medium">{{ money(p.mgmt) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="flex items-center gap-1 text-ink-3"><i class="h-2 w-2 rounded-[2px] bg-ic" />IC</dt>
            <dd class="font-medium">{{ money(p.ic) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-ink-3">Total</dt>
            <dd class="font-semibold">{{ money(p.mgmt + p.ic) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-ink-3">Ratio</dt>
            <dd class="font-medium">{{ ratio(p.ratio) }}</dd>
          </div>
        </dl>
        <CostSplit class="mt-2" :mgmt="p.mgmt" :ic="p.ic" :height="5" />

        <div class="mt-auto flex items-center justify-between pt-2">
          <button
            type="button"
            class="pointer-events-auto relative z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="open ? 'bg-ink text-surface hover:bg-ink/85' : 'bg-sunken text-ink ring-1 ring-inset ring-line-strong hover:bg-line'"
            :aria-expanded="open"
            :aria-label="`${open ? 'Hide' : 'Show'} ${p.direct} direct reports of ${p.name}`"
            @click.stop="toggle(v)"
          >
            {{ p.direct }} direct
            <svg class="h-3 w-3 transition-transform" :class="open && 'rotate-180'" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div class="flex gap-2.5 text-2xs text-ink-3">
            <span :title="`${num(p.desc)} people in this org`"><b class="font-semibold text-ink">{{ num(p.desc) }}</b> total</span>
            <span :title="`${num(p.nonLeaf)} of them manage someone`"><b class="font-semibold text-ink">{{ num(p.nonLeaf) }}</b> mgrs</span>
          </div>
        </div>
      </template>

      <div v-else class="mt-auto flex items-center justify-between text-xs">
        <span class="text-ink-3">Individual contributor</span>
        <span class="font-medium">{{ money(p.salary) }}</span>
      </div>
    </div>
  </article>
</template>
