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

const isDark = inject<Ref<boolean>>("isDark")!;

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
		color: "var(--sl-color-gray-4)",
		border: "none",
	},
	"&.cm-focused": {
		outline: "none",
	},
});

function makeExtensions(theme: string) {
	return [
		lineNumbers(),
		highlightActiveLine(),
		EditorView.lineWrapping,
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

// `files` is only ever reassigned wholesale (a new Map object) when the
// parent loads a different recipe entirely (an example, or the blank-slate
// reset) — a same-file edit goes through `.set()` on the existing Map, which
// doesn't change its identity and so doesn't trigger this. A wholesale
// replacement can land on the *same* `activeFile` the editor was already
// showing (every example loads into `/main.gram`), in which case the
// `activeFile` watcher above never fires and the stale cached state would
// otherwise linger — so every cached state is dropped here and the active
// file's state is rebuilt fresh from the new `files`.
watch(
	() => props.files,
	() => {
		stateCache.clear();
		diagnosticsCache.clear();
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
