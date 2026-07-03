<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  options: {
    enableMassStandardization: boolean
    enableYieldCalculation: boolean
    enableNutritionalEstimation: boolean
  }
}>()

const emit = defineEmits<{
  'update:options': [options: typeof props.options]
}>()

const massEnabled = computed({
  get: () => props.options.enableMassStandardization,
  set: (val) => {
    emit('update:options', { ...props.options, enableMassStandardization: val })
  }
})

const yieldEnabled = computed({
  get: () => props.options.enableYieldCalculation,
  set: (val) => {
    emit('update:options', { ...props.options, enableYieldCalculation: val })
  }
})

const nutritionEnabled = computed({
  get: () => props.options.enableNutritionalEstimation,
  set: (val) => {
    emit('update:options', { ...props.options, enableNutritionalEstimation: val })
  }
})
</script>

<template>
  <div class="gram-options">
    <div class="options-header">
      <span class="options-title">Analysis Options</span>
    </div>
    <div class="options-body">
      <label class="option-label">
        <input type="checkbox" v-model="massEnabled" />
        Mass Normalization
      </label>
      <label class="option-label child-option" :class="{ disabled: !massEnabled }">
        <input type="checkbox" v-model="yieldEnabled" :disabled="!massEnabled" />
        Yield Management (Gross Mass)
      </label>
      <label class="option-label">
        <input type="checkbox" v-model="nutritionEnabled" />
        Nutrition Estimation
      </label>
    </div>
  </div>
</template>

<style scoped>
.gram-options {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
}

.options-header {
  margin-bottom: 8px;
}

.options-title {
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.05em;
}

.options-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  user-select: none;
}

.option-label:hover {
  color: var(--vp-c-text-1);
}

.child-option {
  margin-left: 20px;
}

.child-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input[type="checkbox"] {
  cursor: inherit;
}
</style>
