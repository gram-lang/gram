<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: string
  options: { label: string; value: string }[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function toggle() {
  isOpen.value = !isOpen.value
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
  isOpen.value = false
}

function closeDropdown(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<template>
  <div class="custom-dropdown" ref="dropdownRef">
    <div class="dropdown-header" @click="toggle" :class="{ 'is-open': isOpen }">
      <span class="dropdown-label">
        {{ options.find(o => o.value === modelValue)?.label || placeholder }}
      </span>
      <svg class="dropdown-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
        <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
      </svg>
    </div>
    
    <div v-show="isOpen" class="dropdown-menu">
      <div 
        v-for="opt in options" 
        :key="opt.value" 
        class="dropdown-item" 
        :class="{ active: opt.value === modelValue }"
        @click="selectOption(opt.value)"
      >
        {{ opt.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-dropdown {
  position: relative;
  font-size: 13px;
  min-width: 150px;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.2s;
}

.dropdown-header:hover, .dropdown-header.is-open {
  border-color: var(--vp-c-brand);
}

.dropdown-icon {
  margin-left: 8px;
  color: var(--vp-c-text-3);
  transition: transform 0.2s;
}

.dropdown-header.is-open .dropdown-icon {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  box-shadow: var(--vp-shadow-3);
  z-index: 50;
  overflow: hidden;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  color: var(--vp-c-text-2);
  transition: background-color 0.2s, color 0.2s;
}

.dropdown-item:hover {
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.dropdown-item.active {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 500;
}
</style>
