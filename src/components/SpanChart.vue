<script setup>
import { computed } from 'vue'
import { num, pct } from '../lib/format.js'

// How many people each manager leads directly.
const props = defineProps({ spans: { type: Array, required: true } })
const total = computed(() => props.spans.reduce((s, x) => s + x.count, 0))
const max = computed(() => Math.max(1, ...props.spans.map((s) => s.count)))
</script>

<template>
  <ul class="space-y-1.5">
    <li v-for="s in spans" :key="s.span" class="grid grid-cols-[5.5rem_1fr_5.5rem] items-center gap-3">
      <span class="text-sm">{{ s.span }} {{ s.span === 1 ? 'report' : 'reports' }}</span>
      <span class="h-3.5">
        <span class="block h-full rounded-r-[4px] rounded-l-[2px]" :class="s.span === 1 ? 'bg-warn' : 'bg-ink-2'" :style="{ width: (s.count / max) * 100 + '%' }" />
      </span>
      <span class="text-right text-sm">
        <span class="font-medium">{{ num(s.count) }}</span>
        <span class="ml-1 text-xs text-ink-3">{{ pct(s.count / total) }}</span>
      </span>
    </li>
  </ul>
</template>
