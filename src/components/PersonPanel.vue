<script setup>
import { computed } from 'vue'
import { org, ui, reveal, analyze, expandAllBelow, expanded, EXPAND_ALL_LIMIT } from '../store.js'
import { children, pathToRoot } from '../lib/orgEngine.js'
import { money, moneyFull, num, ratio, pct, splitEmoji, formatDate } from '../lib/format.js'
import Avatar from './Avatar.vue'
import CostSplit from './CostSplit.vue'

const v = computed(() => ui.selected)
const o = computed(() => org.value)

const person = computed(() => {
  const x = o.value
  const i = v.value
  const total = x.mgmtCost[i] + x.icCost[i]
  return {
    name: x.name[i],
    title: x.title[i],
    email: x.email[i],
    department: x.department[i],
    location: x.location[i],
    entity: x.entity[i],
    project: x.project[i],
    level: x.level[i],
    start: formatDate(x.startDate[i]),
    perf: splitEmoji(x.performance[i]),
    salary: x.salary[i],
    isManager: x.childCount[i] > 0,
    direct: x.childCount[i],
    desc: x.desc[i],
    nonLeaf: x.nonLeaf[i],
    mgmt: x.mgmtCost[i],
    ic: x.icCost[i],
    total,
    ratio: x.icCost[i] > 0 ? x.mgmtCost[i] / x.icCost[i] : null,
  }
})

const chain = computed(() => pathToRoot(o.value, v.value).slice(0, -1))
const reports = computed(() =>
  children(o.value, v.value).sort((a, b) => o.value.desc[b] - o.value.desc[a] || o.value.salary[b] - o.value.salary[a]),
)
const allOpen = computed(() => expanded.value.has(v.value) && reports.value.every((c) => o.value.childCount[c] === 0 || expanded.value.has(c)))
</script>

<template>
  <aside
    class="absolute inset-x-0 bottom-0 z-20 flex max-h-[72%] flex-col rounded-t-2xl border-t border-line bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.12)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[380px] md:rounded-none md:border-l md:border-t-0 md:shadow-none"
    aria-label="Person details"
  >
    <header class="flex items-start gap-3 border-b border-line p-4">
      <Avatar :name="person.name" :manager="person.isManager" :size="44" />
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-base font-semibold leading-snug">{{ person.name }}</h2>
        <p class="truncate text-sm text-ink-2">{{ person.title }}</p>
        <a :href="`mailto:${person.email}`" class="truncate text-xs text-ink-3 underline-offset-2 hover:underline">{{ person.email }}</a>
      </div>
      <button type="button" class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-sunken" aria-label="Close details" @click="ui.selected = -1">
        <svg class="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      </button>
    </header>

    <div class="scrollbar-thin flex-1 overflow-y-auto">
      <!-- Actions -->
      <div class="flex flex-wrap gap-2 px-4 pt-4">
        <button type="button" class="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface hover:bg-ink/85" @click="reveal(v)">Show in chart</button>
        <button v-if="person.isManager" type="button" class="rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-line-strong hover:bg-sunken" @click="analyze(v)">Analyze cost</button>
        <button
          v-if="person.isManager && person.desc <= EXPAND_ALL_LIMIT && !allOpen"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-line-strong hover:bg-sunken"
          @click="reveal(v); expandAllBelow(v)"
        >
          Open whole team
        </button>
      </div>

      <!-- Org metrics -->
      <section v-if="person.isManager" class="px-4 pt-5">
        <h3 class="text-sm font-semibold">Their organization</h3>
        <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
          <div class="flex flex-col-reverse rounded-lg bg-sunken px-2 py-2">
            <dt class="text-2xs text-ink-3">Direct reports</dt>
            <dd class="text-lg font-semibold leading-tight">{{ num(person.direct) }}</dd>
          </div>
          <div class="flex flex-col-reverse rounded-lg bg-sunken px-2 py-2">
            <dt class="text-2xs text-ink-3">Everyone below</dt>
            <dd class="text-lg font-semibold leading-tight">{{ num(person.desc) }}</dd>
          </div>
          <div class="flex flex-col-reverse rounded-lg bg-sunken px-2 py-2">
            <dt class="text-2xs text-ink-3">Managers below</dt>
            <dd class="text-lg font-semibold leading-tight">{{ num(person.nonLeaf) }}</dd>
          </div>
        </dl>

        <div class="mt-4 rounded-xl ring-1 ring-line">
          <div class="flex items-baseline justify-between px-3 pt-3">
            <span class="text-sm text-ink-2">Total cost</span>
            <span class="text-xl font-semibold" :title="moneyFull(person.total)">{{ money(person.total) }}</span>
          </div>
          <CostSplit class="mt-2.5 px-3" :mgmt="person.mgmt" :ic="person.ic" :height="8" />
          <dl class="grid grid-cols-2 gap-px border-t border-line bg-line mt-3 rounded-b-xl overflow-hidden text-sm">
            <div class="bg-surface px-3 py-2">
              <dt class="flex items-center gap-1.5 text-xs text-ink-3"><i class="h-2 w-2 rounded-[2px] bg-mgmt" />Management</dt>
              <dd class="font-semibold">{{ money(person.mgmt) }} <span class="text-xs font-normal text-ink-3">{{ pct(person.mgmt / person.total) }}</span></dd>
            </div>
            <div class="bg-surface px-3 py-2">
              <dt class="flex items-center gap-1.5 text-xs text-ink-3"><i class="h-2 w-2 rounded-[2px] bg-ic" />Individual contributors</dt>
              <dd class="font-semibold">{{ money(person.ic) }} <span class="text-xs font-normal text-ink-3">{{ pct(person.ic / person.total) }}</span></dd>
            </div>
            <div class="col-span-2 bg-surface px-3 py-2">
              <dt class="text-xs text-ink-3">Management cost ratio (management ÷ IC cost)</dt>
              <dd class="font-semibold">{{ ratio(person.ratio) }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- Profile -->
      <section class="px-4 pt-5">
        <h3 class="text-sm font-semibold">Profile</h3>
        <dl class="mt-2 divide-y divide-line text-sm">
          <div class="flex justify-between gap-4 py-1.5"><dt class="text-ink-3">Salary</dt><dd class="font-medium">{{ moneyFull(person.salary) }}</dd></div>
          <div class="flex justify-between gap-4 py-1.5"><dt class="text-ink-3">Department</dt><dd class="text-right">{{ person.department }}</dd></div>
          <div class="flex justify-between gap-4 py-1.5"><dt class="text-ink-3">Location</dt><dd class="text-right">{{ person.location }}</dd></div>
          <div class="flex justify-between gap-4 py-1.5"><dt class="text-ink-3">Entity</dt><dd class="text-right">{{ person.entity }}</dd></div>
          <div class="flex justify-between gap-4 py-1.5"><dt class="text-ink-3">Project</dt><dd class="text-right">{{ person.project }}</dd></div>
          <div class="flex justify-between gap-4 py-1.5"><dt class="text-ink-3">Level</dt><dd>{{ person.level }}</dd></div>
          <div class="flex justify-between gap-4 py-1.5"><dt class="text-ink-3">Started</dt><dd>{{ person.start }}</dd></div>
          <div class="flex justify-between gap-4 py-1.5">
            <dt class="text-ink-3">Performance</dt>
            <dd><span aria-hidden="true">{{ person.perf.icon }}</span> {{ person.perf.label }}</dd>
          </div>
        </dl>
      </section>

      <!-- Reporting line -->
      <section v-if="chain.length" class="px-4 pt-5">
        <h3 class="text-sm font-semibold">Reports up to</h3>
        <ol class="mt-2 space-y-0.5">
          <li v-for="(a, i) in chain" :key="a">
            <button type="button" class="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-sunken" :style="{ paddingLeft: 6 + i * 10 + 'px' }" @click="ui.selected = a">
              <Avatar :name="o.name[a]" manager :size="22" />
              <span class="min-w-0 flex-1 truncate text-sm">{{ o.name[a] }}</span>
              <span class="truncate text-xs text-ink-3">{{ o.title[a] }}</span>
            </button>
          </li>
        </ol>
      </section>

      <!-- Direct reports -->
      <section v-if="reports.length" class="px-4 pb-6 pt-5">
        <h3 class="text-sm font-semibold">Direct reports</h3>
        <ul class="mt-2 space-y-0.5">
          <li v-for="c in reports" :key="c">
            <button type="button" class="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-sunken" @click="ui.selected = c">
              <Avatar :name="o.name[c]" :manager="o.childCount[c] > 0" :size="28" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ o.name[c] }}</span>
                <span class="block truncate text-xs text-ink-3">{{ o.title[c] }}</span>
              </span>
              <span class="shrink-0 text-right text-xs">
                <span class="block font-medium">{{ o.childCount[c] ? money(o.mgmtCost[c] + o.icCost[c]) : money(o.salary[c]) }}</span>
                <span class="block text-ink-3">{{ o.childCount[c] ? `${num(o.desc[c])} people` : 'Salary' }}</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
      <div v-else class="h-6" />
    </div>
  </aside>
</template>
