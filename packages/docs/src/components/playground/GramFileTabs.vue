<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useI18n } from "./useI18n";

const props = defineProps<{
	files: string[]; // ordered virtual paths, entry first
	activeFile: string;
	entryFile: string;
	errorFiles: Set<string>;
}>();

const emit = defineEmits<{
	select: [path: string];
	add: [];
	rename: [oldPath: string, newPath: string];
	remove: [path: string];
}>();

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const { t } = useI18n();

function label(path: string): string {
	return path.startsWith("/") ? path.slice(1) : path;
}

const renamingPath = ref<string | null>(null);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: startRename is used in the <template> block below, which Biome's Vue support doesn't see.
async function startRename(path: string) {
	if (path === props.entryFile) return;
	renamingPath.value = path;
	renameValue.value = label(path);
	await nextTick();
	renameInput.value?.focus();
	renameInput.value?.select();
}

// biome-ignore lint/correctness/noUnusedVariables: commitRename is used in the <template> block below, which Biome's Vue support doesn't see.
function commitRename() {
	const oldPath = renamingPath.value;
	if (!oldPath) return;
	const trimmed = renameValue.value.trim();
	renamingPath.value = null;
	if (!trimmed) return;
	const newPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
	if (newPath === oldPath) return;
	emit("rename", oldPath, newPath);
}

// biome-ignore lint/correctness/noUnusedVariables: cancelRename is used in the <template> block below, which Biome's Vue support doesn't see.
function cancelRename() {
	renamingPath.value = null;
}
</script>

<template>
  <div class="gram-file-tabs">
    <div
      v-for="path in files"
      :key="path"
      class="file-tab"
      :class="{ active: path === activeFile, 'has-error': errorFiles.has(path) }"
      @click="emit('select', path)"
      @dblclick="startRename(path)"
    >
      <input
        v-if="renamingPath === path"
        ref="renameInput"
        v-model="renameValue"
        class="rename-input"
        :aria-label="t.playground.tabs.newFileName"
        @click.stop
        @keydown.enter="commitRename"
        @keydown.escape="cancelRename"
        @blur="commitRename"
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

    <button class="file-tab-add" :title="t.playground.tabs.addFile" @click="emit('add')">
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
  overflow-x: auto;
  flex-shrink: 0;
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
  box-shadow: inset 0 -2px 0 var(--sl-color-accent);
}

.file-tab.has-error .file-tab-label {
  color: #ef4444;
}

.file-tab-error-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #ef4444;
  flex-shrink: 0;
}

.rename-input {
  font: inherit;
  color: inherit;
  background-color: var(--sl-color-bg);
  border: 1px solid var(--sl-color-accent);
  border-radius: 3px;
  padding: 1px 4px;
  width: 10ch;
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
