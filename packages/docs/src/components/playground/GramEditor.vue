<script setup lang="ts">
import { onMounted, onUnmounted, inject, ref, watch, type Ref } from "vue";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import {
	EditorView,
	keymap,
	lineNumbers,
	highlightActiveLine,
} from "@codemirror/view";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands";
import {
	type Diagnostic,
	forceLinting,
	lintGutter,
	linter,
} from "@codemirror/lint";
import type { HighlighterCore } from "shiki/core";

import { getHighlighter, SHIKI_THEMES } from "./shikiHighlighter";
import { shikiHighlightExtension } from "./codemirror/shikiHighlightExtension";
import { useI18n } from "./useI18n";

const isDark = inject<Ref<boolean>>("isDark")!;
const { t } = useI18n();

const props = defineProps<{
	files: Map<string, string>;
	activeFile: string;
}>();

const emit = defineEmits<{
	"update:files": [path: string, content: string];
}>();

const editorContainer = ref<HTMLDivElement | null>(null);
let view: EditorView | undefined;
let highlighter: HighlighterCore | undefined;

const highlightCompartment = new Compartment();

// One `EditorState` per open file, so switching tabs preserves each file's
// undo history and cursor/scroll position instead of recreating the buffer
// from scratch. `EditorState` is immutable — every transaction produces a
// *new* state object — so the cache entry for the active file is refreshed
// on every update, not just written once at creation.
const stateCache = new Map<string, EditorState>();
// Diagnostics are per-file for the same reason: a squiggly computed for one
// file's offsets would be meaningless (or land on the wrong text) if shown
// while a different file's state is active.
const diagnosticsCache = new Map<string, Diagnostic[]>();

function currentTheme(): string {
	return isDark.value ? SHIKI_THEMES.dark : SHIKI_THEMES.light;
}

const editorTheme = EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "var(--sl-color-bg)",
		fontSize: "14px",
	},
	".cm-scroller": {
		fontFamily: 'var(--sl-font-mono), "Fira Code", monospace',
		overflow: "auto",
	},
	".cm-content": {
		padding: "16px 0",
	},
	".cm-gutters": {
		backgroundColor: "var(--sl-color-bg)",
		// gray-4 fails WCAG AA (2.65:1 dark / 3.19:1 light) against
		// --sl-color-bg; gray-3 clears 4.5:1 in both themes.
		color: "var(--sl-color-gray-3)",
		border: "none",
	},
	"&.cm-focused": {
		// CodeMirror's default focus outline gets clipped by
		// .editor-container's overflow: hidden, so it's replaced with an
		// inset box-shadow ring to keep focus visible for keyboard users.
		// accent-high (not accent) so the ring still clears the 3:1
		// non-text contrast minimum in light mode (accent alone is 2.33:1).
		outline: "none",
		boxShadow: "inset 0 0 0 2px var(--sl-color-accent-high)",
	},
});

function makeExtensions(theme: string) {
	return [
		lineNumbers(),
		highlightActiveLine(),
		EditorView.lineWrapping,
		EditorView.contentAttributes.of({
			"aria-label": t.value.playground.inputTab,
		}),
		history(),
		keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
		editorTheme,
		lintGutter(),
		linter(() => diagnosticsCache.get(props.activeFile) ?? [], { delay: 0 }),
		highlightCompartment.of(
			highlighter ? shikiHighlightExtension(highlighter, "gram", theme) : [],
		),
		EditorView.updateListener.of((update) => {
			stateCache.set(props.activeFile, update.state);
			if (update.docChanged) {
				emit("update:files", props.activeFile, update.state.doc.toString());
			}
		}),
	];
}

function stateFor(path: string): EditorState {
	const cached = stateCache.get(path);
	if (cached) return cached;
	const state = EditorState.create({
		doc: props.files.get(path) ?? "",
		extensions: makeExtensions(currentTheme()),
	});
	stateCache.set(path, state);
	return state;
}

onMounted(async () => {
	highlighter = await getHighlighter();
	if (!editorContainer.value) return;

	view = new EditorView({
		state: stateFor(props.activeFile),
		parent: editorContainer.value,
	});
});

onUnmounted(() => {
	view?.destroy();
});

watch(
	() => props.activeFile,
	(newFile) => {
		if (!view) return;
		view.setState(stateFor(newFile));
	},
);

// Rebuilding or clearing state when files map changes. For keys whose content
// changed or which were removed from the files Map, stale cached state is dropped.
watch(
	() => props.files,
	() => {
		for (const [key, state] of stateCache.entries()) {
			if (
				!props.files.has(key) ||
				props.files.get(key) !== state.doc.toString()
			) {
				stateCache.delete(key);
				diagnosticsCache.delete(key);
			}
		}
		if (!view) return;
		view.setState(stateFor(props.activeFile));
	},
);

watch(isDark, (dark) => {
	if (!view || !highlighter) return;
	view.dispatch({
		effects: highlightCompartment.reconfigure(
			shikiHighlightExtension(
				highlighter,
				"gram",
				dark ? SHIKI_THEMES.dark : SHIKI_THEMES.light,
			),
		),
	});
});

defineExpose({
	focus() {
		view?.focus();
	},

	jump(start: number, end: number) {
		if (!view) return;
		const length = view.state.doc.length;
		const from = Math.max(0, Math.min(start, length));
		const to = Math.max(from, Math.min(end, length));
		view.dispatch({
			selection: EditorSelection.single(from, to),
			effects: EditorView.scrollIntoView(from, { y: "center" }),
		});
		view.focus();
	},

	setDiagnostics(
		diags: Array<{
			from: number;
			to: number;
			severity: "error" | "warning" | "info";
			message: string;
		}>,
	) {
		if (!view) return;
		diagnosticsCache.set(props.activeFile, diags);
		forceLinting(view);
	},

	setErrorMarker(offset: number | null, message: string) {
		if (!view) return;

		if (offset === null) {
			diagnosticsCache.set(props.activeFile, []);
			forceLinting(view);
			return;
		}

		const length = view.state.doc.length;
		const clamped = Math.max(0, Math.min(offset, length));
		let from = clamped;
		let to = Math.min(clamped + 1, length);
		if (to === from) {
			// Error is at end-of-file (e.g. "unexpected end of input"): a
			// zero-width range renders no squiggly, so underline the
			// preceding character instead.
			from = Math.max(0, clamped - 1);
			to = clamped;
		}

		diagnosticsCache.set(props.activeFile, [
			{ from, to, severity: "error", message },
		]);
		forceLinting(view);
	},

	// Drops a closed file's cached state/diagnostics so they don't linger in
	// memory once the tab is gone.
	forgetFile(path: string) {
		stateCache.delete(path);
		diagnosticsCache.delete(path);
	},

	// Moves a renamed file's cached state/diagnostics to its new key,
	// preserving undo history and cursor position across the rename.
	renamePath(oldPath: string, newPath: string) {
		const state = stateCache.get(oldPath);
		if (state) {
			stateCache.delete(oldPath);
			stateCache.set(newPath, state);
		}
		const diagnostics = diagnosticsCache.get(oldPath);
		if (diagnostics) {
			diagnosticsCache.delete(oldPath);
			diagnosticsCache.set(newPath, diagnostics);
		}
	},
});
</script>

<template>
  <div class="gram-editor">
    <div class="editor-container" ref="editorContainer"></div>
  </div>
</template>

<style scoped>
.gram-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--sl-color-bg);
  overflow: hidden;
}

.editor-container {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
}

.editor-container :deep(.cm-activeLine),
.editor-container :deep(.cm-activeLineGutter) {
  background-color: var(--gram-active-line-bg, rgba(0, 0, 0, 0.04));
}
</style>

<style>
:root {
  --gram-active-line-bg: rgba(0, 0, 0, 0.04);
}
:root[data-theme='dark'] {
  --gram-active-line-bg: rgba(255, 255, 255, 0.03); /* Adjust opacity as needed */
}
</style>
