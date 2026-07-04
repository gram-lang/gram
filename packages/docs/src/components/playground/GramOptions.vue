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
      <label class="option-item">
        <input type="checkbox" v-model="massEnabled" />
        <div class="option-text">
          <span class="option-name">Mass Standardization</span>
          <span class="option-desc">Converts all ingredient quantities into a standardized mass (grams).</span>
        </div>
      </label>
      
      <label class="option-item child-option" :class="{ disabled: !massEnabled }">
        <input type="checkbox" v-model="yieldEnabled" :disabled="!massEnabled" />
        <div class="option-text">
          <span class="option-name">Yield Management</span>
          <span class="option-desc">Calculates the gross amount needed considering ingredient yield factors.</span>
        </div>
      </label>

      <label class="option-item">
        <input type="checkbox" v-model="nutritionEnabled" />
        <div class="option-text">
          <span class="option-name">Nutrition Estimation</span>
          <span class="option-desc">Estimates nutritional values based on the ingredients database.</span>
        </div>
      </label>
    </div>
  </div>
</template>

<style scoped>
.gram-options {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 16px;
  font-size: 14px;
  width: 320px; /* Fixed width for better wrapping of descriptions */
}

.options-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
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
  gap: 16px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-name {
  color: var(--vp-c-text-1);
  font-weight: 500;
  line-height: 1.2;
  transition: color 0.2s;
}

.option-desc {
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.4;
}

.option-item:hover .option-name {
  color: var(--vp-c-brand-1);
}

.child-option {
  margin-left: 24px;
  position: relative;
}

.child-option::before {
  content: '';
  position: absolute;
  left: -17px;
  top: -16px;
  width: 2px;
  height: 24px;
  background-color: var(--vp-c-divider);
  border-bottom-left-radius: 4px;
}

.child-option::after {
  content: '';
  position: absolute;
  left: -17px;
  top: 8px;
  width: 12px;
  height: 2px;
  background-color: var(--vp-c-divider);
}

.child-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.child-option.disabled:hover .option-name {
  color: var(--vp-c-text-1); /* remove hover effect when disabled */
}

input[type="checkbox"] {
  cursor: inherit;
  margin-top: 1px; /* Align checkbox with the top of the text */
}
</style>
