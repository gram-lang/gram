<script setup lang="ts">
import { computed } from 'vue'
import { UNIT_CONVERSIONS } from '@gram-lang/analyzer'
import { formatDecimalToFraction } from '@gram-lang/renderer'
import { useData } from 'vitepress'
import { getDictionary } from '@gram-lang/i18n'

const { lang } = useData()
const t = computed(() => getDictionary(lang.value))

const knownUnits = [
  ...Object.keys(UNIT_CONVERSIONS.mass.map),
  ...Object.keys(UNIT_CONVERSIONS.volume.map)
]

const props = defineProps<{
  options: {
    enableMassStandardization: boolean
    enableYieldCalculation: boolean
    enableNutritionalEstimation: boolean
    bakersMath: boolean
    bakersMathOnly: boolean
    bakersReference: string | undefined
  },
  shoppingList?: any[],
  scaleTargetId: string | null,
  scaleTargetQty: number | null,
  scaleTargetUnit: string
}>()

const emit = defineEmits<{
  'update:options': [options: typeof props.options],
  'update:scaleTargetId': [val: string | null],
  'update:scaleTargetQty': [val: number | null],
  'update:scaleTargetUnit': [val: string],
  'scale-apply': []
}>()

const massEnabled = computed({
  get: () => props.options.enableMassStandardization,
  set: (val) => emit('update:options', { ...props.options, enableMassStandardization: val })
})

const yieldEnabled = computed({
  get: () => props.options.enableYieldCalculation,
  set: (val) => emit('update:options', { ...props.options, enableYieldCalculation: val })
})

const nutritionEnabled = computed({
  get: () => props.options.enableNutritionalEstimation,
  set: (val) => emit('update:options', { ...props.options, enableNutritionalEstimation: val })
})

const bakersMath = computed({
  get: () => props.options.bakersMath,
  set: (val) => emit('update:options', { ...props.options, bakersMath: val })
})

const bakersMathOnly = computed({
  get: () => props.options.bakersMathOnly,
  set: (val) => emit('update:options', { ...props.options, bakersMathOnly: val })
})

const bakersReference = computed({
  get: () => props.options.bakersReference || '',
  set: (val) => emit('update:options', { ...props.options, bakersReference: val || undefined })
})

const targetId = computed({
  get: () => props.scaleTargetId || '',
  set: (val) => {
    emit('update:scaleTargetId', val || null)
    if (val && props.shoppingList) {
      const item = props.shoppingList.find(i => i.id === val)
      if (item) {
        emit('update:scaleTargetUnit', item.unit || '')
        if (item.qty && typeof item.qty === 'number') {
          emit('update:scaleTargetQty', item.qty)
        } else {
          emit('update:scaleTargetQty', null)
        }
      }
    }
  }
})

const targetQty = computed({
  get: () => {
    if (props.scaleTargetQty === null) return ''
    return formatDecimalToFraction(props.scaleTargetQty)
  },
  set: (val: string) => {
    if (!val) {
      emit('update:scaleTargetQty', null)
      return
    }
    let parsed: number | null = null
    if (val.includes('/')) {
      const parts = val.split('/')
      if (parts.length === 2) {
        const n = parseFloat(parts[0])
        const d = parseFloat(parts[1])
        if (!isNaN(n) && !isNaN(d) && d !== 0) parsed = n / d
      }
    } else {
      parsed = parseFloat(val)
    }
    if (parsed !== null && !isNaN(parsed)) {
      emit('update:scaleTargetQty', parsed)
    } else {
      emit('update:scaleTargetQty', null)
    }
  }
})

const targetUnit = computed({
  get: () => props.scaleTargetUnit,
  set: (val) => emit('update:scaleTargetUnit', val)
})

function submitScale() {
  emit('scale-apply')
}
</script>

<template>
  <div class="gram-options">
    <div class="options-section">
      <div class="options-header">
        <span class="options-title">{{ t.playground.options.scaleTitle }}</span>
      </div>
      <div class="options-body scale-body">
        <select class="scale-select" v-model="targetId">
          <option value="">{{ t.playground.options.selectIngredient }}</option>
          <option v-for="item in props.shoppingList" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select>
        <div class="scale-inputs" v-if="targetId">
          <input type="text" class="scale-input qty" v-model.lazy="targetQty" :placeholder="t.playground.options.qty" @keydown.enter="submitScale" />
          <input type="text" list="gram-units" class="scale-input unit" v-model="targetUnit" :placeholder="t.playground.options.unit" @keydown.enter="submitScale" />
          <button class="scale-apply-btn" @click="submitScale">{{ t.playground.options.apply }}</button>
        </div>
      </div>
    </div>

    <datalist id="gram-units">
      <option v-for="u in knownUnits" :key="u" :value="u"></option>
    </datalist>

    <div class="options-section">
      <div class="options-header">
        <span class="options-title">{{ t.playground.options.bakersMath }}</span>
      </div>
      <div class="options-body">
        <label class="option-item">
          <input type="checkbox" v-model="bakersMath" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.enableBakersMath }}</span>
            <span class="option-desc">{{ t.playground.options.bakersMathDesc }}</span>
          </div>
        </label>
        
        <label class="option-item child-option" :class="{ disabled: !bakersMath }">
          <input type="checkbox" v-model="bakersMathOnly" :disabled="!bakersMath" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.hideAbsolute }}</span>
          </div>
        </label>

        <div class="child-option select-wrapper" :class="{ disabled: !bakersMath }" v-if="bakersMath">
          <span class="select-label">{{ t.playground.options.forceReference }}</span>
          <select class="scale-select" v-model="bakersReference" :disabled="!bakersMath">
            <option value="">{{ t.playground.options.autoDetect }}</option>
            <option v-for="item in props.shoppingList" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div class="options-section">
      <div class="options-header">
        <span class="options-title">{{ t.playground.options.physicalAnalysis }}</span>
      </div>
      <div class="options-body">
        <label class="option-item">
          <input type="checkbox" v-model="massEnabled" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.massStandardization }}</span>
            <span class="option-desc">{{ t.playground.options.massDesc }}</span>
          </div>
        </label>
        
        <label class="option-item child-option" :class="{ disabled: !massEnabled }">
          <input type="checkbox" v-model="yieldEnabled" :disabled="!massEnabled" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.yieldManagement }}</span>
          </div>
        </label>

        <label class="option-item">
          <input type="checkbox" v-model="nutritionEnabled" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.nutrition }}</span>
          </div>
        </label>
      </div>
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
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 80vh;
  overflow-y: auto;
}

.options-section {
  display: flex;
  flex-direction: column;
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
  gap: 12px;
}

.scale-body {
  gap: 8px;
}

.scale-select {
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  outline: none;
}
.scale-select:focus {
  border-color: var(--vp-c-brand-1);
}

.scale-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.scale-input {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  outline: none;
}
.scale-input:focus {
  border-color: var(--vp-c-brand-1);
}
.scale-input.qty { flex: 2; min-width: 0; }
.scale-input.unit { flex: 1; min-width: 0; }

.scale-apply-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background-color: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.scale-apply-btn:hover {
  opacity: 0.9;
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

.select-wrapper::after {
  top: 14px;
}

.select-label {
  display: block;
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin-bottom: 4px;
}

.child-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

input[type="checkbox"] {
  cursor: inherit;
  margin-top: 1px;
}
</style>
