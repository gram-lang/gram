<script setup lang="ts">
import { useI18n } from "./useI18n";

/**
 * One section of the options: a header that opens and closes it, a dot and a
 * reset button when something in it differs from the defaults, and its body.
 */
defineProps<{
	title: string;
	open: boolean;
	/** Whether anything in the section differs from the defaults. */
	modified: boolean;
	/** What the section changed, in a few words: the tooltip of its dot. */
	badgeTitle?: string;
}>();

// biome-ignore lint/correctness/noUnusedVariables: emit is used in the <template> block below, which Biome's Vue support doesn't see.
const emit = defineEmits<{
	toggle: [];
	reset: [];
}>();

// biome-ignore lint/correctness/noUnusedVariables: t is used in the <template> block below, which Biome's Vue support doesn't see.
const { t } = useI18n();
</script>

<template>
  <div class="studio-section" :class="{ 'is-open': open }">
    <div class="studio-section-header">
      <button
        type="button"
        class="studio-section-trigger"
        :aria-expanded="open"
        :title="modified ? badgeTitle : undefined"
        @click="emit('toggle')"
      >
        <svg class="chevron-icon" :class="{ rotated: open }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <span class="section-title">{{ title }}</span>
        <span
          v-if="modified"
          class="section-dot"
          aria-hidden="true"
        ></span>
      </button>
      <button
        v-if="modified"
        type="button"
        class="section-reset-btn"
        @click.stop="emit('reset')"
        :title="t.playground.resetSection"
      >
        {{ t.playground.resetSection }}
      </button>
    </div>

    <div v-show="open" class="studio-section-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.studio-section {
  border: 1px solid var(--sl-color-border);
  border-radius: 0;
  background-color: var(--sl-color-bg);
}

.studio-section.is-open {
  border-color: var(--sl-color-gray-5);
}

.studio-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--sl-color-gray-7);
  padding: 4px 8px 4px 4px;
  gap: 8px;
}

.studio-section-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  padding: 8px 4px 8px 8px;
  cursor: pointer;
  color: var(--sl-color-text);
  text-align: left;
}

.chevron-icon {
  flex-shrink: 0;
  color: var(--sl-color-gray-3);
}

.chevron-icon.rotated {
  transform: rotate(90deg);
}

.section-title {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}

.section-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--sl-color-accent);
  margin-left: auto;
  flex-shrink: 0;
  display: inline-block;
  box-shadow: 0 0 0 2px var(--sl-color-gray-7);
}

.section-reset-btn {
  background: transparent;
  border: none;
  color: var(--sl-color-gray-3);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 0;
  white-space: nowrap;
  flex-shrink: 0;
}

.section-reset-btn:hover {
  color: var(--sl-color-text);
  background-color: var(--sl-color-gray-6);
}

.studio-section-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-top: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
}
</style>
