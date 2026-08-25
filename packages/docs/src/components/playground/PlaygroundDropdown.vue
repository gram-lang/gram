<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, useId } from "vue";

const props = defineProps<{
	modelValue: string;
	options: { label: string; value: string }[];
	placeholder?: string;
	ariaLabel: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
	change: [value: string];
}>();

const isOpen = ref(false);
const highlightedIndex = ref(-1);
const dropdownRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const listboxId = useId();

function optionId(index: number): string {
	return `${listboxId}-option-${index}`;
}

// biome-ignore lint/correctness/noUnusedVariables: activeDescendant is used in the <template> block below, which Biome's Vue support doesn't see.
const activeDescendant = computed(() =>
	isOpen.value && highlightedIndex.value >= 0
		? optionId(highlightedIndex.value)
		: undefined,
);

function selectedIndex(): number {
	return props.options.findIndex((o) => o.value === props.modelValue);
}

function openDropdown() {
	isOpen.value = true;
	const idx = selectedIndex();
	highlightedIndex.value = idx >= 0 ? idx : 0;
}

function closeDropdown(focusTrigger = false) {
	isOpen.value = false;
	if (focusTrigger) triggerRef.value?.focus();
}

// biome-ignore lint/correctness/noUnusedVariables: toggle is used in the <template> block below, which Biome's Vue support doesn't see.
function toggle() {
	if (isOpen.value) closeDropdown();
	else openDropdown();
}

function selectOption(value: string) {
	emit("update:modelValue", value);
	emit("change", value);
	closeDropdown(true);
}

// biome-ignore lint/correctness/noUnusedVariables: onTriggerKeydown is used in the <template> block below, which Biome's Vue support doesn't see.
function onTriggerKeydown(e: KeyboardEvent) {
	switch (e.key) {
		case "ArrowDown":
			e.preventDefault();
			if (!isOpen.value) openDropdown();
			else
				highlightedIndex.value = Math.min(
					highlightedIndex.value + 1,
					props.options.length - 1,
				);
			break;
		case "ArrowUp":
			e.preventDefault();
			if (!isOpen.value) openDropdown();
			else highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
			break;
		case "Home":
			if (isOpen.value) {
				e.preventDefault();
				highlightedIndex.value = 0;
			}
			break;
		case "End":
			if (isOpen.value) {
				e.preventDefault();
				highlightedIndex.value = props.options.length - 1;
			}
			break;
		case "Enter":
		case " ":
			e.preventDefault();
			if (isOpen.value && highlightedIndex.value >= 0) {
				selectOption(props.options[highlightedIndex.value].value);
			} else if (!isOpen.value) {
				openDropdown();
			}
			break;
		case "Escape":
			if (isOpen.value) {
				e.preventDefault();
				closeDropdown();
			}
			break;
		case "Tab":
			isOpen.value = false;
			break;
	}
}

function onOutsideClick(e: MouseEvent) {
	if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
		isOpen.value = false;
	}
}

onMounted(() => {
	document.addEventListener("click", onOutsideClick);
});

onUnmounted(() => {
	document.removeEventListener("click", onOutsideClick);
});
</script>

<template>
  <div class="custom-dropdown" ref="dropdownRef">
    <div
      class="dropdown-header"
      ref="triggerRef"
      role="combobox"
      tabindex="0"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="listboxId"
      :aria-activedescendant="activeDescendant"
      :class="{ 'is-open': isOpen }"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="dropdown-label">
        {{ options.find(o => o.value === modelValue)?.label || placeholder }}
      </span>
      <svg class="dropdown-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 15.0006L7.75732 10.758L9.17154 9.34375L12 12.1722L14.8284 9.34375L16.2426 10.758L12 15.0006Z"></path>
      </svg>
    </div>

    <div v-show="isOpen" class="dropdown-menu" role="listbox" :id="listboxId">
      <div
        v-for="(opt, index) in options"
        :key="opt.value"
        :id="optionId(index)"
        class="dropdown-item"
        role="option"
        :aria-selected="opt.value === modelValue"
        :class="{ active: opt.value === modelValue, highlighted: index === highlightedIndex }"
        @mousemove="highlightedIndex = index"
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
  min-width: 0;
  width: 100%;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: transparent;
  color: var(--sl-color-gray-3);
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  border: 1px solid var(--sl-color-border);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.dropdown-header:hover {
  border: 1px solid var(--sl-color-gray-3);
}

.dropdown-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.dropdown-header:hover, .dropdown-header.is-open {
  color: var(--sl-color-text);
}

.dropdown-icon {
  margin-left: 8px;
  flex-shrink: 0;
  color: var(--sl-color-gray-4);
}

.dropdown-header:hover .dropdown-icon, .dropdown-header.is-open .dropdown-icon {
  color: var(--sl-color-gray-3);
}

.dropdown-header.is-open .dropdown-icon {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  max-width: calc(100vw - 32px);
  width: max-content;
  background-color: var(--sl-color-bg);
  border: 1px solid var(--sl-color-border);
  z-index: 50;
  padding: 0;
  overflow-y: auto;
  max-height: 300px;
}

.dropdown-item {
  padding: 6px 16px;
  cursor: pointer;
  color: var(--sl-color-gray-3);
  font-weight: 500;
  white-space: nowrap;
}

.dropdown-item:hover,
.dropdown-item.highlighted {
  background-color: var(--sl-color-gray-7);
}

.dropdown-item.active {
  color: var(--sl-color-white);
  background-color: var(--sl-color-gray-7);
  font-weight:bold;
}

@media (max-width: 640px) {
  .custom-dropdown {
    min-width: 0;
    flex: 1 1 auto;
  }
}
</style>
