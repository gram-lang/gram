<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "./useI18n";
import { warningSeverityOf, type WarningSeverity } from "@gram-lang/modules";
import type { PlaygroundDiagnostic } from "./diagnostics";

const props = defineProps<{
	warnings: Array<
		| PlaygroundDiagnostic
		| {
				code: string;
				message: string;
				item?: string;
				loc?: { start: number; end: number };
				uri?: string;
				severity?: WarningSeverity;
				blocking?: boolean;
		  }
	>;
}>();

// biome-ignore lint/correctness/noUnusedVariables: emit is used in the <template> block below, which Biome's Vue support doesn't see.
const emit = defineEmits<{
	jump: [start: number, end: number, uri?: string];
}>();

const { t } = useI18n();

const isCollapsed = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: toggle is used in the <template> block below, which Biome's Vue support doesn't see.
function toggle() {
	isCollapsed.value = !isCollapsed.value;
}

const SEVERITY_ORDER: Record<WarningSeverity, number> = {
	error: 0,
	warning: 1,
	info: 2,
};

const itemsWithSeverity = computed(() => {
	const mapped = props.warnings.map((w) => ({
		...w,
		severity: (w.severity || warningSeverityOf(w.code)) as WarningSeverity,
	}));

	return mapped.sort((a, b) => {
		const orderA = SEVERITY_ORDER[a.severity] ?? 99;
		const orderB = SEVERITY_ORDER[b.severity] ?? 99;
		return orderA - orderB;
	});
});

const counts = computed(() => {
	let error = 0;
	let warning = 0;
	let info = 0;
	for (const item of itemsWithSeverity.value) {
		if (item.severity === "error") error++;
		else if (item.severity === "warning") warning++;
		else if (item.severity === "info") info++;
	}
	return { error, warning, info };
});

// biome-ignore lint/correctness/noUnusedVariables: overallSeverity is used in the <template> block below, which Biome's Vue support doesn't see.
const overallSeverity = computed<WarningSeverity>(() => {
	if (counts.value.error > 0) return "error";
	if (counts.value.warning > 0) return "warning";
	return "info";
});

// biome-ignore lint/correctness/noUnusedVariables: headerSummary is used in the <template> block below, which Biome's Vue support doesn't see.
const headerSummary = computed(() => {
	const parts: string[] = [];
	const c = counts.value;
	const tr = t.value.playground.warnings;

	if (c.error > 0) {
		parts.push(`${c.error} ${c.error > 1 ? tr.errors : tr.error}`);
	}
	if (c.warning > 0) {
		parts.push(`${c.warning} ${c.warning > 1 ? tr.warnings : tr.warning}`);
	}
	if (c.info > 0) {
		parts.push(`${c.info} ${c.info > 1 ? tr.infos : tr.info}`);
	}
	return parts.join(", ");
});
</script>

<template>
  <div
    v-if="warnings.length > 0"
    class="gram-warnings"
    :class="[`severity-${overallSeverity}`, { collapsed: isCollapsed }]"
  >
    <div class="warnings-header" @click="toggle">
      <div class="warnings-title">
        <!-- Error icon -->
        <svg v-if="overallSeverity === 'error'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path>
        </svg>
        <!-- Warning icon -->
        <svg v-else-if="overallSeverity === 'warning'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
          <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"></path>
        </svg>
        <!-- Info icon -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V120a8,8,0,0,1,0-16,16,16,0,0,1,16,16v48A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"></path>
        </svg>
        <span>{{ headerSummary }}</span>
      </div>
      <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
        <path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"></path>
      </svg>
    </div>
    
    <ul class="warnings-list" v-show="!isCollapsed">
      <li
        v-for="(w, i) in itemsWithSeverity"
        :key="i"
        class="warning-item"
        :class="`item-${w.severity}`"
      >
        <div class="warning-icon">
          <!-- Error item icon -->
          <svg v-if="w.severity === 'error'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path>
          </svg>
          <!-- Warning item icon -->
          <svg v-else-if="w.severity === 'warning'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
            <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"></path>
          </svg>
          <!-- Info item icon -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V120a8,8,0,0,1,0-16,16,16,0,0,1,16,16v48A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"></path>
          </svg>
        </div>
        <div class="warning-content">
          <div class="warning-meta">
            <span class="severity-badge" :class="`badge-${w.severity}`">
              {{ w.severity === 'error' ? t.playground.warnings.error : w.severity === 'warning' ? t.playground.warnings.warning : t.playground.warnings.info }}
            </span>
            <span class="warning-code">[{{ w.code }}]</span>
            <span v-if="w.uri" class="warning-uri">{{ w.uri.startsWith('/') ? w.uri.slice(1) : w.uri }}</span>
          </div>
          <span class="warning-message">{{ w.message }}</span>
          <span v-if="w.item" class="warning-item-name">{{ t.playground.warnings.item }}: {{ w.item }}</span>
        </div>
        <button v-if="w.loc" class="warning-jump" @click="emit('jump', w.loc.start, w.loc.end, w.uri)">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
            <path d="M240,120H215.63A88.13,88.13,0,0,0,136,40.37V16a8,8,0,0,0-16,0V40.37A88.13,88.13,0,0,0,40.37,120H16a8,8,0,0,0,0,16H40.37A88.13,88.13,0,0,0,120,215.63V240a8,8,0,0,0,16,0V215.63A88.13,88.13,0,0,0,215.63,136H240a8,8,0,0,0,0-16ZM128,200a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,200Zm0-112a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z"></path>
          </svg>
          {{ t.playground.warnings.show }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.gram-warnings {
  background-color: var(--sl-color-bg-sidebar);
  overflow: hidden;
  transition: border-color 0.2s;
}

/* Overall severity container borders */
.gram-warnings.severity-error {
  border-top: 1px solid rgba(239, 68, 68, 0.3);
}
.gram-warnings.severity-warning {
  border-top: 1px solid rgba(245, 158, 11, 0.3);
}
.gram-warnings.severity-info {
  border-top: 1px solid rgba(59, 130, 246, 0.3);
}

.warnings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.gram-warnings.severity-error .warnings-header {
  background-color: rgba(239, 68, 68, 0.1);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
}
.gram-warnings.severity-error .warnings-header:hover {
  background-color: rgba(239, 68, 68, 0.15);
}

.gram-warnings.severity-warning .warnings-header {
  background-color: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.2);
  color: #d97706;
}
.gram-warnings.severity-warning .warnings-header:hover {
  background-color: rgba(245, 158, 11, 0.15);
}

.gram-warnings.severity-info .warnings-header {
  background-color: rgba(59, 130, 246, 0.1);
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
  color: #2563eb;
}
.gram-warnings.severity-info .warnings-header:hover {
  background-color: rgba(59, 130, 246, 0.15);
}

.warnings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size:0.9rem;
}

.toggle-icon {
  transition: transform 0.2s;
}

.gram-warnings.collapsed .toggle-icon {
  transform: rotate(180deg);
}

.gram-warnings.collapsed .warnings-header {
  border-bottom: none;
}

.warnings-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.gram-warnings.severity-error .warnings-list {
  background-color: rgba(239, 68, 68, 0.04);
}
.gram-warnings.severity-warning .warnings-list {
  background-color: rgba(245, 158, 11, 0.04);
}
.gram-warnings.severity-info .warnings-list {
  background-color: rgba(59, 130, 246, 0.04);
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 12px;
  transition: background-color 0.2s;
  background-color: var(--sl-color-bg);
}

.warning-item:not(:last-child){
    border-bottom: 1px solid #e6e6e6;
}

.warning-item.item-error .warning-icon {
  color: #ef4444;
}
.warning-item.item-warning .warning-icon {
  color: #f59e0b;
}
.warning-item.item-info .warning-icon {
  color: #3b82f6;
}

.warning-icon {
  flex-shrink: 0;
}

.warning-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.warning-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.severity-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 3px 5px;
}

.severity-badge.badge-error {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}
.severity-badge.badge-warning {
  background-color: rgba(245, 158, 11, 0.15);
  color: #d97706;
}
.severity-badge.badge-info {
  background-color: rgba(59, 130, 246, 0.15);
  color: #2563eb;
}

.warning-code {
  font-weight: 600;
  color: var(--sl-color-gray-3);
  font-size: 12px;
  font-family: var(--sl-font-mono);
  background-color: var(--sl-color-bg-sidebar);
  padding: 0px 6px;
  border-radius: 4px;
}

.warning-uri {
  font-size: 11px;
  font-family: var(--sl-font-mono);
  color: var(--sl-color-gray-3);
  background-color: var(--sl-color-bg-inline-code);
  padding: 1px 5px;
  border-radius: 3px;
}

.warning-message {
  font-size: 14px;
  color: var(--sl-color-text);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
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
  background-color: transparent;
  color: var(--sl-color-gray-3);
  font-size: 12px;
  border: 1px solid var(--sl-color-border);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.warning-jump:hover {
  background-color: var(--sl-color-bg-inline-code);
  color: var(--sl-color-text);
  border-color: var(--sl-color-gray-4);
}
</style>
