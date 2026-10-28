<script setup>
import { computed, ref, watch } from 'vue'
import { money, moneyFull, num, pct } from '../lib/format.js'
import { showTip, moveTip, hideTip } from '../lib/tooltip.js'

// Horizontal stacked bars: management cost then IC cost per group.
const props = defineProps({
  rows: { type: Array, required: true }, // { key, label?, headcount, mgmt, ic, total, v? }
  drillable: { type: Boolean, default: false },
})
const emit = defineEmits(['drill'])

const SORTS = [
  { key: 'total', label: 'Total cost' },
  { key: 'share', label: 'Management share' },
  { key: 'headcount', label: 'Headcount' },
]
const sortBy = ref('total')
const showAll = ref(false)
const LIMIT = 10
watch(() => props.rows, () => (showAll.value = false))

const sorted = computed(() => {
  const share = (r) => (r.total ? r.mgmt / r.total : 0)
  const f = { total: (r) => r.total, share, headcount: (r) => r.headcount }[sortBy.value]
  return [...props.rows].sort((a, b) => f(b) - f(a))
})
const shown = computed(() => (showAll.value ? sorted.value : sorted.value.slice(0, LIMIT)))
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.total)))

function tipFor(e, r) {
  showTip(e, r.label ?? r.key, [
    ['Management', money(r.mgmt), 'bg-mgmt'],
    ['IC', money(r.ic), 'bg-ic'],
    ['Total', moneyFull(r.total)],
    ['Management share', pct(r.total ? r.mgmt / r.total : 0)],
    ['People', num(r.headcount)],
  ])
}
</script>

<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      <span class="mr-1 text-ink-3">Sort by</span>
      <button
        v-for="s in SORTS"
        :key="s.key"
        type="button"
        class="rounded-md px-2 py-1 font-medium"
        :class="sortBy === s.key ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-sunken'"
        :aria-pressed="sortBy === s.key"
        @click="sortBy = s.key"
      >
        {{ s.label }}
      </button>
    </div>

    <div class="grid grid-cols-[minmax(0,9rem)_1fr_4.25rem] gap-3 border-b border-line px-1 pb-1.5 text-2xs text-ink-3 sm:grid-cols-[minmax(0,13rem)_1fr_4.5rem_3.5rem]" aria-hidden="true">
      <span />
      <span class="flex items-center gap-3">
        <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-[2px] bg-mgmt" />Management</span>
        <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-[2px] bg-ic" />IC</span>
      </span>
      <span class="text-right">Total</span>
      <span class="hidden text-right sm:block">People</span>
    </div>
    <ul class="mt-1 space-y-0.5" @mousemove="moveTip">
      <li v-for="r in shown" :key="r.key">
        <component
          :is="drillable ? 'button' : 'div'"
          :type="drillable ? 'button' : undefined"
          class="group grid w-full grid-cols-[minmax(0,9rem)_1fr_4.25rem] items-center gap-3 rounded-md px-1 py-1 text-left sm:grid-cols-[minmax(0,13rem)_1fr_4.5rem_3.5rem]"
          :class="drillable && 'hover:bg-sunken'"
          @mouseenter="tipFor($event, r)"
          @mouseleave="hideTip"
          @focus="tipFor($event, r)"
          @blur="hideTip"
          @click="drillable && (hideTip(), emit('drill', r.v))"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm">{{ r.label ?? r.key }}</span>
            <span v-if="r.sub" class="block truncate text-2xs text-ink-3">{{ r.sub }}</span>
          </span>
          <span class="flex h-3.5 gap-[2px]" :style="{ width: (r.total / max) * 100 + '%' }" aria-hidden="true">
            <span v-if="r.mgmt > 0" class="rounded-l-[3px] bg-mgmt" :class="!r.ic && 'rounded-r-[4px]'" :style="{ width: (r.mgmt / r.total) * 100 + '%' }" />
            <span v-if="r.ic > 0" class="flex-1 rounded-r-[4px] bg-ic" :class="!r.mgmt && 'rounded-l-[3px]'" />
          </span>
          <span class="text-right text-sm font-medium">{{ money(r.total) }}</span>
          <span class="hidden text-right text-xs text-ink-3 sm:block">{{ num(r.headcount) }}</span>
        </component>
      </li>
    </ul>

    <div class="mt-2 flex items-center justify-between text-xs text-ink-3">
      <button v-if="rows.length > LIMIT" type="button" class="rounded-md px-1 py-1 font-medium text-ink hover:underline" @click="showAll = !showAll">
        {{ showAll ? 'Show top 10' : `Show all ${rows.length}` }}
      </button>
      <span v-else />
      <span v-if="drillable">Select a row to analyze that org</span>
    </div>
  </div>
</template>
