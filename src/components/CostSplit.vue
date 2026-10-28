<script setup>
import { computed } from 'vue'

// Two-part bar: management cost vs IC cost. A 2px gap separates the fills.
const props = defineProps({
  mgmt: { type: Number, required: true },
  ic: { type: Number, required: true },
  height: { type: Number, default: 6 },
})
const share = computed(() => {
  const t = props.mgmt + props.ic
  return t > 0 ? props.mgmt / t : 0
})
</script>

<template>
  <div
    class="flex w-full gap-[2px]"
    :style="{ height: height + 'px' }"
    role="img"
    :aria-label="`Management ${Math.round(share * 100)}% of cost, individual contributors ${100 - Math.round(share * 100)}%`"
  >
    <div v-if="share > 0" class="rounded-l-[3px] bg-mgmt" :class="share >= 1 && 'rounded-r-[3px]'" :style="{ width: share * 100 + '%' }" />
    <div v-if="share < 1" class="flex-1 rounded-r-[3px] bg-ic" :class="share <= 0 && 'rounded-l-[3px]'" />
  </div>
</template>
