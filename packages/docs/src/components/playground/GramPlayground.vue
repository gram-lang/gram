<script setup lang="ts">
import { ref, watch, onMounted, shallowRef, onUnmounted, computed } from "vue";
// biome-ignore lint/style/useImportType: GramEditor is used as a component in the <template> block below, which Biome's Vue support doesn't see — a type-only import breaks the ref.
import GramEditor from "./GramEditor.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import GramOptions from "./GramOptions.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import GramWarnings from "./GramWarnings.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import GramOutput from "./GramOutput.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import PlaygroundDropdown from "./PlaygroundDropdown.vue";
import { getAST, GramParseError } from "@gram-lang/parser";
import { compile, resolveScaleFactor, applyScale } from "@gram-lang/kitchen";
import {
	analyze,
	convertUnit,
	resolveIngredientDensity,
	parseDensityOverrides,
} from "@gram-lang/analyzer";
import { toMarkdown, toHTML } from "@gram-lang/renderer";
import { DEFAULT_SOURCES } from "./db";
import { useData } from "vitepress";
import { getDictionary } from "@gram-lang/i18n";

const { lang } = useData();
const t = computed(() => getDictionary(lang.value));

const code = ref("");
const viewMode = ref<"preview" | "json" | "ast" | "markdown" | "json-tree">(
	"preview",
);
const options = ref({
	enableMassStandardization: true,
	enableYieldCalculation: false,
	enableNutritionalEstimation: true,
	bakersMath: false,
	bakersMathOnly: false,
	bakersReference: undefined as string | undefined,
});

const scaleFactorString = ref("100");
const scaleTargetId = ref<string | null>(null);
const scaleTargetQty = ref<number | null>(null);
const scaleTargetUnit = ref("");
const scaleError = ref("");

// biome-ignore lint/correctness/noUnusedVariables: viewModeOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const viewModeOptions = computed(() => [
	{ label: t.value.playground.views.preview, value: "preview" },
	{ label: t.value.playground.views.jsonTree, value: "json-tree" },
	{ label: t.value.playground.views.json, value: "json" },
	{ label: t.value.playground.views.ast, value: "ast" },
	{ label: t.value.playground.views.markdown, value: "markdown" },
]);

const editorRef = ref<InstanceType<typeof GramEditor> | null>(null);

// Output State
const htmlPreview = ref("");
const content = ref("");
const jsonData = shallowRef<any>({});
const warnings = ref<any[]>([]);
const errorMsg = ref("");

let fullDatabase: any = {};

const manifestData = ref<any[]>([]);
const examples = computed(() =>
	manifestData.value.map((ex: any) => ({
		label: (t.value.playground.examples as any)[ex.id] || ex.title,
		value: `${import.meta.env.BASE_URL}examples/${ex.id}`,
	})),
);
const selectedExample = ref("");

onMounted(() => {
	// Build database
	DEFAULT_SOURCES.forEach((source) => {
		if (source.data) {
			Object.assign(fullDatabase, source.data);
		}
	});

	// Load Examples
	const manifestName = lang.value === "fr" ? "manifest-fr.json" : "manifest.json";
	fetch(`${import.meta.env.BASE_URL}examples/${manifestName}`)
		.then((res) => res.json())
		.then((manifest) => {
			manifestData.value = manifest;
			if (manifestData.value.length > 0 && !code.value) {
				const defaultEx =
					examples.value.find((ex: any) => ex.value.includes("empanadas")) ||
					examples.value[0];
				selectedExample.value = defaultEx.value;
				loadExample(defaultEx.value);
			}
		})
		.catch((err) => console.error("Manifest Error:", err));

	updateGram();
});

function loadExample(path: string) {
	if (!path) return;
	fetch(path)
		.then((res) => res.text())
		.then((text) => {
			code.value = text;
		});
}

function renderSExpr(node: any, level = 0): string {
	if (node === null || node === undefined) return "nil";
	if (typeof node !== "object") {
		if (typeof node === "string") return `"${node}"`;
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map((n) => renderSExpr(n, level)).join("\n");
	}
	const indent = "  ".repeat(level);
	const type = node.type || "Object";
	let attrs = "";
	let children: any[] = [];
	const ignore = new Set(["type", "loc"]);

	Object.entries(node).forEach(([k, v]) => {
		if (ignore.has(k)) return;
		if (v === null) return;
		if (typeof v !== "object") {
			attrs += ` :${k} ${typeof v === "string" ? `"${v}"` : v}`;
		} else if (Array.isArray(v)) {
			v.forEach((child) => {
				children.push(child);
			});
		} else {
			if (v && typeof v === "object" && "min" in v && "max" in v) {
				attrs += ` :${k} ${(v as any).min}-${(v as any).max}`;
			} else {
				children.push(v);
			}
		}
	});
	if (children.length === 0) {
		return `${indent}(${type}${attrs})`;
	}
	const childrenStr = children.map((c) => renderSExpr(c, level + 1)).join("\n");
	return `${indent}(${type}${attrs}\n${childrenStr})`;
}

function updateGram() {
	errorMsg.value = "";
	scaleError.value = "";
	editorRef.value?.setErrorMarker(null, "");
	try {
		const ast = getAST(code.value);
		let result = compile(ast, { ...options.value, scaleFactor: 1 });

		if (scaleTargetId.value && scaleTargetQty.value !== null) {
			try {
				// Same-family units (g<->kg, ml<->l...) always convert; crossing
				// mass<->volume (e.g. targeting "water=150g" in a recipe written in
				// ml) also works whenever a density is available, from the recipe's
				// own `densities:` frontmatter or the loaded ingredient database.
				const overrides = parseDensityOverrides(result.meta);
				const density = resolveIngredientDensity(
					scaleTargetId.value,
					fullDatabase,
					overrides,
				)?.density;
				const resolution = resolveScaleFactor(
					result,
					{
						type: "target",
						id: scaleTargetId.value,
						qty: scaleTargetQty.value,
						unit: scaleTargetUnit.value || null,
					},
					(value, from, to) => convertUnit(value, from, to, density),
				);
				result = applyScale(result, resolution.factor);
				scaleFactorString.value = (resolution.factor * 100)
					.toFixed(2)
					.replace(/\.00$/, "");
			} catch (e: any) {
				scaleError.value = e.message;
			}
		} else {
			const factor = parseFloat(scaleFactorString.value) / 100;
			if (!Number.isNaN(factor) && factor > 0 && factor !== 1) {
				try {
					const resolution = resolveScaleFactor(result, {
						type: "factor",
						value: factor,
					});
					result = applyScale(result, resolution.factor);
				} catch (e: any) {
					scaleError.value = e.message;
				}
			}
		}

		const analysisOptions = {
			...options.value,
			enableBakersMath: options.value.bakersMath,
		};
		const analysis = analyze(result, fullDatabase, analysisOptions);
		result = analysis.result;

		warnings.value = result.warnings || [];
		jsonData.value = result;

		if (viewMode.value === "json") {
			content.value = JSON.stringify(result, null, 2);
		} else if (viewMode.value === "ast") {
			content.value = renderSExpr(ast);
		} else if (viewMode.value === "markdown") {
			content.value = toMarkdown(result, { lang: lang.value });
		} else if (viewMode.value === "preview") {
			htmlPreview.value = toHTML(result, {
				interactiveScaling: true,
				bakersMathOnly: options.value.bakersMathOnly,
				lang: lang.value,
			});
		}
	} catch (e: any) {
		errorMsg.value = e.message;
		warnings.value = [];
		if (e instanceof GramParseError) {
			editorRef.value?.setErrorMarker(e.offset, e.message);
		}
	}
}

// biome-ignore lint/correctness/noUnusedVariables: handleScaleUpdate is used in the <template> block below, which Biome's Vue support doesn't see.
function handleScaleUpdate(factor: number) {
	scaleFactorString.value = (factor * 100).toFixed(2).replace(/\.00$/, "");
	scaleTargetId.value = null;
	scaleTargetQty.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: handleScaleApply is used in the <template> block below, which Biome's Vue support doesn't see.
function handleScaleApply() {
	updateGram();
}

// biome-ignore lint/correctness/noUnusedVariables: clearTarget is used in the <template> block below, which Biome's Vue support doesn't see.
function clearTarget() {
	scaleTargetId.value = null;
	scaleTargetQty.value = null;
}

watch(
	[code, options, viewMode, scaleFactorString, lang],
	() => {
		if (!scaleTargetId.value) {
			updateGram();
		}
	},
	{ deep: true },
);

// biome-ignore lint/correctness/noUnusedVariables: handleJump is used in the <template> block below, which Biome's Vue support doesn't see.
function handleJump(start: number, end: number) {
	if (editorRef.value) {
		editorRef.value.jump(start, end);
	}
}

// Split Pane Logic
const leftPanelWidth = ref(50);
const isDragging = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: startDrag is used in the <template> block below, which Biome's Vue support doesn't see.
function startDrag(_e: MouseEvent) {
	isDragging.value = true;
	document.addEventListener("mousemove", onDrag);
	document.addEventListener("mouseup", stopDrag);
	document.body.style.userSelect = "none";
	document.body.style.cursor = "col-resize";
}

function onDrag(e: MouseEvent) {
	if (!isDragging.value) return;
	const workspace = document.querySelector(
		".playground-workspace",
	) as HTMLElement;
	if (!workspace) return;
	const rect = workspace.getBoundingClientRect();
	const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
	leftPanelWidth.value = Math.min(Math.max(newWidth, 20), 80);
}

function stopDrag() {
	isDragging.value = false;
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
	document.body.style.userSelect = "";
	document.body.style.cursor = "";
}

onUnmounted(() => {
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
});
</script>

<template>
  <div class="gram-playground">
    <div class="playground-toolbar">
      <div class="toolbar-left">
        <h2>{{ t.playground.title }}</h2>
        <span class="status-badge" :class="(errorMsg || scaleError) ? 'invalid' : 'valid'">
          {{ (errorMsg || scaleError) ? 'Invalid' : t.playground.statusValid }}
        </span>
      </div>
      <div class="toolbar-right">
        <div class="toolbar-item" v-if="examples.length > 0">
          <span class="toolbar-label">{{ t.playground.recipe }}</span>
          <PlaygroundDropdown 
            v-model="selectedExample" 
            :options="examples" 
            :placeholder="t.playground.loadExample"
            @change="loadExample" 
          />
        </div>
        
        <div class="toolbar-item">
          <span class="toolbar-label">{{ t.playground.scaleFactor }}</span>
          <input type="number" class="scale-factor-input" v-model="scaleFactorString" @input="clearTarget" min="1" step="any" />
        </div>

        <div class="toolbar-item">
          <span class="toolbar-label">{{ t.playground.viewLabel }}</span>
          <PlaygroundDropdown 
            v-model="viewMode" 
            :options="viewModeOptions" 
          />
        </div>

        <details class="options-dropdown">
          <summary class="options-summary" :title="t.playground.analysisOptions">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 11.9998C2 11.1353 2.1097 10.2964 2.31595 9.49631C3.40622 9.55283 4.48848 9.01015 5.0718 7.99982C5.65467 6.99025 5.58406 5.78271 4.99121 4.86701C6.18354 3.69529 7.66832 2.82022 9.32603 2.36133C9.8222 3.33385 10.8333 3.99982 12 3.99982C13.1667 3.99982 14.1778 3.33385 14.674 2.36133C16.3317 2.82022 17.8165 3.69529 19.0088 4.86701C18.4159 5.78271 18.3453 6.99025 18.9282 7.99982C19.5115 9.01015 20.5938 9.55283 21.6841 9.49631C21.8903 10.2964 22 11.1353 22 11.9998C22 12.8643 21.8903 13.7032 21.6841 14.5033C20.5938 14.4468 19.5115 14.9895 18.9282 15.9998C18.3453 17.0094 18.4159 18.2169 19.0088 19.1326C17.8165 20.3043 16.3317 21.1794 14.674 21.6383C14.1778 20.6658 13.1667 19.9998 12 19.9998C10.8333 19.9998 9.8222 20.6658 9.32603 21.6383C7.66832 21.1794 6.18354 20.3043 4.99121 19.1326C5.58406 18.2169 5.65467 17.0094 5.0718 15.9998C4.48848 14.9895 3.40622 14.4468 2.31595 14.5033C2.1097 13.7032 2 12.8643 2 11.9998ZM6.80385 14.9998C7.43395 16.0912 7.61458 17.3459 7.36818 18.5236C7.77597 18.8138 8.21005 19.0652 8.66489 19.2741C9.56176 18.4712 10.7392 17.9998 12 17.9998C13.2608 17.9998 14.4382 18.4712 15.3351 19.2741C15.7899 19.0652 16.224 18.8138 16.6318 18.5236C16.3854 17.3459 16.566 16.0912 17.1962 14.9998C17.8262 13.9085 18.8225 13.1248 19.9655 12.7493C19.9884 12.5015 20 12.2516 20 11.9998C20 11.7481 19.9884 11.4981 19.9655 11.2504C18.8225 10.8749 17.8262 10.0912 17.1962 8.99982C16.566 7.90845 16.3854 6.65378 16.6318 5.47605C16.224 5.18588 15.7899 4.93447 15.3351 4.72552C14.4382 5.52844 13.2608 5.99982 12 5.99982C10.7392 5.99982 9.56176 5.52844 8.66489 4.72552C8.21005 4.93447 7.77597 5.18588 7.36818 5.47605C7.61458 6.65378 7.43395 7.90845 6.80385 8.99982C6.17376 10.0912 5.17754 10.8749 4.03451 11.2504C4.01157 11.4981 4 11.7481 4 11.9998C4 12.2516 4.01157 12.5015 4.03451 12.7493C5.17754 13.1248 6.17376 13.9085 6.80385 14.9998ZM12 14.9998C10.3431 14.9998 9 13.6567 9 11.9998C9 10.343 10.3431 8.99982 12 8.99982C13.6569 8.99982 15 10.343 15 11.9998C15 13.6567 13.6569 14.9998 12 14.9998ZM12 12.9998C12.5523 12.9998 13 12.5521 13 11.9998C13 11.4475 12.5523 10.9998 12 10.9998C11.4477 10.9998 11 11.4475 11 11.9998C11 12.5521 11.4477 12.9998 12 12.9998Z"></path></svg>
          </summary>
          <div class="options-dropdown-content">
            <GramOptions 
              v-model:options="options" 
              :shopping-list="jsonData?.shopping_list || []"
              v-model:scale-target-id="scaleTargetId"
              v-model:scale-target-qty="scaleTargetQty"
              v-model:scale-target-unit="scaleTargetUnit"
              @scale-apply="handleScaleApply"
            />
          </div>
        </details>
      </div>
    </div>
    
    <div class="playground-workspace" :class="{ 'is-dragging': isDragging }" :style="{ '--left-width': leftPanelWidth + '%' }">
      <!-- Left Column: Editor & Options -->
      <div class="playground-col left-col">
        <div class="editor-wrapper">
          <GramEditor ref="editorRef" v-model="code" />
        </div>
        <GramWarnings v-if="warnings.length > 0" :warnings="warnings" @jump="handleJump" />
      </div>
      
      <!-- Splitter -->
      <div class="playground-splitter" @mousedown.prevent="startDrag">
        <div class="splitter-handle"></div>
      </div>

      <!-- Right Column: Output -->
      <div class="playground-col right-col">
        <div v-if="errorMsg" class="error-msg">
          <strong>Error:</strong> {{ errorMsg }}
        </div>
        <div v-if="scaleError" class="error-msg scale-error-banner">
          <strong>Scale Error:</strong> {{ scaleError }}
        </div>
        <div v-if="!errorMsg" class="output-wrapper">
          <GramOutput 
            :view-mode="viewMode as any" 
            :content="content" 
            :html-preview="htmlPreview" 
            :json-data="jsonData" 
            @scale-update="handleScaleUpdate"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gram-playground {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  margin-bottom: 32px;
}

.playground-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px;
}

.toolbar-left h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  border: none;
  padding: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge.valid {
  background-color: var(--vp-c-green-soft, rgba(16, 185, 129, 0.15));
  color: var(--vp-c-green-1, #10b981);
}

.status-badge.invalid {
  background-color: var(--vp-c-red-soft, rgba(239, 68, 68, 0.15));
  color: var(--vp-c-red-1, #ef4444);
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.options-dropdown {
  position: relative;
}

.options-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  cursor: pointer;
  list-style: none;
  color: var(--vp-c-text-2);
  transition: border-color 0.2s, background-color 0.2s;
  padding: 8px;
}

.options-summary::-webkit-details-marker {
  display: none;
}

.options-summary:hover {
  border-color: var(--vp-c-brand);
  background-color: var(--vp-c-bg-soft);
}

.options-dropdown-content {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: max-content;
  box-shadow: var(--vp-shadow-3);
  border-radius: 8px;
}

/* Workspace & Split Pane */
.scale-factor-input {
  width: 60px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  outline: none;
}
.scale-factor-input:focus {
  border-color: var(--vp-c-brand-1);
}

.playground-workspace {
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: 70vh;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-1);
}

.playground-col {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
  min-height: 0;
}

.editor-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
}

.output-wrapper {
  flex: 1;
  height: 100%;
  position: relative;
  min-height: 0;
}

.playground-splitter {
  display: none;
}

@media (min-width: 960px) {
  .playground-workspace {
    flex-direction: row;
    height: 75vh;
  }
  
  .playground-col {
    /* No min-height required */
  }
  
  .left-col {
    width: var(--left-width);
  }
  
  .right-col {
    width: calc(100% - var(--left-width));
  }
  
  .playground-splitter {
    display: flex;
    width: 6px;
    background-color: var(--vp-c-bg-mute);
    border-left: 1px solid var(--vp-c-border);
    border-right: 1px solid var(--vp-c-border);
    cursor: col-resize;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    z-index: 10;
  }
  
  .playground-splitter:hover, .playground-workspace.is-dragging .playground-splitter {
    background-color: var(--vp-c-brand-soft);
  }
  
  .splitter-handle {
    width: 2px;
    height: 24px;
    background-color: var(--vp-c-text-3);
    border-radius: 2px;
  }
}

.error-msg {
  padding: 16px;
  background-color: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  border-bottom: 1px solid var(--vp-c-danger-3);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
}

.scale-error-banner {
  border-bottom: none;
  border-radius: 8px;
  margin: 16px 16px 0 16px;
  border: 1px solid var(--vp-c-danger-3);
}

.output-wrapper {
  height: 100%;
}
</style>
