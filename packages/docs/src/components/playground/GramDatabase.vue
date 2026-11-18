<script setup lang="ts">
// The `ingredients.yaml` tab: the example database, shown as is, read-only,
// with what it is for. The data the pipeline uses is the same file (db.ts).
// Its text loads the first time the tab opens, in a chunk of its own that
// carries nothing else.
import { inject, ref, watch, type Ref } from "vue";
import { getHighlighter, SHIKI_THEMES } from "./shikiHighlighter";
import { useI18n } from "./useI18n";

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const { t } = useI18n();
const isDark = inject<Ref<boolean>>("isDark")!;

const highlightedHtml = ref("");

watch(
	isDark,
	async (dark) => {
		const [{ default: source }, highlighter] = await Promise.all([
			import("./ingredients.yaml?raw"),
			getHighlighter(),
		]);
		highlightedHtml.value = highlighter.codeToHtml(source, {
			lang: "yaml",
			theme: dark ? SHIKI_THEMES.dark : SHIKI_THEMES.light,
		});
	},
	{ immediate: true },
);
</script>

<template>
  <div class="gram-database">
    <p class="studio-section-note database-notice">
      <svg class="note-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>
        {{ t.playground.database.project }}
        <a :href="t.playground.database.docHref">{{ t.playground.database.docLink }}</a>
      </span>
    </p>
    <div class="database-code" v-html="highlightedHtml"></div>
  </div>
</template>

<style scoped src="./optionsFields.css"></style>

<style scoped>
.gram-database {
  position: absolute;
  inset: 0;
  overflow: auto;
  background-color: var(--sl-color-bg);
}

.database-notice {
  margin: 12px 16px 0;
}

.database-notice a {
  color: var(--sl-color-text-accent);
}

.database-code :deep(pre) {
  margin: 0;
  padding: 12px 16px 16px;
  background: transparent !important;
  font-size: 13px;
  line-height: 1.6;
  font-family: var(--sl-font-mono), monospace;
  font-variant-ligatures: none;
  white-space: pre-wrap;
}
</style>
