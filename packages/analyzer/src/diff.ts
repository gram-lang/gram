import type {
	CompilationResult,
	ProcessedSection,
	StepToken,
	ProcessedTimer,
	ProcessedTemperature,
	ProcessedCheckpoint,
	Usage,
	ShoppingListItem,
	CompositeItem,
} from "@gram-lang/kitchen";
import { formatTerms, normalizeUnit } from "@gram-lang/i18n";
import {
	numericTotal,
	scheduleFor,
	scheduleTimes,
	termsOfUsage,
} from "@gram-lang/kitchen";

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
	/**
	 * The amount as a reader sees it (`202-203 g`, `1 cup + 20 g`), where the
	 * numbers above only give its middle or nothing. Since 1.5.0.
	 */
	fromText?: string;
	toText?: string;
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
	from?: TemperatureValue;
	to?: TemperatureValue;
}

/** A temperature as `diffTemperatures` compares it. `note` since 1.5.0. */
export interface TemperatureValue {
	value: number;
	unit: string;
	range?: { min: number; max: number };
	note?: string;
}

export interface TimerDelta {
	section: string | null;
	name?: string;
	change: "added" | "removed" | "changed";
	from?: string;
	to?: string;
}

/** A target state (`={ribbon stage}`) added, removed or changed. Since 1.5.0. */
export interface CheckpointDelta {
	section: string | null;
	change: "added" | "removed" | "changed";
	from?: CheckpointValue;
	to?: CheckpointValue;
}

/** A target state as `diffRecipes` compares it. Since 1.5.0. */
export interface CheckpointValue {
	state: string;
	note?: string;
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
	/** Since 1.5.0. */
	checkpoints: CheckpointDelta[];
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
				// One entry per unit of the parent (`100 g` and `2`, since
				// 1.5.2): paired by unit like a plain ingredient's entries.
				unit: item.unit,
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
	numericTotal(termsOfUsage(item));

/**
 * The amount of an entry as text, its unit included, written the way the
 * shopping list writes it (`1 cup + 1 tbsp` for 17 tbsp, `2-3 g`, `1.5 kg`),
 * or `undefined` when it has no terms (a text quantity, no quantity).
 */
const amountText = (item: ShoppingItem): string | undefined => {
	const terms = termsOfUsage(item);
	if (terms.length > 0)
		return formatTerms(terms, { minus: " - ", mode: "computed", buying: true });
	// A ratio still waiting for its target's amount, as written.
	const qty = (item as { qty?: unknown }).qty as {
		type?: string;
		raw?: string;
	};
	return qty?.type === "RatioQuantity" ? qty.raw : undefined;
};

/** `fromText` / `toText` of a delta, each only when there is one. */
function texts(
	aItem: ShoppingItem | null,
	bItem: ShoppingItem | null,
): Pick<IngredientDelta, "fromText" | "toText"> {
	const fromText = aItem ? amountText(aItem) : undefined;
	const toText = bItem ? amountText(bItem) : undefined;
	return {
		...(fromText !== undefined && { fromText }),
		...(toText !== undefined && { toText }),
	};
}

function fmtTimerQty(
	qty: ProcessedTimer["quantity"],
	unit?: string,
	raw?: string,
): string {
	const u = unit ? ` ${unit}` : "";
	// A refused timer has no quantity, only what the author wrote.
	if ((qty === undefined || qty === null) && raw) return raw.trim();
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

function getTempValue(token: ProcessedTemperature): TemperatureValue | null {
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
	return {
		value,
		unit: token.unit ?? "°",
		range,
		...(token.note ? { note: token.note } : {}),
	};
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

function isProcessedCheckpoint(token: StepToken): token is ProcessedCheckpoint {
	return (
		typeof token === "object" &&
		token !== null &&
		"type" in token &&
		token.type === "checkpoint"
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
	// An ingredient bought in two units is two shopping entries of one id
	// (500 g here, 2 cups there): each entry is compared, not only the last
	// one of each id.
	const toMap = (list: ShoppingItem[]) => {
		const map = new Map<string, SimpleShoppingItem[]>();
		for (const item of flattenShoppingItems(list)) {
			const entries = map.get(item.id) ?? [];
			entries.push(item);
			map.set(item.id, entries);
		}
		return map;
	};

	const aMap = toMap(a);
	const bMap = toMap(b);
	const allIds = new Set([...aMap.keys(), ...bMap.keys()]);
	const deltas: IngredientDelta[] = [];

	for (const id of allIds) {
		for (const [aItem, bItem] of pairByUnit(
			aMap.get(id) ?? [],
			bMap.get(id) ?? [],
		)) {
			const delta = diffIngredient(id, aItem, bItem);
			if (delta) deltas.push(delta);
		}
	}

	return deltas;
}

/**
 * The entries of one ingredient on both sides, paired: same unit first
 * (`cup` and `cups` are one unit), then what is left in order (a unit that
 * changed), then the entries only one side has.
 */
function pairByUnit(
	a: SimpleShoppingItem[],
	b: SimpleShoppingItem[],
): [SimpleShoppingItem | null, SimpleShoppingItem | null][] {
	const pairs: [SimpleShoppingItem | null, SimpleShoppingItem | null][] = [];
	const bLeft = [...b];
	const aLeft: SimpleShoppingItem[] = [];
	for (const aItem of a) {
		const unit = normalizeUnit(aItem.unit);
		const index = bLeft.findIndex(
			(bItem) => normalizeUnit(bItem.unit) === unit,
		);
		if (index === -1) {
			aLeft.push(aItem);
			continue;
		}
		pairs.push([aItem, bLeft[index] ?? null]);
		bLeft.splice(index, 1);
	}
	const rest = Math.max(aLeft.length, bLeft.length);
	for (let i = 0; i < rest; i++)
		pairs.push([aLeft[i] ?? null, bLeft[i] ?? null]);
	return pairs;
}

function diffIngredient(
	id: string,
	aItem: SimpleShoppingItem | null,
	bItem: SimpleShoppingItem | null,
): IngredientDelta | null {
	if (aItem && !bItem) {
		return {
			id,
			name: aItem.name || id,
			change: "removed",
			fromQty: numericQty(aItem) ?? undefined,
			fromUnit: aItem.unit ?? null,
			...texts(aItem, null),
		};
	}
	if (!aItem && bItem) {
		return {
			id,
			name: bItem.name || id,
			change: "added",
			toQty: numericQty(bItem) ?? undefined,
			toUnit: bItem.unit ?? null,
			...texts(null, bItem),
		};
	}
	if (!aItem || !bItem) return null;

	const aQty = numericQty(aItem);
	const bQty = numericQty(bItem);
	const aUnit = aItem.unit ?? null;
	const bUnit = bItem.unit ?? null;

	const sameUnit = normalizeUnit(aUnit) === normalizeUnit(bUnit);

	// Same middle, other bounds (`2-4 g` → `1-5 g`) is a change too.
	const sameRange =
		(aItem as ShoppingListItem).range?.min ===
			(bItem as ShoppingListItem).range?.min &&
		(aItem as ShoppingListItem).range?.max ===
			(bItem as ShoppingListItem).range?.max;
	if (aQty === bQty && sameUnit && sameRange) return null;

	const delta: IngredientDelta = {
		id,
		name: bItem.name || id,
		change: "changed",
		fromQty: aQty ?? undefined,
		fromUnit: aUnit,
		toQty: bQty ?? undefined,
		toUnit: bUnit,
		...texts(aItem, bItem),
	};

	if (aQty !== null && bQty !== null && sameUnit && aQty !== 0) {
		delta.percentChange = Math.round(((bQty - aQty) / aQty) * 100);
	}

	return delta;
}

// The four times a diff reports, all read from the default timeline (mise en
// place right before each section, the shortest rests): the same on both sides,
// which is all a comparison needs. The active time is the schedule's, which
// plans a timer written as a range on its longest figure, so changing the range
// of a cooking time shows; `metrics.activeTime` (the average) is deprecated.
function timingsOf(
	recipe: CompilationResult,
): Record<TimingDelta["field"], number> {
	const { totalTime, idleTime } = scheduleTimes(recipe);
	const schedule = scheduleFor(recipe);
	return {
		totalTime,
		idleTime,
		activeTime: schedule?.activeTime ?? recipe.metrics?.activeTime ?? 0,
		preparationTime:
			schedule?.preparationTime ?? recipe.metrics?.preparationTime ?? 0,
	};
}

function diffTimings(
	a: CompilationResult,
	b: CompilationResult,
): TimingDelta[] {
	const fields: readonly TimingDelta["field"][] = [
		"totalTime",
		"idleTime",
		"activeTime",
		"preparationTime",
	];
	const from = timingsOf(a);
	const to = timingsOf(b);
	const deltas: TimingDelta[] = [];
	for (const field of fields) {
		if (from[field] !== to[field]) {
			deltas.push({ field, from: from[field], to: to[field] });
		}
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

/** A delta of `diffStepTokens`, the shape the timer, temperature and target state deltas share. */
type StepTokenDelta<V> = {
	section: string | null;
	name?: string;
	change: "added" | "removed" | "changed";
	from?: V;
	to?: V;
};

/**
 * The deltas of one kind of step token (timers, temperatures, target
 * states), section by section: named tokens are paired by name, the others
 * by position (`matchTokenPairs`), and a pair is a change when its name or
 * its value differs. A token whose value is `null` (a temperature in words)
 * is never reported as added or removed.
 */
function diffStepTokens<T extends StepToken & { name?: string }, V>(
	aSections: ProcessedSection[],
	bSections: ProcessedSection[],
	isMatch: (token: StepToken) => token is T,
	compared: (token: T) => V | null,
): StepTokenDelta<V>[] {
	const aMap = extractTokensByType(aSections, isMatch);
	const bMap = extractTokensByType(bSections, isMatch);
	const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
	const deltas: StepTokenDelta<V>[] = [];

	for (const key of allKeys) {
		const section = key.startsWith("__pos_") ? null : key;
		const pairs = matchTokenPairs(aMap.get(key) ?? [], bMap.get(key) ?? []);

		for (const [a, b] of pairs) {
			const from = a ? compared(a) : null;
			const to = b ? compared(b) : null;
			const name = b?.name ?? a?.name;
			const named = name !== undefined ? { name } : {};
			if (!a && to !== null) {
				deltas.push({ section, ...named, change: "added", to });
			} else if (!b && from !== null) {
				deltas.push({ section, ...named, change: "removed", from });
			} else if (a && b) {
				const nameChanged = (a.name ?? null) !== (b.name ?? null);
				if (nameChanged || JSON.stringify(from) !== JSON.stringify(to)) {
					deltas.push({
						section,
						...named,
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

function diffTemperatures(
	aSections: ProcessedSection[],
	bSections: ProcessedSection[],
): TemperatureDelta[] {
	return diffStepTokens(
		aSections,
		bSections,
		isProcessedTemperature,
		getTempValue,
	);
}

function diffTimers(
	aSections: ProcessedSection[],
	bSections: ProcessedSection[],
): TimerDelta[] {
	return diffStepTokens(aSections, bSections, isProcessedTimer, (t) =>
		// A proportional time: its ratio as written, so changing the ratio
		// shows, and the duration it comes to when it is known.
		t.ratio
			? t.quantity !== undefined
				? `${t.ratio.raw} (${fmtTimerQty(t.quantity, t.unit)})`
				: t.ratio.raw
			: fmtTimerQty(t.quantity, t.unit, t.raw),
	);
}

// Target states have no name: paired by position in their section.
function diffCheckpoints(
	aSections: ProcessedSection[],
	bSections: ProcessedSection[],
): CheckpointDelta[] {
	return diffStepTokens(aSections, bSections, isProcessedCheckpoint, (t) => ({
		state: t.state,
		...(t.note ? { note: t.note } : {}),
	}));
}

const SKIP_TOKEN_TYPES = new Set([
	"declaration",
	"timer",
	"temperature",
	"checkpoint",
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
	const timings = diffTimings(a, b);
	const sections = diffSections(aSections, bSections);
	const meta = diffMeta(
		(a.meta ?? {}) as Record<string, unknown>,
		(b.meta ?? {}) as Record<string, unknown>,
	);
	const temperatures = diffTemperatures(aSections, bSections);
	const timers = diffTimers(aSections, bSections);
	const checkpoints = diffCheckpoints(aSections, bSections);
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
			checkpoints.length > 0 ||
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
		checkpoints,
		modules,
	};
}
