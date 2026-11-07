<script setup lang="ts">
import { computed, useId } from "vue";
// biome-ignore lint/correctness/noUnusedImports: NutritionBasis types a cast in the <template> block below, which Biome's Vue support doesn't see.
import type { NutritionBasis } from "@gram-lang/renderer";
// biome-ignore lint/correctness/noUnusedImports: OptionsSection is used as a component in the <template> block below
import OptionsSection from "./OptionsSection.vue";
// biome-ignore lint/correctness/noUnusedImports: PlaygroundTooltip is used in the <template> block below
import PlaygroundTooltip from "./PlaygroundTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the template block below
import GramSelect from "./GramSelect.vue";
import {
	isPhysicsModified,
	physicsBadgeTitle,
	// biome-ignore lint/correctness/noUnusedImports: used in the <template> block below, which Biome's Vue support doesn't see.
	resetPhysics,
} from "./optionSections";
import { settingChoices } from "./settingLabels";
import type { PlaygroundOptions } from "./settingsStorage";
import { useI18n } from "./useI18n";

/** "Physics & Nutrition": the analyses of the recipe, and the nutrition basis shown. */
const props = defineProps<{
	open: boolean;
	options: PlaygroundOptions;
}>();

const emit = defineEmits<{
	toggle: [];
	"update:options": [options: PlaygroundOptions];
}>();

const { t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: modified is used in the <template> block below, which Biome's Vue support doesn't see.
const modified = computed(() => isPhysicsModified(props.options));
// biome-ignore lint/correctness/noUnusedVariables: badgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const badgeTitle = computed(() => physicsBadgeTitle(props.options, t.value));

// biome-ignore lint/correctness/noUnusedVariables: massEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const massEnabled = computed({
	get: () => props.options.massStandardization,
	set: (val) =>
		emit("update:options", {
			...props.options,
			massStandardization: val,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: yieldEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const yieldEnabled = computed({
	get: () => props.options.yieldCalculation,
	set: (val) =>
		emit("update:options", { ...props.options, yieldCalculation: val }),
});

// biome-ignore lint/correctness/noUnusedVariables: nutritionEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const nutritionEnabled = computed({
	get: () => props.options.nutritionEstimation,
	set: (val) =>
		emit("update:options", {
			...props.options,
			nutritionEstimation: val,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: nutritionBasisId is used in the <template> block below, which Biome's Vue support doesn't see.
const nutritionBasisId = useId();

// biome-ignore lint/correctness/noUnusedVariables: nutritionBasisOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const nutritionBasisOptions = computed(() =>
	settingChoices("nutritionBasis", t.value),
);
</script>

<template>
  <OptionsSection
    :title="t.playground.sections.physics"
    :open="open"
    :modified="modified"
    :badge-title="badgeTitle"
    @toggle="emit('toggle')"
    @reset="emit('update:options', resetPhysics(props.options))"
  >
    <p class="studio-section-note">
      <svg class="note-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>{{ t.playground.help.physicsDisclaimer }}</span>
    </p>

    <label class="option-item">
      <input type="checkbox" v-model="massEnabled" />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ t.playground.options.massStandardization }}</span>
          <PlaygroundTooltip :text="t.playground.help.massStandardization" />
        </div>
        <span class="option-desc">{{ t.playground.options.massDesc }}</span>
      </div>
    </label>
    
    <label class="option-item child-option" :class="{ disabled: !massEnabled }">
      <input type="checkbox" v-model="yieldEnabled" :disabled="!massEnabled" />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ t.playground.options.yieldManagement }}</span>
          <PlaygroundTooltip :text="t.playground.help.yieldManagement" />
        </div>
      </div>
    </label>

    <label class="option-item">
      <input type="checkbox" v-model="nutritionEnabled" />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ t.playground.options.nutrition }}</span>
          <PlaygroundTooltip :text="t.playground.help.nutrition" />
        </div>
      </div>
    </label>

    <div class="studio-field child-option" :class="{ disabled: !nutritionEnabled }">
      <div class="studio-label-row">
        <label class="studio-label" :for="nutritionBasisId">{{ t.playground.options.nutritionBasis }}</label>
        <PlaygroundTooltip :text="t.playground.help.nutritionBasis" />
      </div>
      <GramSelect
        block
        :id="nutritionBasisId"
        :model-value="props.options.nutritionBasis"
        :disabled="!nutritionEnabled"
        :options="nutritionBasisOptions"
        @update:model-value="(value: string) => emit('update:options', { ...props.options, nutritionBasis: value as NutritionBasis })"
      />
    </div>
  </OptionsSection>
</template>

<style scoped src="./optionsFields.css"></style>

<style scoped src="./optionsChoices.css"></style>
