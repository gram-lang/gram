<script setup lang="ts">
import { computed } from "vue";
import { formatDecimalToFraction } from "@gram-lang/renderer";
import { UNIT_CONVERSIONS } from "@gram-lang/i18n";
import { useI18n } from "./useI18n";

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const { t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: knownUnits is used in the <template> block below, which Biome's Vue support doesn't see.
const knownUnits = [
	...Object.keys(UNIT_CONVERSIONS.mass.map),
	...Object.keys(UNIT_CONVERSIONS.volume.map),
];

const props = defineProps<{
	options: {
		enableMassStandardization: boolean;
		enableYieldCalculation: boolean;
		enableNutritionalEstimation: boolean;
		bakersMath: boolean;
		bakersMathOnly: boolean;
		bakersReference: string | undefined;
	};
	shoppingList?: any[];
	scaleFactorString?: string;
	scaleTargetId: string | null;
	scaleTargetQty: number | null;
	scaleTargetUnit: string;
}>();

const emit = defineEmits<{
	"update:options": [options: typeof props.options];
	"update:scaleFactorString": [val: string];
	"update:scaleTargetId": [val: string | null];
	"update:scaleTargetQty": [val: number | null];
	"update:scaleTargetUnit": [val: string];
	"clear-target": [];
	"scale-apply": [];
}>();

// biome-ignore lint/correctness/noUnusedVariables: globalScaleFactor is used in the <template> block below, which Biome's Vue support doesn't see.
const globalScaleFactor = computed({
	get: () => props.scaleFactorString || "100",
	set: (val: string) => {
		emit("update:scaleFactorString", val);
		emit("clear-target");
	},
});

// biome-ignore lint/correctness/noUnusedVariables: massEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const massEnabled = computed({
	get: () => props.options.enableMassStandardization,
	set: (val) =>
		emit("update:options", {
			...props.options,
			enableMassStandardization: val,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: yieldEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const yieldEnabled = computed({
	get: () => props.options.enableYieldCalculation,
	set: (val) =>
		emit("update:options", { ...props.options, enableYieldCalculation: val }),
});

// biome-ignore lint/correctness/noUnusedVariables: nutritionEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const nutritionEnabled = computed({
	get: () => props.options.enableNutritionalEstimation,
	set: (val) =>
		emit("update:options", {
			...props.options,
			enableNutritionalEstimation: val,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: bakersMath is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersMath = computed({
	get: () => props.options.bakersMath,
	set: (val) => emit("update:options", { ...props.options, bakersMath: val }),
});

// biome-ignore lint/correctness/noUnusedVariables: bakersMathOnly is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersMathOnly = computed({
	get: () => props.options.bakersMathOnly,
	set: (val) =>
		emit("update:options", { ...props.options, bakersMathOnly: val }),
});

// biome-ignore lint/correctness/noUnusedVariables: bakersReference is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersReference = computed({
	get: () => props.options.bakersReference || "",
	set: (val) =>
		emit("update:options", {
			...props.options,
			bakersReference: val || undefined,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: targetId is used in the <template> block below, which Biome's Vue support doesn't see.
const targetId = computed({
	get: () => props.scaleTargetId || "",
	set: (val) => {
		emit("update:scaleTargetId", val || null);
		if (val && props.shoppingList) {
			const item = props.shoppingList.find((i) => i.id === val);
			if (item) {
				emit("update:scaleTargetUnit", item.unit || "");
				if (item.qty && typeof item.qty === "number") {
					emit("update:scaleTargetQty", item.qty);
				} else {
					emit("update:scaleTargetQty", null);
				}
			}
		}
	},
});

// biome-ignore lint/correctness/noUnusedVariables: targetQty is used in the <template> block below, which Biome's Vue support doesn't see.
const targetQty = computed({
	get: () => {
		if (props.scaleTargetQty === null) return "";
		return formatDecimalToFraction(props.scaleTargetQty);
	},
	set: (val: string) => {
		if (!val) {
			emit("update:scaleTargetQty", null);
			return;
		}
		let parsed: number | null = null;
		if (val.includes("/")) {
			const parts = val.split("/");
			if (parts.length === 2) {
				const n = parseFloat(parts[0]);
				const d = parseFloat(parts[1]);
				if (!Number.isNaN(n) && !Number.isNaN(d) && d !== 0) parsed = n / d;
			}
		} else {
			parsed = parseFloat(val);
		}
		if (parsed !== null && !Number.isNaN(parsed)) {
			emit("update:scaleTargetQty", parsed);
		} else {
			emit("update:scaleTargetQty", null);
		}
	},
});

// biome-ignore lint/correctness/noUnusedVariables: targetUnit is used in the <template> block below, which Biome's Vue support doesn't see.
const targetUnit = computed({
	get: () => props.scaleTargetUnit,
	set: (val) => emit("update:scaleTargetUnit", val),
});

// biome-ignore lint/correctness/noUnusedVariables: submitScale is used in the <template> block below, which Biome's Vue support doesn't see.
function submitScale() {
	emit("scale-apply");
}
</script>

<template>
  <div class="gram-options">
    <div class="options-section">
      <div class="options-header">
        <span class="options-title">{{ t.playground.options.scaleTitle }}</span>
      </div>
      <div class="options-body scale-body">
        <div class="scale-group">
          <span class="scale-subtitle">{{ t.playground.options.scaleGlobal }}</span>
          <div class="scale-factor-wrapper">
            <input type="number" class="scale-factor-input" v-model="globalScaleFactor" min="1" step="any" />
            <span class="scale-factor-unit">%</span>
          </div>
        </div>

        <div class="scale-group">
          <span class="scale-subtitle">{{ t.playground.options.scaleByIngredient }}</span>
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
  background-color: var(--sl-color-bg);
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
  border-bottom: 1px solid var(--sl-color-border);
}

.options-title {
  font-weight: 600;
  color: var(--sl-color-text);
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
  gap: 12px;
}

.scale-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scale-subtitle {
  font-size: 11px;
  font-weight: 600;
  color: var(--sl-color-gray-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.scale-factor-wrapper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  padding-right: 8px;
  width: fit-content;
}

.scale-factor-wrapper:focus-within {
  border-color: var(--sl-color-gray-3);
}

.scale-factor-input {
  width: 52px;
  padding: 4px 2px 4px 8px;
  border: none;
  background: transparent;
  color: var(--sl-color-text);
  font-size: 13px;
  outline: none;
  text-align: right;
  -moz-appearance: textfield;
}

.scale-factor-input::-webkit-inner-spin-button,
.scale-factor-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.scale-factor-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--sl-color-gray-3);
  user-select: none;
}

.scale-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  color: var(--sl-color-text);
  font-size: 13px;
  outline: none;
}
.scale-select:focus {
  border-color: var(--sl-color-gray-3);
}

.scale-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.scale-input {
  padding: 6px 8px;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  color: var(--sl-color-text);
  font-size: 13px;
  outline: none;
}
.scale-input:focus {
  border-color: var(--sl-color-gray-3);
}
.scale-input.qty { flex: 2; min-width: 0; }
.scale-input.unit { flex: 1; min-width: 0; }

.scale-apply-btn {
  padding: 6px 12px;
  background-color: var(--sl-color-accent);
  color: var(--sl-color-bg);
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
  color: var(--sl-color-text);
  font-weight: 500;
  line-height: 1.2;
}

.option-desc {
  color: var(--sl-color-gray-3);
  font-size: 12px;
  line-height: 1.4;
}

.option-item:hover .option-name {
  color: var(--sl-color-accent);
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
  background-color: var(--sl-color-border);
  border-bottom-left-radius: 4px;
}

.child-option::after {
  content: '';
  position: absolute;
  left: -17px;
  top: 8px;
  width: 12px;
  height: 2px;
  background-color: var(--sl-color-border);
}

.select-wrapper::after {
  top: 14px;
}

.select-label {
  display: block;
  font-size: 12px;
  color: var(--sl-color-gray-3);
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
