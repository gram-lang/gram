<script setup lang="ts">
import { ref, computed, watch } from "vue";
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
	collapsed?: boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: emit is used in the <template> block below, which Biome's Vue support doesn't see.
const emit = defineEmits<{
	jump: [start: number, end: number, uri?: string];
	"update:collapsed": [collapsed: boolean];
}>();

const { t } = useI18n();

const activeFilter = ref<WarningSeverity | "all">("all");
const localCollapsed = ref(false);

const isCollapsed = computed({
	get: () => props.collapsed ?? localCollapsed.value,
	set: (val: boolean) => {
		localCollapsed.value = val;
		emit("update:collapsed", val);
	},
});

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
	return { error, warning, info, total: itemsWithSeverity.value.length };
});

// The active filter otherwise survives a recompile that clears the category
// it was narrowed to (fix the warning it was showing → 0 warnings left) — the
// pastille for that category disappears, but filteredItems keeps returning
// [] against the old filter instead of falling back to "all", so the console
// looks empty even though a real diagnostic (in another category) exists.
watch(counts, (newCounts) => {
	if (activeFilter.value !== "all" && newCounts[activeFilter.value] === 0) {
		activeFilter.value = "all";
	}
});

const filteredItems = computed(() => {
	if (activeFilter.value === "all") return itemsWithSeverity.value;
	return itemsWithSeverity.value.filter(
		(item) => item.severity === activeFilter.value,
	);
});

// biome-ignore lint/correctness/noUnusedVariables: setFilter is used in the <template> block below, which Biome's Vue support doesn't see.
function setFilter(filter: WarningSeverity | "all", e: Event) {
	e.stopPropagation();
	if (activeFilter.value === filter) {
		activeFilter.value = "all";
	} else {
		activeFilter.value = filter;
		if (isCollapsed.value) isCollapsed.value = false;
	}
}

// biome-ignore lint/correctness/noUnusedVariables: overallSeverity is used in the <template> block below, which Biome's Vue support doesn't see.
const overallSeverity = computed<WarningSeverity>(() => {
	if (counts.value.error > 0) return "error";
	if (counts.value.warning > 0) return "warning";
	return "info";
});
</script>

<template>
  <div
    v-if="warnings.length > 0"
    class="gram-diagnostics-console"
    :class="[`severity-${overallSeverity}`, { collapsed: isCollapsed }]"
  >
    <div class="console-header" @click="toggle">
      <div class="console-header-left">
        <span class="console-title">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM4 5V19H20V5H4ZM7 13H9V17H7V13ZM11 7H13V17H11V7ZM15 10H17V17H15V10Z"></path></svg>
          {{ t.playground.warnings.consoleTitle || 'Diagnostics & Débogage' }}
        </span>

        <div class="filter-pills">
          <button
            v-if="counts.error > 0"
            class="pill pill-error"
            :class="{ active: activeFilter === 'error' }"
            @click="setFilter('error', $event)"
          >
            <span class="pill-dot"></span>
            {{ counts.error }} {{ counts.error > 1 ? t.playground.warnings.errors : t.playground.warnings.error }}
          </button>
          
          <button
            v-if="counts.warning > 0"
            class="pill pill-warning"
            :class="{ active: activeFilter === 'warning' }"
            @click="setFilter('warning', $event)"
          >
            <span class="pill-dot"></span>
            {{ counts.warning }} {{ counts.warning > 1 ? t.playground.warnings.warnings : t.playground.warnings.warning }}
          </button>
          
          <button
            v-if="counts.info > 0"
            class="pill pill-info"
            :class="{ active: activeFilter === 'info' }"
            @click="setFilter('info', $event)"
          >
            <span class="pill-dot"></span>
            {{ counts.info }} {{ counts.info > 1 ? t.playground.warnings.infos : t.playground.warnings.info }}
          </button>
        </div>
      </div>

      <div class="console-header-right">
        <button class="console-toggle-btn" :title="isCollapsed ? (t.playground.warnings.expandConsole || 'Expand console') : (t.playground.warnings.collapseConsole || 'Collapse console')">
          <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
            <path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"></path>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="console-body" v-show="!isCollapsed">
      <ul class="diagnostics-list">
        <li
          v-for="(w, i) in filteredItems"
          :key="i"
          class="diagnostic-item"
          :class="`item-${w.severity}`"
        >
          <div class="diagnostic-icon">
            <!-- Error item icon -->
            <svg v-if="w.severity === 'error'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path>
            </svg>
            <!-- Warning item icon -->
            <svg v-else-if="w.severity === 'warning'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"></path>
            </svg>
            <!-- Info item icon -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V120a8,8,0,0,1,0-16,16,16,0,0,1,16,16v48A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"></path>
            </svg>
          </div>
          <div class="diagnostic-content">
            <div class="diagnostic-meta">
              <span class="severity-badge" :class="`badge-${w.severity}`">
                {{ w.severity === 'error' ? t.playground.warnings.error : w.severity === 'warning' ? t.playground.warnings.warning : t.playground.warnings.info }}
              </span>
              <span class="diagnostic-code">[{{ w.code }}]</span>
              <span v-if="w.uri" class="diagnostic-uri">{{ w.uri.startsWith('/') ? w.uri.slice(1) : w.uri }}</span>
              <span v-if="w.item" class="diagnostic-item-name">{{ t.playground.warnings.item }}: <code>{{ w.item }}</code></span>
            </div>
            <span class="diagnostic-message">{{ w.message }}</span>
          </div>
          <button v-if="w.loc" class="diagnostic-jump" @click="emit('jump', w.loc.start, w.loc.end, w.uri)">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256">
              <path d="M240,120H215.63A88.13,88.13,0,0,0,136,40.37V16a8,8,0,0,0-16,0V40.37A88.13,88.13,0,0,0,40.37,120H16a8,8,0,0,0,0,16H40.37A88.13,88.13,0,0,0,120,215.63V240a8,8,0,0,0,16,0V215.63A88.13,88.13,0,0,0,215.63,136H240a8,8,0,0,0,0-16ZM128,200a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,200Zm0-112a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z"></path>
            </svg>
            {{ t.playground.warnings.show }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.gram-diagnostics-console {
  display: flex;
  flex-direction: column;
  background-color: var(--sl-color-bg);
  border: 1px solid var(--sl-color-border);
  border-top: none;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  background-color: var(--sl-color-bg-sidebar);
  border-bottom: 1px solid var(--sl-color-border);
  min-height: 38px;
  box-sizing: border-box;
}

.console-header:hover {
  background-color: var(--sl-color-gray-7);
}

.console-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.console-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sl-color-text);
  letter-spacing: 0.2px;
}

.filter-pills {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
}

.pill-dot {
  width: 6px;
  height: 6px;
}

.pill-error {
  color: #ef4444;
}
.pill-error .pill-dot {
  background-color: #ef4444;
}
.pill-error:hover, .pill-error.active {
  background-color: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

.pill-warning {
  color: #d97706;
}
.pill-warning .pill-dot {
  background-color: #f59e0b;
}
.pill-warning:hover, .pill-warning.active {
  background-color: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
}

.pill-info {
  color: #2563eb;
}
.pill-info .pill-dot {
  background-color: #3b82f6;
}
.pill-info:hover, .pill-info.active {
  background-color: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
}

.console-header-right {
  display: flex;
  align-items: center;
}

.console-toggle-btn {
  background: transparent;
  border: none;
  color: var(--sl-color-gray-3);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.console-toggle-btn:hover {
  color: var(--sl-color-text);
}

.toggle-icon {
}

.gram-diagnostics-console.collapsed .toggle-icon {
  transform: rotate(180deg);
}

.gram-diagnostics-console.collapsed .console-header {
  border-bottom: none;
}

.console-body {
  max-height: 220px;
  overflow-y: auto;
  background-color: var(--sl-color-bg);
}

.diagnostics-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.diagnostic-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 14px;
  background-color: var(--sl-color-bg);
  border-bottom: 1px solid var(--sl-color-hairline, #e6e6e6);
}

.diagnostic-item:last-child {
  border-bottom: none;
}

.diagnostic-item:hover {
  background-color: var(--sl-color-gray-7);
}

.diagnostic-item.item-error .diagnostic-icon {
  color: #ef4444;
}
.diagnostic-item.item-warning .diagnostic-icon {
  color: #f59e0b;
}
.diagnostic-item.item-info .diagnostic-icon {
  color: #3b82f6;
}

.diagnostic-icon {
  flex-shrink: 0;
}

.diagnostic-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.diagnostic-meta {
  display: flex;
  align-items: center;
  gap: 8px;
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

.diagnostic-code {
  font-weight: 600;
  color: var(--sl-color-gray-3);
  font-size: 11px;
  font-family: var(--sl-font-mono);
  background-color: var(--sl-color-bg-sidebar);
  padding: 3px 5px;
}

.diagnostic-uri {
  font-size: 11px;
  font-family: var(--sl-font-mono);
  color: var(--sl-color-gray-3);
  background-color: var(--sl-color-bg-inline-code);
  padding: 3px 5px;
}

.diagnostic-item-name {
  font-size: 12px;
  color: var(--sl-color-gray-3);
}

.diagnostic-item-name code {
  font-family: var(--sl-font-mono);
  color: var(--sl-color-text);
}

.diagnostic-message {
  font-size: 13px;
  color: var(--sl-color-text);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.diagnostic-jump {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background-color: transparent;
  color: var(--sl-color-gray-3);
  font-size: 12px;
  border: 1px solid var(--sl-color-border);
  cursor: pointer;
  flex-shrink: 0;
  align-self: center;
}

.diagnostic-jump:hover {
  background-color: var(--sl-color-bg-inline-code);
  color: var(--sl-color-text);
  border-color: var(--sl-color-gray-4);
}
</style>
