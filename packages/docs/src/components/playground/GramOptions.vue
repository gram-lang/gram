<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { formatDecimalToFraction } from "@gram-lang/renderer";
import { UNIT_CONVERSIONS } from "@gram-lang/i18n";
import {
	REST_CHOICES,
	type MiseEnPlaceMode,
	type RestChoice,
} from "@gram-lang/kitchen";
import { useI18n } from "./useI18n";

export interface PlanSettings {
	serveAt: string;
	timeZone: string;
	from: string;
	to: string;
}

const { lang, t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: knownUnits is used in the <template> block below, which Biome's Vue support doesn't see.
const knownUnits = [
	...Object.keys(UNIT_CONVERSIONS.mass.map),
	...Object.keys(UNIT_CONVERSIONS.volume.map),
];

const props = defineProps<{
	options: {
		enableMassStandardization: boolean;
		enableYieldCalculation: boolean;
		enableNutritionalEstimation: boolean;
		bakersMath: boolean;
		bakersMathOnly: boolean;
		bakersReference: string | undefined;
	};
	shoppingList?: Array<{
		id: string;
		name: string;
		qty?: number;
		unit?: string;
	}>;
	availableImports?: { uri: string; specifier: string; binding: string }[];
	stockedUris?: Set<string>;
	scaleFactorString?: string;
	scaleTargetId: string | null;
	scaleTargetQty: number | null;
	scaleTargetUnit: string;
	schedule?: MiseEnPlaceMode;
	rests?: RestChoice;
	plan?: PlanSettings;
	planError?: string;
	initialSection?: string;
}>();

const emit = defineEmits<{
	"update:options": [options: typeof props.options];
	"update:scaleFactorString": [val: string];
	"update:scaleTargetId": [val: string | null];
	"update:scaleTargetQty": [val: number | null];
	"update:scaleTargetUnit": [val: string];
	"clear-target": [];
	"scale-apply": [];
	"toggle-stock": [uri: string];
	"update:schedule": [schedule: MiseEnPlaceMode];
	"update:rests": [rests: RestChoice];
	"update:plan": [plan: PlanSettings];
	"clear-plan": [];
}>();

// Accordion open/collapsed state
const openSections = ref<Record<string, boolean>>({
	schedule: props.initialSection === "schedule",
	scale: props.initialSection === "scale" || !props.initialSection,
	bakersMath: props.initialSection === "bakersMath",
	physics: props.initialSection === "physics",
	stock: props.initialSection === "stock",
});

watch(
	() => props.initialSection,
	(sec) => {
		if (sec) {
			openSections.value[sec] = true;
		}
	},
	{ immediate: true },
);

// biome-ignore lint/correctness/noUnusedVariables: toggleSection is used in the <template> block below, which Biome's Vue support doesn't see.
function toggleSection(sec: string) {
	openSections.value[sec] = !openSections.value[sec];
}

// --------------------------------------------------------------------------
// Section 1: Schedule & Service
// --------------------------------------------------------------------------
// biome-ignore lint/correctness/noUnusedVariables: scheduleOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const scheduleOptions = computed(() => [
	{
		label: t.value.renderer.schedulePerSection,
		value: "perSection",
	},
	{ label: t.value.renderer.scheduleUpfront, value: "upfront" },
	{ label: t.value.renderer.schedulePerSession, value: "perSession" },
]);

// biome-ignore lint/correctness/noUnusedVariables: restsOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const restsOptions = computed(() =>
	REST_CHOICES.map((value) => ({
		label:
			t.value.renderer[
				value === "shortest"
					? "restsShortest"
					: value === "balanced"
						? "restsBalanced"
						: "restsLongest"
			],
		value,
	})),
);

const timeZones: string[] = (() => {
	try {
		return (
			(
				Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
			).supportedValuesOf?.("timeZone") ?? []
		);
	} catch {
		return [];
	}
})();

// biome-ignore lint/correctness/noUnusedVariables: timeZoneOptions is used in the <template> block below, which Biome's Vue support doesn't see.
const timeZoneOptions = computed(() => {
	const local = (() => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
		} catch {
			return "UTC";
		}
	})();
	const list = timeZones.length > 0 ? timeZones : [local, "UTC"];
	const set = new Set<string>();
	set.add(local);
	if (local !== "UTC") set.add("UTC");
	for (const z of list) set.add(z);
	if (props.plan?.timeZone) set.add(props.plan.timeZone);
	return Array.from(set);
});

// biome-ignore lint/correctness/noUnusedVariables: updatePlanField is used in the <template> block below, which Biome's Vue support doesn't see.
function updatePlanField(field: keyof PlanSettings, value: string) {
	if (!props.plan) return;
	emit("update:plan", {
		...props.plan,
		[field]: value,
	});
}

// biome-ignore lint/correctness/noUnusedVariables: scheduleBadge is used in the <template> block below, which Biome's Vue support doesn't see.
const scheduleBadge = computed(() => {
	const p = props.plan;
	if (p?.serveAt) {
		let timeStr = p.serveAt;
		try {
			const d = new Date(p.serveAt);
			if (!Number.isNaN(d.getTime())) {
				timeStr = d.toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				});
			}
		} catch {
			// fallback to raw string
		}
		const isCustomMise = props.schedule && props.schedule !== "perSection";
		const miseSuffix = isCustomMise
			? ` · ${t.value.playground.sections?.schedule ? "Mise en place" : "Mise en place"}`
			: "";
		const timePrefix = lang.value === "fr" ? "Service à" : "Serve at";
		return `${timePrefix} ${timeStr}${miseSuffix}`;
	}
	if (props.schedule !== "perSection" || props.rests !== "shortest") {
		return t.value.playground.badges?.active || "Active";
	}
	return t.value.playground.badges?.default || "Default";
});

// biome-ignore lint/correctness/noUnusedVariables: isScheduleModified is used in the <template> block below, which Biome's Vue support doesn't see.
const isScheduleModified = computed(() => {
	return Boolean(
		props.plan?.serveAt ||
			(props.schedule && props.schedule !== "perSection") ||
			(props.rests && props.rests !== "shortest"),
	);
});

// biome-ignore lint/correctness/noUnusedVariables: resetScheduleSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetScheduleSection() {
	emit("update:schedule", "perSection");
	emit("update:rests", "shortest");
	emit("clear-plan");
}

// --------------------------------------------------------------------------
// Section 2: Scale & Portions
// --------------------------------------------------------------------------
// biome-ignore lint/correctness/noUnusedVariables: globalScaleFactor is used in the <template> block below, which Biome's Vue support doesn't see.
const globalScaleFactor = computed({
	get: () => props.scaleFactorString || "100",
	set: (val: string) => {
		emit("update:scaleFactorString", val);
		emit("clear-target");
	},
});

// biome-ignore lint/correctness/noUnusedVariables: targetId is used in the <template> block below, which Biome's Vue support doesn't see.
const targetId = computed({
	get: () => props.scaleTargetId || "",
	set: (val) => {
		emit("update:scaleTargetId", val || null);
		if (val && props.shoppingList) {
			const item = props.shoppingList.find((i) => i.id === val);
			if (item) {
				emit("update:scaleTargetUnit", item.unit || "");
				if (item.qty && typeof item.qty === "number") {
					emit("update:scaleTargetQty", item.qty);
				} else {
					emit("update:scaleTargetQty", null);
				}
			}
		}
	},
});

// biome-ignore lint/correctness/noUnusedVariables: targetQty is used in the <template> block below, which Biome's Vue support doesn't see.
const targetQty = computed({
	get: () => {
		if (props.scaleTargetQty === null) return "";
		return formatDecimalToFraction(props.scaleTargetQty);
	},
	set: (val: string) => {
		if (!val) {
			emit("update:scaleTargetQty", null);
			return;
		}
		let parsed: number | null = null;
		if (val.includes("/")) {
			const parts = val.split("/");
			if (parts.length === 2) {
				const n = parseFloat(parts[0]);
				const d = parseFloat(parts[1]);
				if (!Number.isNaN(n) && !Number.isNaN(d) && d !== 0) parsed = n / d;
			}
		} else {
			parsed = parseFloat(val);
		}
		if (parsed !== null && !Number.isNaN(parsed)) {
			emit("update:scaleTargetQty", parsed);
		} else {
			emit("update:scaleTargetQty", null);
		}
	},
});

// biome-ignore lint/correctness/noUnusedVariables: targetUnit is used in the <template> block below, which Biome's Vue support doesn't see.
const targetUnit = computed({
	get: () => props.scaleTargetUnit,
	set: (val) => emit("update:scaleTargetUnit", val),
});

// biome-ignore lint/correctness/noUnusedVariables: submitScale is used in the <template> block below, which Biome's Vue support doesn't see.
function submitScale() {
	emit("scale-apply");
}

// biome-ignore lint/correctness/noUnusedVariables: scaleBadge is used in the <template> block below, which Biome's Vue support doesn't see.
const scaleBadge = computed(() => {
	if (props.scaleTargetId && props.shoppingList) {
		const item = props.shoppingList.find((i) => i.id === props.scaleTargetId);
		const qtyStr =
			props.scaleTargetQty !== null
				? `${props.scaleTargetQty}${props.scaleTargetUnit ? ` ${props.scaleTargetUnit}` : ""}`
				: "";
		const targetLabel = item?.name
			? `${item.name}${qtyStr ? ` ${qtyStr}` : ""}`
			: "";
		const byIng = t.value.playground.badges?.byIngredient || "By ingredient";
		return targetLabel ? `${byIng} (${targetLabel})` : byIng;
	}
	const factor = props.scaleFactorString || "100";
	return `${factor}%`;
});

// biome-ignore lint/correctness/noUnusedVariables: isScaleModified is used in the <template> block below, which Biome's Vue support doesn't see.
const isScaleModified = computed(() => {
	return (
		(props.scaleFactorString && props.scaleFactorString !== "100") ||
		Boolean(props.scaleTargetId)
	);
});

// biome-ignore lint/correctness/noUnusedVariables: resetScaleSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetScaleSection() {
	emit("update:scaleFactorString", "100");
	emit("clear-target");
}

// --------------------------------------------------------------------------
// Section 3: Baker's Math
// --------------------------------------------------------------------------
// biome-ignore lint/correctness/noUnusedVariables: bakersMath is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersMath = computed({
	get: () => props.options.bakersMath,
	set: (val) => emit("update:options", { ...props.options, bakersMath: val }),
});

// biome-ignore lint/correctness/noUnusedVariables: bakersMathOnly is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersMathOnly = computed({
	get: () => props.options.bakersMathOnly,
	set: (val) =>
		emit("update:options", { ...props.options, bakersMathOnly: val }),
});

// biome-ignore lint/correctness/noUnusedVariables: bakersReference is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersReference = computed({
	get: () => props.options.bakersReference || "",
	set: (val) =>
		emit("update:options", {
			...props.options,
			bakersReference: val || undefined,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: bakersBadge is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersBadge = computed(() => {
	return props.options.bakersMath
		? t.value.playground.badges?.active || "Active"
		: t.value.playground.badges?.inactive || "Inactive";
});

// biome-ignore lint/correctness/noUnusedVariables: isBakersModified is used in the <template> block below, which Biome's Vue support doesn't see.
const isBakersModified = computed(() => {
	return Boolean(props.options.bakersMath);
});

// biome-ignore lint/correctness/noUnusedVariables: resetBakersSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetBakersSection() {
	emit("update:options", {
		...props.options,
		bakersMath: false,
		bakersMathOnly: false,
		bakersReference: undefined,
	});
}

// --------------------------------------------------------------------------
// Section 4: Physical Analysis & Nutrition
// --------------------------------------------------------------------------
// biome-ignore lint/correctness/noUnusedVariables: massEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const massEnabled = computed({
	get: () => props.options.enableMassStandardization,
	set: (val) =>
		emit("update:options", {
			...props.options,
			enableMassStandardization: val,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: yieldEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const yieldEnabled = computed({
	get: () => props.options.enableYieldCalculation,
	set: (val) =>
		emit("update:options", { ...props.options, enableYieldCalculation: val }),
});

// biome-ignore lint/correctness/noUnusedVariables: nutritionEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
const nutritionEnabled = computed({
	get: () => props.options.enableNutritionalEstimation,
	set: (val) =>
		emit("update:options", {
			...props.options,
			enableNutritionalEstimation: val,
		}),
});

// biome-ignore lint/correctness/noUnusedVariables: physicsBadge is used in the <template> block below, which Biome's Vue support doesn't see.
const physicsBadge = computed(() => {
	const {
		enableMassStandardization,
		enableYieldCalculation,
		enableNutritionalEstimation,
	} = props.options;
	const std = t.value.playground.badges?.standardized || "Standardized";
	const nutr = t.value.playground.badges?.nutritionActive || "Nutrition active";

	if (
		enableMassStandardization &&
		enableYieldCalculation &&
		enableNutritionalEstimation
	) {
		return `${std} · Rendement · Nutrition`;
	}
	if (enableMassStandardization && enableNutritionalEstimation) {
		return `${std} · ${nutr}`;
	}
	if (enableMassStandardization) {
		return std;
	}
	if (enableNutritionalEstimation) {
		return nutr;
	}
	return t.value.playground.badges?.inactive || "Inactive";
});

// biome-ignore lint/correctness/noUnusedVariables: isPhysicsModified is used in the <template> block below, which Biome's Vue support doesn't see.
const isPhysicsModified = computed(() => {
	return (
		!props.options.enableMassStandardization ||
		props.options.enableYieldCalculation ||
		!props.options.enableNutritionalEstimation
	);
});

// biome-ignore lint/correctness/noUnusedVariables: resetPhysicsSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetPhysicsSection() {
	emit("update:options", {
		...props.options,
		enableMassStandardization: true,
		enableYieldCalculation: false,
		enableNutritionalEstimation: true,
	});
}

// --------------------------------------------------------------------------
// Section 5: Stock & Modules
// --------------------------------------------------------------------------
// biome-ignore lint/correctness/noUnusedVariables: stockBadge is used in the <template> block below, which Biome's Vue support doesn't see.
const stockBadge = computed(() => {
	const count = props.stockedUris?.size ?? 0;
	return (
		t.value.playground.badges?.inStock?.replace("{count}", String(count)) ||
		`${count} in stock`
	);
});

// biome-ignore lint/correctness/noUnusedVariables: isStockModified is used in the <template> block below, which Biome's Vue support doesn't see.
const isStockModified = computed(() => {
	return Boolean((props.stockedUris?.size ?? 0) > 0);
});

// biome-ignore lint/correctness/noUnusedVariables: resetStockSection is used in the <template> block below, which Biome's Vue support doesn't see.
function resetStockSection() {
	if (props.stockedUris) {
		for (const uri of [...props.stockedUris]) {
			emit("toggle-stock", uri);
		}
	}
}
</script>

<template>
  <div class="gram-studio-options">
    <!-- Section 1: Planification & Service -->
    <div class="studio-section" :class="{ 'is-open': openSections.schedule }">
      <div class="studio-section-header">
        <button
          type="button"
          class="studio-section-trigger"
          :aria-expanded="openSections.schedule"
          @click="toggleSection('schedule')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.schedule }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.schedule || 'Planification & Service' }}</span>
          <span class="section-badge" :class="{ 'is-active': isScheduleModified }">{{ scheduleBadge }}</span>
        </button>
        <button
          v-if="isScheduleModified"
          type="button"
          class="section-reset-btn"
          @click.stop="resetScheduleSection"
          :title="t.playground.resetSection || 'Reset'"
        >
          {{ t.playground.resetSection || 'Reset' }}
        </button>
      </div>

      <div v-show="openSections.schedule" class="studio-section-body">
        <div class="studio-field">
          <label class="studio-label">{{ t.renderer.scheduleLabel }}</label>
          <select
            class="studio-select"
            :value="props.schedule || 'perSection'"
            @change="emit('update:schedule', ($event.target as HTMLSelectElement).value as MiseEnPlaceMode)"
          >
            <option v-for="opt in scheduleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="studio-field">
          <label class="studio-label">{{ t.renderer.restsLabel }}</label>
          <select
            class="studio-select"
            :value="props.rests || 'shortest'"
            @change="emit('update:rests', ($event.target as HTMLSelectElement).value as RestChoice)"
          >
            <option v-for="opt in restsOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="studio-field">
          <label class="studio-label">{{ t.playground.views.planServeAt }}</label>
          <input
            class="studio-input"
            type="datetime-local"
            :value="props.plan?.serveAt || ''"
            @input="updatePlanField('serveAt', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="studio-field">
          <label class="studio-label">{{ t.playground.views.planTimeZone }}</label>
          <select
            class="studio-select"
            :value="props.plan?.timeZone || 'UTC'"
            @change="updatePlanField('timeZone', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="zone in timeZoneOptions" :key="zone" :value="zone">
              {{ zone }}
            </option>
          </select>
        </div>

        <div class="studio-field">
          <label class="studio-label">{{ t.playground.views.planAvailableFrom }} / {{ t.playground.views.planAvailableTo }}</label>
          <div class="studio-time-range">
            <input
              class="studio-input"
              type="time"
              :value="props.plan?.from || '08:00'"
              @input="updatePlanField('from', ($event.target as HTMLInputElement).value)"
            />
            <span class="range-separator">→</span>
            <input
              class="studio-input"
              type="time"
              :value="props.plan?.to || '22:00'"
              @input="updatePlanField('to', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <p v-if="props.planError" class="plan-error" role="alert">
          {{ t.playground.views.planInvalid.replace('{message}', props.planError) }}
        </p>
      </div>
    </div>

    <!-- Section 2: Portions & Échelle -->
    <div class="studio-section" :class="{ 'is-open': openSections.scale }">
      <div class="studio-section-header">
        <button
          type="button"
          class="studio-section-trigger"
          :aria-expanded="openSections.scale"
          @click="toggleSection('scale')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.scale }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.scale || 'Portions & Échelle' }}</span>
          <span class="section-badge" :class="{ 'is-active': isScaleModified }">{{ scaleBadge }}</span>
        </button>
        <button
          v-if="isScaleModified"
          type="button"
          class="section-reset-btn"
          @click.stop="resetScaleSection"
          :title="t.playground.resetSection || 'Reset'"
        >
          {{ t.playground.resetSection || 'Reset' }}
        </button>
      </div>

      <div v-show="openSections.scale" class="studio-section-body">
        <div class="studio-field">
          <span class="studio-label">{{ t.playground.options.scaleGlobal }}</span>
          <div class="scale-factor-wrapper">
            <input
              type="number"
              class="scale-factor-input"
              v-model="globalScaleFactor"
              min="1"
              step="any"
            />
            <span class="scale-factor-unit">%</span>
          </div>
        </div>

        <div class="studio-field">
          <span class="studio-label">{{ t.playground.options.scaleByIngredient }}</span>
          <select class="studio-select" v-model="targetId">
            <option value="">{{ t.playground.options.selectIngredient }}</option>
            <option v-for="item in props.shoppingList" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
          <div class="scale-inputs" v-if="targetId">
            <input
              type="text"
              class="studio-input qty"
              v-model.lazy="targetQty"
              :placeholder="t.playground.options.qty"
              @keydown.enter="submitScale"
            />
            <input
              type="text"
              list="studio-gram-units"
              class="studio-input unit"
              v-model="targetUnit"
              :placeholder="t.playground.options.unit"
              @keydown.enter="submitScale"
            />
            <button class="scale-apply-btn" @click="submitScale">{{ t.playground.options.apply }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 3: Boulangerie (Baker's math) -->
    <div class="studio-section" :class="{ 'is-open': openSections.bakersMath }">
      <div class="studio-section-header">
        <button
          type="button"
          class="studio-section-trigger"
          :aria-expanded="openSections.bakersMath"
          @click="toggleSection('bakersMath')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.bakersMath }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.bakersMath || "Baker's Math" }}</span>
          <span class="section-badge" :class="{ 'is-active': isBakersModified }">{{ bakersBadge }}</span>
        </button>
        <button
          v-if="isBakersModified"
          type="button"
          class="section-reset-btn"
          @click.stop="resetBakersSection"
          :title="t.playground.resetSection || 'Reset'"
        >
          {{ t.playground.resetSection || 'Reset' }}
        </button>
      </div>

      <div v-show="openSections.bakersMath" class="studio-section-body">
        <label class="option-item">
          <input type="checkbox" v-model="bakersMath" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.enableBakersMath }}</span>
            <span class="option-desc">{{ t.playground.options.bakersMathDesc }}</span>
          </div>
        </label>
        
        <label class="option-item child-option" :class="{ disabled: !bakersMath }">
          <input type="checkbox" v-model="bakersMathOnly" :disabled="!bakersMath" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.hideAbsolute }}</span>
          </div>
        </label>

        <div class="child-option select-wrapper" :class="{ disabled: !bakersMath }" v-if="bakersMath">
          <span class="studio-label">{{ t.playground.options.forceReference }}</span>
          <select class="studio-select" v-model="bakersReference" :disabled="!bakersMath">
            <option value="">{{ t.playground.options.autoDetect }}</option>
            <option v-for="item in props.shoppingList" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Section 4: Physique & Nutrition -->
    <div class="studio-section" :class="{ 'is-open': openSections.physics }">
      <div class="studio-section-header">
        <button
          type="button"
          class="studio-section-trigger"
          :aria-expanded="openSections.physics"
          @click="toggleSection('physics')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.physics }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.physics || 'Physique & Nutrition' }}</span>
          <span class="section-badge" :class="{ 'is-active': isPhysicsModified }">{{ physicsBadge }}</span>
        </button>
        <button
          v-if="isPhysicsModified"
          type="button"
          class="section-reset-btn"
          @click.stop="resetPhysicsSection"
          :title="t.playground.resetSection || 'Reset'"
        >
          {{ t.playground.resetSection || 'Reset' }}
        </button>
      </div>

      <div v-show="openSections.physics" class="studio-section-body">
        <label class="option-item">
          <input type="checkbox" v-model="massEnabled" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.massStandardization }}</span>
            <span class="option-desc">{{ t.playground.options.massDesc }}</span>
          </div>
        </label>
        
        <label class="option-item child-option" :class="{ disabled: !massEnabled }">
          <input type="checkbox" v-model="yieldEnabled" :disabled="!massEnabled" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.yieldManagement }}</span>
          </div>
        </label>

        <label class="option-item">
          <input type="checkbox" v-model="nutritionEnabled" />
          <div class="option-text">
            <span class="option-name">{{ t.playground.options.nutrition }}</span>
          </div>
        </label>
      </div>
    </div>

    <!-- Section 5: Stock & Modules -->
    <div
      v-if="(props.availableImports?.length ?? 0) > 0"
      class="studio-section"
      :class="{ 'is-open': openSections.stock }"
    >
      <div class="studio-section-header">
        <button
          type="button"
          class="studio-section-trigger"
          :aria-expanded="openSections.stock"
          @click="toggleSection('stock')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.stock }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.stock || 'Stock & Modules' }}</span>
          <span class="section-badge" :class="{ 'is-active': isStockModified }">{{ stockBadge }}</span>
        </button>
        <button
          v-if="isStockModified"
          type="button"
          class="section-reset-btn"
          @click.stop="resetStockSection"
          :title="t.playground.resetSection || 'Reset'"
        >
          {{ t.playground.resetSection || 'Reset' }}
        </button>
      </div>

      <div v-show="openSections.stock" class="studio-section-body">
        <label class="option-item" v-for="imp in props.availableImports" :key="imp.uri">
          <input
            type="checkbox"
            :checked="props.stockedUris?.has(imp.uri) ?? false"
            @change="emit('toggle-stock', imp.uri)"
          />
          <div class="option-text">
            <span class="option-name">{{ imp.specifier }}</span>
            <span class="option-desc">{{ t.playground.options.stockDesc }}</span>
          </div>
        </label>
      </div>
    </div>

    <datalist id="studio-gram-units">
      <option v-for="u in knownUnits" :key="u" :value="u"></option>
    </datalist>
  </div>
</template>

<style scoped>
.gram-studio-options {
  background-color: var(--sl-color-bg);
  padding: 16px;
  font-size: 14px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.studio-section {
  border: 1px solid var(--sl-color-border);
  border-radius: 0;
  background-color: var(--sl-color-bg);
  overflow: hidden;
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
  padding: 8px;
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

.section-badge {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 0;
  background-color: var(--sl-color-gray-6);
  color: var(--sl-color-gray-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  font-weight: 500;
}

.section-badge.is-active {
  background-color: var(--sl-color-accent);
  color: #1a1613;
  font-weight: 600;
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

.studio-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.studio-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--sl-color-gray-3);
  letter-spacing: 0.02em;
}

.studio-select,
.studio-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  color: var(--sl-color-text);
  font-size: 13px;
  border-radius: 0;
  outline: none;
  box-sizing: border-box;
}

.studio-select:focus,
.studio-input:focus {
  border-color: var(--sl-color-gray-3);
}

.studio-time-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-separator {
  color: var(--sl-color-gray-3);
  font-size: 12px;
}

.plan-error {
  margin: 0;
  font-size: 12px;
  color: var(--sl-color-red-high);
  line-height: 1.4;
}

.scale-factor-wrapper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--sl-color-border);
  background-color: var(--sl-color-bg);
  padding-right: 8px;
  width: fit-content;
  border-radius: 0;
}

.scale-factor-wrapper:focus-within {
  border-color: var(--sl-color-gray-3);
}

.scale-factor-input {
  width: 60px;
  padding: 6px 4px 6px 8px;
  border: none;
  background: transparent;
  color: var(--sl-color-text);
  font-size: 13px;
  outline: none;
  text-align: right;
  -moz-appearance: textfield;
}

.scale-factor-input::-webkit-inner-spin-button,
.scale-factor-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.scale-factor-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--sl-color-gray-3);
  user-select: none;
}

.scale-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.scale-inputs .qty {
  flex: 2;
  min-width: 0;
}

.scale-inputs .unit {
  flex: 1;
  min-width: 0;
}

.scale-apply-btn {
  padding: 6px 12px;
  background-color: var(--sl-color-accent);
  color: #1a1613;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  border-radius: 0;
  white-space: nowrap;
}

.scale-apply-btn:hover {
  opacity: 0.9;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.option-name {
  color: var(--sl-color-text);
  font-weight: 500;
  font-size: 13px;
  line-height: 1.2;
}

.option-desc {
  color: var(--sl-color-gray-3);
  font-size: 12px;
  line-height: 1.4;
}

.option-item:hover .option-name {
  color: var(--sl-color-orange-high);
}

.child-option {
  margin-left: 24px;
  position: relative;
}

.child-option::before {
  content: '';
  position: absolute;
  left: -17px;
  top: -14px;
  width: 2px;
  height: 22px;
  background-color: var(--sl-color-border);
  border-bottom-left-radius: 0;
}

.child-option::after {
  content: '';
  position: absolute;
  left: -17px;
  top: 8px;
  width: 12px;
  height: 2px;
  background-color: var(--sl-color-border);
}

.select-wrapper::after {
  top: 14px;
}

.child-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

input[type="checkbox"] {
  cursor: inherit;
  margin-top: 2px;
}
</style>
