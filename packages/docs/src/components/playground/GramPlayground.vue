<script setup lang="ts">
import {
	ref,
	watch,
	onMounted,
	shallowRef,
	onUnmounted,
	computed,
	provide,
	nextTick,
} from "vue";
// biome-ignore lint/style/useImportType: GramEditor is used as a component in the <template> block below, which Biome's Vue support doesn't see — a type-only import breaks the ref.
import GramEditor from "./GramEditor.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import GramFileTabs from "./GramFileTabs.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import GramOptions from "./GramOptions.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import GramWarnings from "./GramWarnings.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import GramOutput from "./GramOutput.vue";
// biome-ignore lint/correctness/noUnusedImports: used as a component in the <template> block below, which Biome's Vue support doesn't see.
import PlaygroundDropdown from "./PlaygroundDropdown.vue";
import { compile, resolveScaleFactor, applyScale } from "@gram-lang/kitchen";
import {
	analyze,
	convertUnit,
	resolveIngredientDensity,
	parseDensityOverrides,
} from "@gram-lang/analyzer";
import {
	loadModuleGraph,
	composeRecipe,
	finalizeComposed,
} from "@gram-lang/modules";
import {
	type PlaygroundDiagnostic,
	parseErrorToDiagnostic,
	scaleErrorToDiagnostic,
	pipelineErrorToDiagnostic,
	enrichWarning,
	sortDiagnostics,
} from "./diagnostics";
import { toMarkdown, toHTML } from "@gram-lang/renderer";
import "@gram-lang/renderer/gram.css";
import "@gram-lang/renderer/gantt.css";
import { DEFAULT_SOURCES } from "./db";
import { ENTRY_URI, createPlaygroundHost } from "./vfsHost";
import { getDictionary } from "@gram-lang/i18n";
import { trackEvent, debounce } from "../../lib/umami";
const props = defineProps<{ lang: "en" | "fr" }>();

// updateGram() re-runs on every keystroke; debounce so we track one compile
// event per pause in typing instead of flooding Umami.
const trackPlaygroundRun = debounce(
	(success: boolean, codeLength: number, extra?: Record<string, unknown>) => {
		trackEvent("playground-run", {
			success,
			code_length: codeLength,
			...extra,
		});
	},
	1000,
);
const trackPlaygroundWarnings = debounce((codes: string[]) => {
	if (codes.length === 0) return;
	trackEvent("playground-warning", { codes: [...new Set(codes)].join(",") });
}, 1000);
const currentLang = computed(() => props.lang);
provide("lang", currentLang);

const isDark = ref(
	typeof document !== "undefined" &&
		document.documentElement.dataset.theme === "dark",
);
provide("isDark", isDark);
let themeObserver: MutationObserver | undefined;
onMounted(() => {
	themeObserver = new MutationObserver(() => {
		isDark.value = document.documentElement.dataset.theme === "dark";
	});
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
});
onUnmounted(() => {
	themeObserver?.disconnect();
});

const t = computed(() => getDictionary(currentLang.value));

const files = ref<Map<string, string>>(new Map([[ENTRY_URI, ""]]));
const activeFile = ref<string>(ENTRY_URI);

const diagnostics = ref<PlaygroundDiagnostic[]>([]);
const isConsoleCollapsed = ref(false);
const blockingDiagnostics = computed(() =>
	diagnostics.value.filter((d) => d.blocking),
);
const hasBlocking = computed(() => blockingDiagnostics.value.length > 0);

// biome-ignore lint/correctness/noUnusedVariables: errorFiles is used in the <template> block below, which Biome's Vue support doesn't see.
const errorFiles = computed(() => {
	return new Set(
		diagnostics.value
			.filter((d) => d.severity === "error" && d.uri)
			.map((d) => d.uri!),
	);
});

const viewMode = ref<
	"preview" | "gantt" | "json" | "ast" | "markdown" | "json-tree"
>("preview");
const options = ref({
	enableMassStandardization: true,
	enableYieldCalculation: false,
	enableNutritionalEstimation: true,
	bakersMath: false,
	bakersMathOnly: false,
	bakersReference: undefined as string | undefined,
});

// URIs (already resolved, matching `ModuleHost.resolve()`'s own output —
// same shape `composeRecipe`'s `stock` option expects) the user has flagged
// as "already on hand" via the Options panel's Stock section — mirrors the
// CLI's `--stock` flag for the playground's own preview.
const stockedUris = ref<Set<string>>(new Set());
// Every distinct import edge seen anywhere in the last-loaded graph
// (deduped by target uri), so GramOptions has something to render
// checkboxes for — rebuilt on every `updateGram()` run since the set of
// available imports can change as the user edits.
const availableImports = ref<
	{ uri: string; specifier: string; binding: string }[]
>([]);

// biome-ignore lint/correctness/noUnusedVariables: toggleStock is used in the <template> block below, which Biome's Vue support doesn't see.
function toggleStock(uri: string) {
	const next = new Set(stockedUris.value);
	const stocked = !next.has(uri);
	if (stocked) next.add(uri);
	else next.delete(uri);
	stockedUris.value = next;
	trackEvent("playground-toggle-stock", { stocked });
}

const scaleFactorString = ref("100");
const scaleTargetId = ref<string | null>(null);
const scaleTargetQty = ref<number | null>(null);
const scaleTargetUnit = ref("");

// biome-ignore lint/correctness/noUnusedVariables: viewModeOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const viewModeOptions = computed(() => [
	{ label: t.value.playground.views.preview, value: "preview" },
	{ label: t.value.playground.views.gantt, value: "gantt" },
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

let fullDatabase: any = {};

const manifestData = ref<any[]>([]);
const examples = computed(() => [
	{
		label:
			(t.value.playground.examples as any).newRecipe || "Blank (New Recipe)",
		value: "",
	},
	...manifestData.value.map((ex: any) => ({
		label: (t.value.playground.examples as any)[ex.id] || ex.title,
		value: ex.id,
	})),
]);
const selectedExample = ref("");

onMounted(() => {
	// Build database
	DEFAULT_SOURCES.forEach((source) => {
		if (source.data) {
			Object.assign(fullDatabase, source.data);
		}
	});

	// Load Examples
	const manifestName =
		currentLang.value === "fr" ? "manifest-fr.json" : "manifest.json";
	fetch(`${import.meta.env.BASE_URL}examples/${manifestName}`)
		.then((res) => res.json())
		.then((manifest) => {
			manifestData.value = manifest;
			if (manifestData.value.length > 0 && !files.value.get(ENTRY_URI)) {
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

function loadExample(id: string) {
	if (!id) {
		files.value = new Map([[ENTRY_URI, ""]]);
		activeFile.value = ENTRY_URI;
		return;
	}
	const manifestEntry = manifestData.value.find((ex: any) => ex.id === id);
	if (manifestEntry?.files?.length) {
		// Multi-file example: fetch every file under `examples/<id>/<relPath>`
		// and lay them out in the VFS at `/<relPath>`.
		Promise.all(
			manifestEntry.files.map((relPath: string) =>
				fetch(`${import.meta.env.BASE_URL}examples/${id}/${relPath}`)
					.then((res) => res.text())
					.then((text) => [`/${relPath}`, text] as const),
			),
		).then((entries) => {
			files.value = new Map(entries);
			activeFile.value = `/${manifestEntry.entry ?? manifestEntry.files[0]}`;
			trackEvent("playground-load-example", { example: id });
		});
	} else {
		fetch(`${import.meta.env.BASE_URL}examples/${id}`)
			.then((res) => res.text())
			.then((text) => {
				files.value = new Map([[ENTRY_URI, text]]);
				activeFile.value = ENTRY_URI;
				trackEvent("playground-load-example", { example: id });
			});
	}
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

// Incremented on every call, so a run that's still `await`ing when a newer
// one starts (e.g. the user kept typing) can tell it's been superseded and
// bail out without clobbering fresher state.
let runToken = 0;

async function updateGram() {
	const token = ++runToken;
	// The active tab is the compile entry point for the preview — clicking
	// an imported file shows what *that file alone* compiles to, not the
	// whole project.
	const previewEntry = activeFile.value;
	const codeLength = files.value.get(previewEntry)?.length ?? 0;
	diagnostics.value = [];
	editorRef.value?.setErrorMarker(null, "");
	// Which pipeline stage is running, so a thrown error can be attributed to it.
	let stage: "compose" | "compile" | "analyze" | "render" = "compose";
	try {
		const host = createPlaygroundHost(new Map(files.value));
		const graph = await loadModuleGraph(previewEntry, host);
		if (token !== runToken) return;

		// Every distinct import edge in the graph, wherever it occurs — a
		// `--stock`ed import can be nested arbitrarily deep (composeRecipe
		// matches `depUri` regardless of which module declares the `@use`),
		// so this scans every module's own imports, not just the entry
		// file's.
		const seenImportUris = new Set<string>();
		const nextAvailableImports: typeof availableImports.value = [];
		for (const uri of graph.order) {
			for (const { decl, uri: depUri } of graph.modules.get(uri)?.imports ??
				[]) {
				if (seenImportUris.has(depUri)) continue;
				seenImportUris.add(depUri);
				nextAvailableImports.push({
					uri: depUri,
					specifier: decl.specifier,
					binding: decl.bindings.map((b) => b.local).join(", "),
				});
			}
		}
		availableImports.value = nextAvailableImports;

		// The previewed document's own syntax error blocks the whole render —
		// `loadModuleGraph` never throws (a *different* module's own parse error
		// degrades gracefully instead, per the module-imports RFC's §C.4).
		const entryParseError = graph.diagnostics.find(
			(w) => w.code === "MODULE_PARSE_ERROR" && w.uri === previewEntry,
		);
		if (entryParseError) {
			const diag = parseErrorToDiagnostic(entryParseError, previewEntry);
			const otherDiags = graph.diagnostics
				.filter((w) => w !== entryParseError)
				.map((w) => enrichWarning(w, previewEntry));
			diagnostics.value = sortDiagnostics([diag, ...otherDiags]);

			if (activeFile.value === previewEntry) {
				editorRef.value?.setErrorMarker(
					entryParseError.loc?.start ?? 0,
					entryParseError.message,
				);
			}
			trackPlaygroundRun(false, codeLength, { error_type: "parse" });
			return;
		}

		stage = "compile";
		const composed = composeRecipe(graph, {
			db: fullDatabase,
			lang: currentLang.value,
			stock: stockedUris.value,
		});
		let result = compile(composed.ast, { ...options.value, scaleFactor: 1 });

		// A stocked import's own leaf (mass/nutrition sourced from the base's
		// real composition) only exists in `composed.syntheticIngredients` —
		// merge it in here, same as the CLI's `pipeline.ts`, so both the
		// scale-by-ingredient density lookup below and `analyze()` further
		// down can actually find it instead of reporting MISSING_INGREDIENT.
		// `fullDatabase` spread last: real DB entries always win on id
		// collision (MODULE_BINDING_SHADOWS_INGREDIENT), same as pipeline.ts.
		const database = { ...composed.syntheticIngredients, ...fullDatabase };
		const collectedScaleDiagnostics: PlaygroundDiagnostic[] = [];

		if (scaleTargetId.value && scaleTargetQty.value !== null) {
			try {
				// Same-family units (g<->kg, ml<->l...) always convert; crossing
				// mass<->volume (e.g. targeting "water=150g" in a recipe written in
				// ml) also works whenever a density is available, from the recipe's
				// own `densities:` frontmatter or the loaded ingredient database.
				const overrides = parseDensityOverrides(result.meta);
				const density = resolveIngredientDensity(
					scaleTargetId.value,
					database,
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
					(value, from, to) =>
						convertUnit(value, from, to, density, currentLang.value),
				);
				result = applyScale(result, resolution.factor);
				scaleFactorString.value = (resolution.factor * 100)
					.toFixed(2)
					.replace(/\.00$/, "");
			} catch (e: any) {
				collectedScaleDiagnostics.push(
					scaleErrorToDiagnostic(e.message, previewEntry),
				);
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
					collectedScaleDiagnostics.push(
						scaleErrorToDiagnostic(e.message, previewEntry),
					);
				}
			}
		}

		stage = "analyze";
		const analysisOptions = {
			...options.value,
			enableBakersMath: options.value.bakersMath,
			lang: currentLang.value,
		};
		const analysis = analyze(result, database, analysisOptions);
		result = finalizeComposed(analysis.result, composed);

		if (token !== runToken) return;

		stage = "render";
		const enrichedWarnings = (result.warnings || []).map((w: any) =>
			enrichWarning(w, previewEntry),
		);
		diagnostics.value = sortDiagnostics([
			...collectedScaleDiagnostics,
			...enrichedWarnings,
		]);
		jsonData.value = result;
		trackPlaygroundWarnings(diagnostics.value.map((w) => w.code));

		const fileWarnings = diagnostics.value.filter(
			(w: any) => !w.uri || w.uri === activeFile.value,
		);
		const editorDiags = fileWarnings
			.filter((w: any) => w.loc && w.loc.start != null)
			.map((w: any) => {
				const severity = w.severity;
				const start = w.loc.start;
				const end = w.loc.end ?? start + 1;
				return {
					from: start,
					to: Math.max(start + 1, end),
					severity,
					message: w.message,
				};
			});
		editorRef.value?.setDiagnostics(editorDiags);

		if (viewMode.value === "json") {
			content.value = JSON.stringify(result, null, 2);
		} else if (viewMode.value === "ast") {
			content.value = renderSExpr(composed.ast);
		} else if (viewMode.value === "markdown") {
			content.value = toMarkdown(result, { lang: currentLang.value });
		} else if (viewMode.value === "preview") {
			htmlPreview.value = toHTML(result, {
				interactiveScaling: true,
				interactiveNutrition: true,
				bakersMathOnly: options.value.bakersMathOnly,
				lang: currentLang.value,
			});
		}
		trackPlaygroundRun(true, codeLength);
	} catch (e: any) {
		if (token !== runToken) return;
		const diag = pipelineErrorToDiagnostic(e, stage, previewEntry);
		diagnostics.value = [diag];
		trackPlaygroundRun(false, codeLength, { error_type: stage });
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
	trackEvent("playground-scale", { factor: scaleFactorString.value });
	updateGram();
}

// biome-ignore lint/correctness/noUnusedVariables: clearTarget is used in the <template> block below, which Biome's Vue support doesn't see.
function clearTarget() {
	scaleTargetId.value = null;
	scaleTargetQty.value = null;
}

watch(
	[
		files,
		options,
		viewMode,
		scaleFactorString,
		currentLang,
		activeFile,
		stockedUris,
	],
	() => {
		if (!scaleTargetId.value) {
			updateGram();
		}
	},
	{ deep: true },
);

watch(
	[viewMode, () => options.value],
	([newView, newOptions], [oldView, oldOptions]) => {
		if (newView !== oldView) {
			trackEvent("playground-change-view", { view: newView });
		}
		if (JSON.stringify(newOptions) !== JSON.stringify(oldOptions)) {
			trackEvent("playground-toggle-option", {
				bakersMath: newOptions.bakersMath,
				nutrition: newOptions.enableNutritionalEstimation,
				yields: newOptions.enableYieldCalculation,
			});
		}
	},
	{ deep: true },
);

// biome-ignore lint/correctness/noUnusedVariables: handleJump is used in the <template> block below, which Biome's Vue support doesn't see.
async function handleJump(start: number, end: number, uri?: string) {
	if (uri && uri !== activeFile.value) {
		activeFile.value = uri;
		await nextTick();
	}
	editorRef.value?.jump(start, end);
}

// biome-ignore lint/correctness/noUnusedVariables: selectFile is used in the <template> block below, which Biome's Vue support doesn't see.
function selectFile(path: string) {
	activeFile.value = path;
}

let nextFileIndex = 1;

// biome-ignore lint/correctness/noUnusedVariables: addFile is used in the <template> block below, which Biome's Vue support doesn't see.
function addFile() {
	let uri = `/file-${nextFileIndex}.gram`;
	while (files.value.has(uri)) {
		nextFileIndex++;
		uri = `/file-${nextFileIndex}.gram`;
	}
	nextFileIndex++;
	files.value.set(uri, "");
	activeFile.value = uri;
}

// biome-ignore lint/correctness/noUnusedVariables: renameFile is used in the <template> block below, which Biome's Vue support doesn't see.
function renameFile(oldPath: string, newPath: string) {
	if (oldPath === ENTRY_URI) return; // entry's virtual path is fixed
	if (newPath === oldPath || files.value.has(newPath)) return;
	const content = files.value.get(oldPath) ?? "";
	files.value.delete(oldPath);
	files.value.set(newPath, content);
	editorRef.value?.renamePath(oldPath, newPath);
	if (activeFile.value === oldPath) activeFile.value = newPath;
}

// biome-ignore lint/correctness/noUnusedVariables: removeFile is used in the <template> block below, which Biome's Vue support doesn't see.
function removeFile(path: string) {
	if (path === ENTRY_URI) return; // entry is undeletable
	files.value.delete(path);
	editorRef.value?.forgetFile(path);
	// Never leave the UI pointed at a tab that no longer exists.
	if (activeFile.value === path) activeFile.value = ENTRY_URI;
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

const isFullscreen = ref(false);
function toggleFullscreen() {
	isFullscreen.value = !isFullscreen.value;
	if (isFullscreen.value) {
		document.body.style.overflow = "hidden";
	} else {
		document.body.style.overflow = "";
	}
}

onUnmounted(() => {
	document.removeEventListener("mousemove", onDrag);
	document.removeEventListener("mouseup", stopDrag);
	document.body.style.overflow = "";
});
</script>

<template>
  <div class="gram-playground" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="playground-toolbar">
      <div class="toolbar-left">
        <h2>{{ t.playground.title }}</h2>
        <button
          type="button"
          class="status-badge"
          :class="[
            hasBlocking ? 'invalid' : (diagnostics.length > 0 ? 'warning' : 'valid'),
            { 'is-clickable': diagnostics.length > 0 }
          ]"
          @click="diagnostics.length > 0 && (isConsoleCollapsed = false)"
          :title="diagnostics.length > 0 ? (t.playground.warnings.consoleTitle || 'Diagnostics & Débogage') : ''"
        >
          {{ hasBlocking ? (t.playground.warnings.errors || 'Errors') : (diagnostics.length > 0 ? (t.playground.statusWarnings || 'Warnings') : t.playground.statusValid) }}
        </button>
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
        
         <details class="options-dropdown">
          <summary class="playground-options-summary" :title="t.playground.analysisOptions">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 11.9998C2 11.1353 2.1097 10.2964 2.31595 9.49631C3.40622 9.55283 4.48848 9.01015 5.0718 7.99982C5.65467 6.99025 5.58406 5.78271 4.99121 4.86701C6.18354 3.69529 7.66832 2.82022 9.32603 2.36133C9.8222 3.33385 10.8333 3.99982 12 3.99982C13.1667 3.99982 14.1778 3.33385 14.674 2.36133C16.3317 2.82022 17.8165 3.69529 19.0088 4.86701C18.4159 5.78271 18.3453 6.99025 18.9282 7.99982C19.5115 9.01015 20.5938 9.55283 21.6841 9.49631C21.8903 10.2964 22 11.1353 22 11.9998C22 12.8643 21.8903 13.7032 21.6841 14.5033C20.5938 14.4468 19.5115 14.9895 18.9282 15.9998C18.3453 17.0094 18.4159 18.2169 19.0088 19.1326C17.8165 20.3043 16.3317 21.1794 14.674 21.6383C14.1778 20.6658 13.1667 19.9998 12 19.9998C10.8333 19.9998 9.8222 20.6658 9.32603 21.6383C7.66832 21.1794 6.18354 20.3043 4.99121 19.1326C5.58406 18.2169 5.65467 17.0094 5.0718 15.9998C4.48848 14.9895 3.40622 14.4468 2.31595 14.5033C2.1097 13.7032 2 12.8643 2 11.9998ZM6.80385 14.9998C7.43395 16.0912 7.61458 17.3459 7.36818 18.5236C7.77597 18.8138 8.21005 19.0652 8.66489 19.2741C9.56176 18.4712 10.7392 17.9998 12 17.9998C13.2608 17.9998 14.4382 18.4712 15.3351 19.2741C15.7899 19.0652 16.224 18.8138 16.6318 18.5236C16.3854 17.3459 16.566 16.0912 17.1962 14.9998C17.8262 13.9085 18.8225 13.1248 19.9655 12.7493C19.9884 12.5015 20 12.2516 20 11.9998C20 11.7481 19.9884 11.4981 19.9655 11.2504C18.8225 10.8749 17.8262 10.0912 17.1962 8.99982C16.566 7.90845 16.3854 6.65378 16.6318 5.47605C16.224 5.18588 15.7899 4.93447 15.3351 4.72552C14.4382 5.52844 13.2608 5.99982 12 5.99982C10.7392 5.99982 9.56176 5.52844 8.66489 4.72552C8.21005 4.93447 7.77597 5.18588 7.36818 5.47605C7.61458 6.65378 7.43395 7.90845 6.80385 8.99982C6.17376 10.0912 5.17754 10.8749 4.03451 11.2504C4.01157 11.4981 4 11.7481 4 11.9998C4 12.2516 4.01157 12.5015 4.03451 12.7493C5.17754 13.1248 6.17376 13.9085 6.80385 14.9998ZM12 14.9998C10.3431 14.9998 9 13.6567 9 11.9998C9 10.343 10.3431 8.99982 12 8.99982C13.6569 8.99982 15 10.343 15 11.9998C15 13.6567 13.6569 14.9998 12 14.9998ZM12 12.9998C12.5523 12.9998 13 12.5521 13 11.9998C13 11.4475 12.5523 10.9998 12 10.9998C11.4477 10.9998 11 11.4475 11 11.9998C11 12.5521 11.4477 12.9998 12 12.9998Z"></path></svg>
          </summary>
          <div class="playground-options-dropdown-content">
            <GramOptions
              v-model:options="options"
              :shopping-list="jsonData?.shopping_list || []"
              :available-imports="availableImports"
              :stocked-uris="stockedUris"
              v-model:scale-factor-string="scaleFactorString"
              v-model:scale-target-id="scaleTargetId"
              v-model:scale-target-qty="scaleTargetQty"
              v-model:scale-target-unit="scaleTargetUnit"
              @clear-target="clearTarget"
              @scale-apply="handleScaleApply"
              @toggle-stock="toggleStock"
            />
          </div>
        </details>
        
        <button class="toolbar-icon-btn" @click="toggleFullscreen" :title="isFullscreen ? (t.playground.exitFullscreen || 'Exit Fullscreen') : (t.playground.fullscreen || 'Fullscreen')">
          <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M21 3H13.5L16.5429 6.04289L13.2929 9.29289L14.7071 10.7071L17.9571 7.45711L21 10.5V3ZM3 21H10.5L7.45711 17.9571L10.7071 14.7071L9.29289 13.2929L6.04289 16.5429L3 13.5V21Z"></path></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20.5 11.0001H13V3.50008L16.0429 6.54297L19.2929 3.29297L20.7071 4.70718L17.4571 7.95718L20.5 11.0001ZM3.50008 13H11.0001V20.5L7.95718 17.4571L4.70718 20.7071L3.29297 19.2929L6.54297 16.0429L3.50008 13Z"></path></svg>
        </button>
      </div>
    </div>
    
    <div class="playground-main-frame">
      <div class="playground-workspace" :class="{ 'is-dragging': isDragging }" :style="{ '--left-width': leftPanelWidth + '%' }">
        <!-- Left Column: Editor & Options -->
        <div class="playground-col left-col">
          <GramFileTabs
            :files="[...files.keys()]"
            :active-file="activeFile"
            :entry-file="ENTRY_URI"
            :error-files="errorFiles"
            @select="selectFile"
            @add="addFile"
            @rename="renameFile"
            @remove="removeFile"
          />
          <div class="editor-wrapper">
            <GramEditor
              ref="editorRef"
              :files="files"
              :active-file="activeFile"
              @update:files="(path, val) => files.set(path, val)"
            />
          </div>
        </div>
        
        <!-- Splitter -->
        <div class="playground-splitter" @mousedown.prevent="startDrag">
          <div class="splitter-handle"></div>
        </div>

        <!-- Right Column: Output -->
        <div class="playground-col right-col">
          <div v-if="activeFile !== ENTRY_URI" class="preview-scope-banner">
            {{ t.playground.tabs.previewingStandalone }} <code>{{ activeFile.slice(1) }}</code>
          </div>
          <div class="output-wrapper">
            <GramOutput 
              :view-mode="viewMode as any" 
              :content="content" 
              :html-preview="htmlPreview" 
              :json-data="jsonData" 
              :blocking-diagnostics="blockingDiagnostics"
              @scale-update="handleScaleUpdate"
              @jump="handleJump"
            >
              <template #view-selector>
                <div class="header-view-wrapper">
                  <span class="toolbar-label">{{ t.playground.viewLabel }}</span>
                  <PlaygroundDropdown 
                    v-model="viewMode" 
                    :options="viewModeOptions" 
                    class="header-view-selector"
                  />
                </div>
              </template>
            </GramOutput>
          </div>
        </div>
      </div>

      <!-- Full-Width Bottom Diagnostics Console -->
      <GramWarnings
        v-if="diagnostics.length > 0"
        :warnings="diagnostics"
        v-model:collapsed="isConsoleCollapsed"
        @jump="handleJump"
      />
    </div>
  </div>
</template>

<style scoped>
.gram-playground {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  min-width: 0;
  max-width: 100%;
  flex: 1;
}

.gram-playground.is-fullscreen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 100000;
  background-color: var(--sl-color-bg);
  margin: 0;
  padding: 1.5rem;
  box-sizing: border-box;
}

.playground-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px;
  gap: 12px;
  flex-wrap: wrap;
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
  flex-shrink: 0;
}

.status-badge {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--sl-color-hairline);
  margin-top: 1px;
  background: transparent;
  cursor: default;
}

.status-badge.is-clickable {
  cursor: pointer;
  transition: all 0.15s;
}

.status-badge.is-clickable:hover {
  background-color: var(--sl-color-gray-7);
}

.status-badge.valid {
  color: #008829;
}

.status-badge.warning {
  color: #d97706;
}

.status-badge.invalid {
  color: #ef4444;
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
  color: var(--sl-color-gray-3);
  white-space: nowrap;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.options-dropdown {
  position: relative;
}

.playground-options-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  cursor: pointer;
  list-style: none; 
  color: var(--sl-color-gray-3); 
  padding: 8px;
  box-sizing: border-box;
}

.playground-options-summary::-webkit-details-marker {
  display: none;
}

.playground-options-summary:hover {
  border-color: var(--sl-color-gray-3);
  background-color: var(--sl-color-gray-7);
}

.toolbar-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 11px;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  cursor: pointer;
  color: var(--sl-color-gray-3);
  transition: all 0.2s;
}

.toolbar-icon-btn:hover {
  border-color: var(--sl-color-gray-3);
  background-color: var(--sl-color-gray-7);
  color: var(--sl-color-text);
}

.playground-options-dropdown-content {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: max-content;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  border: 1px solid var(--sl-color-border);
}

.playground-main-frame {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* Workspace & Split Pane */
.playground-workspace {
  display: flex;
  height: calc(100vh - 360px);
  min-height: 520px;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  position: relative;
  min-width: 0;
  max-width: 100%;
}

.gram-playground.is-fullscreen .playground-workspace {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.playground-workspace.is-dragging {
  cursor: col-resize;
  user-select: none;
}

.playground-col {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.left-col {
  width: var(--left-width, 50%);
  border-right: 1px solid var(--sl-color-border);
}

.editor-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
}

.playground-splitter {
  width: 8px;
  margin-left: -4px;
  margin-right: -4px;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: background-color 0.2s;
}

.playground-splitter:hover,
.playground-workspace.is-dragging .playground-splitter {
  background-color: rgba(59, 130, 246, 0.2);
}

.splitter-handle {
  width: 2px;
  height: 24px;
  background-color: var(--sl-color-border);
  border-radius: 1px;
}

.playground-splitter:hover .splitter-handle,
.playground-workspace.is-dragging .splitter-handle {
  background-color: #3b82f6;
}

.right-col {
  flex: 1;
  background-color: var(--sl-color-bg);
  min-width: 0;
  position: relative;
}

.preview-scope-banner {
  padding: 6px 12px;
  background-color: var(--sl-color-bg-sidebar);
  border-bottom: 1px solid var(--sl-color-border);
  font-size: 11px;
  color: var(--sl-color-gray-3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-scope-banner code {
  font-family: var(--sl-font-mono);
  color: var(--sl-color-text);
  font-weight: 600;
}

.output-wrapper {
  height: 100%;
}

.header-view-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-view-selector :deep(.dropdown-header) {
  border-color: transparent;
  padding-left: 0;
}

.header-view-selector :deep(.dropdown-header:hover) {
  border-color: transparent;
  background-color: transparent;
}
</style>
