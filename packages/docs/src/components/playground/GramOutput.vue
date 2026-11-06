<script setup lang="ts">
import {
	ref,
	computed,
	watch,
	nextTick,
	inject,
	onMounted,
	onUnmounted,
	type Ref,
} from "vue";
import { JSON_TREE_CSS, type Format } from "@gram-lang/renderer";

import { useI18n } from "./useI18n";
import { getHighlighter, SHIKI_THEMES } from "./shikiHighlighter";
import { trackEvent } from "../../lib/umami";
import type { PlaygroundDiagnostic } from "./diagnostics";
import type { OutputOption, Pane } from "./outputs";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the template block below
import GramErrorState from "./GramErrorState.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the template block below
import GramSelect from "./GramSelect.vue";

const props = defineProps<{
	/** The output shown: an id of the renderer's `outputs`. */
	outputId: string;
	/** The views of the recipe, as tabs: what the playground is about. */
	viewTabs: OutputOption[];
	/** The inspectors: one "Inspect" tab, the choice among them in the bar of the content. */
	inspectors: OutputOption[];
	/** The inspector the "Inspect" tab opens: the last one shown. */
	lastInspectorId: string;
	format: Format;
	/** How it is shown, from its descriptor. */
	pane: Pane;
	/** HTML for an `html` or `tree` pane, text for a `code` pane; `null` when the recipe has nothing for it. */
	content: string | null;
	/** The formats the view can be shown in; a toggle appears when there are several. */
	formatOptions: { value: Format; label: string }[];
	/** The view has a print format: a Print button opens it. */
	canPrint?: boolean;
	blockingDiagnostics?: PlaygroundDiagnostic[];
}>();

const emit = defineEmits<{
	(e: "scale-update", factor: number): void;
	(e: "jump", start: number, end: number, uri?: string): void;
	(e: "update:format", format: Format): void;
	(e: "print"): void;
	(e: "update:outputId", outputId: string): void;
}>();

const isDark = inject<Ref<boolean>>("isDark")!;
// biome-ignore lint/correctness/noUnusedVariables: t is used in the template block below, which Biome's Vue support doesn't see.
const { t } = useI18n();

// The stylesheet of the JSON tree ships with the renderer as text: added to
// the page once, its colors mapped to the theme by `.output-tree` below.
onMounted(() => {
	if (document.getElementById("gram-json-tree-css")) return;
	const style = document.createElement("style");
	style.id = "gram-json-tree-css";
	style.textContent = JSON_TREE_CSS;
	document.head.appendChild(style);
});

// biome-ignore lint/correctness/noUnusedVariables: inspector is used in the template block below, which Biome's Vue support doesn't see.
const inspector = computed(() =>
	props.inspectors.find((option) => option.value === props.outputId),
);

// The tabs: the views, then "Inspect", which opens the last inspector. Every
// change of what is shown goes through them, and only them.
const INSPECT = "inspect";
// biome-ignore lint/correctness/noUnusedVariables: tabs is used in the template block below, which Biome's Vue support doesn't see.
const tabs = computed<(OutputOption & { inspect?: boolean })[]>(() => [
	...props.viewTabs,
	{ value: INSPECT, label: t.value.playground.output.inspect, inspect: true },
]);
// biome-ignore lint/correctness/noUnusedVariables: activeTab is used in the template block below, which Biome's Vue support doesn't see.
const activeTab = computed(() => (inspector.value ? INSPECT : props.outputId));

function selectTab(value: string) {
	emit("update:outputId", value === INSPECT ? props.lastInspectorId : value);
}

// The tabs move with the arrow keys, as a tab list does.
// biome-ignore lint/correctness/noUnusedVariables: onTabKeydown is used in the template block below, which Biome's Vue support doesn't see.
function onTabKeydown(e: KeyboardEvent, index: number) {
	const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
	if (!step) return;
	e.preventDefault();
	const list = tabs.value;
	const next = list[(index + step + list.length) % list.length];
	if (!next) return;
	selectTab(next.value);
	nextTick(() =>
		document.getElementById(`gram-view-tab-${next.value}`)?.focus(),
	);
}

// When the tabs no longer fit (more views, a narrow pane, longer words), they
// become one dropdown: still the one control that changes what is shown. A
// hidden copy of the tabs measures what they need.
const header = ref<HTMLElement | null>(null);
const tabsMeasure = ref<HTMLElement | null>(null);
const compact = ref(false);
function measureTabs() {
	if (!header.value || !tabsMeasure.value) return;
	const style = getComputedStyle(header.value);
	const room =
		header.value.clientWidth -
		Number.parseFloat(style.paddingLeft) -
		Number.parseFloat(style.paddingRight);
	compact.value = tabsMeasure.value.scrollWidth > room;
}
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
	resizeObserver = new ResizeObserver(measureTabs);
	if (header.value) resizeObserver.observe(header.value);
	measureTabs();
});
onUnmounted(() => resizeObserver?.disconnect());
watch(tabs, () => nextTick(measureTabs), { deep: true });

const hasBlocking = computed(() => {
	return (
		(props.blockingDiagnostics && props.blockingDiagnostics.length > 0) ?? false
	);
});

// biome-ignore lint/correctness/noUnusedVariables: isEmpty is used in the template block below, which Biome's Vue support doesn't see.
const isEmpty = computed(() => props.content === null);
// biome-ignore lint/correctness/noUnusedVariables: canCopy is used in the template block below, which Biome's Vue support doesn't see.
const canCopy = computed(
	() => !hasBlocking.value && props.pane.type === "code" && !!props.content,
);

// biome-ignore lint/correctness/noUnusedVariables: canShowPrint is used in the template block below, which Biome's Vue support doesn't see.
const canShowPrint = computed(
	() => !!props.canPrint && !hasBlocking.value && !isEmpty.value,
);

// The bar above the content: only when it has something to offer.
// biome-ignore lint/correctness/noUnusedVariables: hasToolbar is used in the template block below, which Biome's Vue support doesn't see.
const hasToolbar = computed(
	() =>
		!hasBlocking.value &&
		(props.formatOptions.length > 1 ||
			canShowPrint.value ||
			canCopy.value ||
			!!inspector.value),
);

const copied = ref(false);
// biome-ignore lint/correctness/noUnusedVariables: copyOutput is used in the template block below, which Biome's Vue support doesn't see.
function copyOutput() {
	if (props.pane.type !== "code" || hasBlocking.value || !props.content) return;
	navigator.clipboard.writeText(props.content).then(() => {
		trackEvent("playground-copy-output", {
			view: props.outputId,
			format: props.format,
		});
		copied.value = true;
		setTimeout(() => {
			copied.value = false;
		}, 2000);
	});
}

const highlightedHtml = ref("");

watch(
	[() => props.content, () => props.pane, isDark],
	async ([content, pane, dark]) => {
		if (pane.type !== "code") return;
		const highlighter = await getHighlighter();
		const language =
			pane.language && highlighter.getLoadedLanguages().includes(pane.language)
				? pane.language
				: "text";
		highlightedHtml.value = highlighter.codeToHtml(content ?? "", {
			lang: language,
			theme: dark ? SHIKI_THEMES.dark : SHIKI_THEMES.light,
		});
	},
	{ immediate: true },
);

const previewContainer = ref<HTMLElement | null>(null);

// A new render replaces the HTML: the sections folded open stay open.
watch(
	() => props.content,
	async () => {
		if (props.pane.type !== "html" || !previewContainer.value) return;

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

// biome-ignore lint/correctness/noUnusedVariables: handlePreviewChange is used in the template block below, which Biome's Vue support doesn't see.
function handlePreviewChange(e: Event) {
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

// biome-ignore lint/correctness/noUnusedVariables: handlePreviewClick is used in the template block below, which Biome's Vue support doesn't see.
function handlePreviewClick(e: MouseEvent) {
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
    <div class="output-header" ref="header">
      <!-- What is shown: the views, then "Inspect", apart on the right -->
      <div v-if="!compact" class="view-tabs" role="tablist" :aria-label="t.playground.output.views">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.value"
          :id="`gram-view-tab-${tab.value}`"
          type="button"
          role="tab"
          class="view-tab"
          :class="{ active: tab.value === activeTab, 'is-inspect': tab.inspect }"
          :aria-selected="tab.value === activeTab"
          :tabindex="tab.value === activeTab ? 0 : -1"
          :title="tab.inspect ? tab.label : undefined"
          @click="selectTab(tab.value)"
          @keydown="onTabKeydown($event, index)"
        >
          <svg v-if="tab.inspect" class="view-tab-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          <span class="view-tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <!-- The tabs no longer fit: one dropdown, the same choice -->
      <GramSelect
        v-else
        size="sm"
        :model-value="activeTab"
        :options="tabs"
        :aria-label="t.playground.output.views"
        @update:model-value="selectTab"
      />

      <!-- What the tabs need, measured out of sight -->
      <div ref="tabsMeasure" class="view-tabs view-tabs-measure" aria-hidden="true">
        <span v-for="tab in tabs" :key="tab.value" class="view-tab" :class="{ 'is-inspect': tab.inspect }">
          <svg v-if="tab.inspect" class="view-tab-icon" width="14" height="14" viewBox="0 0 24 24"></svg>
          <span class="view-tab-label">{{ tab.label }}</span>
        </span>
      </div>
      <slot name="actions"></slot>
    </div>
    <div class="output-container">
      <!-- How the output is shown: part of the content, it changes with it -->
      <div v-if="hasToolbar" class="view-toolbar">
        <!-- Which inspector: the choice of the "Inspect" tab, as a format is a view's -->
        <GramSelect
          v-if="inspector"
          size="sm"
          bare
          :model-value="outputId"
          :options="inspectors"
          :aria-label="t.playground.output.inspect"
          @update:model-value="(value: string) => emit('update:outputId', value)"
        />
        <GramSelect
          v-if="formatOptions.length > 1"
          size="sm"
          bare
          :model-value="format"
          :options="formatOptions"
          :aria-label="t.playground.formatLabel"
          @update:model-value="(value: string) => emit('update:format', value as Format)"
        />
        <span class="view-toolbar-spacer"></span>
        <button
          v-if="canShowPrint"
          type="button"
          class="icon-btn"
          :title="t.playground.output.print"
          :aria-label="t.playground.output.print"
          @click="emit('print')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        </button>
        <button v-if="canCopy" type="button" class="icon-btn" @click="copyOutput" :title="t.playground.output.copy" :aria-label="t.playground.output.copy">
          <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--sl-color-green)" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
      </div>

      <!-- Unified Error State (Blocking Errors) -->
      <GramErrorState
        v-if="hasBlocking"
        :diagnostics="blockingDiagnostics || []"
        @jump="(start, end, uri) => emit('jump', start, end, uri)"
      />

      <!-- The recipe has nothing for this view (a work plan with nothing to schedule) -->
      <p v-else-if="isEmpty" class="output-empty">{{ t.renderer.outputEmpty }}</p>

      <template v-else>
        <!-- Shiki-highlighted read-only text: an inspector, or a view in a text format -->
        <div
          v-if="pane.type === 'code'"
          class="output-code"
          v-html="highlightedHtml"
        ></div>

        <!-- The JSON tree (renderJsonTree): it folds with the keyboard too -->
        <div
          v-else-if="pane.type === 'tree'"
          class="output-tree"
          :class="isDark ? 'is-dark' : 'is-light'"
          v-html="content"
        ></div>

        <!-- A view, as HTML -->
        <div
          v-else
          ref="previewContainer"
          @click="handlePreviewClick"
          @change="handlePreviewChange"
          class="output-preview gram-preview vp-doc show-macros"
          v-html="content"
        ></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gram-output {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--sl-color-bg);
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
}

.output-header {
  position: relative;
  overflow: hidden;
  padding-inline: 12px;
  background-color: var(--sl-color-gray-7);
  border-bottom: 1px solid var(--sl-color-border);
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.view-tabs {
  display: flex;
  align-self: stretch;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}

.view-tabs::-webkit-scrollbar {
  display: none;
}

.view-tab {
  flex-shrink: 0;
  padding: 0 14px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--sl-color-gray-3);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.view-tab:hover {
  color: var(--sl-color-white);
}

.view-tab.active {
  color: var(--sl-color-white);
  border-bottom-color: var(--sl-color-accent);
  font-weight: 600;
}

.view-tab:focus-visible {
  outline: 2px solid var(--sl-color-accent);
  outline-offset: -2px;
}



/* "Inspect" is a tab like the others, quieter and on its own on the right. */
.view-tab.is-inspect {
  margin-inline-start: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.view-tab-icon {
  flex-shrink: 0;
}

/* A narrow pane: "Inspect" keeps only its icon. */
@container (max-width: 520px) {
  .view-tab.is-inspect .view-tab-label {
    display: none;
  }
}

/* The copy of the tabs that measures them: laid out, never seen. */
.view-tabs-measure {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  flex: none;
  overflow: visible;
  height: 0;
}

.view-tabs-measure .view-tab.is-inspect {
  margin-inline-start: 24px;
}

.view-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding-inline: 12px;
  box-sizing: border-box;
  background-color: var(--sl-color-bg);
  border-bottom: 1px solid var(--sl-color-hairline, var(--sl-color-border));
}

/* The bar is already drawn: its buttons go without a frame. */
.view-toolbar .icon-btn {
  border-color: transparent;
}

.view-toolbar .icon-btn:hover {
  border-color: transparent;
  background-color: var(--sl-color-gray-6);
}

.view-toolbar-spacer {
  flex: 1;
}



@media (max-width: 767px) {
  .output-header {
    height: 42px;
    padding-inline: 8px;
    gap: 8px;
  }
}

.output-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sl-color-gray-3);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--sl-color-gray-3);
  cursor: pointer;
  border: 1px solid var(--sl-color-border);
  background: transparent;
}

.icon-btn:hover {
	border-color: var(--sl-color-gray-3);
  color: var(--sl-color-white);
}

.output-container {
  flex: 1;
  overflow: auto;
  position: relative;
  min-width: 0;
  max-width: 100%;
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
  font-family: var(--sl-font-mono), monospace;
  font-variant-ligatures: none;
  white-space: pre-wrap;
  word-break: break-word;
}

.output-tree {
  --gram-json-font: var(--sl-font-mono);
  --gram-json-muted: var(--sl-color-gray-3);
  --gram-json-hover: var(--sl-color-bg-inline-code);
  --gram-json-guide: var(--sl-color-hairline);
  padding: 16px;
  background-color: var(--sl-color-bg);
  min-height: 100%;
  display: inline-block;
  box-sizing: border-box;
  overflow: hidden;
}

.output-tree.is-dark {
  --gram-json-key: #79b8ff;
  --gram-json-string: #9ecbff;
  --gram-json-punct: #e1e4e8;
}

.output-tree.is-light {
  --gram-json-key: #005cc5;
  --gram-json-string: #032f62;
  --gram-json-punct: #24292e;
}

.output-empty {
  margin: 0;
  padding: 24px 16px;
  color: var(--sl-color-gray-3);
  font-size: 14px;
}

.output-preview{
  padding: 16px;
  background-color: var(--sl-color-bg);
  min-height: 100%;
  display: inline-block;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.loading-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  /* gray-4 fails 4.5:1 in both themes against --sl-color-bg; gray-3 clears it. */
  color: var(--sl-color-gray-3);
  font-size: 14px;
}

/* Fix Vitepress default styles overriding some specific gram preview stuff if needed */
.output-preview.vp-doc :deep(ul), 
.output-preview.vp-doc :deep(ol) {
  /* margin-top: 8px; */
}
</style>
