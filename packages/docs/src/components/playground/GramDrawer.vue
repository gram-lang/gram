<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useI18n } from "./useI18n";

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below
const { t } = useI18n();

const props = withDefaults(
	defineProps<{
		isOpen: boolean;
		title: string;
		activeCount?: number;
		docked?: boolean;
	}>(),
	{
		docked: false,
	},
);

const emit = defineEmits<{
	(e: "close"): void;
	(e: "reset"): void;
}>();

const drawerRef = ref<HTMLElement | null>(null);
let triggerElement: HTMLElement | null = null;
let originalOverflow = "";

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(): HTMLElement[] {
	if (!drawerRef.value) return [];
	return Array.from(
		drawerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
	).filter((el) => el.offsetParent !== null);
}

function handleKeyDown(e: KeyboardEvent) {
	if (!props.isOpen) return;

	if (e.key === "Escape") {
		// When docked, only close on Escape if the event originated inside the drawer panel
		if (props.docked && !drawerRef.value?.contains(document.activeElement)) {
			return;
		}
		e.preventDefault();
		emit("close");
		return;
	}

	if (e.key === "Tab") {
		// In docked mode, standard page tab navigation applies without trapping
		if (props.docked) return;

		const focusable = getFocusableElements();
		if (focusable.length === 0) {
			e.preventDefault();
			return;
		}

		const firstElement = focusable[0];
		const lastElement = focusable[focusable.length - 1];

		if (e.shiftKey) {
			if (
				document.activeElement === firstElement ||
				!drawerRef.value?.contains(document.activeElement)
			) {
				e.preventDefault();
				lastElement.focus();
			}
		} else {
			if (
				document.activeElement === lastElement ||
				!drawerRef.value?.contains(document.activeElement)
			) {
				e.preventDefault();
				firstElement.focus();
			}
		}
	}
}

// Interactive touch & pointer drag handling for resizing / dismissing the mobile bottom-sheet
const sheetHeight = ref<number | null>(null);
// biome-ignore lint/correctness/noUnusedVariables: isDraggingSheet is used in the <template> block below
const isDraggingSheet = ref(false);
let touchStartY = 0;
let startSheetHeight = 0;

// biome-ignore lint/correctness/noUnusedVariables: mobileSheetStyle is used in the <template> block below
const mobileSheetStyle = computed(() => {
	if (props.docked || sheetHeight.value === null) return {};
	return {
		height: `${sheetHeight.value}px`,
		maxHeight: "92vh",
	};
});

// biome-ignore lint/correctness/noUnusedVariables: handleTouchStart is used in the <template> block below
function handleTouchStart(e: TouchEvent) {
	if (props.docked) return;
	isDraggingSheet.value = true;
	touchStartY = e.touches[0].clientY;
	startSheetHeight = drawerRef.value
		? drawerRef.value.getBoundingClientRect().height
		: window.innerHeight * 0.7;
}

// biome-ignore lint/correctness/noUnusedVariables: handleTouchMove is used in the <template> block below
function handleTouchMove(e: TouchEvent) {
	if (props.docked || !isDraggingSheet.value) return;
	const touchY = e.touches[0].clientY;
	const deltaY = touchY - touchStartY;
	const newHeight = startSheetHeight - deltaY;
	const maxHeight = window.innerHeight * 0.92;
	sheetHeight.value = Math.max(100, Math.min(newHeight, maxHeight));
}

// biome-ignore lint/correctness/noUnusedVariables: handleTouchEnd is used in the <template> block below
function handleTouchEnd() {
	if (props.docked || !isDraggingSheet.value) return;
	isDraggingSheet.value = false;
	finishDrag();
}

// biome-ignore lint/correctness/noUnusedVariables: handleMouseDown is used in the <template> block below
function handleMouseDown(e: MouseEvent) {
	if (props.docked) return;
	isDraggingSheet.value = true;
	touchStartY = e.clientY;
	startSheetHeight = drawerRef.value
		? drawerRef.value.getBoundingClientRect().height
		: window.innerHeight * 0.7;
	window.addEventListener("mousemove", handleMouseMove);
	window.addEventListener("mouseup", handleMouseUp);
}

function handleMouseMove(e: MouseEvent) {
	if (!isDraggingSheet.value) return;
	const deltaY = e.clientY - touchStartY;
	const newHeight = startSheetHeight - deltaY;
	const maxHeight = window.innerHeight * 0.92;
	sheetHeight.value = Math.max(100, Math.min(newHeight, maxHeight));
}

function handleMouseUp() {
	if (!isDraggingSheet.value) return;
	isDraggingSheet.value = false;
	window.removeEventListener("mousemove", handleMouseMove);
	window.removeEventListener("mouseup", handleMouseUp);
	finishDrag();
}

function finishDrag() {
	if (props.docked) return;
	if (sheetHeight.value !== null) {
		const currentH = sheetHeight.value;
		const deltaY = startSheetHeight - currentH;
		// If pulled down far (height < 180px or pulled down > 140px), close the sheet
		if (currentH < 180 || deltaY > 140) {
			emit("close");
			return;
		}
		// Clamp to valid range: minimum 240px, maximum 92vh
		const maxHeight = window.innerHeight * 0.92;
		sheetHeight.value = Math.max(240, Math.min(currentH, maxHeight));
	}
}

// biome-ignore lint/correctness/noUnusedVariables: handleAfterLeave is used in the <template> block below
function handleAfterLeave() {
	sheetHeight.value = null;
	isDraggingSheet.value = false;
}

watch(
	() => props.isOpen,
	async (isOpen) => {
		if (isOpen) {
			triggerElement = document.activeElement as HTMLElement | null;
			if (!props.docked) {
				originalOverflow = document.body.style.overflow;
				document.body.style.overflow = "hidden";
			}
			window.addEventListener("keydown", handleKeyDown);

			await nextTick();
			if (!props.docked) {
				const focusable = getFocusableElements();
				if (focusable.length > 0) {
					focusable[0].focus();
				} else {
					drawerRef.value?.focus();
				}
			}
		} else {
			if (!props.docked) {
				document.body.style.overflow = originalOverflow;
			}
			window.removeEventListener("keydown", handleKeyDown);
			if (triggerElement && typeof triggerElement.focus === "function") {
				triggerElement.focus();
			}
			triggerElement = null;
		}
	},
);

watch(
	() => props.docked,
	(docked) => {
		if (props.isOpen) {
			if (docked) {
				document.body.style.overflow = originalOverflow;
			} else {
				originalOverflow = document.body.style.overflow;
				document.body.style.overflow = "hidden";
			}
		}
	},
);

onMounted(() => {
	if (props.isOpen) {
		window.addEventListener("keydown", handleKeyDown);
	}
});

onUnmounted(() => {
	if (!props.docked) {
		document.body.style.overflow = originalOverflow;
	}
	window.removeEventListener("keydown", handleKeyDown);
	window.removeEventListener("mousemove", handleMouseMove);
	window.removeEventListener("mouseup", handleMouseUp);
});
</script>

<template>
  <Teleport to="body" :disabled="docked">
    <Transition
      :name="docked ? '' : 'gram-drawer-anim'"
      :css="!docked"
      :duration="docked ? 0 : 250"
      @after-leave="handleAfterLeave"
    >
      <div
        v-if="isOpen"
        class="gram-drawer-root"
        :class="{ 'is-docked': docked }"
      >
        <div
          v-if="!docked"
          class="gram-drawer-backdrop"
          @click="emit('close')"
          aria-hidden="true"
        ></div>
        <div
          ref="drawerRef"
          class="gram-drawer-panel"
          :class="{ 'is-resizing': isDraggingSheet }"
          :style="mobileSheetStyle"
          :role="docked ? 'region' : 'dialog'"
          :aria-modal="docked ? undefined : 'true'"
          :aria-label="docked ? title : undefined"
          :aria-labelledby="docked ? undefined : 'drawer-title'"
          tabindex="-1"
        >
          <!-- Mobile Drag Handle -->
          <div
            v-if="!docked"
            class="gram-drawer-drag-handle-area"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @touchcancel="handleTouchEnd"
            @mousedown="handleMouseDown"
          >
            <div class="gram-drawer-drag-handle"></div>
          </div>

          <!-- Header -->
          <div class="gram-drawer-header">
            <div class="gram-drawer-header-left">
              <h2 id="drawer-title" class="gram-drawer-title">{{ title }}</h2>
              <span
                v-if="(activeCount ?? 0) > 0"
                class="gram-drawer-active-badge"
              >
                {{ t.playground.activeOptionsBadge.replace('{count}', String(activeCount)) }}
              </span>
            </div>
            <div class="gram-drawer-header-actions">
              <button
                type="button"
                class="gram-drawer-reset-btn"
                :disabled="!activeCount || activeCount <= 0"
                @click="emit('reset')"
                :title="t.playground.resetAll"
              >
                {{ t.playground.resetAll }}
              </button>
              <button
                type="button"
                class="gram-drawer-close-btn"
                :aria-label="t.playground.a11y?.closeDrawer || 'Close'"
                @click="emit('close')"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Content slot -->
          <div class="gram-drawer-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gram-drawer-root:not(.is-docked) {
  position: fixed;
  inset: 0;
  z-index: 200000;
  display: flex;
  justify-content: flex-end;
}

.gram-drawer-root.is-docked {
  position: relative;
  inset: auto;
  z-index: 5;
  display: flex;
  flex-direction: column;
  width: 360px;
  max-width: 45%;
  min-width: 300px;
  height: 100%;
  flex-shrink: 0;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
}

.gram-drawer-backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.25);
}

.gram-drawer-root:not(.is-docked) .gram-drawer-panel {
  position: relative;
  z-index: 1;
  width: 360px;
  max-width: 90vw;
  height: 100%;
  background-color: var(--sl-color-bg);
  border-left: 1px solid var(--sl-color-border);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  outline: none;
}

.gram-drawer-root.is-docked .gram-drawer-panel {
  position: static;
  width: 100%;
  max-width: 100%;
  height: 100%;
  background-color: var(--sl-color-bg);
  border-left: none;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  outline: none;
}

.gram-drawer-drag-handle-area {
  display: none;
  justify-content: center;
  align-items: center;
  padding: 12px 0 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.gram-drawer-drag-handle-area:active {
  cursor: grabbing;
}

.gram-drawer-drag-handle {
  width: 40px;
  height: 5px;
  border-radius: 3px;
  background-color: var(--sl-color-gray-4);
  transition: background-color 0.15s, transform 0.15s;
}

.gram-drawer-drag-handle-area:hover .gram-drawer-drag-handle,
.gram-drawer-drag-handle-area:active .gram-drawer-drag-handle {
  background-color: var(--sl-color-gray-3);
  transform: scaleX(1.1);
}

.gram-drawer-panel.is-resizing {
  transition: none !important;
}

.gram-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  flex-shrink: 0;
  gap: 12px;
}

.gram-drawer-root.is-docked .gram-drawer-header {
  height: 42px;
  padding: 0 12px;
  box-sizing: border-box;
  background-color: var(--sl-color-gray-7);
}

.gram-drawer-root.is-docked .gram-drawer-title {
  font-size: 13px;
}

.gram-drawer-root.is-docked .gram-drawer-close-btn {
  width: 28px;
  height: 28px;
}

.gram-drawer-root.is-docked .gram-drawer-reset-btn {
  padding: 3px 8px;
  font-size: 11px;
}

.gram-drawer-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.gram-drawer-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--sl-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.gram-drawer-active-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 0;
  background-color: var(--sl-color-accent);
  color: #1a1613;
  white-space: nowrap;
  flex-shrink: 0;
}

.gram-drawer-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.gram-drawer-reset-btn {
  background: transparent;
  border: 1px solid var(--sl-color-border);
  color: var(--sl-color-gray-3);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 0;
}

.gram-drawer-reset-btn:hover:not(:disabled) {
  color: var(--sl-color-text);
  border-color: var(--sl-color-gray-3);
}

.gram-drawer-reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.gram-drawer-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--sl-color-gray-3);
  cursor: pointer;
  border-radius: 0;
}

.gram-drawer-close-btn:hover {
  color: var(--sl-color-text);
  background-color: var(--sl-color-gray-6);
  border-color: var(--sl-color-border);
}

.gram-drawer-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Transitions: Mobile overlay panel translation & root fade */
.gram-drawer-anim-enter-active,
.gram-drawer-anim-leave-active {
  transition: opacity 0.25s ease;
}

.gram-drawer-anim-enter-from,
.gram-drawer-anim-leave-to {
  opacity: 0;
}

.gram-drawer-anim-enter-active .gram-drawer-panel,
.gram-drawer-anim-leave-active .gram-drawer-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.gram-drawer-anim-enter-from .gram-drawer-panel,
.gram-drawer-anim-leave-to .gram-drawer-panel {
  transform: translateX(100%);
}

.gram-drawer-anim-leave-from .gram-drawer-panel {
  transform: translateX(0);
}

/* Mobile responsive layout (Bottom Sheet) */
@media (max-width: 767px) {
  .gram-drawer-root:not(.is-docked) {
    align-items: flex-end;
  }

  .gram-drawer-root:not(.is-docked) .gram-drawer-panel {
    width: 100%;
    max-width: 100vw;
    height: auto;
    max-height: 85vh;
    border-left: none;
    border-top: 1px solid var(--sl-color-border);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
  }

  .gram-drawer-drag-handle-area {
    display: flex;
  }

  .gram-drawer-header {
    padding: 12px 14px;
    gap: 8px;
  }

  .gram-drawer-title {
    font-size: 14px;
  }

  .gram-drawer-reset-btn {
    padding: 3px 8px;
    font-size: 11px;
    white-space: nowrap;
  }

  .gram-drawer-close-btn {
    width: 28px;
    height: 28px;
  }

  .gram-drawer-anim-enter-from .gram-drawer-panel,
  .gram-drawer-anim-leave-to .gram-drawer-panel {
    transform: translateY(100%) !important;
  }

  .gram-drawer-anim-leave-from .gram-drawer-panel {
    transform: translateY(0) !important;
  }
}
</style>
