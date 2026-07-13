<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const _props = defineProps<{
	modelValue: string;
	options: { label: string; value: string }[];
	placeholder?: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
	change: [value: string];
}>();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: toggle is used in the <template> block below, which Biome's Vue support doesn't see.
function toggle() {
	isOpen.value = !isOpen.value;
}

// biome-ignore lint/correctness/noUnusedVariables: selectOption is used in the <template> block below, which Biome's Vue support doesn't see.
function selectOption(value: string) {
	emit("update:modelValue", value);
	emit("change", value);
	isOpen.value = false;
}

function closeDropdown(e: MouseEvent) {
	if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
		isOpen.value = false;
	}
}

onMounted(() => {
	document.addEventListener("click", closeDropdown);
});

onUnmounted(() => {
	document.removeEventListener("click", closeDropdown);
});
</script>

<template>
  <div class="custom-dropdown" ref="dropdownRef">
    <div class="dropdown-header" @click="toggle" :class="{ 'is-open': isOpen }">
      <span class="dropdown-label">
        {{ options.find(o => o.value === modelValue)?.label || placeholder }}
      </span>
      <svg class="dropdown-icon" xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 15.0006L7.75732 10.758L9.17154 9.34375L12 12.1722L14.8284 9.34375L16.2426 10.758L12 15.0006Z"></path>
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
  font-size: 14px;
  min-width: 140px;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-radius: 6px;
  background-color: transparent;
  color: var(--vp-c-text-2);
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: color 0.25s, background-color 0.25s;
  border: 1px solid var(--vp-c-border);
  width: 190px;
}

.dropdown-header:hover, .dropdown-header.is-open {
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
}

.dropdown-icon {
  margin-left: 8px;
  color: var(--vp-c-text-3);
  transition: transform 0.25s, color 0.25s;
}

.dropdown-header:hover .dropdown-icon, .dropdown-header.is-open .dropdown-icon {
  color: var(--vp-c-text-2);
}

.dropdown-header.is-open .dropdown-icon {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  background-color: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  box-shadow: var(--vp-shadow-3);
  z-index: 50;
  padding: 6px 0;
  overflow: hidden;
}

.dropdown-item {
  padding: 6px 16px;
  cursor: pointer;
  color: var(--vp-c-text-2);
  font-weight: 500;
  transition: color 0.25s, background-color 0.25s;
  white-space: nowrap;
}

.dropdown-item:hover {
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-default-soft);
}

.dropdown-item.active {
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-default-soft);
}
</style>
