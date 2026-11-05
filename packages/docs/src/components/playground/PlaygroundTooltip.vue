<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";

withDefaults(
	defineProps<{
		text: string;
		ariaLabel?: string;
	}>(),
	{
		ariaLabel: "Information",
	},
);

const isOpen = ref(false);
const isAbove = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const bubbleRef = ref<HTMLElement | null>(null);

const coords = ref({ top: 0, left: 0, arrowLeft: 12 });
let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

function updatePosition() {
	if (!triggerRef.value) return;
	const rect = triggerRef.value.getBoundingClientRect();

	// If trigger is hidden or scrolled out of view, close tooltip
	if (rect.width === 0 && rect.height === 0) {
		isOpen.value = false;
		return;
	}
	if (rect.bottom < 50 || rect.top > window.innerHeight - 20) {
		isOpen.value = false;
		return;
	}

	const tooltipWidth = 260;
	const padding = 12;

	let left = rect.left - 8;
	if (left + tooltipWidth > window.innerWidth - padding) {
		left = window.innerWidth - tooltipWidth - padding;
	}
	if (left < padding) {
		left = padding;
	}

	const spaceBelow = window.innerHeight - rect.bottom;
	const spaceAbove = rect.top;
	const placeAbove = spaceBelow < 90 && spaceAbove > spaceBelow;
	isAbove.value = placeAbove;

	const top = placeAbove ? rect.top - 6 : rect.bottom + 6;
	const arrowLeft = Math.max(
		10,
		Math.min(tooltipWidth - 14, rect.left + rect.width / 2 - left),
	);

	coords.value = { top, left, arrowLeft };
}

function show() {
	if (hoverTimeout) clearTimeout(hoverTimeout);
	updatePosition();
	isOpen.value = true;
	nextTick(() => {
		updatePosition();
	});
}

// biome-ignore lint/correctness/noUnusedVariables: hide is used in the <template> block below
function hide() {
	if (hoverTimeout) clearTimeout(hoverTimeout);
	hoverTimeout = setTimeout(() => {
		isOpen.value = false;
	}, 120);
}

// biome-ignore lint/correctness/noUnusedVariables: cancelHide is used in the <template> block below
function cancelHide() {
	if (hoverTimeout) clearTimeout(hoverTimeout);
}

// biome-ignore lint/correctness/noUnusedVariables: toggle is used in the <template> block below
function toggle() {
	if (isOpen.value) {
		isOpen.value = false;
	} else {
		show();
	}
}

function handleKeyDown(e: KeyboardEvent) {
	if (isOpen.value && e.key === "Escape") {
		isOpen.value = false;
	}
}

function handleDocumentClick(e: MouseEvent) {
	if (
		isOpen.value &&
		triggerRef.value &&
		!triggerRef.value.contains(e.target as Node) &&
		bubbleRef.value &&
		!bubbleRef.value.contains(e.target as Node)
	) {
		isOpen.value = false;
	}
}

function handleScrollOrResize() {
	if (isOpen.value) {
		updatePosition();
	}
}

onMounted(() => {
	document.addEventListener("click", handleDocumentClick);
	document.addEventListener("keydown", handleKeyDown);
	window.addEventListener("scroll", handleScrollOrResize, true);
	window.addEventListener("resize", handleScrollOrResize);
});

onUnmounted(() => {
	if (hoverTimeout) clearTimeout(hoverTimeout);
	document.removeEventListener("click", handleDocumentClick);
	document.removeEventListener("keydown", handleKeyDown);
	window.removeEventListener("scroll", handleScrollOrResize, true);
	window.removeEventListener("resize", handleScrollOrResize);
});
</script>

<template>
  <span class="playground-tooltip-container">
    <button
      ref="triggerRef"
      type="button"
      class="playground-tooltip-trigger"
      :class="{ 'is-active': isOpen }"
      :aria-label="ariaLabel"
      :aria-expanded="isOpen"
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
      @click="toggle"
    >
      <slot>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="info-icon"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </slot>
    </button>
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="bubbleRef"
        class="playground-tooltip-bubble"
        :class="{ 'is-above': isAbove }"
        :style="{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          '--arrow-left': `${coords.arrowLeft}px`,
        }"
        role="tooltip"
        @mouseenter="cancelHide"
        @mouseleave="hide"
      >
        {{ text }}
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.playground-tooltip-container {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.playground-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--sl-color-gray-4);
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s ease;
}

.playground-tooltip-trigger:hover,
.playground-tooltip-trigger:focus-visible,
.playground-tooltip-trigger.is-active {
  color: var(--sl-color-accent-high, var(--sl-color-text));
}

.playground-tooltip-trigger:focus-visible {
  outline: 2px solid var(--sl-color-accent);
  outline-offset: 1px;
}

.info-icon {
  width: 13px;
  height: 13px;
}
</style>

<style>
/* Global style because the bubble is teleported to body */
.playground-tooltip-bubble {
  position: fixed;
  z-index: 300000;
  width: max-content;
  max-width: 280px;
  max-height: 260px;
  overflow-y: auto;
  padding: 7px 11px;
  background-color: var(--sl-color-bg-nav, #1a1613);
  color: var(--sl-color-text, #f5f2eb);
  border: 1px solid var(--sl-color-gray-5, #443e38);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  font-size: 11.5px;
  line-height: 1.45;
  font-weight: 400;
  border-radius: 4px;
  pointer-events: auto;
  white-space: pre-line;
  word-break: normal;
  box-sizing: border-box;
  animation: tooltip-fade-in 0.15s ease-out;
}

.playground-tooltip-bubble.is-above {
  transform: translateY(-100%);
  animation: tooltip-fade-in-above 0.15s ease-out;
}

.playground-tooltip-bubble::before {
  content: "";
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: var(--sl-color-bg-nav, #1a1613);
  left: var(--arrow-left, 12px);
  transform: translateX(-50%) rotate(45deg);
}

.playground-tooltip-bubble:not(.is-above)::before {
  top: -5px;
  border-left: 1px solid var(--sl-color-gray-5, #443e38);
  border-top: 1px solid var(--sl-color-gray-5, #443e38);
}

.playground-tooltip-bubble.is-above::before {
  bottom: -5px;
  border-right: 1px solid var(--sl-color-gray-5, #443e38);
  border-bottom: 1px solid var(--sl-color-gray-5, #443e38);
}

@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes tooltip-fade-in-above {
  from {
    opacity: 0;
    transform: translateY(calc(-100% + 2px));
  }
  to {
    opacity: 1;
    transform: translateY(-100%);
  }
}
</style>
