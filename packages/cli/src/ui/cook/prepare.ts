import type { CompilationResult } from "@gram-lang/kitchen";
import {
	quantityToMinutes,
	aggregateSectionIngredients,
} from "@gram-lang/kitchen";
import { splitDuration } from "../../core/format";
import type { RecipeData, FlatStep, CookTimer } from "./types";

// Shared quantity formatter: preserves fraction text ('1/2', '2/3') and adds space before unit
export function fmtQty(item: { qty?: any; unit?: string | null }): string {
	if (item.qty == null) return "";
	const q = item.qty;
	let display: string;
	if (typeof q === "number") {
		display = String(q);
	} else if (typeof q === "object" && q !== null) {
		display = q.text ?? (q.value != null ? String(q.value) : "");
	} else {
		display = String(q);
	}
	const unit = item.unit ?? "";
	return unit ? ` ${display} ${unit}` : ` ${display}`;
}

export function fmtCountdown(remainingMs: number): string {
	const { h, m, s } = splitDuration(Math.ceil(remainingMs / 1000));
	if (h > 0)
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Returns true when showing ≈ mass is useful (unit is not already a metric mass unit)
export function shouldShowMass(unit?: string | null): boolean {
	return unit == null || !/^(g|kg|mg)$/i.test(unit);
}

export function fmtMass(g: number): string {
	if (g >= 1000) return `${+(g / 1000).toFixed(1)} kg`;
	if (g >= 10) return `${Math.round(g)} g`;
	return `${+g.toFixed(1)} g`;
}

function quantityToMs(qty: any): number {
	return quantityToMinutes(qty) * 60_000;
}

function extractTimers(
	step: any,
	sectionIdx: number,
	stepIdx: number,
): CookTimer[] {
	const timers: CookTimer[] = [];
	const seen = new Set<string>();

	// 1. backgroundTasks (async timers ~_name{})
	if (Array.isArray(step.backgroundTasks)) {
		step.backgroundTasks.forEach((t: any, i: number) => {
			const id = `${sectionIdx}-${stepIdx}-bg-${i}`;
			const name = t.name ?? `Timer step ${stepIdx + 1}`;
			if (!seen.has(name)) {
				seen.add(name);
				timers.push({ id, name, durationMs: (t.duration ?? 0) * 60 * 1000 });
			}
		});
	}

	// 2. inline timer tokens in content (~name{})
	if (Array.isArray(step.content)) {
		step.content.forEach((token: any, i: number) => {
			if (token?.type !== "timer") return;
			// Skip passive timers already captured above (isPassive flag)
			if (token.isPassive) return;
			const name = token.name ?? `Timer step ${stepIdx + 1}`;
			if (seen.has(name)) return;
			seen.add(name);
			const id = `${sectionIdx}-${stepIdx}-inline-${i}`;
			timers.push({ id, name, durationMs: quantityToMs(token.quantity) });
		});
	}

	return timers.filter((t) => t.durationMs > 0);
}

export function prepareRecipeData(
	compiled: CompilationResult,
	massMap: Record<string, number> = {},
): RecipeData {
	const steps: FlatStep[] = [];
	let globalIndex = 0;

	compiled.sections.forEach((section, sectionIdx) => {
		const sectionSteps = (section.steps ?? []).filter(
			(s: any) => s.type === "step",
		);
		sectionSteps.forEach((step: any, localIdx: number) => {
			steps.push({
				globalIndex,
				sectionIndex: sectionIdx,
				sectionTitle: section.title,
				isFirstOfSection: localIdx === 0,
				// aggregateSectionIngredients() leaves `.name` unset for ordinary
				// ingredients (createCleanUsage() never populates it) — resolve the
				// display name from the registry here.
				sectionIngredients: aggregateSectionIngredients(
					section.ingredients ?? [],
				).map((ing) => ({
					...ing,
					name:
						compiled.registry.ingredients[ing.id]?.name ?? ing.name ?? ing.id,
				})),
				step,
				timers: extractTimers(step, sectionIdx, globalIndex),
			});
			globalIndex++;
		});
	});

	return {
		title: compiled.title,
		shoppingList: compiled.shopping_list ?? [],
		steps,
		registry: compiled.registry,
		massMap,
	};
}
