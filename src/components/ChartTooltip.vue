<script setup>
import { tip } from '../lib/tooltip.js'
</script>

<template>
  <div
    v-show="tip.show"
    class="pointer-events-none fixed z-50 min-w-[170px] -translate-x-1/2 -translate-y-full rounded-lg bg-surface px-3 py-2 text-xs shadow-lg ring-1 ring-line"
    :style="{ left: tip.x + 'px', top: tip.y - 6 + 'px' }"
    role="tooltip"
  >
    <div class="mb-1 font-semibold">{{ tip.title }}</div>
    <div v-for="r in tip.rows" :key="r[0]" class="flex items-center justify-between gap-4 py-px">
      <span class="flex items-center gap-1.5 text-ink-2"><i v-if="r[2]" class="h-2 w-2 rounded-[2px]" :class="r[2]" />{{ r[0] }}</span>
      <span class="font-medium">{{ r[1] }}</span>
    </div>
  </div>
</template>
