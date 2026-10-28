<script setup>
import { computed, ref } from 'vue'
import { org } from '../store.js'
import { num } from '../lib/format.js'
import Avatar from './Avatar.vue'

const props = defineProps({
  placeholder: { type: String, default: 'Search people' },
  managersOnly: { type: Boolean, default: false },
})
const emit = defineEmits(['pick'])

const q = ref('')
const open = ref(false)
const active = ref(0)
const input = ref(null)
const listId = `search-${Math.random().toString(36).slice(2, 8)}`

// Lower-cased search text, built once per loaded org.
const cache = new WeakMap()
function index(o) {
  let ix = cache.get(o)
  if (!ix) {
    ix = { names: o.name.map((s) => s.toLowerCase()), rest: o.title.map((t, i) => `${t} ${o.email[i]} ${o.id[i]}`.toLowerCase()) }
    cache.set(o, ix)
  }
  return ix
}

const results = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term || !org.value) return []
  const o = org.value
  const { names, rest } = index(o)
  const hits = []
  for (let i = 0; i < o.n && hits.length < 400; i++) {
    if (props.managersOnly && o.childCount[i] === 0) continue
    const nm = names[i]
    let score = -1
    if (nm.startsWith(term)) score = 0
    else if (nm.includes(' ' + term)) score = 1
    else if (nm.includes(term)) score = 2
    else if (rest[i].includes(term)) score = 3
    if (score >= 0) hits.push([score, -o.desc[i], i])
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return hits.slice(0, 8).map((h) => h[2])
})

function pick(v) {
  emit('pick', v)
  q.value = ''
  open.value = false
  input.value?.blur()
}

function onKey(e) {
  if (!results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pick(results.value[active.value])
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="relative">
    <label class="flex h-9 items-center gap-2 rounded-lg bg-sunken px-3 ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-focus">
      <svg class="h-4 w-4 shrink-0 text-ink-3" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <span class="sr-only">{{ placeholder }}</span>
      <input
        ref="input"
        v-model="q"
        type="search"
        :placeholder="placeholder"
        class="w-full min-w-0 bg-transparent text-sm placeholder:text-ink-3 focus:outline-none"
        role="combobox"
        :aria-expanded="open && results.length > 0"
        :aria-controls="listId"
        autocomplete="off"
        @focus="open = true"
        @input="open = true; active = 0"
        @keydown="onKey"
        @blur="open = false"
      />
    </label>

    <ul
      v-if="open && q.trim()"
      :id="listId"
      role="listbox"
      class="absolute right-0 z-30 mt-1.5 w-full min-w-[300px] overflow-hidden rounded-xl bg-surface py-1 shadow-lg ring-1 ring-line"
    >
      <li v-if="!results.length" class="px-3 py-2.5 text-sm text-ink-3">No one matches “{{ q.trim() }}”.</li>
      <li
        v-for="(v, i) in results"
        :key="v"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer items-center gap-2.5 px-3 py-2"
        :class="i === active && 'bg-sunken'"
        @mousedown.prevent="pick(v)"
        @mouseenter="active = i"
      >
        <Avatar :name="org.name[v]" :manager="org.childCount[v] > 0" :size="28" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">{{ org.name[v] }}</div>
          <div class="truncate text-xs text-ink-3">{{ org.title[v] }}, {{ org.department[v] }}</div>
        </div>
        <span v-if="org.childCount[v]" class="shrink-0 text-xs text-ink-3">{{ num(org.desc[v]) }} in org</span>
      </li>
    </ul>
  </div>
</template>
