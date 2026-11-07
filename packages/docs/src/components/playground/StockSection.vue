<script setup lang="ts">
import { computed } from "vue";
// biome-ignore lint/correctness/noUnusedImports: OptionsSection is used as a component in the <template> block below
import OptionsSection from "./OptionsSection.vue";
// biome-ignore lint/correctness/noUnusedImports: PlaygroundTooltip is used in the <template> block below
import PlaygroundTooltip from "./PlaygroundTooltip.vue";
import { isStockModified, stockBadgeTitle } from "./optionSections";
import { useI18n } from "./useI18n";

/** "Stock & Modules": the modules the cook already has on hand. */
const props = defineProps<{
	open: boolean;
	availableImports?: { uri: string; specifier: string; binding: string }[];
	stockedUris?: Set<string>;
}>();

const emit = defineEmits<{
	toggle: [];
	"toggle-stock": [uri: string];
}>();

const { t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: modified is used in the <template> block below, which Biome's Vue support doesn't see.
const modified = computed(() => isStockModified(props.stockedUris));
// biome-ignore lint/correctness/noUnusedVariables: badgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const badgeTitle = computed(() => stockBadgeTitle(props.stockedUris, t.value));

// biome-ignore lint/correctness/noUnusedVariables: resetSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetSection() {
	if (props.stockedUris) {
		for (const uri of [...props.stockedUris]) {
			emit("toggle-stock", uri);
		}
	}
}
</script>

<template>
  <OptionsSection
    :title="t.playground.sections.stock"
    :open="open"
    :modified="modified"
    :badge-title="badgeTitle"
    @toggle="emit('toggle')"
    @reset="resetSection"
  >
    <label class="option-item" v-for="imp in props.availableImports" :key="imp.uri">
      <input
        type="checkbox"
        :checked="props.stockedUris?.has(imp.uri) ?? false"
        @change="emit('toggle-stock', imp.uri)"
      />
      <div class="option-text">
        <div class="studio-label-row">
          <span class="option-name">{{ imp.specifier }}</span>
          <PlaygroundTooltip :text="t.playground.help.stockItem" />
        </div>
        <span class="option-desc">{{ t.playground.options.stockDesc }}</span>
      </div>
    </label>
  </OptionsSection>
</template>

<style scoped src="./optionsFields.css"></style>

<style scoped src="./optionsChoices.css"></style>
