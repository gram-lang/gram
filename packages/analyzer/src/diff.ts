import type {
	CompilationResult,
	ProcessedSection,
	StepToken,
	ProcessedTimer,
	ProcessedTemperature,
	Usage,
	ShoppingListItem,
	CompositeItem,
} from "@gram-lang/kitchen";
import { getNumericQty } from "@gram-lang/kitchen";

// Structural, analyzer-local shapes for the module-composition metadata a
// `CompilationResult` may carry when it actually came from
// `@gram-lang/modules`' `composeRecipe`/`finalizeComposed` (module-imports
// RFC §F.0.2). Deliberately NOT imported from `@gram-lang/modules` itself:
// that package already depends on this one (for `analyze()`), so a type
// import the other way would be a package cycle. These mirror modules'
// `ComposedSection`/`ModuleInfo` shapes by structure, not by reference —
// anything `finalizeComposed` actually produces satisfies them.
interface DiffableModuleInfo {
	uri: string;
	binding: string;
	scaleFactor: number;
}
interface DiffableSection extends ProcessedSection {
	module?: unknown;
}
interface DiffableCompilationResult extends CompilationResult {
	sections: DiffableSection[];
	modules?: DiffableModuleInfo[];
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface MetaDelta {
	field: string;
	from: unknown;
	to: unknown;
}

export interface IngredientDelta {
	id: string;
	name: string;
	change: "added" | "removed" | "changed";
	fromQty?: number;
	fromUnit?: string | null;
	toQty?: number;
	toUnit?: string | null;
	percentChange?: number;
}

export interface PrepDelta {
	id: string;
	name: string;
	section: string | null;
	from: string | null;
	to: string | null;
}

export interface TimingDelta {
	field: "totalTime" | "idleTime" | "activeTime" | "preparationTime";
	from: number;
	to: number;
}

export interface SectionDelta {
	change: "added" | "removed" | "changed";
	title: string | null;
	fromStepCount?: number;
	toStepCount?: number;
}

export interface TemperatureDelta {
	section: string | null;
	name?: string;
	change: "added" | "removed" | "changed";
	from?: { value: number; unit: string; range?: { min: number; max: number } };
	to?: { value: number; unit: string; range?: { min: number; max: number } };
}

export interface TimerDelta {
	section: string | null;
	name?: string;
	change: "added" | "removed" | "changed";
	from?: string;
	to?: string;
}

export interface ModuleDelta {
	uri: string;
	change: "added" | "removed" | "changed";
	fromBinding?: string;
	toBinding?: string;
	fromFactor?: number;
	toFactor?: number;
}

export interface DiffResult {
	hasChanges: boolean;
	titleChanged: boolean;
	fromTitle: string | null;
	toTitle: string | null;
	meta: MetaDelta[];
	ingredients: IngredientDelta[];
	preparations: PrepDelta[];
	timings: TimingDelta[];
	sections: SectionDelta[];
	temperatures: TemperatureDelta[];
	timers: TimerDelta[];
	modules: ModuleDelta[];
}

type ShoppingItem = ShoppingListItem | CompositeItem | Usage;
// What's left of ShoppingItem once composite/alternative groups are excluded —
// both ShoppingListItem and Usage share the .name?/.unit?/.qty? shape diffIngredients needs.
type SimpleShoppingItem = ShoppingListItem | Usage;

function isCompositeOrAlternative(
	item: ShoppingItem,
): item is CompositeItem | (Usage & { type: "alternative" }) {
	return (
		"type" in item && (item.type === "composite" || item.type === "alternative")
	);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Single grouping primitive, shared by every diff function below that needs
// to key items by something that isn't guaranteed unique (a section title, a
// timer/temperature name). The same "overwrite instead of accumulate" bug —
// a `Map.set` on a colliding key silently dropping the first item — existed
// independently in three places here (section-title keying in two
// functions, token-name keying in a third). One of them had already been
// fixed at its own site without touching the other two, so fixing only
// this call site again would leave the same bug alive in the rest.
function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
	const result = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		const bucket = result.get(key);
		if (bucket) bucket.push(item);
		else result.set(key, [item]);
	}
	return result;
}

function groupSectionsByKey<T extends { title: string | null }>(
	sections: T[],
): Map<string, T[]> {
	const result = new Map<string, T[]>();
	sections.forEach((section, i) => {
		const key = section.title ?? `__pos_${i}`;
		const bucket = result.get(key);
		if (bucket) bucket.push(section);
		else result.set(key, [section]);
	});
	return result;
}

// Composite and alternative groups used to be excluded from diffIngredients
// entirely, so a quantity change inside either (`@lemon{2}` -> `{5}` on a
// composite parent, `@egg{2}|@tofu{200g}` -> `{9}|{900g}` on an alternative)
// produced `hasChanges: false` — a diff tool asserting "nothing changed" is
// worse than no diff tool at all. This recursively unwraps both into the
// flat, individually-diffable ingredients they're built from, so the
// existing id-keyed comparison in diffIngredients sees every quantity that
// can change, not just the ones outside a group.
function flattenShoppingItems(items: ShoppingItem[]): SimpleShoppingItem[] {
	const result: SimpleShoppingItem[] = [];
	for (const item of items) {
		if (!isCompositeOrAlternative(item)) {
			result.push(item);
			continue;
		}
		if (item.type === "composite") {
			// The composite parent's own total is itself a well-defined
			// absolute quantity (see scale/engine.ts's findStandardItem
			// comment) — diffable exactly like any other ingredient — in
			// addition to, not instead of, its nested children.
			result.push({
				id: item.id,
				name: (item as { name?: string }).name ?? item.id,
				qty: item.qty,
			} as SimpleShoppingItem);
			result.push(...flattenShoppingItems(item.usage as ShoppingItem[]));
		} else {
			// Alternative: "alternative" itself isn't a real ingredient id —
			// only its options are.
			result.push(
				...flattenShoppingItems((item.options ?? []) as ShoppingItem[]),
			);
		}
	}
	return result;
}

const numericQty = (item: ShoppingItem): number | null =>
	getNumericQty(item.qty);

function fmtTimerQty(qty: ProcessedTimer["quantity"], unit?: string): string {
	const u = unit ? ` ${unit}` : "";
	if (qty === undefined || qty === null) return `?${u}`;
	if (typeof qty === "number") return `${qty}${u}`;
	if (typeof qty === "string") return `${qty}${u}`;
	if (typeof qty === "object") {
		// Pre-existing bug fixed here: this used to check qty.from/qty.to, which
		// never existed on QuantityValueAST (the real range fields are range.min/max),
		// so range timers silently fell through to the plain .value branch below.
		if (qty.type === "range" && qty.range)
			return `${qty.range.min}-${qty.range.max}${u}`;
		if (qty.value !== undefined) return `${qty.value}${u}`;
	}
	return `?${u}`;
}

function getTempValue(token: ProcessedTemperature): {
	value: number;
	unit: string;
	range?: { min: number; max: number };
} | null {
	const q = token.quantity;
	if (!q) return null;
	const value =
		typeof q === "number"
			? q
			: typeof q === "object" && "value" in q && typeof q.value === "number"
				? q.value
				: null;
	if (value === null) return null;
	// Ranges collapse to their average in `.value` — carry the explicit bounds
	// too, otherwise {2-3} -> {1-4} (same average) would look unchanged.
	const range =
		typeof q === "object" && "type" in q && q.type === "range" && q.range
			? q.range
			: undefined;
	return { value, unit: token.unit ?? "°", range };
}

function isProcessedTimer(token: StepToken): token is ProcessedTimer {
	return (
		typeof token === "object" &&
		token !== null &&
		"type" in token &&
		token.type === "timer"
	);
}

function isProcessedTemperature(
	token: StepToken,
): token is ProcessedTemperature {
	return (
		typeof token === "object" &&
		token !== null &&
		"type" in token &&
		token.type === "temperature"
	);
}

// A plain ingredient/cookware/reference usage — the only StepToken variants
// carrying a `.preparation`/`.id` pair relevant to diffPreparations().
// ProcessedDeclaration also has a string `.id`, so it must be excluded
// explicitly — it's the only other StepToken variant that does.
function isUsageToken(token: StepToken): token is Usage {
	return (
		typeof token === "object" &&
		token !== null &&
		"id" in token &&
		typeof token.id === "string" &&
		(!("type" in token) || token.type !== "declaration")
	);
}

// Extract all tokens matching a type predicate from all steps, keyed by
// section title/position — two sections sharing a title accumulate into the
// same bucket via groupSectionsByKey rather than the second overwriting the
// first's tokens.
function extractTokensByType<T extends StepToken>(
	sections: ProcessedSection[],
	isMatch: (token: StepToken) => token is T,
): Map<string, T[]> {
	const result = new Map<string, T[]>();
	for (const [key, group] of groupSectionsByKey(sections)) {
		const tokens: T[] = [];
		for (const section of group) {
			for (const step of section.steps ?? []) {
				if (step.type !== "step") continue;
				for (const token of step.content ?? []) {
					if (isMatch(token)) tokens.push(token);
				}
			}
		}
		if (tokens.length > 0) result.set(key, tokens);
	}
	return result;
}

// Match tokens: named by name (accumulating same-named tokens within a
// section and pairing them positionally — audit 2026-07-22, analyzer finding
// B3: `aNamed.set(t.name, t)` used to overwrite on a repeated name, so of two
// same-named timers in one section, the first silently vanished from the
// diff), unnamed by position.
function matchTokenPairs<T extends { name?: string }>(
	aTokens: T[],
	bTokens: T[],
): Array<[T | null, T | null]> {
	const pairs: Array<[T | null, T | null]> = [];

	const aNamed = groupBy(
		aTokens.filter((t) => t.name),
		(t) => t.name!,
	);
	const aUnnamed = aTokens.filter((t) => !t.name);

	const bNamed = groupBy(
		bTokens.filter((t) => t.name),
		(t) => t.name!,
	);
	const bUnnamed = bTokens.filter((t) => !t.name);

	for (const name of new Set([...aNamed.keys(), ...bNamed.keys()])) {
		const aList = aNamed.get(name) ?? [];
		const bList = bNamed.get(name) ?? [];
		const namedMaxLen = Math.max(aList.length, bList.length);
		for (let i = 0; i < namedMaxLen; i++) {
			pairs.push([aList[i] ?? null, bList[i] ?? null]);
		}
	}

	const maxLen = Math.max(aUnnamed.length, bUnnamed.length);
	for (let i = 0; i < maxLen; i++)
		pairs.push([aUnnamed[i] ?? null, bUnnamed[i] ?? null]);

	return pairs;
}

// ── Diff functions ────────────────────────────────────────────────────────────

function diffMeta(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
): MetaDelta[] {
	const skipKeys = new Set(["title"]);
	const allKeys = new Set(
		[...Object.keys(a), ...Object.keys(b)].filter((k) => !skipKeys.has(k)),
	);
	const deltas: MetaDelta[] = [];
	for (const field of allKeys) {
		const from = a[field] ?? null;
		const to = b[field] ?? null;
		if (JSON.stringify(from) !== JSON.stringify(to))
			deltas.push({ field, from, to });
	}
	return deltas;
}

function diffIngredients(
	a: ShoppingItem[],
	b: ShoppingItem[],
): IngredientDelta[] {
	const toMap = (list: ShoppingItem[]) =>
		new Map<string, SimpleShoppingItem>(
			flattenShoppingItems(list).map((i) => [i.id, i]),
		);

	const aMap = toMap(a);
	const bMap = toMap(b);
	const allIds = new Set([...aMap.keys(), ...bMap.keys()]);
	const deltas: IngredientDelta[] = [];

	for (const id of allIds) {
		const aItem = aMap.get(id);
		const bItem = bMap.get(id);

		if (aItem && !bItem) {
			deltas.push({
				id,
				name: aItem.name || id,
				change: "removed",
				fromQty: numericQty(aItem) ?? undefined,
				fromUnit: aItem.unit ?? null,
			});
			continue;
		}
		if (!aItem && bItem) {
			deltas.push({
				id,
				name: bItem.name || id,
				change: "added",
				toQty: numericQty(bItem) ?? undefined,
				toUnit: bItem.unit ?? null,
			});
			continue;
		}
		if (!aItem || !bItem) continue;

		const aQty = numericQty(aItem);
		const bQty = numericQty(bItem);
		const aUnit = aItem.unit ?? null;
		const bUnit = bItem.unit ?? null;

		if (aQty === bQty && aUnit === bUnit) continue;

		const delta: IngredientDelta = {
			id,
			name: bItem.name || id,
			change: "changed",
			fromQty: aQty ?? undefined,
			fromUnit: aUnit,
			toQty: bQty ?? undefined,
			toUnit: bUnit,
		};

		if (aQty !== null && bQty !== null && aUnit === bUnit && aQty !== 0) {
			delta.percentChange = Math.round(((bQty - aQty) / aQty) * 100);
		}

		deltas.push(delta);
	}

	return deltas;
}

function diffTimings(
	a: CompilationResult["metrics"],
	b: CompilationResult["metrics"],
): TimingDelta[] {
	// Typed as the narrow TimingDelta["field"] union (not the full
	// `keyof CompilationResult["metrics"]`, which now also includes the
	// array-typed *Breakdown fields) so `a[field]`/`b[field]` stay `number`
	// without needing a cast.
	const fields: readonly TimingDelta["field"][] = [
		"totalTime",
		"idleTime",
		"activeTime",
		"preparationTime",
	];
	const deltas: TimingDelta[] = [];
	for (const field of fields) {
		const from = a[field] ?? 0;
		const to = b[field] ?? 0;
		if (from !== to) deltas.push({ field, from, to });
	}
	return deltas;
}

function stepCount(section: ProcessedSection): number {
	return (section.steps ?? []).filter((s) => s.type === "step").length;
}

function diffSections(
	a: ProcessedSection[],
	b: ProcessedSection[],
): SectionDelta[] {
	// This used to key sections by title through a plain `Map.set`, so two
	// sections sharing a title (a perfectly normal recipe, e.g. two "Prep"
	// sections) had the second silently overwrite the first — the same
	// "overwrite instead of accumulate" bug fixed for section-title keying
	// in extractTokensByType, left alive here. groupSectionsByKey
	// accumulates same-titled sections into a list, paired positionally
	// below.
	const aGroups = groupSectionsByKey(a);
	const bGroups = groupSectionsByKey(b);
	const allKeys = new Set([...aGroups.keys(), ...bGroups.keys()]);
	const deltas: SectionDelta[] = [];

	for (const key of allKeys) {
		const aList = aGroups.get(key) ?? [];
		const bList = bGroups.get(key) ?? [];
		const maxLen = Math.max(aList.length, bList.length);

		for (let i = 0; i < maxLen; i++) {
			const aSection = aList[i];
			const bSection = bList[i];

			if (aSection && !bSection) {
				deltas.push({
					change: "removed",
					title: aSection.title,
					fromStepCount: stepCount(aSection),
				});
				continue;
			}
			if (!aSection && bSection) {
				deltas.push({
					change: "added",
					title: bSection.title,
					toStepCount: stepCount(bSection),
				});
				continue;
			}
			if (!aSection || !bSection) continue;

			const from = stepCount(aSection);
			const to = stepCount(bSection);
			if (from !== to)
				deltas.push({
					change: "changed",
					title: bSection.title,
					fromStepCount: from,
					toStepCount: to,
				});
		}
	}

	return deltas;
}

function diffTemperatures(
	aSections: ProcessedSection[],
	bSections: ProcessedSection[],
): TemperatureDelta[] {
	const aMap = extractTokensByType(aSections, isProcessedTemperature);
	const bMap = extractTokensByType(bSections, isProcessedTemperature);
	const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
	const deltas: TemperatureDelta[] = [];

	for (const key of allKeys) {
		const sectionTitle = key.startsWith("__pos_") ? null : key;
		const pairs = matchTokenPairs(aMap.get(key) ?? [], bMap.get(key) ?? []);

		for (const [a, b] of pairs) {
			if (!a && b) {
				const to = getTempValue(b);
				if (to)
					deltas.push({
						section: sectionTitle,
						name: b.name,
						change: "added",
						to,
					});
				continue;
			}
			if (a && !b) {
				const from = getTempValue(a);
				if (from)
					deltas.push({
						section: sectionTitle,
						name: a.name,
						change: "removed",
						from,
					});
				continue;
			}
			if (a && b) {
				const from = getTempValue(a);
				const to = getTempValue(b);
				const nameChanged = (a.name ?? null) !== (b.name ?? null);
				const valChanged = JSON.stringify(from) !== JSON.stringify(to);
				if (nameChanged || valChanged) {
					deltas.push({
						section: sectionTitle,
						name: b.name ?? a.name,
						change: "changed",
						from: from ?? undefined,
						to: to ?? undefined,
					});
				}
			}
		}
	}

	return deltas;
}

function diffTimers(
	aSections: ProcessedSection[],
	bSections: ProcessedSection[],
): TimerDelta[] {
	const aMap = extractTokensByType(aSections, isProcessedTimer);
	const bMap = extractTokensByType(bSections, isProcessedTimer);
	const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
	const deltas: TimerDelta[] = [];

	for (const key of allKeys) {
		const sectionTitle = key.startsWith("__pos_") ? null : key;
		const pairs = matchTokenPairs(aMap.get(key) ?? [], bMap.get(key) ?? []);

		for (const [a, b] of pairs) {
			if (!a && b) {
				deltas.push({
					section: sectionTitle,
					name: b.name,
					change: "added",
					to: fmtTimerQty(b.quantity, b.unit),
				});
				continue;
			}
			if (a && !b) {
				deltas.push({
					section: sectionTitle,
					name: a.name,
					change: "removed",
					from: fmtTimerQty(a.quantity, a.unit),
				});
				continue;
			}
			if (a && b) {
				const from = fmtTimerQty(a.quantity, a.unit);
				const to = fmtTimerQty(b.quantity, b.unit);
				const nameChanged = (a.name ?? null) !== (b.name ?? null);
				if (nameChanged || from !== to) {
					deltas.push({
						section: sectionTitle,
						name: b.name ?? a.name,
						change: "changed",
						from,
						to,
					});
				}
			}
		}
	}

	return deltas;
}

const SKIP_TOKEN_TYPES = new Set([
	"declaration",
	"timer",
	"temperature",
	"comment",
	"alternative",
	"composite",
]);

function diffPreparations(
	aSections: ProcessedSection[],
	bSections: ProcessedSection[],
): PrepDelta[] {
	// Same "overwrite instead of accumulate" bug on section-title keying, a
	// third time in this file — two same-titled sections used to have the
	// second's `byId` map silently replace the first's, losing that
	// section's preparations from the diff entirely. groupSectionsByKey
	// merges same-titled sections' tokens into one `byId` map instead.
	const extractBySection = (sections: ProcessedSection[]) => {
		const result = new Map<string, Map<string, Usage[]>>();
		for (const [key, group] of groupSectionsByKey(sections)) {
			const byId = new Map<string, Usage[]>();
			for (const section of group) {
				for (const step of section.steps ?? []) {
					if (step.type !== "step") continue;
					for (const token of step.content ?? []) {
						if (!isUsageToken(token)) continue;
						if (token.type && SKIP_TOKEN_TYPES.has(token.type)) continue;
						const bucket = byId.get(token.id) ?? [];
						bucket.push(token);
						byId.set(token.id, bucket);
					}
				}
			}
			result.set(key, byId);
		}
		return result;
	};

	const aMap = extractBySection(aSections);
	const bMap = extractBySection(bSections);
	const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
	const deltas: PrepDelta[] = [];

	for (const key of allKeys) {
		const sectionTitle = key.startsWith("__pos_") ? null : key;
		const aById = aMap.get(key) ?? new Map<string, Usage[]>();
		const bById = bMap.get(key) ?? new Map<string, Usage[]>();
		const allIds = new Set([...aById.keys(), ...bById.keys()]);

		for (const id of allIds) {
			const aOccurrences = aById.get(id) ?? [];
			const bOccurrences = bById.get(id) ?? [];
			const maxLen = Math.max(aOccurrences.length, bOccurrences.length);

			for (let i = 0; i < maxLen; i++) {
				const a = aOccurrences[i] ?? null;
				const b = bOccurrences[i] ?? null;
				const aPrep = a?.preparation ?? null;
				const bPrep = b?.preparation ?? null;
				if (aPrep === bPrep) continue;
				deltas.push({
					id,
					name: (b ?? a)?.name ?? id,
					section: sectionTitle,
					from: aPrep,
					to: bPrep,
				});
			}
		}
	}

	return deltas;
}

// Sections spliced in from an `@use` import (module-imports RFC §F.0.2)
// always land at the head of `sections[]`, in `@use` declaration order —
// so adding, removing, or reordering imports shifts every position/title
// key the *other* diff functions rely on, making a one-line `@use` addition
// look like the whole recipe changed. Filtered out here, once, for every
// diff that keys by section title/position; `diffModules` below compares
// the imports themselves instead, by (uri, binding, scale factor) — a far
// more useful signal than a section-position shift.
function ownSections(sections: DiffableSection[]): DiffableSection[] {
	return sections.filter((s) => !s.module);
}

function diffModules(
	a: DiffableModuleInfo[],
	b: DiffableModuleInfo[],
): ModuleDelta[] {
	const aMap = new Map(a.map((m) => [m.uri, m]));
	const bMap = new Map(b.map((m) => [m.uri, m]));
	const allUris = new Set([...aMap.keys(), ...bMap.keys()]);
	const deltas: ModuleDelta[] = [];

	for (const uri of allUris) {
		const aModule = aMap.get(uri);
		const bModule = bMap.get(uri);

		if (aModule && !bModule) {
			deltas.push({
				uri,
				change: "removed",
				fromBinding: aModule.binding,
				fromFactor: aModule.scaleFactor,
			});
			continue;
		}
		if (!aModule && bModule) {
			deltas.push({
				uri,
				change: "added",
				toBinding: bModule.binding,
				toFactor: bModule.scaleFactor,
			});
			continue;
		}
		if (!aModule || !bModule) continue;

		if (
			aModule.binding !== bModule.binding ||
			aModule.scaleFactor !== bModule.scaleFactor
		) {
			deltas.push({
				uri,
				change: "changed",
				fromBinding: aModule.binding,
				toBinding: bModule.binding,
				fromFactor: aModule.scaleFactor,
				toFactor: bModule.scaleFactor,
			});
		}
	}

	return deltas;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function diffRecipes(
	a: DiffableCompilationResult,
	b: DiffableCompilationResult,
): DiffResult {
	const aSections = ownSections(a.sections ?? []);
	const bSections = ownSections(b.sections ?? []);

	const ingredients = diffIngredients(
		a.shopping_list ?? [],
		b.shopping_list ?? [],
	);
	const preparations = diffPreparations(aSections, bSections);
	const timings = diffTimings(a.metrics, b.metrics);
	const sections = diffSections(aSections, bSections);
	const meta = diffMeta(
		(a.meta ?? {}) as Record<string, unknown>,
		(b.meta ?? {}) as Record<string, unknown>,
	);
	const temperatures = diffTemperatures(aSections, bSections);
	const timers = diffTimers(aSections, bSections);
	const modules = diffModules(a.modules ?? [], b.modules ?? []);
	const titleChanged = a.title !== b.title;

	return {
		hasChanges:
			titleChanged ||
			ingredients.length > 0 ||
			preparations.length > 0 ||
			timings.length > 0 ||
			sections.length > 0 ||
			meta.length > 0 ||
			temperatures.length > 0 ||
			timers.length > 0 ||
			modules.length > 0,
		titleChanged,
		fromTitle: a.title,
		toTitle: b.title,
		meta,
		ingredients,
		preparations,
		timings,
		sections,
		temperatures,
		timers,
		modules,
	};
}
