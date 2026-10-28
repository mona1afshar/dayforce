<script setup>
import { computed } from 'vue'
import { money, num, pct } from '../lib/format.js'
import { showTip, moveTip, hideTip } from '../lib/tooltip.js'

// Columns per reporting layer below the leader: where does the spend sit?
const props = defineProps({ layers: { type: Array, required: true } })
const max = computed(() => Math.max(1, ...props.layers.map((l) => l.mgmt + l.ic)))
const PLOT = 168

function tipFor(e, l) {
  const t = l.mgmt + l.ic
  showTip(e, `Layer ${l.layer}`, [
    ['Management', money(l.mgmt), 'bg-mgmt'],
    ['IC', money(l.ic), 'bg-ic'],
    ['Total', money(t)],
    ['People', num(l.headcount)],
    ['Managers', `${num(l.managers)} (${pct(l.managers / l.headcount)})`],
  ])
}
</script>

<template>
  <div>
    <div class="relative" :style="{ height: PLOT + 34 + 'px' }" @mousemove="moveTip">
      <!-- baseline -->
      <div class="absolute inset-x-0 border-t border-line-strong" :style="{ top: PLOT + 16 + 'px' }" />
      <div class="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
        <button
          v-for="l in layers"
          :key="l.layer"
          type="button"
          class="flex h-full min-w-0 flex-1 flex-col items-stretch justify-end rounded-md focus-visible:outline-offset-4"
          :aria-label="`Layer ${l.layer}: ${money(l.mgmt + l.ic)}, ${num(l.headcount)} people`"
          @mouseenter="tipFor($event, l)"
          @mouseleave="hideTip"
          @focus="tipFor($event, l)"
          @blur="hideTip"
        >
          <span class="mb-1 truncate text-center text-2xs font-medium text-ink-2">{{ money(l.mgmt + l.ic) }}</span>
          <span class="flex flex-col gap-[2px]" :style="{ height: Math.max(2, ((l.mgmt + l.ic) / max) * PLOT) + 'px' }">
            <span v-if="l.mgmt > 0" class="rounded-t-[4px] bg-mgmt" :style="{ height: (l.mgmt / (l.mgmt + l.ic)) * 100 + '%' }" />
            <span v-if="l.ic > 0" class="flex-1 bg-ic" :class="!l.mgmt && 'rounded-t-[4px]'" />
          </span>
          <span class="mt-[18px] block h-0" />
        </button>
      </div>
    </div>
    <div class="flex gap-1.5 sm:gap-2.5">
      <div v-for="l in layers" :key="l.layer" class="min-w-0 flex-1 text-center">
        <div class="text-xs font-medium">{{ l.layer }}</div>
        <div class="truncate text-2xs text-ink-3">{{ num(l.headcount) }}</div>
      </div>
    </div>
    <p class="mt-2 text-2xs text-ink-3">Layers below the leader (1 = direct reports), with headcount under each.</p>
  </div>
</template>
