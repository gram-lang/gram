<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useI18n } from "./useI18n";

const props = defineProps<{
	files: string[]; // ordered virtual paths, entry first
	activeFile: string;
	entryFile: string;
	errorFiles: Set<string>;
	editorPanelId?: string;
}>();

const emit = defineEmits<{
	select: [path: string];
	add: [];
	rename: [oldPath: string, newPath: string];
	remove: [path: string];
	doneRename: [];
}>();

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const { t } = useI18n();

function label(path: string): string {
	return path.startsWith("/") ? path.slice(1) : path;
}

// biome-ignore lint/correctness/noUnusedVariables: tabId is used in the <template> block below, which Biome's Vue support doesn't see.
function tabId(path: string): string {
	return `file-tab-${path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

const renamingPath = ref<string | null>(null);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
const tabRefs = ref<Map<string, HTMLElement>>(new Map());

// biome-ignore lint/correctness/noUnusedVariables: setRenameInputRef is used in the <template> block below, which Biome's Vue support doesn't see.
function setRenameInputRef(el: any) {
	if (el) {
		renameInput.value = el as HTMLInputElement;
	}
}

// biome-ignore lint/correctness/noUnusedVariables: setTabRef is used in the <template> block below, which Biome's Vue support doesn't see.
function setTabRef(path: string, el: unknown) {
	if (el) tabRefs.value.set(path, el as HTMLElement);
	else tabRefs.value.delete(path);
}

function focusAndSelectTab(path: string) {
	emit("select", path);
	nextTick(() => tabRefs.value.get(path)?.focus());
}

// biome-ignore lint/correctness/noUnusedVariables: onTabKeydown is used in the <template> block below, which Biome's Vue support doesn't see.
function onTabKeydown(e: KeyboardEvent, path: string) {
	const idx = props.files.indexOf(path);
	switch (e.key) {
		case "ArrowRight":
			e.preventDefault();
			focusAndSelectTab(props.files[(idx + 1) % props.files.length]);
			break;
		case "ArrowLeft":
			e.preventDefault();
			focusAndSelectTab(
				props.files[(idx - 1 + props.files.length) % props.files.length],
			);
			break;
		case "Home":
			e.preventDefault();
			focusAndSelectTab(props.files[0]);
			break;
		case "End":
			e.preventDefault();
			focusAndSelectTab(props.files[props.files.length - 1]);
			break;
		case "Enter":
		case " ":
			e.preventDefault();
			emit("select", path);
			break;
		case "F2":
			e.preventDefault();
			startRename(path);
			break;
		case "Delete":
		case "Backspace":
			if (path !== props.entryFile) {
				e.preventDefault();
				emit("remove", path);
				nextTick(() => tabRefs.value.get(props.entryFile)?.focus());
			}
			break;
	}
}

async function startRename(path: string) {
	renamingPath.value = path;
	renameValue.value = label(path);
	await nextTick();
	const focusAndSelect = () => {
		if (renameInput.value && renamingPath.value === path) {
			renameInput.value.focus();
			renameInput.value.select();
		}
	};
	focusAndSelect();
	setTimeout(focusAndSelect, 50);
}

// biome-ignore lint/correctness/noUnusedVariables: commitRename is used in the <template> block below, which Biome's Vue support doesn't see.
function commitRename(focusEditor = false) {
	const oldPath = renamingPath.value;
	if (!oldPath) return;
	let trimmed = renameValue.value.trim().replace(/^\/+/, "");
	renamingPath.value = null;
	if (!trimmed) {
		if (focusEditor) emit("doneRename");
		return;
	}
	if (!trimmed.endsWith(".gram") && !trimmed.includes(".")) {
		trimmed += ".gram";
	}
	const newPath = `/${trimmed}`;
	if (newPath !== oldPath) {
		emit("rename", oldPath, newPath);
	}
	if (focusEditor) {
		emit("doneRename");
	}
}

// biome-ignore lint/correctness/noUnusedVariables: cancelRename is used in the <template> block below, which Biome's Vue support doesn't see.
function cancelRename(focusEditor = false) {
	renamingPath.value = null;
	if (focusEditor) {
		emit("doneRename");
	}
}

defineExpose({
	startRename,
});
</script>

<template>
  <div class="gram-file-tabs">
    <div class="gram-file-tabs-list" role="tablist" :aria-label="t.playground.tabs.openFiles">
    <div
      v-for="path in files"
      :key="path"
      :id="tabId(path)"
      :ref="(el) => setTabRef(path, el)"
      class="file-tab"
      :class="{ active: path === activeFile, 'has-error': errorFiles.has(path) }"
      role="tab"
      :aria-selected="path === activeFile"
      :aria-label="errorFiles.has(path) ? `${label(path)} (${t.playground.tabs.hasErrors})` : label(path)"
      :aria-controls="path === activeFile ? editorPanelId : undefined"
      :aria-keyshortcuts="path === entryFile ? undefined : 'Delete'"
      :tabindex="path === activeFile ? 0 : -1"
      @click="emit('select', path)"
      @dblclick="startRename(path)"
      @keydown="onTabKeydown($event, path)"
    >
      <input
        v-if="renamingPath === path"
        :ref="setRenameInputRef"
        v-model="renameValue"
        class="rename-input"
        :aria-label="t.playground.tabs.newFileName"
        @click.stop
        @dblclick.stop
        @keydown.stop
        @keydown.enter="commitRename(true)"
        @keydown.escape="cancelRename(true)"
        @blur="commitRename(false)"
      />
      <span v-else class="file-tab-label">{{ label(path) }}</span>

      <span v-if="errorFiles.has(path)" class="file-tab-error-dot" aria-hidden="true"></span>

      <button
        v-if="path !== entryFile"
        class="file-tab-close"
        :title="t.playground.tabs.removeFile"
        @click.stop="emit('remove', path)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="12" height="12" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>
      </button>
    </div>
    </div>

    <button class="file-tab-add" :title="t.playground.tabs.addFile" :aria-label="t.playground.tabs.addFile" @click="emit('add')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="14" height="14" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path></svg>
    </button>
  </div>
</template>

<style scoped>
.gram-file-tabs {
  display: flex;
  align-items: stretch;
  background-color: var(--sl-color-gray-7);
  border-bottom: 1px solid var(--sl-color-border);
  flex-shrink: 0;
  min-width: 0;
}

.gram-file-tabs-list {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  min-width: 0;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 42px;
  font-size: 12px;
  font-family: var(--sl-font-mono);
  color: var(--sl-color-gray-3);
  border-right: 1px solid var(--sl-color-border);
  cursor: pointer;
  white-space: nowrap;
  position: relative;
}

.file-tab:hover {
  color: var(--sl-color-text);
  background-color: var(--sl-color-bg-sidebar);
}

.file-tab.active {
  color: var(--sl-color-text);
  background-color: var(--sl-color-bg);
  /* accent-high: plain accent is only 2.33:1 on white, under the 3:1
     non-text minimum for a state indicator in light mode. */
  box-shadow: inset 0 -2px 0 var(--sl-color-accent);
}

.file-tab.has-error .file-tab-label {
  color: var(--sl-color-red-high);
}

.file-tab-error-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--sl-color-red);
  flex-shrink: 0;
}

.rename-input {
  font: inherit;
  color: inherit;
  background-color: var(--sl-color-bg);
  border: 1px solid var(--sl-color-accent-high);
  border-radius: 3px;
  padding: 1px 4px;
  width: 16ch;
  max-width: 24ch;
}

.file-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 3px;
  color: inherit;
  background: transparent;
  border: none;
  cursor: pointer;
}

.file-tab-close:hover {
  background-color: var(--sl-color-gray-6);
  color: var(--sl-color-text);
}

.file-tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  color: var(--sl-color-gray-3);
  background: transparent;
  border: none;
  border-right: 1px solid var(--sl-color-border);
  cursor: pointer;
  flex-shrink: 0;
}

.file-tab-add:hover {
  color: var(--sl-color-text);
  background-color: var(--sl-color-bg-sidebar);
}
</style>
