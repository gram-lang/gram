import { basename } from "node:path";
import { runPipeline } from "../core/pipeline";
import { fmtNumber } from "../core/format";
import type { IngredientData } from "@gram-lang/analyzer";
import type { RecipeViewModel } from "../types";

function formatMass(grams: number): string {
	if (grams >= 1000) return `${fmtNumber(grams / 1000)} kg`;
	return `${fmtNumber(Math.round(grams), 0)} g`;
}

function formatQty(item: any): string {
	const qty = item.qty;
	if (qty == null) return "";
	if (typeof qty === "number") {
		return item.unit ? `${fmtNumber(qty)} ${item.unit}` : fmtNumber(qty);
	}
	if (typeof qty === "string") return item.unit ? `${qty} ${item.unit}` : qty;
	if (typeof qty === "object") {
		if (qty.value === "TextQuantity" || qty.type === "text")
			return qty.value ?? "";
		if (qty.text) return item.unit ? `${qty.text} ${item.unit}` : qty.text;
		if (qty.value != null) {
			const v =
				typeof qty.value === "number"
					? fmtNumber(qty.value)
					: String(qty.value);
			return item.unit ? `${v} ${item.unit}` : v;
		}
		if (qty.range) {
			const min =
				typeof qty.range.min === "number"
					? fmtNumber(qty.range.min)
					: qty.range.min;
			const max =
				typeof qty.range.max === "number"
					? fmtNumber(qty.range.max)
					: qty.range.max;
			const r = `${min}–${max}`;
			return item.unit ? `${r} ${item.unit}` : r;
		}
	}
	return "";
}

function formatDisplayQty(
	item: any,
	opts: { bakersMathOnly?: boolean },
): string {
	if (item.normalizedMass != null) {
		const massStr = formatMass(item.normalizedMass);
		if (item.bakersPercentage !== undefined) {
			return opts.bakersMathOnly
				? `${item.bakersPercentage}%`
				: `${item.bakersPercentage}% (${massStr})`;
		}
		return massStr;
	}
	return formatQty(item);
}

function tokenToText(item: any, registry: Record<string, any>): string {
	if (typeof item === "string") return item;
	if (!item) return "";
	if (
		item.id &&
		(!item.type ||
			item.type === "ingredient" ||
			item.type === "cookware" ||
			item.type === "reference")
	) {
		return item.alias ?? registry[item.id]?.name ?? item.name ?? item.id;
	}
	switch (item.type) {
		case "text":
			return item.value ?? "";
		case "timer": {
			const q = item.quantity;
			if (!q) return "";
			const val = q.text ?? (q.value != null ? String(q.value) : "");
			return `~${val}${q.unit ?? "min"}`;
		}
		case "temperature": {
			const q = item.quantity;
			if (!q) return item.text ?? "";
			const val = q.text ?? (q.value != null ? String(q.value) : "");
			return `${val}${item.unit ?? "°C"}`;
		}
		case "comment":
		case "declaration":
			return "";
		default:
			return item.value ?? item.name ?? "";
	}
}

function isInlineToken(item: any): boolean {
	if (typeof item === "string") return false;
	if (!item) return false;
	if (item.type === "comment" || item.type === "declaration") return false;
	return true;
}

function stepToText(content: any[], registry: Record<string, any>): string {
	const parts: string[] = [];
	for (let i = 0; i < content.length; i++) {
		const item = content[i];
		const text = tokenToText(item, registry);
		if (!text) continue;

		if (isInlineToken(item) && parts.length > 0) {
			const last = parts[parts.length - 1];
			// Don't add space if preceded by apostrophe or whitespace
			if (last && !/[\s']$/.test(last)) parts.push(" ");
		}

		parts.push(text);

		if (isInlineToken(item)) {
			const next = content[i + 1];
			const nextText = next
				? typeof next === "string"
					? next
					: tokenToText(next, registry)
				: "";
			if (nextText && !/^[\s.,!?:;)]/.test(nextText)) parts.push(" ");
		}
	}
	return parts.join("").trim();
}

function getTimerMinutes(step: any): number | undefined {
	const tasks: any[] = step.backgroundTasks ?? [];
	if (tasks.length > 0) return tasks[0].duration;
	return undefined;
}

export async function buildViewModel(
	file: string,
	opts: {
		db?: Record<string, IngredientData> | null;
		scaleFactor?: number;
		bakersReference?: string;
		bakersMathOnly?: boolean;
	},
): Promise<RecipeViewModel> {
	const { compiled, analyzed } = await runPipeline(file, {
		db: opts.db,
		scaleFactor: opts.scaleFactor,
		bakersReference: opts.bakersReference,
	});

	const title =
		(compiled.meta?.title as string | undefined) ??
		compiled.title ??
		basename(file, ".gram");
	const servings = (compiled.meta?.servings as number | undefined) ?? null;

	const m = compiled.metrics;
	const times =
		m && (m.totalTime || m.idleTime || m.activeTime || m.preparationTime)
			? {
					total: m.totalTime || undefined,
					idle: m.idleTime || undefined,
					active: m.activeTime || undefined,
					prep: m.preparationTime || undefined,
				}
			: null;

	const registry = compiled.registry?.ingredients ?? {};
	const cwRegistry = compiled.registry?.cookware ?? {};

	const sourceSections: any[] = analyzed
		? analyzed.result.sections
		: compiled.sections;
	// Shopping list
	const shoppingList: RecipeViewModel["shoppingList"] = [];
	if (analyzed) {
		for (const item of analyzed.result.shopping_list as any[]) {
			if (item.type === "alternative" || item.variable_entries) continue;
			const name = item.name ?? item.id;
			const displayQty = formatDisplayQty(item, opts);
			if (displayQty) {
				shoppingList.push({
					name,
					displayQty,
					isEstimate: item.isEstimate ?? false,
				});
			}
		}
	} else {
		for (const item of compiled.shopping_list as any[]) {
			if (item.type === "alternative" || item.variable_entries) continue;
			const displayQty = formatDisplayQty(item, opts);
			if (displayQty) {
				shoppingList.push({
					name: item.name ?? item.id,
					displayQty,
					isEstimate: false,
				});
			}
		}
	}

	// Sections
	const sections: RecipeViewModel["sections"] = sourceSections.map((sec) => {
		const secIngs: any[] = sec.ingredients ?? [];

		// Regular (non-composite) ingredients
		const regularEntries: RecipeViewModel["sections"][0]["ingredients"] =
			secIngs
				.filter(
					(ing: any) =>
						!ing.composite && ing.type !== "alternative" && ing.qty != null,
				)
				.map((ing: any) => {
					const name =
						opts.db?.[ing.id]?.name ??
						ing.alias ??
						registry[ing.id]?.name ??
						ing.name ??
						ing.id;
					return {
						name,
						displayQty: formatDisplayQty(ing, opts),
						isEstimate: ing.isEstimate ?? false,
					};
				});

		// Composite ingredients — group children by parent, apply MAX rule for parent qty
		// composite.quantity can be a number OR a fraction/qty object — extract numeric value for MAX comparison
		function compositeNumericValue(q: any): number {
			if (q == null) return 0;
			if (typeof q === "number") return q;
			if (typeof q === "object" && q.value != null) return q.value;
			return 0;
		}
		const parentMap = new Map<
			string,
			{
				name: string;
				maxQtyRaw: any;
				unit?: string;
				children: Array<{ name: string; displayQty: string }>;
			}
		>();
		for (const ing of secIngs.filter((i: any) => i.composite)) {
			const parentName: string = ing.composite.parent;
			const childQtyRaw = ing.composite.quantity ?? null;
			const childUnit: string | undefined = ing.composite.unit ?? undefined;
			if (!parentMap.has(parentName)) {
				parentMap.set(parentName, {
					name: parentName,
					maxQtyRaw: childQtyRaw,
					unit: childUnit,
					children: [],
				});
			}
			const parent = parentMap.get(parentName)!;
			if (
				childQtyRaw != null &&
				compositeNumericValue(childQtyRaw) >
					compositeNumericValue(parent.maxQtyRaw)
			) {
				parent.maxQtyRaw = childQtyRaw;
			}
			const childName =
				opts.db?.[ing.id]?.name ?? registry[ing.id]?.name ?? ing.name ?? ing.id;
			const childDisplayQty = formatDisplayQty(
				{
					qty: childQtyRaw,
					unit: childUnit,
					normalizedMass: ing.normalizedMass,
					bakersPercentage: ing.bakersPercentage,
				},
				opts,
			);
			parent.children.push({ name: childName, displayQty: childDisplayQty });
		}
		const compositeEntries: RecipeViewModel["sections"][0]["ingredients"] =
			Array.from(parentMap.values()).map((p) => ({
				name: p.name,
				displayQty: formatDisplayQty({ qty: p.maxQtyRaw, unit: p.unit }, opts),
				isEstimate: false,
				children: p.children,
			}));

		const ingredients: RecipeViewModel["sections"][0]["ingredients"] = [
			...regularEntries,
			...compositeEntries,
		];

		const steps: RecipeViewModel["sections"][0]["steps"] = [];
		for (const step of (sec.steps ?? []) as any[]) {
			if (step.type === "comment") continue;
			const text = stepToText(step.content ?? [], registry);
			if (!text) continue;
			steps.push({
				action: step.action ?? undefined,
				text,
				timerMinutes: getTimerMinutes(step),
				_tokens: step.content ?? [],
			});
		}

		return { title: sec.title ?? null, ingredients, steps };
	});

	const nutrition = analyzed?.result.metrics?.nutrition ?? null;
	const missingIngredients = analyzed?.missingIngredients ?? [];

	return {
		title,
		servings,
		times,
		shoppingList,
		sections,
		nutrition,
		missingIngredients,
		_registries: { ingredients: registry, cookware: cwRegistry },
	};
}
