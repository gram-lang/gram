<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, useId } from "vue";
import { formatDecimalToFraction } from "@gram-lang/renderer";
import { UNIT_CONVERSIONS } from "@gram-lang/i18n";
import {
	REST_CHOICES,
	type MiseEnPlaceMode,
	type RestChoice,
} from "@gram-lang/kitchen";
import { WEEKDAYS, type Weekday } from "@gram-lang/scheduler";
// biome-ignore lint/correctness/noUnusedImports: PlaygroundTooltip is used in the <template> block below
import PlaygroundTooltip from "./PlaygroundTooltip.vue";
import { useI18n } from "./useI18n";

export interface DayAvailability {
	enabled: boolean;
	from: string;
	to: string;
}

export interface PlanSettings {
	serveAt: string;
	timeZone: string;
	from: string;
	to: string;
	customWeekdays?: boolean;
	weekdays?: Partial<Record<Weekday, DayAvailability>>;
}

const { lang, t } = useI18n();

// biome-ignore lint/correctness/noUnusedVariables: knownUnits is used in the <template> block below, which Biome's Vue support doesn't see.
const knownUnits = Array.from(
	new Set([
		...Object.keys(UNIT_CONVERSIONS.mass.map),
		...Object.keys(UNIT_CONVERSIONS.volume.map),
	]),
);

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
	/** Serving times that work, why the others don't, and the earliest from now. */
	serveSuggestions?: {
		candidates: { serveAt: string; label: string; title: string }[];
		rejected: string[];
		earliest: { serveAt: string; label: string; text: string } | null;
	} | null;
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
	{ label: t.value.renderer.schedulePerDay, value: "perDay" },
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

function updatePlanField(field: keyof PlanSettings, value: string) {
	if (!props.plan) return;
	emit("update:plan", {
		...props.plan,
		[field]: value,
	});
}

// biome-ignore lint/correctness/noUnusedVariables: pickServeAt is used in the <template> block below, which Biome's Vue support doesn't see.
function pickServeAt(serveAt: string) {
	updatePlanField("serveAt", serveAt);
}

// biome-ignore lint/correctness/noUnusedVariables: clearServeAt is used in the <template> block below, which Biome's Vue support doesn't see.
function clearServeAt() {
	updatePlanField("serveAt", "");
}

// biome-ignore lint/correctness/noUnusedVariables: formatEarliestLabel is used in the <template> block below, which Biome's Vue support doesn't see.
function formatEarliestLabel(label: string): string {
	return lang.value === "fr" ? `Au plus tôt : ${label}` : `Earliest: ${label}`;
}

// biome-ignore lint/correctness/noUnusedVariables: filteredCandidates is used in the <template> block below, which Biome's Vue support doesn't see.
const filteredCandidates = computed(() => {
	if (!props.serveSuggestions?.candidates) return [];
	const earliestServeAt = props.serveSuggestions.earliest?.serveAt;
	if (!earliestServeAt) return props.serveSuggestions.candidates;
	return props.serveSuggestions.candidates.filter(
		(c) => c.serveAt !== earliestServeAt,
	);
});

// biome-ignore lint/correctness/noUnusedVariables: earliestTooltip is used in the <template> block below, which Biome's Vue support doesn't see.
const earliestTooltip = computed(() => {
	if (!props.serveSuggestions?.earliest) return "";
	const e = props.serveSuggestions.earliest;
	const match = props.serveSuggestions.candidates.find(
		(c) => c.serveAt === e.serveAt,
	);
	if (match?.title) {
		return `${e.text}\n• ${match.title}`;
	}
	return e.text;
});

// biome-ignore lint/correctness/noUnusedVariables: rejectedTooltipText is used in the <template> block below, which Biome's Vue support doesn't see.
const rejectedTooltipText = computed(() => {
	if (!props.serveSuggestions?.rejected?.length) return "";
	const header =
		lang.value === "fr" ? "Créneaux non retenus :\n" : "Unavailable slots:\n";
	return (
		header + props.serveSuggestions.rejected.map((r) => `• ${r}`).join("\n")
	);
});

const WEEKDAY_FULL_LABELS: Record<"fr" | "en", Record<Weekday, string>> = {
	fr: {
		mon: "Lundi",
		tue: "Mardi",
		wed: "Mercredi",
		thu: "Jeudi",
		fri: "Vendredi",
		sat: "Samedi",
		sun: "Dimanche",
	},
	en: {
		mon: "Monday",
		tue: "Tuesday",
		wed: "Wednesday",
		thu: "Thursday",
		fri: "Friday",
		sat: "Saturday",
		sun: "Sunday",
	},
};

// biome-ignore lint/correctness/noUnusedVariables: getWeekdayFullLabel is used in the <template> block below, which Biome's Vue support doesn't see.
function getWeekdayFullLabel(day: Weekday): string {
	return WEEKDAY_FULL_LABELS[(lang.value as "fr" | "en") || "en"]?.[day] ?? day;
}

// biome-ignore lint/correctness/noUnusedVariables: getDayEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
function getDayEnabled(day: Weekday): boolean {
	if (!props.plan?.weekdays) return true;
	return props.plan.weekdays[day]?.enabled ?? true;
}

// biome-ignore lint/correctness/noUnusedVariables: getDayFrom is used in the <template> block below, which Biome's Vue support doesn't see.
function getDayFrom(day: Weekday): string {
	return props.plan?.weekdays?.[day]?.from ?? props.plan?.from ?? "08:00";
}

// biome-ignore lint/correctness/noUnusedVariables: getDayTo is used in the <template> block below, which Biome's Vue support doesn't see.
function getDayTo(day: Weekday): string {
	return props.plan?.weekdays?.[day]?.to ?? props.plan?.to ?? "22:00";
}

// biome-ignore lint/correctness/noUnusedVariables: toggleCustomWeekdays is used in the <template> block below, which Biome's Vue support doesn't see.
function toggleCustomWeekdays(e: Event) {
	const checked = (e.target as HTMLInputElement).checked;
	if (!props.plan) return;
	if (checked && !props.plan.weekdays) {
		const initialWeekdays: Partial<Record<Weekday, DayAvailability>> = {};
		for (const day of WEEKDAYS) {
			initialWeekdays[day] = {
				enabled: true,
				from: props.plan.from || "08:00",
				to: props.plan.to || "22:00",
			};
		}
		emit("update:plan", {
			...props.plan,
			customWeekdays: true,
			weekdays: initialWeekdays,
		});
	} else {
		emit("update:plan", {
			...props.plan,
			customWeekdays: checked,
		});
	}
}

// biome-ignore lint/correctness/noUnusedVariables: toggleDayEnabled is used in the <template> block below, which Biome's Vue support doesn't see.
function toggleDayEnabled(day: Weekday) {
	if (!props.plan) return;
	const currentEnabled = getDayEnabled(day);
	const currentFrom = getDayFrom(day);
	const currentTo = getDayTo(day);
	const updatedWeekdays = {
		...(props.plan.weekdays ?? {}),
		[day]: {
			enabled: !currentEnabled,
			from: currentFrom,
			to: currentTo,
		},
	};
	emit("update:plan", {
		...props.plan,
		weekdays: updatedWeekdays,
	});
}

// biome-ignore lint/correctness/noUnusedVariables: updateDayTime is used in the <template> block below, which Biome's Vue support doesn't see.
function updateDayTime(day: Weekday, field: "from" | "to", value: string) {
	if (!props.plan) return;
	const daySetting = props.plan.weekdays?.[day] ?? {
		enabled: true,
		from: props.plan.from || "08:00",
		to: props.plan.to || "22:00",
	};
	const updatedWeekdays = {
		...(props.plan.weekdays ?? {}),
		[day]: {
			...daySetting,
			[field]: value,
		},
	};
	emit("update:plan", {
		...props.plan,
		weekdays: updatedWeekdays,
	});
}

function getScheduleLabel(mode: string | undefined): string {
	if (mode === "upfront") return t.value.renderer.scheduleUpfront;
	if (mode === "perDay") return t.value.renderer.schedulePerDay;
	if (mode === "perSection") return t.value.renderer.schedulePerSection;
	return "";
}

function getRestsLabel(choice: string | undefined): string {
	if (choice === "balanced") return t.value.renderer.restsBalanced;
	if (choice === "longest") return t.value.renderer.restsLongest;
	if (choice === "shortest") return t.value.renderer.restsShortest;
	return "";
}

// biome-ignore lint/correctness/noUnusedVariables: scheduleBadgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const scheduleBadgeTitle = computed(() => {
	const p = props.plan;
	const parts: string[] = [];
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
		const timePrefix = lang.value === "fr" ? "Service à" : "Serve at";
		parts.push(`${timePrefix} ${timeStr}`);
	}
	if (p?.customWeekdays) {
		parts.push(lang.value === "fr" ? "Horaires personnalisés" : "Custom hours");
	}
	if (props.schedule && props.schedule !== "perSection") {
		const miseLabel = getScheduleLabel(props.schedule);
		if (miseLabel) parts.push(`Mise en place: ${miseLabel}`);
	}
	if (props.rests && props.rests !== "shortest") {
		const restsLabel = getRestsLabel(props.rests);
		if (restsLabel) parts.push(`Repos: ${restsLabel}`);
	}
	return parts.join(" · ") || t.value.playground.badges?.active || "Active";
});

// biome-ignore lint/correctness/noUnusedVariables: isScheduleModified is used in the <template> block below, which Biome's Vue support doesn't see.
const isScheduleModified = computed(() => {
	return Boolean(
		props.plan?.serveAt ||
			props.plan?.customWeekdays ||
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

// biome-ignore lint/correctness/noUnusedVariables: unitWrapperRef is used in the <template> block below
const unitWrapperRef = ref<HTMLElement | null>(null);
// biome-ignore lint/correctness/noUnusedVariables: unitInputRef is used in the <template> block below
const unitInputRef = ref<HTMLInputElement | null>(null);
// biome-ignore lint/correctness/noUnusedVariables: isUnitDropdownOpen is used in the <template> block below
const isUnitDropdownOpen = ref(false);
// biome-ignore lint/correctness/noUnusedVariables: highlightedUnitIndex is used in the <template> block below
const highlightedUnitIndex = ref(-1);
// biome-ignore lint/correctness/noUnusedVariables: unitListboxId is used in the <template> block below
const unitListboxId = useId();

// biome-ignore lint/correctness/noUnusedVariables: unitOptionId is used in the <template> block below
function unitOptionId(index: number): string {
	return `${unitListboxId}-option-${index}`;
}

// biome-ignore lint/correctness/noUnusedVariables: activeUnitDescendant is used in the <template> block below
const activeUnitDescendant = computed(() =>
	isUnitDropdownOpen.value && highlightedUnitIndex.value >= 0
		? unitOptionId(highlightedUnitIndex.value)
		: undefined,
);

// biome-ignore lint/correctness/noUnusedVariables: filteredUnits is used in the <template> block below
const filteredUnits = computed(() => {
	const query = (targetUnit.value || "").trim().toLowerCase();
	if (!query) {
		return knownUnits;
	}
	const startsWith: string[] = [];
	const contains: string[] = [];
	for (const u of knownUnits) {
		const lower = u.toLowerCase();
		if (lower.startsWith(query)) {
			startsWith.push(u);
		} else if (lower.includes(query)) {
			contains.push(u);
		}
	}
	return [...startsWith, ...contains];
});

// biome-ignore lint/correctness/noUnusedVariables: selectUnit is used in the <template> block below
function selectUnit(u: string) {
	targetUnit.value = u;
	isUnitDropdownOpen.value = false;
	highlightedUnitIndex.value = -1;
}

// biome-ignore lint/correctness/noUnusedVariables: onUnitFocus is used in the <template> block below
function onUnitFocus() {
	isUnitDropdownOpen.value = true;
	highlightedUnitIndex.value = -1;
}

// biome-ignore lint/correctness/noUnusedVariables: onUnitInput is used in the <template> block below
function onUnitInput() {
	if (!isUnitDropdownOpen.value) {
		isUnitDropdownOpen.value = true;
	}
	highlightedUnitIndex.value = 0;
}

// biome-ignore lint/correctness/noUnusedVariables: onUnitKeydown is used in the <template> block below
function onUnitKeydown(e: KeyboardEvent) {
	if (e.key === "ArrowDown") {
		e.preventDefault();
		if (!isUnitDropdownOpen.value) {
			isUnitDropdownOpen.value = true;
			highlightedUnitIndex.value = 0;
		} else if (filteredUnits.value.length > 0) {
			highlightedUnitIndex.value = Math.min(
				highlightedUnitIndex.value + 1,
				filteredUnits.value.length - 1,
			);
		}
		return;
	}

	if (e.key === "ArrowUp") {
		e.preventDefault();
		if (!isUnitDropdownOpen.value) {
			isUnitDropdownOpen.value = true;
			highlightedUnitIndex.value = filteredUnits.value.length - 1;
		} else if (filteredUnits.value.length > 0) {
			highlightedUnitIndex.value = Math.max(highlightedUnitIndex.value - 1, 0);
		}
		return;
	}

	if (e.key === "Enter") {
		if (
			isUnitDropdownOpen.value &&
			highlightedUnitIndex.value >= 0 &&
			filteredUnits.value[highlightedUnitIndex.value]
		) {
			e.preventDefault();
			selectUnit(filteredUnits.value[highlightedUnitIndex.value]);
			return;
		}
		isUnitDropdownOpen.value = false;
		submitScale();
		return;
	}

	if (e.key === "Escape") {
		if (isUnitDropdownOpen.value) {
			e.preventDefault();
			isUnitDropdownOpen.value = false;
		}
		return;
	}

	if (e.key === "Tab") {
		isUnitDropdownOpen.value = false;
	}
}

function onDocumentClick(e: MouseEvent) {
	if (
		unitWrapperRef.value &&
		!unitWrapperRef.value.contains(e.target as Node)
	) {
		isUnitDropdownOpen.value = false;
	}
}

watch(highlightedUnitIndex, (idx) => {
	if (idx >= 0 && isUnitDropdownOpen.value) {
		const el = document.getElementById(unitOptionId(idx));
		el?.scrollIntoView({ block: "nearest" });
	}
});

watch(
	() => props.scaleTargetId,
	() => {
		isUnitDropdownOpen.value = false;
	},
);

onMounted(() => {
	document.addEventListener("click", onDocumentClick);
});

onUnmounted(() => {
	document.removeEventListener("click", onDocumentClick);
});

// biome-ignore lint/correctness/noUnusedVariables: submitScale is used in the <template> block below, which Biome's Vue support doesn't see.
function submitScale() {
	emit("scale-apply");
}

// biome-ignore lint/correctness/noUnusedVariables: scaleBadgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const scaleBadgeTitle = computed(() => {
	if (props.scaleTargetId && props.shoppingList) {
		const item = props.shoppingList.find((i) => i.id === props.scaleTargetId);
		const qtyStr =
			props.scaleTargetQty !== null
				? `${props.scaleTargetQty}${props.scaleTargetUnit ? ` ${props.scaleTargetUnit}` : ""}`
				: "";
		const byIng = t.value.playground.badges?.byIngredient || "By ingredient";
		const name = item?.name || props.scaleTargetId;
		return `${byIng}: ${name}${qtyStr ? ` (${qtyStr})` : ""}`;
	}
	const factor = props.scaleFactorString || "100";
	const globalLabel = t.value.playground.options?.scaleGlobal || "Global scale";
	return `${globalLabel}: ${factor}%`;
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

// biome-ignore lint/correctness/noUnusedVariables: bakersBadgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const bakersBadgeTitle = computed(() => {
	const title = t.value.playground.sections?.bakersMath || "Baker's Math";
	if (props.options.bakersReference) {
		return `${title}: ${props.options.bakersReference}`;
	}
	return title;
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

// biome-ignore lint/correctness/noUnusedVariables: physicsBadgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const physicsBadgeTitle = computed(() => {
	const parts: string[] = [];
	if (props.options.enableMassStandardization) {
		parts.push(
			t.value.playground.options?.standardizeMass || "Standardize mass",
		);
	}
	if (props.options.enableYieldCalculation) {
		parts.push(t.value.playground.options?.yieldCalc || "Yield");
	}
	if (props.options.enableNutritionalEstimation) {
		parts.push(t.value.playground.options?.nutritionCalc || "Nutrition");
	}
	return parts.length > 0
		? parts.join(" · ")
		: t.value.playground.badges?.inactive || "Inactive";
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

// biome-ignore lint/correctness/noUnusedVariables: stockBadgeTitle is used in the <template> block below, which Biome's Vue support doesn't see.
const stockBadgeTitle = computed(() => {
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
          :title="isScheduleModified ? scheduleBadgeTitle : undefined"
          @click="toggleSection('schedule')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.schedule }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.schedule || 'Planification & Service' }}</span>
          <span
            v-if="isScheduleModified"
            class="section-dot"
            aria-hidden="true"
          ></span>
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
          <div class="studio-label-row">
            <label class="studio-label">{{ t.renderer.scheduleLabel }}</label>
            <PlaygroundTooltip :text="t.playground.help.schedule" />
          </div>
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
          <div class="studio-label-row">
            <label class="studio-label">{{ t.renderer.restsLabel }}</label>
            <PlaygroundTooltip :text="t.playground.help.rests" />
          </div>
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

        <!-- Heure de service -->
        <div class="studio-field serve-field-group">
          <div class="studio-label-row">
            <label class="studio-label">{{ lang === 'fr' ? 'Heure de service' : (t.playground.views.planServeAt || 'Served on') }}</label>
            <PlaygroundTooltip :text="t.playground.help.serveAt" />
            <button
              v-if="props.plan?.serveAt"
              type="button"
              class="clear-serve-btn"
              @click="clearServeAt"
              :title="lang === 'fr' ? 'Effacer la date de service' : 'Clear serve time'"
            >
              {{ lang === 'fr' ? 'Effacer' : 'Clear' }}
            </button>
          </div>

          <!-- Raccourcis de service (Au plus tôt + Suggestions + Info créneaux rejetés) -->
          <div v-if="props.serveSuggestions" class="serve-shortcuts-container">
            <div
              v-if="props.serveSuggestions.candidates.length > 0 || props.serveSuggestions.earliest"
              class="serve-shortcuts-row"
            >
              <!-- Au plus tôt -->
              <button
                v-if="props.serveSuggestions.earliest"
                type="button"
                class="serve-pill earliest-pill"
                :class="{ 'is-selected': props.plan?.serveAt === props.serveSuggestions.earliest.serveAt }"
                :title="earliestTooltip"
                @click="pickServeAt(props.serveSuggestions.earliest.serveAt)"
              >
                <svg
                  class="pill-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span class="pill-text">{{ formatEarliestLabel(props.serveSuggestions.earliest.label) }}</span>
              </button>

              <!-- Suggestions candidates -->
              <button
                v-for="c in filteredCandidates"
                :key="c.serveAt"
                type="button"
                class="serve-pill"
                :class="{ 'is-selected': props.plan?.serveAt === c.serveAt }"
                :title="c.title"
                @click="pickServeAt(c.serveAt)"
              >
                {{ c.label }}
              </button>

              <!-- Pourquoi pas les autres créneaux ? -->
              <div
                v-if="props.serveSuggestions.rejected.length > 0"
                class="rejected-info-wrapper"
              >
                <PlaygroundTooltip
                  :text="rejectedTooltipText"
                  :aria-label="lang === 'fr' ? 'Pourquoi pas les autres créneaux ?' : 'Why not other slots?'"
                >
                  <span class="rejected-chip">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="rejected-chip-icon"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>{{ lang === 'fr' ? 'Autres créneaux' : 'Other slots' }}</span>
                  </span>
                </PlaygroundTooltip>
              </div>
            </div>
            <p v-else class="serve-none">{{ t.playground.views.serveWhenNone }}</p>
          </div>

          <input
            class="studio-input"
            type="datetime-local"
            :value="props.plan?.serveAt || ''"
            @input="updatePlanField('serveAt', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="studio-field">
          <div class="studio-label-row">
            <label class="studio-label">{{ t.playground.views.planTimeZone }}</label>
            <PlaygroundTooltip :text="t.playground.help.timeZone" />
          </div>
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

        <!-- Disponibilités -->
        <div class="studio-field">
          <div class="studio-label-row">
            <label class="studio-label">{{ lang === 'fr' ? 'Disponibilité quotidienne' : (t.playground.views.planAvailableFrom + ' / ' + t.playground.views.planAvailableTo) }}</label>
            <PlaygroundTooltip :text="t.playground.help.availability" />
          </div>
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

          <!-- Option horaires spécifiques par jour -->
          <label class="custom-weekdays-toggle">
            <input
              type="checkbox"
              :checked="Boolean(props.plan?.customWeekdays)"
              @change="toggleCustomWeekdays"
            />
            <span>{{ lang === 'fr' ? 'Horaires spécifiques par jour' : 'Specific hours by day of the week' }}</span>
          </label>

          <!-- Grille des 7 jours si activée -->
          <div v-if="props.plan?.customWeekdays" class="weekdays-grid">
            <div
              v-for="day in WEEKDAYS"
              :key="day"
              class="weekday-row"
              :class="{ 'is-disabled': !getDayEnabled(day) }"
            >
              <div class="weekday-row-top">
                <label class="weekday-name-label">
                  <input
                    type="checkbox"
                    :checked="getDayEnabled(day)"
                    @change="toggleDayEnabled(day)"
                  />
                  <span class="weekday-name">{{ getWeekdayFullLabel(day) }}</span>
                </label>
                <span v-if="!getDayEnabled(day)" class="weekday-status-closed">
                  {{ lang === 'fr' ? 'Indisponible' : 'Unavailable' }}
                </span>
              </div>

              <div v-if="getDayEnabled(day)" class="weekday-time-inputs">
                <input
                  class="studio-input studio-input-compact"
                  type="time"
                  :value="getDayFrom(day)"
                  @input="updateDayTime(day, 'from', ($event.target as HTMLInputElement).value)"
                />
                <span class="range-separator">→</span>
                <input
                  class="studio-input studio-input-compact"
                  type="time"
                  :value="getDayTo(day)"
                  @input="updateDayTime(day, 'to', ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
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
          :title="isScaleModified ? scaleBadgeTitle : undefined"
          @click="toggleSection('scale')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.scale }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.scale || 'Portions & Échelle' }}</span>
          <span
            v-if="isScaleModified"
            class="section-dot"
            aria-hidden="true"
          ></span>
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
          <div class="studio-label-row">
            <span class="studio-label">{{ t.playground.options.scaleGlobal }}</span>
            <PlaygroundTooltip :text="t.playground.help.scaleGlobal" />
          </div>
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
          <div class="studio-label-row">
            <span class="studio-label">{{ t.playground.options.scaleByIngredient }}</span>
            <PlaygroundTooltip :text="t.playground.help.scaleByIngredient" />
          </div>
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
            <div class="scale-unit-wrapper" ref="unitWrapperRef">
              <input
                ref="unitInputRef"
                type="text"
                class="studio-input unit"
                v-model="targetUnit"
                :placeholder="t.playground.options.unit"
                role="combobox"
                autocomplete="off"
                aria-autocomplete="list"
                :aria-expanded="isUnitDropdownOpen"
                :aria-controls="unitListboxId"
                :aria-activedescendant="activeUnitDescendant"
                @focus="onUnitFocus"
                @input="onUnitInput"
                @keydown="onUnitKeydown"
              />
              <ul
                v-if="isUnitDropdownOpen && filteredUnits.length > 0"
                :id="unitListboxId"
                class="unit-dropdown-menu"
                role="listbox"
              >
                <li
                  v-for="(u, index) in filteredUnits"
                  :key="u"
                  :id="unitOptionId(index)"
                  class="unit-dropdown-item"
                  :class="{
                    'is-highlighted': index === highlightedUnitIndex,
                    'is-active': u === targetUnit,
                  }"
                  role="option"
                  :aria-selected="u === targetUnit"
                  @mousedown.prevent="selectUnit(u)"
                  @mouseenter="highlightedUnitIndex = index"
                >
                  {{ u }}
                </li>
              </ul>
            </div>
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
          :title="isBakersModified ? bakersBadgeTitle : undefined"
          @click="toggleSection('bakersMath')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.bakersMath }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.bakersMath || "Baker's Math" }}</span>
          <span
            v-if="isBakersModified"
            class="section-dot"
            aria-hidden="true"
          ></span>
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
            <div class="studio-label-row">
              <span class="option-name">{{ t.playground.options.enableBakersMath }}</span>
              <PlaygroundTooltip :text="t.playground.help.bakersMath" />
            </div>
            <span class="option-desc">{{ t.playground.options.bakersMathDesc }}</span>
          </div>
        </label>
        
        <label class="option-item child-option" :class="{ disabled: !bakersMath }">
          <input type="checkbox" v-model="bakersMathOnly" :disabled="!bakersMath" />
          <div class="option-text">
            <div class="studio-label-row">
              <span class="option-name">{{ t.playground.options.hideAbsolute }}</span>
              <PlaygroundTooltip :text="t.playground.help.bakersMathOnly" />
            </div>
          </div>
        </label>

        <div class="child-option select-wrapper" :class="{ disabled: !bakersMath }" v-if="bakersMath">
          <div class="studio-label-row">
            <span class="studio-label">{{ t.playground.options.forceReference }}</span>
            <PlaygroundTooltip :text="t.playground.help.bakersReference" />
          </div>
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
          :title="isPhysicsModified ? physicsBadgeTitle : undefined"
          @click="toggleSection('physics')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.physics }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.physics || 'Physique & Nutrition' }}</span>
          <span
            v-if="isPhysicsModified"
            class="section-dot"
            aria-hidden="true"
          ></span>
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
        <p class="studio-section-note">
          <svg class="note-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{{ t.playground.help.physicsDisclaimer }}</span>
        </p>

        <label class="option-item">
          <input type="checkbox" v-model="massEnabled" />
          <div class="option-text">
            <div class="studio-label-row">
              <span class="option-name">{{ t.playground.options.massStandardization }}</span>
              <PlaygroundTooltip :text="t.playground.help.massStandardization" />
            </div>
            <span class="option-desc">{{ t.playground.options.massDesc }}</span>
          </div>
        </label>
        
        <label class="option-item child-option" :class="{ disabled: !massEnabled }">
          <input type="checkbox" v-model="yieldEnabled" :disabled="!massEnabled" />
          <div class="option-text">
            <div class="studio-label-row">
              <span class="option-name">{{ t.playground.options.yieldManagement }}</span>
              <PlaygroundTooltip :text="t.playground.help.yieldManagement" />
            </div>
          </div>
        </label>

        <label class="option-item">
          <input type="checkbox" v-model="nutritionEnabled" />
          <div class="option-text">
            <div class="studio-label-row">
              <span class="option-name">{{ t.playground.options.nutrition }}</span>
              <PlaygroundTooltip :text="t.playground.help.nutrition" />
            </div>
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
          :title="isStockModified ? stockBadgeTitle : undefined"
          @click="toggleSection('stock')"
        >
          <svg class="chevron-icon" :class="{ rotated: openSections.stock }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="section-title">{{ t.playground.sections?.stock || 'Stock & Modules' }}</span>
          <span
            v-if="isStockModified"
            class="section-dot"
            aria-hidden="true"
          ></span>
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
            <div class="studio-label-row">
              <span class="option-name">{{ imp.specifier }}</span>
              <PlaygroundTooltip :text="t.playground.help.stockItem" />
            </div>
            <span class="option-desc">{{ t.playground.options.stockDesc }}</span>
          </div>
        </label>
      </div>
    </div>

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

.studio-section-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0 0 2px;
  padding: 8px 10px;
  background-color: var(--sl-color-gray-7, #24201c);
  border: 1px solid var(--sl-color-gray-6, #36302a);
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--sl-color-gray-2, #c4bebb);
}

.note-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--sl-color-gray-3, #9e948f);
}

.studio-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.studio-label-row {
  display: flex;
  align-items: center;
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
  width: 100%;
}

.studio-time-range .studio-input {
  flex: 1;
  min-width: 0;
}

.range-separator {
  color: var(--sl-color-gray-3);
  font-size: 12px;
}

.clear-serve-btn {
  background: transparent;
  border: none;
  color: var(--sl-color-gray-3);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  margin-left: auto;
  border-radius: 2px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.clear-serve-btn:hover {
  color: var(--sl-color-accent-high);
}

.serve-field-group {
  gap: 8px;
}

.serve-shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.serve-shortcuts-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.serve-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.serve-pill {
  border: 1px solid var(--sl-color-gray-5);
  background: var(--sl-color-bg-nav);
  color: var(--sl-color-text);
  padding: 3px 6px;
  font-size: 12px;
  cursor: pointer;
}

.serve-pill:hover {
  border-color: var(--sl-color-gray-3);
}

.serve-pill.is-selected {
  border-color: var(--sl-color-accent);
  color: #1a1613;
  background-color: var(--sl-color-accent);
  font-weight: 600; 
}

.earliest-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: var(--sl-color-bg-nav);
  border: 1px solid var(--sl-color-gray-5);
  color: var(--sl-color-text);
  font-weight: 500;
}

.earliest-pill .pill-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--sl-color-accent);
}

.earliest-pill.is-selected .pill-icon {
  color: currentColor;
}

.earliest-pill:hover {
  border-color: var(--sl-color-gray-3);
  color: var(--sl-color-text);
}

.earliest-pill.is-selected {
  border-color: var(--sl-color-accent);
  color: #1a1613;
  background-color: var(--sl-color-accent);
  font-weight: 600; 
}

.rejected-info-wrapper {
  display: inline-flex;
  align-items: center;
}

.rejected-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px dashed var(--sl-color-gray-5);
  background-color: var(--sl-color-bg-nav);
  color: var(--sl-color-gray-3);
  padding: 3px 6px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.rejected-chip-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.rejected-chip:hover,
.playground-tooltip-trigger:focus-visible .rejected-chip,
.playground-tooltip-trigger.is-active .rejected-chip {
  border-color: var(--sl-color-gray-3);
  color: var(--sl-color-text);
  background-color: var(--sl-color-gray-7);
}

.serve-none {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--sl-color-gray-2);
}

.custom-weekdays-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--sl-color-gray-2);
  cursor: pointer;
  margin-top: 4px;
  user-select: none;
}

.weekdays-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.weekday-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background-color: var(--sl-color-gray-7);
  border: 1px solid var(--sl-color-gray-6);
  border-radius: 4px;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.weekday-row.is-disabled {
  opacity: 0.55;
  background-color: transparent;
  border-color: var(--sl-color-border);
}

.weekday-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.weekday-name-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--sl-color-text);
}

.weekday-name {
  color: var(--sl-color-text);
}

.weekday-status-closed {
  font-size: 11.5px;
  color: var(--sl-color-gray-3);
  font-style: italic;
}

.weekday-time-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.weekday-time-inputs .studio-input-compact {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  text-align: center;
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

.scale-unit-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.scale-unit-wrapper .unit {
  width: 100%;
}

.unit-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  min-width: 90px;
  max-height: 180px;
  overflow-y: auto;
  background-color: var(--sl-color-bg);
  border: 1px solid var(--sl-color-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 100;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  box-sizing: border-box;
}

.unit-dropdown-item {
  padding: 6px 10px;
  font-size: 13px;
  color: var(--sl-color-text);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.unit-dropdown-item:hover,
.unit-dropdown-item.is-highlighted {
  background-color: var(--sl-color-gray-7);
  color: var(--sl-color-text);
}

.unit-dropdown-item.is-active {
  color: var(--sl-color-text);
  background-color: var(--sl-color-gray-6);
  font-weight: 600;
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
