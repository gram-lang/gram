<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "./useI18n";

defineProps<{
	warnings: Array<{
		code: string;
		message: string;
		item?: string;
		loc?: { start: number; end: number };
	}>;
}>();

// biome-ignore lint/correctness/noUnusedVariables: emit is used in the <template> block below, which Biome's Vue support doesn't see.
const emit = defineEmits<{
	jump: [start: number, end: number];
}>();

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const { t } = useI18n();

const isCollapsed = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: toggle is used in the <template> block below, which Biome's Vue support doesn't see.
function toggle() {
	isCollapsed.value = !isCollapsed.value;
}
</script>

<template>
  <div v-if="warnings.length > 0" class="gram-warnings" :class="{ collapsed: isCollapsed }">
    <div class="warnings-header" @click="toggle">
      <div class="warnings-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"></path></svg>
        <span>{{ warnings.length }} {{ warnings.length > 1 ? t.playground.warnings.warnings : t.playground.warnings.warning }}</span>
      </div>
     <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"></path></svg>
    </div>
    
    <ul class="warnings-list" v-show="!isCollapsed">
      <li v-for="(w, i) in warnings" :key="i" class="warning-item">
        <div class="warning-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentcolor" viewBox="0 0 256 256"><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z"></path></svg>
        </div>
        <div class="warning-content">
          <span class="warning-code">[{{ w.code }}]</span>
          <span class="warning-message">{{ w.message }}</span>
          <span v-if="w.item" class="warning-item-name">{{ t.playground.warnings.item }}: {{ w.item }}</span>
        </div>
        <button v-if="w.loc" class="warning-jump" @click="emit('jump', w.loc.start, w.loc.end)">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M240,120H215.63A88.13,88.13,0,0,0,136,40.37V16a8,8,0,0,0-16,0V40.37A88.13,88.13,0,0,0,40.37,120H16a8,8,0,0,0,0,16H40.37A88.13,88.13,0,0,0,120,215.63V240a8,8,0,0,0,16,0V215.63A88.13,88.13,0,0,0,215.63,136H240a8,8,0,0,0,0-16ZM128,200a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,200Zm0-112a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z"></path></svg>
          {{ t.playground.warnings.show }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.gram-warnings {
  background-color: var(--sl-color-bg-sidebar);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  overflow: hidden;
  margin: 10px;
}

.warnings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  background-color: rgba(220, 38, 38, 0.1);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.warnings-header:hover {
  background-color: rgba(220, 38, 38, 0.15);
}

.warnings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ef4444;
  font-weight: 600;
}

.toggle-icon {
  transition: transform 0.2s;
  color: #ef4444;
}

.gram-warnings.collapsed .toggle-icon {
  transform: rotate(180deg);
}

.gram-warnings.collapsed .warnings-header {
  border-bottom: none;
}

.warnings-list {
  list-style: none;
  padding: 10px;
  margin: 0;
background-color: rgba(220, 38, 38, 0.1);
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(220, 38, 38, 0.1);
  transition: background-color 0.2s;
  background-color: var(--sl-color-bg);
  border-radius: 7px;
}


.warning-item:last-child {
  border-bottom: none;
}

.warning-icon {
  color: #ef4444;
  margin-top: 2px;
}

.warning-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.warning-code {
  font-weight: 600;
  color: var(--sl-color-gray-3);
  font-size: 12px;
  font-family: var(--sl-font-mono);
  background-color: var(--sl-color-bg-sidebar);
  padding: 0px 6px;
  border-radius: 4px;
  align-self: flex-start;
}

.warning-message {
  font-size: 14px;
  color: var(--sl-color-text);
}

.warning-item-name {
  font-size: 12px;
  color: var(--sl-color-gray-3);
}

.warning-jump {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 4px;
  background-color: transparent;
  color: var(--sl-color-gray-3);
  font-size: 12px;
  border: 1px solid var(--sl-color-hairline);
  cursor: pointer;
  transition: all 0.2s;
}

.warning-jump:hover {
  background-color: var(--sl-color-bg-inline-code);
  color: var(--sl-color-text);
  border-color: var(--sl-color-gray-4);
}
</style>
