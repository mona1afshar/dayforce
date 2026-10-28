<script setup>
import { computed, ref, watch } from 'vue'
import { org } from '../store.js'
import { money, num, ratio } from '../lib/format.js'

// Every manager inside the current scope, sortable by the metric that matters.
const props = defineProps({ managers: { type: Array, required: true }, orgRatio: { type: Number, default: null } })
const emit = defineEmits(['open', 'analyze'])

const COLS = [
  { key: 'desc', label: 'People', get: (o, v) => o.desc[v] },
  { key: 'direct', label: 'Direct', get: (o, v) => o.childCount[v] },
  { key: 'mgmt', label: 'Management', get: (o, v) => o.mgmtCost[v] },
  { key: 'ic', label: 'IC', get: (o, v) => o.icCost[v] },
  { key: 'total', label: 'Total cost', get: (o, v) => o.mgmtCost[v] + o.icCost[v] },
  { key: 'ratio', label: 'Mgmt ratio', get: (o, v) => (o.icCost[v] ? o.mgmtCost[v] / o.icCost[v] : -1) },
]
const sortKey = ref('total')
const page = ref(1)
const PAGE = 15
watch(() => props.managers, () => (page.value = 1))

const sorted = computed(() => {
  const o = org.value
  const col = COLS.find((c) => c.key === sortKey.value)
  // Decorate-sort-undecorate keeps the comparator cheap for ~11k managers.
  return props.managers
    .map((v) => [col.get(o, v), v])
    .sort((a, b) => b[0] - a[0])
    .map((x) => x[1])
})
const rows = computed(() => sorted.value.slice(0, page.value * PAGE))
const high = (v) => {
  const o = org.value
  return props.orgRatio != null && o.icCost[v] > 0 && o.mgmtCost[v] / o.icCost[v] > props.orgRatio * 1.5
}
</script>

<template>
  <div>
    <div class="scrollbar-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table class="w-full min-w-[720px] text-sm">
        <thead>
          <tr class="border-b border-line text-left text-xs text-ink-3">
            <th class="py-2 pr-3 font-medium">Manager</th>
            <th v-for="c in COLS" :key="c.key" class="py-2 pl-3 text-right font-medium" :aria-sort="sortKey === c.key ? 'descending' : 'none'">
              <button type="button" class="inline-flex items-center gap-1 rounded hover:text-ink" :class="sortKey === c.key && 'font-semibold text-ink'" @click="sortKey = c.key">
                {{ c.label }}
                <svg v-if="sortKey === c.key" class="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
              </button>
            </th>
            <th class="py-2 pl-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in rows" :key="v" class="border-b border-line/70 hover:bg-sunken">
            <td class="max-w-[16rem] py-2 pr-3">
              <button type="button" class="block w-full min-w-0 text-left" @click="emit('open', v)">
                <span class="block truncate font-medium hover:underline">{{ org.name[v] }}</span>
                <span class="block truncate text-xs text-ink-3">{{ org.title[v] }}, {{ org.department[v] }}</span>
              </button>
            </td>
            <td class="py-2 pl-3 text-right">{{ num(org.desc[v]) }}</td>
            <td class="py-2 pl-3 text-right" :class="org.childCount[v] === 1 && 'font-semibold text-warn'">{{ org.childCount[v] }}</td>
            <td class="py-2 pl-3 text-right">{{ money(org.mgmtCost[v]) }}</td>
            <td class="py-2 pl-3 text-right">{{ money(org.icCost[v]) }}</td>
            <td class="py-2 pl-3 text-right font-medium">{{ money(org.mgmtCost[v] + org.icCost[v]) }}</td>
            <td class="whitespace-nowrap py-2 pl-3 text-right">
              <span v-if="high(v)" class="mr-1 rounded bg-warn/15 px-1 text-2xs font-semibold text-warn">High</span>{{ ratio(org.icCost[v] ? org.mgmtCost[v] / org.icCost[v] : null) }}
            </td>
            <td class="py-2 pl-3 text-right">
              <button v-if="org.nonLeaf[v] > 0" type="button" class="rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-line-strong hover:bg-surface" @click="emit('analyze', v)">Analyze</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-3 flex items-center justify-between text-xs text-ink-3">
      <span>Showing {{ num(rows.length) }} of {{ num(managers.length) }} managers. “High” marks a ratio 1.5× above this org’s.</span>
      <button v-if="rows.length < managers.length" type="button" class="rounded-md px-2 py-1 font-medium text-ink ring-1 ring-inset ring-line-strong hover:bg-sunken" @click="page++">Show 15 more</button>
    </div>
  </div>
</template>
