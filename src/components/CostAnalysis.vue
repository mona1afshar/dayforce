<script setup>
import { computed, ref } from 'vue'
import { org, ui, reveal, analyze } from '../store.js'
import { analyzeScope, DIMENSIONS } from '../lib/analytics.js'
import { children, pathToRoot } from '../lib/orgEngine.js'
import { money, moneyFull, num, pct, ratio } from '../lib/format.js'
import SearchBox from './SearchBox.vue'
import BreakdownChart from './BreakdownChart.vue'
import LayerChart from './LayerChart.vue'
import SpanChart from './SpanChart.vue'
import ManagersTable from './ManagersTable.vue'
import Avatar from './Avatar.vue'

const o = computed(() => org.value)
const v = computed(() => (ui.scope >= 0 ? ui.scope : o.value.roots[0]))
const isManager = computed(() => o.value.childCount[v.value] > 0)
const a = computed(() => (isManager.value ? analyzeScope(o.value, v.value) : null))
const chain = computed(() => pathToRoot(o.value, v.value).slice(0, -1))
const firstName = computed(() => o.value.name[v.value].split(' ')[0])

/* Breakdown: direct reports' orgs come straight from the precomputed per-node
   totals (O(direct reports)); the other dimensions come from the scope scan. */
const dim = ref('team')
const dims = [{ key: 'team', label: 'Direct reports' }, ...DIMENSIONS]
const breakdown = computed(() => {
  if (!a.value) return []
  if (dim.value !== 'team') return a.value.groups[dim.value]
  const x = o.value
  return children(x, v.value).map((c) => {
    const lead = x.childCount[c] > 0
    const mgmt = (lead ? x.salary[c] : 0) + x.mgmtCost[c]
    const ic = (lead ? 0 : x.salary[c]) + x.icCost[c]
    return { key: String(c), v: c, label: x.name[c], sub: x.title[c], headcount: 1 + x.desc[c], mgmt, ic, total: mgmt + ic }
  })
})

/* A one-line read of the org, written from the numbers. */
const summary = computed(() => {
  const s = a.value
  if (!s) return ''
  const top = s.groups.department[0]
  const mgmtShare = pct(s.mgmt / s.total)
  let line = `Management is ${mgmtShare} of the ${money(s.total)} spent below ${firstName.value}. `
  if (top) line += `${top.key} is the costliest department at ${money(top.total)}.`
  return line
})

function openInChart(u) {
  reveal(u)
}
</script>

<template>
  <div class="scrollbar-thin h-full overflow-y-auto">
    <div class="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
      <!-- Scope -->
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <nav v-if="chain.length" aria-label="Reporting line" class="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-3">
            <template v-for="(u, i) in chain" :key="u">
              <button type="button" class="rounded px-1 hover:bg-surface hover:text-ink" @click="analyze(u)">{{ o.name[u] }}</button>
              <span aria-hidden="true">/</span>
            </template>
          </nav>
          <div class="flex items-center gap-3">
            <Avatar :name="o.name[v]" manager :size="44" />
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">{{ o.name[v] }}’s organization</h1>
              <p class="text-sm text-ink-2">{{ o.title[v] }}, {{ o.department[v] }}, {{ o.location[v] }}</p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <SearchBox class="w-full sm:w-72" placeholder="Analyze another manager" managers-only @pick="analyze" />
          <button type="button" class="h-9 shrink-0 rounded-lg px-3 text-sm font-medium ring-1 ring-inset ring-line-strong hover:bg-surface" @click="openInChart(v)">Show in chart</button>
        </div>
      </div>

      <div v-if="!a" class="mt-10 rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <p class="font-medium">{{ o.name[v] }} doesn’t manage anyone.</p>
        <p class="mt-1 text-sm text-ink-2">Search for a manager above, or go back to <button type="button" class="font-medium underline" @click="analyze(o.roots[0])">the whole company</button>.</p>
      </div>

      <template v-else>
        <p class="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-2">{{ summary }}</p>

        <!-- Headline numbers -->
        <dl class="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-3 lg:grid-cols-6" style="gap: 1px">
          <div class="bg-surface p-4">
            <dt class="text-xs text-ink-3">People</dt>
            <dd class="mt-1 text-2xl font-semibold tracking-tight">{{ num(a.headcount) }}</dd>
            <dd class="mt-0.5 text-xs text-ink-2">{{ num(a.managerCount) }} managers, {{ num(a.icCount) }} ICs</dd>
          </div>
          <div class="bg-surface p-4">
            <dt class="text-xs text-ink-3">Total cost</dt>
            <dd class="mt-1 text-2xl font-semibold tracking-tight" :title="moneyFull(a.total)">{{ money(a.total) }}</dd>
            <dd class="mt-0.5 text-xs text-ink-2">Salaries of everyone below</dd>
          </div>
          <div class="bg-surface p-4">
            <dt class="flex items-center gap-1.5 text-xs text-ink-3"><i class="h-2 w-2 rounded-[2px] bg-mgmt" />Management cost</dt>
            <dd class="mt-1 text-2xl font-semibold tracking-tight" :title="moneyFull(a.mgmt)">{{ money(a.mgmt) }}</dd>
            <dd class="mt-0.5 text-xs text-ink-2">{{ pct(a.mgmt / a.total) }} of total</dd>
          </div>
          <div class="bg-surface p-4">
            <dt class="flex items-center gap-1.5 text-xs text-ink-3"><i class="h-2 w-2 rounded-[2px] bg-ic" />IC cost</dt>
            <dd class="mt-1 text-2xl font-semibold tracking-tight" :title="moneyFull(a.ic)">{{ money(a.ic) }}</dd>
            <dd class="mt-0.5 text-xs text-ink-2">{{ pct(a.ic / a.total) }} of total</dd>
          </div>
          <div class="bg-surface p-4">
            <dt class="text-xs text-ink-3">Management cost ratio</dt>
            <dd class="mt-1 text-2xl font-semibold tracking-tight">{{ ratio(a.ratio) }}</dd>
            <dd class="mt-0.5 text-xs text-ink-2">${{ ratio(a.ratio) }} of management per $1 of IC</dd>
          </div>
          <div class="bg-surface p-4">
            <dt class="text-xs text-ink-3">Average span of control</dt>
            <dd class="mt-1 text-2xl font-semibold tracking-tight">{{ a.avgSpan.toFixed(1) }}</dd>
            <dd class="mt-0.5 text-xs" :class="a.singleReportManagers ? 'font-medium text-warn' : 'text-ink-2'">
              {{ a.singleReportManagers ? `${num(a.singleReportManagers)} with a single report` : 'No single-report managers' }}
            </dd>
          </div>
        </dl>

        <!-- Breakdown -->
        <section class="mt-6 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-semibold">Where the money goes</h2>
              <p class="text-sm text-ink-2">Cost split by management and individual contributors.</p>
            </div>
            <div class="flex flex-wrap gap-1 rounded-lg bg-sunken p-1 text-xs" role="tablist" aria-label="Group by">
              <button
                v-for="d in dims"
                :key="d.key"
                type="button"
                role="tab"
                :aria-selected="dim === d.key"
                class="rounded-md px-2.5 py-1.5 font-medium"
                :class="dim === d.key ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:text-ink'"
                @click="dim = d.key"
              >
                {{ d.label }}
              </button>
            </div>
          </div>
          <BreakdownChart class="mt-4" :rows="breakdown" :drillable="dim === 'team'" @drill="(u) => o.childCount[u] && analyze(u)" />
        </section>

        <div class="mt-6 grid gap-6 lg:grid-cols-5">
          <section class="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5 lg:col-span-3">
            <h2 class="text-base font-semibold">Cost by layer</h2>
            <p class="mb-4 text-sm text-ink-2">Deep orgs pay for more management between the leader and the work.</p>
            <LayerChart :layers="a.layers" />
          </section>
          <section class="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5 lg:col-span-2">
            <h2 class="text-base font-semibold">Span of control</h2>
            <p class="mb-4 text-sm text-ink-2">Managers by number of direct reports. Single-report managers are often a layer to remove.</p>
            <SpanChart :spans="a.spans" />
            <dl class="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt class="text-xs text-ink-3">Average manager salary</dt>
                <dd class="font-semibold">{{ money(a.avgManagerSalary) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-ink-3">Average IC salary</dt>
                <dd class="font-semibold">{{ money(a.avgIcSalary) }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section class="mt-6 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
          <h2 class="text-base font-semibold">Managers in this org</h2>
          <p class="mb-3 text-sm text-ink-2">Sort to find the most expensive teams, the heaviest management overhead, or the narrowest spans.</p>
          <ManagersTable :managers="a.managers" :org-ratio="a.ratio" @open="openInChart" @analyze="analyze" />
        </section>
      </template>
    </div>
  </div>
</template>
