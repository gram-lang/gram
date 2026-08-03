<script setup lang="ts">
import { ref, computed, watch, nextTick, inject, type Ref } from "vue";

import { getDictionary } from "@gram-lang/i18n";
import { getHighlighter, SHIKI_THEMES } from "./shikiHighlighter";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import JsonNode from "./JsonNode.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below
import GramGantt from "./GramGantt.vue";

const props = defineProps<{
	viewMode: "json" | "ast" | "markdown" | "json-tree" | "preview" | "gantt";
	content: string; // JSON string, AST string, or Markdown string
	htmlPreview: string;
	jsonData: any;
}>();

const emit = defineEmits<(e: "scale-update", factor: number) => void>();

const lang = inject<Ref<"en" | "fr">>("lang")!;
const isDark = inject<Ref<boolean>>("isDark")!;
// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const t = computed(() => getDictionary(lang.value));

const currentLang = computed(() => {
	if (props.viewMode === "ast") return "scheme";
	if (props.viewMode === "markdown") return "markdown";
	return "json";
});

const copied = ref(false);
// biome-ignore lint/correctness/noUnusedVariables: copyOutput is used in the <template> block below, which Biome's Vue support doesn't see.
function copyOutput() {
	if (props.viewMode === "preview" || props.viewMode === "json-tree") return;
	navigator.clipboard.writeText(props.content).then(() => {
		copied.value = true;
		setTimeout(() => {
			copied.value = false;
		}, 2000);
	});
}

const highlightedHtml = ref("");

watch(
	[() => props.content, currentLang, isDark],
	async ([content, shikiLang, dark]) => {
		if (!["json", "ast", "markdown"].includes(props.viewMode)) return;
		const highlighter = await getHighlighter();
		highlightedHtml.value = highlighter.codeToHtml(content, {
			lang: shikiLang,
			theme: dark ? SHIKI_THEMES.dark : SHIKI_THEMES.light,
		});
	},
	{ immediate: true },
);

const previewContainer = ref<HTMLElement | null>(null);

watch(
	() => props.htmlPreview,
	async () => {
		if (props.viewMode !== "preview" || !previewContainer.value) return;

		const openDetails = new Set<string>();
		previewContainer.value
			.querySelectorAll("details[open]")
			.forEach((details) => {
				const summary = details.querySelector("summary");
				if (summary?.textContent) {
					openDetails.add(summary.textContent.trim());
				}
			});

		await nextTick();

		if (openDetails.size > 0 && previewContainer.value) {
			previewContainer.value.querySelectorAll("details").forEach((details) => {
				const summary = details.querySelector("summary");
				if (
					summary?.textContent &&
					openDetails.has(summary.textContent.trim())
				) {
					details.open = true;
				}
			});
		}
	},
	{ flush: "pre" },
);

// biome-ignore lint/correctness/noUnusedVariables: handlePreviewChange is used in the <template> block below, which Biome's Vue support doesn't see.
function handlePreviewChange(e: Event) {
	if (props.viewMode !== "preview") return;
	const target = e.target as HTMLElement;
	if (target.classList.contains("portions-input")) {
		const input = target as HTMLInputElement;
		const newVal = parseFloat(input.value);
		const interactivePortions = target.closest(".interactive-portions");
		const basePortions = parseFloat(
			interactivePortions?.getAttribute("data-base-portions") || "1",
		);
		if (!Number.isNaN(newVal) && newVal > 0) {
			emit("scale-update", newVal / basePortions);
		}
	}
}

// biome-ignore lint/correctness/noUnusedVariables: handlePreviewClick is used in the <template> block below, which Biome's Vue support doesn't see.
function handlePreviewClick(e: MouseEvent) {
	if (props.viewMode !== "preview") return;
	const target = e.target as HTMLElement;

	const scaleBtn = target.closest(".scale-btn");
	if (scaleBtn) {
		e.preventDefault();
		const action = scaleBtn.getAttribute("data-scale-action");
		if (action === "set-factor") {
			const val = parseFloat(scaleBtn.getAttribute("data-value") || "1");
			emit("scale-update", val);
		} else if (action === "inc-portions" || action === "dec-portions") {
			const interactivePortions = target.closest(".interactive-portions");
			const basePortions = parseFloat(
				interactivePortions?.getAttribute("data-base-portions") || "1",
			);
			const inputEl = interactivePortions?.querySelector(
				".portions-input",
			) as HTMLInputElement | null;
			const currentPortions = inputEl
				? parseFloat(inputEl.value)
				: basePortions;
			const newPortions =
				action === "inc-portions" ? currentPortions + 1 : currentPortions - 1;
			if (newPortions > 0) {
				emit("scale-update", newPortions / basePortions);
			}
		}
		return;
	}

	const a = target.closest("a");
	if (a?.hash?.startsWith("#")) {
		const id = a.hash.substring(1);
		const el = document.getElementById(id);
		if (el) {
			e.preventDefault();
			if (previewContainer.value) {
				previewContainer.value
					.querySelectorAll(".target-highlight")
					.forEach((n) => {
						n.classList.remove("target-highlight");
					});
			}
			el.classList.add("target-highlight");
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}
}
</script>

<template>
  <div class="gram-output">
    <div class="output-header" v-if="['json', 'ast', 'markdown'].includes(viewMode)">
      <span class="output-title">{{ viewMode.toUpperCase() }}</span>
      <button class="copy-btn" @click="copyOutput" :title="t.playground.output.copy">
        <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--vp-c-green-1)"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </button>
    </div>
    <div class="output-container">
      <!-- Shiki-highlighted read-only output (JSON, AST, Markdown) -->
      <!-- Shiki's codeToHtml() already emits its own <pre><code> wrapper -->
      <div
        v-if="['json', 'ast', 'markdown'].includes(viewMode)"
        class="output-code"
        v-html="highlightedHtml"
      ></div>

      <!-- Interactive JSON Tree -->
      <div v-else-if="viewMode === 'json-tree'" class="output-tree">
        <JsonNode :data="jsonData" :is-last="true" :initial-expanded="true" />
      </div>

      <!-- Gantt Chart -->
      <div v-else-if="viewMode === 'gantt'" class="output-gantt">
        <GramGantt :json-data="jsonData" />
      </div>
      
      <!-- HTML Preview -->
      <div 
        ref="previewContainer" 
        @click="handlePreviewClick" 
        @change="handlePreviewChange" 
        v-else-if="viewMode === 'preview'" 
        class="output-preview gram-preview vp-doc show-macros" 
        v-html="htmlPreview"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.gram-output {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
  overflow: hidden;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--vp-c-bg-mute);
  border-bottom: 1px solid var(--vp-c-border);
}

.output-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  color: var(--vp-c-text-2);
  transition: background-color 0.2s, color 0.2s;
  cursor: pointer;
  border: none;
  background: transparent;
}

.copy-btn:hover {
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.output-container {
  flex: 1;
  overflow: auto;
  position: relative;
  background-color: var(--vp-code-bg);
}

.output-code {
  min-height: 100%;
  font-size: 14px;
}

.output-code :deep(pre) {
  margin: 0;
  padding: 16px;
  box-sizing: border-box;
  background: transparent !important;
  line-height: 1.6;
  font-family: var(--vp-font-family-mono), "Fira Code", monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.output-tree, .output-preview{
  padding: 16px;
  background-color: var(--vp-c-bg);
  min-height: 100%;
}

.output-gantt{
	  background-color: var(--vp-c-bg);
  min-height: 100%;
}

.loading-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-text-3);
  font-size: 14px;
}

/* Fix Vitepress default styles overriding some specific gram preview stuff if needed */
.output-preview.vp-doc :deep(ul), 
.output-preview.vp-doc :deep(ol) {
  margin-top: 8px;
}
</style>
