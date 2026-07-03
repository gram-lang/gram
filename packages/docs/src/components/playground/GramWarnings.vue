<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  warnings: Array<{
    code: string
    message: string
    item?: string
    loc?: { start: number; end: number }
  }>
}>()

const emit = defineEmits<{
  jump: [start: number, end: number]
}>()

const isCollapsed = ref(false)

function toggle() {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div v-if="warnings.length > 0" class="gram-warnings" :class="{ collapsed: isCollapsed }">
    <div class="warnings-header" @click="toggle">
      <div class="warnings-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
          <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"></path>
        </svg>
        <span>{{ warnings.length }} Warning{{ warnings.length > 1 ? 's' : '' }}</span>
      </div>
      <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
        <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
      </svg>
    </div>
    
    <ul class="warnings-list" v-show="!isCollapsed">
      <li v-for="(w, i) in warnings" :key="i" class="warning-item">
        <div class="warning-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path>
          </svg>
        </div>
        <div class="warning-content">
          <span class="warning-code">[{{ w.code }}]</span>
          <span class="warning-message">{{ w.message }}</span>
          <span v-if="w.item" class="warning-item-name">Item: {{ w.item }}</span>
        </div>
        <button v-if="w.loc" class="warning-jump" @click="emit('jump', w.loc.start, w.loc.end)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
            <path d="M224,120H192V88a8,8,0,0,0-16,0v32H144a8,8,0,0,0,0,16h32v32a8,8,0,0,0,16,0V136h32a8,8,0,0,0,0-16ZM200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,160H56V56H200V200Z"></path>
          </svg>
          Show
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.gram-warnings {
  margin-top: 16px;
  background-color: var(--vp-c-warning-soft, rgba(234, 179, 8, 0.1));
  border: 1px solid var(--vp-c-warning-border, rgba(234, 179, 8, 0.3));
  border-radius: 8px;
  overflow: hidden;
}

.warnings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  background-color: rgba(255, 255, 255, 0.05);
}

.warnings-header:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.warnings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-warning-text, #eab308);
  font-weight: 600;
}

.toggle-icon {
  transition: transform 0.2s;
  color: var(--vp-c-warning-text, #eab308);
}

.gram-warnings.collapsed .toggle-icon {
  transform: rotate(-90deg);
}

.warnings-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--vp-c-warning-border, rgba(234, 179, 8, 0.3));
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-warning-border, rgba(234, 179, 8, 0.1));
}

.warning-item:last-child {
  border-bottom: none;
}

.warning-icon {
  color: var(--vp-c-warning-text, #eab308);
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
  color: var(--vp-c-warning-text, #eab308);
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
}

.warning-message {
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.warning-item-name {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.warning-jump {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  font-size: 12px;
  border: 1px solid var(--vp-c-border);
  cursor: pointer;
  transition: all 0.2s;
}

.warning-jump:hover {
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
}
</style>
