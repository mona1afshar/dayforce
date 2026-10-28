<script setup>
import { computed } from 'vue'
import { initials } from '../lib/format.js'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 32 },
  manager: { type: Boolean, default: false },
})
const text = computed(() => initials(props.name))
</script>

<template>
  <span
    class="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
    :class="manager ? 'bg-ink text-surface' : 'bg-sunken text-ink-2 ring-1 ring-inset ring-line-strong'"
    :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.36) + 'px' }"
    aria-hidden="true"
  >
    {{ text }}
  </span>
</template>
