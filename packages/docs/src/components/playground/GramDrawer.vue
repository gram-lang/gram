<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useI18n } from "./useI18n";

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below
const { t } = useI18n();

const props = defineProps<{
	isOpen: boolean;
	title: string;
	activeCount?: number;
}>();

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
		e.preventDefault();
		emit("close");
		return;
	}

	if (e.key === "Tab") {
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

// Touch handling for mobile bottom-sheet swipe down to dismiss
let touchStartY = 0;
let touchCurrentY = 0;

// biome-ignore lint/correctness/noUnusedVariables: handleTouchStart is used in the <template> block below, which Biome's Vue support doesn't see.
function handleTouchStart(e: TouchEvent) {
	touchStartY = e.touches[0].clientY;
	touchCurrentY = touchStartY;
}

// biome-ignore lint/correctness/noUnusedVariables: handleTouchMove is used in the <template> block below, which Biome's Vue support doesn't see.
function handleTouchMove(e: TouchEvent) {
	touchCurrentY = e.touches[0].clientY;
}

// biome-ignore lint/correctness/noUnusedVariables: handleTouchEnd is used in the <template> block below, which Biome's Vue support doesn't see.
function handleTouchEnd() {
	const diffY = touchCurrentY - touchStartY;
	if (diffY > 70) {
		emit("close");
	}
	touchStartY = 0;
	touchCurrentY = 0;
}

watch(
	() => props.isOpen,
	async (isOpen) => {
		if (isOpen) {
			triggerElement = document.activeElement as HTMLElement | null;
			originalOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			window.addEventListener("keydown", handleKeyDown);

			await nextTick();
			const focusable = getFocusableElements();
			if (focusable.length > 0) {
				focusable[0].focus();
			} else {
				drawerRef.value?.focus();
			}
		} else {
			document.body.style.overflow = originalOverflow;
			window.removeEventListener("keydown", handleKeyDown);
			if (triggerElement && typeof triggerElement.focus === "function") {
				triggerElement.focus();
			}
			triggerElement = null;
		}
	},
);

onMounted(() => {
	if (props.isOpen) {
		window.addEventListener("keydown", handleKeyDown);
	}
});

onUnmounted(() => {
	document.body.style.overflow = originalOverflow;
	window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="gram-drawer-anim">
      <div v-if="isOpen" class="gram-drawer-root">
        <div class="gram-drawer-backdrop" @click="emit('close')" aria-hidden="true"></div>
        <div
          ref="drawerRef"
          class="gram-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          tabindex="-1"
        >
          <!-- Mobile Drag Handle -->
          <div
            class="gram-drawer-drag-handle-area"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
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
.gram-drawer-root {
  position: fixed;
  inset: 0;
  z-index: 200000;
  display: flex;
  justify-content: flex-end;
}

.gram-drawer-backdrop {
  position: absolute;
  inset: 0;
  background-color: transparent;
}

.gram-drawer-panel {
  position: relative;
  z-index: 1;
  width: 440px;
  max-width: 90vw;
  height: 100%;
  background-color: var(--sl-color-bg);
  border-left: 1px solid var(--sl-color-border);
  box-shadow: none;
  display: flex;
  flex-direction: column;
  outline: none;
}

.gram-drawer-drag-handle-area {
  display: none;
  justify-content: center;
  align-items: center;
  padding: 8px 0 4px;
  cursor: grab;
}

.gram-drawer-drag-handle {
  width: 36px;
  height: 4px;
  border-radius: 0;
  background-color: var(--sl-color-gray-4);
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

.gram-drawer-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.gram-drawer-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--sl-color-text);
  white-space: nowrap;
}

.gram-drawer-active-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 0;
  background-color: var(--sl-color-accent);
  color: #1a1613;
  white-space: nowrap;
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

/* Transitions: Only panel translation */
.gram-drawer-anim-enter-active .gram-drawer-panel,
.gram-drawer-anim-leave-active .gram-drawer-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.gram-drawer-anim-enter-from .gram-drawer-panel,
.gram-drawer-anim-leave-to .gram-drawer-panel {
  transform: translateX(100%);
}

/* Mobile responsive layout (Bottom Sheet) */
@media (max-width: 767px) {
  .gram-drawer-root {
    align-items: flex-end;
  }

  .gram-drawer-panel {
    width: 100%;
    max-width: 100vw;
    height: auto;
    max-height: 85vh;
    border-left: none;
    border-top: 1px solid var(--sl-color-border);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }

  .gram-drawer-drag-handle-area {
    display: flex;
  }

  .gram-drawer-anim-enter-from .gram-drawer-panel,
  .gram-drawer-anim-leave-to .gram-drawer-panel {
    transform: translateY(100%);
  }
}
</style>
