<script setup>
import { computed, onMounted, ref } from 'vue'
import { org, ui, loadOrg, reveal } from './store.js'
import { num } from './lib/format.js'
import OrgChart from './components/OrgChart.vue'
import PersonPanel from './components/PersonPanel.vue'
import CostAnalysis from './components/CostAnalysis.vue'
import SearchBox from './components/SearchBox.vue'
import ChartTooltip from './components/ChartTooltip.vue'

onMounted(() => loadOrg())

const fileInput = ref(null)
const onFile = (e) => {
  const file = e.target.files?.[0]
  if (file) loadOrg({ file })
  e.target.value = ''
}

const issues = computed(() => {
  const i = org.value?.issues
  if (!i) return ''
  const parts = []
  if (i.unknownManagers) parts.push(`${num(i.unknownManagers)} people point to a manager who isn’t in the file and are shown as top-level`)
  if (i.cyclesBroken) parts.push(`${num(i.cyclesBroken)} reporting loops were cut`)
  if (i.duplicateIds) parts.push(`${num(i.duplicateIds)} duplicate employee IDs were skipped`)
  if (org.value.roots.length > 1) parts.push(`the chart starts from ${org.value.name[org.value.roots[0]]}; ${num(org.value.roots.length - 1)} other top-level people are reachable through search`)
  return parts.join('; ')
})

const tabs = [
  { key: 'chart', label: 'Org chart' },
  { key: 'analysis', label: 'Cost analysis' },
]
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
      <div class="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
        <svg class="h-7 w-7 shrink-0" viewBox="0 0 28 28" aria-hidden="true">
          <rect x="10" y="3" width="8" height="6" rx="2" class="fill-ink" />
          <rect x="2" y="19" width="8" height="6" rx="2" class="fill-mgmt" />
          <rect x="18" y="19" width="8" height="6" rx="2" class="fill-ic" />
          <path d="M14 9v5M6 19v-5h16v5" fill="none" class="stroke-ink" stroke-width="1.6" />
        </svg>
        <div class="min-w-0 leading-tight">
          <div class="truncate text-[15px] font-semibold">{{ ui.sourceName }}</div>
          <div v-if="org" class="truncate text-xs text-ink-3">
            {{ num(org.n) }} people<span v-if="ui.timings" class="hidden lg:inline">, built in {{ Math.round(ui.timings.parseMs + ui.timings.buildMs) }} ms</span>
          </div>
        </div>
      </div>

      <nav class="order-3 flex w-full gap-1 rounded-lg bg-sunken p-1 sm:order-none sm:w-auto" aria-label="Views">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium sm:flex-none"
          :class="ui.view === t.key ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:text-ink'"
          :aria-current="ui.view === t.key ? 'page' : undefined"
          :disabled="ui.status !== 'ready'"
          @click="ui.view = t.key"
        >
          {{ t.label }}
        </button>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <SearchBox v-if="ui.status === 'ready'" class="hidden w-72 sm:block" placeholder="Find a person" @pick="reveal" />
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 ring-1 ring-inset ring-line hover:bg-sunken hover:text-ink"
          title="Load a different people CSV"
          @click="fileInput.click()"
        >
          <svg class="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span class="hidden md:inline">Load CSV</span>
          <span class="sr-only md:hidden">Load CSV</span>
        </button>
        <input ref="fileInput" type="file" accept=".csv,text/csv" class="hidden" @change="onFile" />
      </div>

      <SearchBox v-if="ui.status === 'ready' && ui.view === 'chart'" class="order-4 w-full sm:hidden" placeholder="Find a person" @pick="reveal" />
    </header>

    <p v-if="issues && ui.status === 'ready'" class="border-b border-line bg-warn/10 px-4 py-1.5 text-xs text-ink-2">Data note: {{ issues }}.</p>

    <main class="relative min-h-0 flex-1">
      <div v-if="ui.status === 'loading'" class="grid h-full place-items-center p-6">
        <div class="w-full max-w-xs text-center">
          <div class="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-line">
            <div class="h-full w-1/3 animate-[loading_1.1s_ease-in-out_infinite] rounded-full bg-ink" />
          </div>
          <p class="mt-4 text-sm font-medium">Building the org chart</p>
          <p class="mt-1 text-xs text-ink-3">Reading every reporting line and adding up costs.</p>
        </div>
      </div>

      <div v-else-if="ui.status === 'error'" class="grid h-full place-items-center p-6">
        <div class="max-w-sm rounded-2xl bg-surface p-6 text-center ring-1 ring-line">
          <p class="font-semibold">The org couldn’t be loaded</p>
          <p class="mt-1 text-sm text-ink-2">{{ ui.error }}</p>
          <p class="mt-3 text-sm text-ink-2">Check that the file is a CSV with Employee Id, Name, Manager and Salary columns.</p>
          <div class="mt-4 flex justify-center gap-2">
            <button type="button" class="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-surface" @click="fileInput.click()">Choose a CSV</button>
            <button type="button" class="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ring-line-strong" @click="loadOrg()">Load Giga Corp</button>
          </div>
        </div>
      </div>

      <template v-else>
        <div v-show="ui.view === 'chart'" class="absolute inset-0">
          <OrgChart :key="ui.loadId" />
          <PersonPanel v-if="ui.selected >= 0" :key="ui.selected" />
        </div>
        <CostAnalysis v-if="ui.view === 'analysis'" :key="ui.loadId" class="absolute inset-0" />
      </template>
    </main>

    <ChartTooltip />
  </div>
</template>

<style>
@keyframes loading {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
</style>
