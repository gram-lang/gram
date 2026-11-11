<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: OptionsSection is used as a component in the <template> block below
import OptionsSection from "./OptionsSection.vue";
// biome-ignore lint/correctness/noUnusedImports: PlaygroundTooltip is used in the <template> block below
import PlaygroundTooltip from "./PlaygroundTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the template block below
import GramSelect from "./GramSelect.vue";
import {
	bakersBadgeTitle,
	isBakersModified,
	// biome-ignore lint/correctness/noUnusedImports: used in the <template> block below, which Biome's Vue support doesn't see.
	resetBakers,
} from "./optionSections";
import type { ShoppingItem } from "./scaleSection";
import type { PlaygroundOptions } from "./settingsStorage";
import { useI18n } from "./useI18n";

/** "Baker's math": the quantities as percentages of a reference ingredient. */
const props = defineProps<{
	open: boolean;
	options: PlaygroundOptions;
	shoppingList?: ShoppingItem[];
}>();

const emit = defineEmits<{
	toggle: [];
	"update:options": [options: PlaygroundOptions];
}>();

const { t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: modified is used in the <template> block below, which Biome's Vue support doesn't see.
const modified = computed(() => isBakersModified(props.options));
// biome-ignore lint/correctness/noUnusedVariables: badgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const badgeTitle = computed(() => bakersBadgeTitle(props.options, t.value));

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
</script>

<template>
  <OptionsSection
    :title="t.playground.sections.bakersMath"
    :open="open"
    :modified="modified"
    :badge-title="badgeTitle"
    @toggle="emit('toggle')"
    @reset="emit('update:options', resetBakers(props.options))"
  >
    <label class="option-item">
      <input type="checkbox" v-model="bakersMath" />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ t.playground.options.enableBakersMath }}</span>
          <PlaygroundTooltip :text="t.playground.help.bakersMath" />
        </div>
        <span class="option-desc">{{ t.playground.options.bakersMathDesc }}</span>
      </div>
    </label>
    
    <label class="option-item child-option" :class="{ disabled: !bakersMath }">
      <input type="checkbox" v-model="bakersMathOnly" :disabled="!bakersMath" />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ t.playground.options.hideAbsolute }}</span>
          <PlaygroundTooltip :text="t.playground.help.bakersMathOnly" />
        </div>
      </div>
    </label>

    <div class="child-option select-wrapper" :class="{ disabled: !bakersMath }" v-if="bakersMath">
      <div class="studio-label-row">
        <span class="studio-label">{{ t.playground.options.forceReference }}</span>
        <PlaygroundTooltip :text="t.playground.help.bakersReference" />
      </div>
      <GramSelect
        block
        v-model="bakersReference"
        :disabled="!bakersMath"
        :options="[{ value: '', label: t.playground.options.autoDetect }, ...props.shoppingList.map((item) => ({ value: item.id, label: item.name }))]"
      />
    </div>
  </OptionsSection>
</template>

<style scoped src="./optionsFields.css"></style>

<style scoped src="./optionsChoices.css"></style>