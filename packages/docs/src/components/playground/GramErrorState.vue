<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "./useI18n";
import type { PlaygroundDiagnostic } from "./diagnostics";

const props = defineProps<{
	diagnostics: PlaygroundDiagnostic[];
}>();

const emit = defineEmits<{
	jump: [start: number, end: number, uri?: string];
}>();

const { t } = useI18n();

const primaryError = computed(() => {
	return (
		props.diagnostics.find((d) => d.blocking) ||
		props.diagnostics.find((d) => d.severity === "error") ||
		props.diagnostics[0]
	);
});
</script>

<template>
  <div class="gram-error-state">
    <div class="error-state-card">
      <div class="error-state-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="currentColor" viewBox="0 0 256 256">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path>
        </svg>
      </div>
      <h3 class="error-state-title">{{ t.playground.errorState?.title || 'Generation paused' }}</h3>
      <p class="error-state-description">
        {{ t.playground.errorState?.blockingDescription || 'The recipe contains blocking errors preventing preview generation.' }}
      </p>

      <div v-if="primaryError" class="error-state-detail">
        <div class="error-detail-header">
          <span class="error-code">[{{ primaryError.code }}]</span>
          <span v-if="primaryError.uri" class="error-uri">{{ primaryError.uri.slice(1) }}</span>
        </div>
        <div class="error-message-box">{{ primaryError.message }}</div>
        <button
          v-if="primaryError.loc"
          class="jump-button"
          @click="emit('jump', primaryError.loc.start, primaryError.loc.end, primaryError.uri)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
            <path d="M240,120H215.63A88.13,88.13,0,0,0,136,40.37V16a8,8,0,0,0-16,0V40.37A88.13,88.13,0,0,0,40.37,120H16a8,8,0,0,0,0,16H40.37A88.13,88.13,0,0,0,120,215.63V240a8,8,0,0,0,16,0V215.63A88.13,88.13,0,0,0,215.63,136H240a8,8,0,0,0,0-16ZM128,200a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,200Zm0-112a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z"></path>
          </svg>
          {{ t.playground.errorState?.jumpToError || 'Jump to error' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gram-error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 32px 16px;
  background-color: var(--sl-color-bg);
  box-sizing: border-box;
}

.error-state-card {
  max-width: 520px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 24px;
  border-radius: 12px;
  border: 1px solid var(--sl-color-red);
  background-color: var(--sl-color-red-low);
}

.error-state-icon {
  /* red-high, not the base red: the base red only clears 3:1 against
     red-low in dark mode (4.80:1) but drops to 2.61:1 in light mode. */
  color: var(--sl-color-red-high);
  margin-bottom: 16px;
}

.error-state-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--sl-color-text);
}

.error-state-description {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: var(--sl-color-gray-3);
  line-height: 1.5;
}

.error-state-detail {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  text-align: left;
}

.error-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-code {
  font-family: var(--sl-font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--sl-color-red-high);
  background-color: var(--sl-color-bg);
  padding: 2px 6px;
  border-radius: 4px;
}

.error-uri {
  font-family: var(--sl-font-mono);
  font-size: 12px;
  color: var(--sl-color-gray-3);
}

.error-message-box {
  padding: 12px;
  background-color: var(--sl-color-bg-sidebar);
  border: 1px solid var(--sl-color-border);
  border-radius: 6px;
  font-family: var(--sl-font-mono);
  font-size: 13px;
  color: var(--sl-color-text);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.jump-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: var(--sl-color-red);
  /* white text on --sl-color-red only reaches ~3.4:1 in either theme;
     a fixed dark brown clears 4.5:1 against red's lightness in both. */
  color: #1a1613;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: filter 0.2s;
  align-self: center;
  margin-top: 4px;
}

.jump-button:hover {
  filter: brightness(0.9);
}
</style>
