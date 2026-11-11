<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, watch } from "vue";
import { formatDecimalToFraction } from "@gram-lang/renderer";
// biome-ignore lint/correctness/noUnusedImports: OptionsSection is used as a component in the <template> block below
import OptionsSection from "./OptionsSection.vue";
// biome-ignore lint/correctness/noUnusedImports: PlaygroundTooltip is used in the <template> block below
import PlaygroundTooltip from "./PlaygroundTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the template block below
import GramSelect from "./GramSelect.vue";
import {
	factorForPortions,
	isScaleModified,
	knownUnits,
	matchingUnits,
	parseScaleQuantity,
	type ScaleState,
	scaleBadgeTitle,
	type ShoppingItem,
	targetChange,
	unitKey,
} from "./scaleSection";
import { useI18n } from "./useI18n";

/** "Portions & Scale": the whole recipe by a percentage, or by one ingredient's quantity. */
const props = defineProps<{
	open: boolean;
	shoppingList?: ShoppingItem[];
	/** The portions of the recipe now, and as written: `null` when it declares none. */
	portions: number | null;
	basePortions: number | null;
	scaleFactorString?: string;
	scaleTargetId: string | null;
	scaleTargetQty: number | null;
	scaleTargetUnit: string;
}>();

const emit = defineEmits<{
	toggle: [];
	"update:scaleFactorString": [val: string];
	"update:scaleTargetId": [val: string | null];
	"update:scaleTargetQty": [val: number | null];
	"update:scaleTargetUnit": [val: string];
	"clear-target": [];
	"scale-apply": [];
}>();

const { t } = useI18n();
// biome-ignore lint/correctness/noUnusedVariables: portionsInputId is used in the <template> block below, which Biome's Vue support doesn't see.
const portionsInputId = useId();

const state = computed<ScaleState>(() => ({
	shoppingList: props.shoppingList,
	scaleFactorString: props.scaleFactorString,
	scaleTargetId: props.scaleTargetId,
	scaleTargetQty: props.scaleTargetQty,
	scaleTargetUnit: props.scaleTargetUnit,
}));
// biome-ignore lint/correctness/noUnusedVariables: modified is used in the <template> block below, which Biome's Vue support doesn't see.
const modified = computed(() => isScaleModified(state.value));
// biome-ignore lint/correctness/noUnusedVariables: badgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const badgeTitle = computed(() => scaleBadgeTitle(state.value, t.value));

// biome-ignore lint/correctness/noUnusedVariables: globalScaleFactor is used in the <template> block below, which Biome's Vue support doesn't see.
const globalScaleFactor = computed({
	get: () => props.scaleFactorString || "100",
	set: (val: string) => {
		emit("update:scaleFactorString", val);
		emit("clear-target");
	},
});

// The recipe's portions: setting a count sets the overall scale.
// biome-ignore lint/correctness/noUnusedVariables: portionsField is used in the <template> block below, which Biome's Vue support doesn't see.
const portionsField = computed({
	get: () =>
		props.portions === null
			? ""
			: String(Math.round(props.portions * 100) / 100),
	set: (val: string | number) => {
		const factor = factorForPortions(Number(val), props.basePortions);
		if (factor === null) return;
		emit("update:scaleFactorString", factor);
		emit("clear-target");
	},
});

// biome-ignore lint/correctness/noUnusedVariables: targetId is used in the <template> block below, which Biome's Vue support doesn't see.
const targetId = computed({
	get: () => props.scaleTargetId || "",
	set: (val: string) => {
		const change = targetChange(val, props.shoppingList);
		emit("update:scaleTargetId", change.id);
		if (change.unit !== undefined) emit("update:scaleTargetUnit", change.unit);
		if (change.qty !== undefined) emit("update:scaleTargetQty", change.qty);
	},
});

// biome-ignore lint/correctness/noUnusedVariables: targetQty is used in the <template> block below, which Biome's Vue support doesn't see.
const targetQty = computed({
	get: () => {
		if (props.scaleTargetQty === null) return "";
		return formatDecimalToFraction(props.scaleTargetQty);
	},
	set: (val: string) => emit("update:scaleTargetQty", parseScaleQuantity(val)),
});

const targetUnit = computed({
	get: () => props.scaleTargetUnit,
	set: (val: string) => emit("update:scaleTargetUnit", val),
});

// The unit field is a combobox: the list under it opens as the cook types.
const unitWrapperRef = ref<HTMLElement | null>(null);
// biome-ignore lint/correctness/noUnusedVariables: unitInputRef is used in the <template> block below
const unitInputRef = ref<HTMLInputElement | null>(null);
const isUnitDropdownOpen = ref(false);
const highlightedUnitIndex = ref(-1);
const unitListboxId = useId();

function unitOptionId(index: number): string {
	return `${unitListboxId}-option-${index}`;
}

// biome-ignore lint/correctness/noUnusedVariables: activeUnitDescendant is used in the <template> block below
const activeUnitDescendant = computed(() =>
	isUnitDropdownOpen.value && highlightedUnitIndex.value >= 0
		? unitOptionId(highlightedUnitIndex.value)
		: undefined,
);

const filteredUnits = computed(() =>
	matchingUnits(knownUnits, targetUnit.value),
);

function selectUnit(u: string) {
	targetUnit.value = u;
	isUnitDropdownOpen.value = false;
	highlightedUnitIndex.value = -1;
}

// biome-ignore lint/correctness/noUnusedVariables: onUnitFocus is used in the <template> block below
function onUnitFocus() {
	isUnitDropdownOpen.value = true;
	highlightedUnitIndex.value = -1;
}

// biome-ignore lint/correctness/noUnusedVariables: onUnitInput is used in the <template> block below
function onUnitInput() {
	if (!isUnitDropdownOpen.value) {
		isUnitDropdownOpen.value = true;
	}
	highlightedUnitIndex.value = 0;
}

// biome-ignore lint/correctness/noUnusedVariables: onUnitKeydown is used in the <template> block below
function onUnitKeydown(e: KeyboardEvent) {
	const result = unitKey(
		e.key,
		{
			open: isUnitDropdownOpen.value,
			highlighted: highlightedUnitIndex.value,
		},
		filteredUnits.value.length,
	);
	if (result.preventDefault) e.preventDefault();
	isUnitDropdownOpen.value = result.open;
	highlightedUnitIndex.value = result.highlighted;
	if (result.select !== undefined) {
		selectUnit(filteredUnits.value[result.select] as string);
	}
	if (result.submit) submitScale();
}

function onDocumentClick(e: MouseEvent) {
	if (
		unitWrapperRef.value &&
		!unitWrapperRef.value.contains(e.target as Node)
	) {
		isUnitDropdownOpen.value = false;
	}
}

watch(highlightedUnitIndex, (idx) => {
	if (idx >= 0 && isUnitDropdownOpen.value) {
		const el = document.getElementById(unitOptionId(idx));
		el?.scrollIntoView({ block: "nearest" });
	}
});

watch(
	() => props.scaleTargetId,
	() => {
		isUnitDropdownOpen.value = false;
	},
);

onMounted(() => {
	document.addEventListener("click", onDocumentClick);
});

onUnmounted(() => {
	document.removeEventListener("click", onDocumentClick);
});

function submitScale() {
	emit("scale-apply");
}

// biome-ignore lint/correctness/noUnusedVariables: resetSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetSection() {
	emit("update:scaleFactorString", "100");
	emit("clear-target");
}
</script>

<template>
  <OptionsSection
    :title="t.playground.sections.scale"
    :open="open"
    :modified="modified"
    :badge-title="badgeTitle"
    @toggle="emit('toggle')"
    @reset="resetSection"
  >
    <div class="studio-field" v-if="props.basePortions">
      <div class="studio-label-row">
        <label class="studio-label" :for="portionsInputId">{{ t.playground.options.scalePortions }}</label>
        <PlaygroundTooltip :text="t.playground.help.scalePortions" />
      </div>
      <div class="scale-factor-wrapper">
        <input
          :id="portionsInputId"
          type="number"
          class="scale-factor-input"
          v-model.lazy="portionsField"
          min="0.1"
          step="any"
          inputmode="decimal"
        />
      </div>
    </div>

    <div class="studio-field">
      <div class="studio-label-row">
        <span class="studio-label">{{ t.playground.options.scaleGlobal }}</span>
        <PlaygroundTooltip :text="t.playground.help.scaleGlobal" />
      </div>
      <div class="scale-factor-wrapper">
        <input
          type="number"
          class="scale-factor-input"
          v-model="globalScaleFactor"
          min="1"
          step="any"
        />
        <span class="scale-factor-unit">%</span>
      </div>
    </div>

    <div class="studio-field">
      <div class="studio-label-row">
        <span class="studio-label">{{ t.playground.options.scaleByIngredient }}</span>
        <PlaygroundTooltip :text="t.playground.help.scaleByIngredient" />
      </div>
      <GramSelect
        block
        v-model="targetId"
        :options="[{ value: '', label: t.playground.options.selectIngredient }, ...props.shoppingList.map((item) => ({ value: item.id, label: item.name }))]"
      />
      <div class="scale-inputs" v-if="targetId">
        <input
          type="text"
          class="studio-input qty"
          v-model.lazy="targetQty"
          :placeholder="t.playground.options.qty"
          @keydown.enter="submitScale"
        />
        <div class="scale-unit-wrapper" ref="unitWrapperRef">
          <input
            ref="unitInputRef"
            type="text"
            class="studio-input unit"
            v-model="targetUnit"
            :placeholder="t.playground.options.unit"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            :aria-expanded="isUnitDropdownOpen"
            :aria-controls="unitListboxId"
            :aria-activedescendant="activeUnitDescendant"
            @focus="onUnitFocus"
            @input="onUnitInput"
            @keydown="onUnitKeydown"
          />
          <ul
            v-if="isUnitDropdownOpen && filteredUnits.length > 0"
            :id="unitListboxId"
            class="unit-dropdown-menu"
            role="listbox"
          >
            <li
              v-for="(u, index) in filteredUnits"
              :key="u"
              :id="unitOptionId(index)"
              class="unit-dropdown-item"
              :class="{
                'is-highlighted': index === highlightedUnitIndex,
                'is-active': u === targetUnit,
              }"
              role="option"
              :aria-selected="u === targetUnit"
              @mousedown.prevent="selectUnit(u)"
              @mouseenter="highlightedUnitIndex = index"
            >
              {{ u }}
            </li>
          </ul>
        </div>
        <button class="scale-apply-btn" @click="submitScale">{{ t.playground.options.apply }}</button>
      </div>
    </div>
  </OptionsSection>
</template>

<style scoped src="./optionsFields.css"></style>

<style scoped>
.scale-factor-wrapper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  padding-right: 8px;
  width: fit-content;
  border-radius: 0;
}

.scale-factor-wrapper:focus-within {
  border-color: var(--sl-color-gray-3);
}

.scale-factor-input {
  width: 60px;
  padding: 6px 4px 6px 8px;
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

.scale-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.scale-inputs .qty {
  flex: 2;
  min-width: 0;
}

.scale-unit-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.scale-unit-wrapper .unit {
  width: 100%;
}

.unit-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  min-width: 90px;
  max-height: 180px;
  overflow-y: auto;
  background-color: var(--sl-color-bg);
  border: 1px solid var(--sl-color-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 100;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  box-sizing: border-box;
}

.unit-dropdown-item {
  padding: 6px 10px;
  font-size: 13px;
  color: var(--sl-color-text);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.unit-dropdown-item:hover,
.unit-dropdown-item.is-highlighted {
  background-color: var(--sl-color-gray-7);
  color: var(--sl-color-text);
}

.unit-dropdown-item.is-active {
  color: var(--sl-color-text);
  background-color: var(--sl-color-gray-6);
  font-weight: 600;
}

.scale-apply-btn {
  padding: 6px 12px;
  background-color: var(--sl-color-accent);
  color: #1a1613;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  border-radius: 0;
  white-space: nowrap;
}

.scale-apply-btn:hover {
  opacity: 0.9;
}
</style>
