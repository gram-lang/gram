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
	modelValue: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [val: string];
}>();

const editorContainer = ref<HTMLDivElement | null>(null);
let view: EditorView | undefined;
let highlighter: HighlighterCore | undefined;

const highlightCompartment = new Compartment();
let currentDiagnostics: Diagnostic[] = [];

const editorTheme = EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "var(--vp-c-bg-soft)",
		fontSize: "14px",
	},
	".cm-scroller": {
		fontFamily: 'var(--vp-font-family-mono), "Fira Code", monospace',
		overflow: "auto",
	},
	".cm-content": {
		padding: "16px 0",
	},
	".cm-gutters": {
		backgroundColor: "var(--vp-c-bg-soft)",
		color: "var(--vp-c-text-3)",
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
		linter(() => currentDiagnostics, { delay: 0 }),
		highlightCompartment.of(
			highlighter ? shikiHighlightExtension(highlighter, "gram", theme) : [],
		),
		EditorView.updateListener.of((update) => {
			if (update.docChanged) {
				emit("update:modelValue", update.state.doc.toString());
			}
		}),
	];
}

onMounted(async () => {
	highlighter = await getHighlighter();
	if (!editorContainer.value) return;

	const state = EditorState.create({
		doc: props.modelValue,
		extensions: makeExtensions(
			isDark.value ? SHIKI_THEMES.dark : SHIKI_THEMES.light,
		),
	});

	view = new EditorView({
		state,
		parent: editorContainer.value,
	});
});

onUnmounted(() => {
	view?.destroy();
});

watch(
	() => props.modelValue,
	(newValue) => {
		if (!view) return;
		const current = view.state.doc.toString();
		if (newValue !== current) {
			view.dispatch({
				changes: { from: 0, to: current.length, insert: newValue },
			});
		}
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
			currentDiagnostics = [];
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

		currentDiagnostics = [{ from, to, severity: "error", message }];
		forceLinting(view);
	},
});
</script>

<template>
  <div class="gram-editor">
    <div class="editor-header">
      <span class="editor-title">Input (.gram)</span>
    </div>
    <div class="editor-container" ref="editorContainer"></div>
  </div>
</template>

<style scoped>
.gram-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
  overflow: hidden;
}

.editor-header {
  padding: 8px 12px;
  background-color: var(--vp-c-bg-mute);
  border-bottom: 1px solid var(--vp-c-border);
}

.editor-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
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
</style>
