<script setup lang="ts">
import { ref, watch } from "vue";
import type { MiseEnPlaceMode, RestChoice } from "@gram-lang/kitchen";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below
import BakersSection from "./BakersSection.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below
import DisplaySection from "./DisplaySection.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below
import PhysicsSection from "./PhysicsSection.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below
import ScaleSection from "./ScaleSection.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below
import ScheduleSection from "./ScheduleSection.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below
import StockSection from "./StockSection.vue";
import type { PlanSettings } from "./planSettings";
import type { ShoppingItem } from "./scaleSection";
import type { ServeSuggestions } from "./scheduleSection";
import type { PlaygroundOptions } from "./settingsStorage";

const props = defineProps<{
	options: PlaygroundOptions;
	shoppingList?: ShoppingItem[];
	availableImports?: { uri: string; specifier: string; binding: string }[];
	stockedUris?: Set<string>;
	scaleFactorString?: string;
	scaleTargetId: string | null;
	scaleTargetQty: number | null;
	scaleTargetUnit: string;
	schedule?: MiseEnPlaceMode;
	rests?: RestChoice;
	plan?: PlanSettings;
	planError?: string;
	/** Serving times that work, why the others don't, and the earliest from now. */
	serveSuggestions?: ServeSuggestions | null;
	initialSection?: string;
}>();

// biome-ignore lint/correctness/noUnusedVariables: emit is used in the <template> block below, which Biome's Vue support doesn't see.
const emit = defineEmits<{
	"update:options": [options: typeof props.options];
	"update:scaleFactorString": [val: string];
	"update:scaleTargetId": [val: string | null];
	"update:scaleTargetQty": [val: number | null];
	"update:scaleTargetUnit": [val: string];
	"clear-target": [];
	"scale-apply": [];
	"toggle-stock": [uri: string];
	"update:schedule": [schedule: MiseEnPlaceMode];
	"update:rests": [rests: RestChoice];
	"update:plan": [plan: PlanSettings];
	"clear-plan": [];
	/** Show the run sheet: where most of the "Schedule & Service" settings show. */
	"show-run-sheet": [];
}>();

// Accordion open/collapsed state
const openSections = ref<Record<string, boolean>>({
	schedule: props.initialSection === "schedule",
	scale: props.initialSection === "scale" || !props.initialSection,
	bakersMath: props.initialSection === "bakersMath",
	display: props.initialSection === "display",
	physics: props.initialSection === "physics",
	stock: props.initialSection === "stock",
});

watch(
	() => props.initialSection,
	(sec) => {
		if (sec) {
			openSections.value[sec] = true;
		}
	},
	{ immediate: true },
);

// biome-ignore lint/correctness/noUnusedVariables: toggleSection is used in the <template> block below, which Biome's Vue support doesn't see.
function toggleSection(sec: string) {
	openSections.value[sec] = !openSections.value[sec];
}
</script>

<template>
  <div class="gram-studio-options">
    <ScheduleSection
      :open="openSections.schedule"
      :plan="props.plan"
      :schedule="props.schedule"
      :rests="props.rests"
      :plan-error="props.planError"
      :serve-suggestions="props.serveSuggestions"
      @toggle="toggleSection('schedule')"
      @update:schedule="emit('update:schedule', $event)"
      @update:rests="emit('update:rests', $event)"
      @update:plan="emit('update:plan', $event)"
      @clear-plan="emit('clear-plan')"
      @show-run-sheet="emit('show-run-sheet')"
    />

    <ScaleSection
      :open="openSections.scale"
      :shopping-list="props.shoppingList"
      :scale-factor-string="props.scaleFactorString"
      :scale-target-id="props.scaleTargetId"
      :scale-target-qty="props.scaleTargetQty"
      :scale-target-unit="props.scaleTargetUnit"
      @toggle="toggleSection('scale')"
      @update:scale-factor-string="emit('update:scaleFactorString', $event)"
      @update:scale-target-id="emit('update:scaleTargetId', $event)"
      @update:scale-target-qty="emit('update:scaleTargetQty', $event)"
      @update:scale-target-unit="emit('update:scaleTargetUnit', $event)"
      @clear-target="emit('clear-target')"
      @scale-apply="emit('scale-apply')"
    />

    <BakersSection
      :open="openSections.bakersMath"
      :options="props.options"
      :shopping-list="props.shoppingList"
      @toggle="toggleSection('bakersMath')"
      @update:options="emit('update:options', $event)"
    />

    <DisplaySection
      :open="openSections.display"
      :options="props.options"
      @toggle="toggleSection('display')"
      @update:options="emit('update:options', $event)"
    />

    <PhysicsSection
      :open="openSections.physics"
      :options="props.options"
      @toggle="toggleSection('physics')"
      @update:options="emit('update:options', $event)"
    />

    <StockSection
      v-if="(props.availableImports?.length ?? 0) > 0"
      :open="openSections.stock"
      :available-imports="props.availableImports"
      :stocked-uris="props.stockedUris"
      @toggle="toggleSection('stock')"
      @toggle-stock="emit('toggle-stock', $event)"
    />
  </div>
</template>

<style scoped>
.gram-studio-options {
  background-color: var(--sl-color-bg);
  padding: 16px;
  font-size: 14px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}
</style>
