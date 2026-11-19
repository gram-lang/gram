<script setup lang="ts">
import { computed, useId } from "vue";
import type { ClockMode } from "@gram-lang/renderer";
// biome-ignore lint/correctness/noUnusedImports: GramSelect is used as a component in the <template> block below
import GramSelect from "./GramSelect.vue";
// biome-ignore lint/correctness/noUnusedImports: OptionsSection is used as a component in the <template> block below
import OptionsSection from "./OptionsSection.vue";
// biome-ignore lint/correctness/noUnusedImports: PlaygroundTooltip is used in the <template> block below
import PlaygroundTooltip from "./PlaygroundTooltip.vue";
import {
	isDisplayModified,
	// biome-ignore lint/correctness/noUnusedImports: used in the <template> block below, which Biome's Vue support doesn't see.
	resetDisplay,
} from "./optionSections";
import { settingChoices } from "./settingLabels";
import type { PlaygroundOptions } from "./settingsStorage";
import { useI18n } from "./useI18n";

/** "Display": the comments of the recipe, the quantities in its steps, the clock. */
const props = defineProps<{
	open: boolean;
	options: PlaygroundOptions;
}>();

const emit = defineEmits<{
	toggle: [];
	"update:options": [options: PlaygroundOptions];
}>();

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const { t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: modified is used in the <template> block below, which Biome's Vue support doesn't see.
const modified = computed(() => isDisplayModified(props.options));

// biome-ignore lint/correctness/noUnusedVariables: clockId is used in the <template> block below, which Biome's Vue support doesn't see.
const clockId = useId();
// biome-ignore lint/correctness/noUnusedVariables: clockOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const clockOptions = computed(() => settingChoices("clock", t.value));

// The comments of the recipe: shown unless this is switched off.
// biome-ignore lint/correctness/noUnusedVariables: showComments is used in the <template> block below, which Biome's Vue support doesn't see.
const showComments = computed({
	get: () => props.options.comments !== "hide",
	set: (val) =>
		emit("update:options", {
			...props.options,
			comments: val ? "show" : "hide",
		}),
});

// The quantities written in the text of the steps: shown unless switched off.
// biome-ignore lint/correctness/noUnusedVariables: showStepQuantities is used in the <template> block below, which Biome's Vue support doesn't see.
const showStepQuantities = computed({
	get: () => props.options.stepQuantities !== "hide",
	set: (val) =>
		emit("update:options", {
			...props.options,
			stepQuantities: val ? "show" : "hide",
		}),
});
</script>

<template>
  <OptionsSection
    :title="t.playground.sections.display"
    :open="open"
    :modified="modified"
    @toggle="emit('toggle')"
    @reset="emit('update:options', resetDisplay(props.options))"
  >
    <label class="option-item">
      <input type="checkbox" v-model="showComments" />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ t.playground.options.showComments }}</span>
          <PlaygroundTooltip :text="t.playground.help.comments" />
        </div>
        <span class="option-desc">{{ t.playground.options.commentsDesc }}</span>
      </div>
    </label>

    <label class="option-item">
      <input type="checkbox" v-model="showStepQuantities" />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ t.playground.options.showStepQuantities }}</span>
          <PlaygroundTooltip :text="t.playground.help.stepQuantities" />
        </div>
        <span class="option-desc">{{ t.playground.options.stepQuantitiesDesc }}</span>
      </div>
    </label>

    <div class="studio-field">
      <div class="studio-label-row">
        <label class="studio-label" :for="clockId">{{ t.playground.options.clock }}</label>
        <PlaygroundTooltip :text="t.playground.help.clock" />
      </div>
      <GramSelect
        block
        :id="clockId"
        :model-value="props.options.clock"
        :options="clockOptions"
        @update:model-value="(value: string) => emit('update:options', { ...props.options, clock: value as ClockMode })"
      />
    </div>
  </OptionsSection>
</template>

<style scoped src="./optionsFields.css"></style>

<style scoped src="./optionsChoices.css"></style>
