import {
	ASTNodeType,
	type RecipeAST,
	type StepAST,
	type ReferenceAST,
	type ImportDecl,
} from "@gram-lang/parser";
import {
	WarningCode,
	pushWarning,
	getNumericQty,
	round2,
	type Warning,
} from "@gram-lang/kitchen";
import { convertUnit } from "@gram-lang/analyzer";
import type {
	AnalyzedCompilationResult,
	AnalyzedSection,
	MassMetrics,
} from "@gram-lang/analyzer";
import type { ExportInfo } from "./exports";

// --- §D.1: measuring an export's yield ---

const STATUS_RANK: Record<MassMetrics["massStatus"], number> = {
	precise: 0,
	estimated: 1,
	incomplete: 2,
};

function worseStatus(
	a: MassMetrics["massStatus"],
	b: MassMetrics["massStatus"],
): MassMetrics["massStatus"] {
	return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/**
 * `masse(&x) = sec(&x).metrics.totalMass + Σ masse(&y)` for every `&y`
 * referenced in `sec(&x)` (§D.1). Recurses by section *index* at the entry
 * point (an export's section is known positionally, and doesn't
 * necessarily have a name to search by — see `computeExports`'s "default"
 * placeholder) and by produced-name for every reference found inside it
 * (a reference is always spelled by name). Well-founded because
 * `detectIntermediateCycles` (kitchen) already guarantees the `->&`/`&`
 * graph is acyclic; `visiting` is a purely defensive backstop.
 */
function massOfSection(
	sections: AnalyzedSection[],
	index: number,
	visiting: Set<number>,
): { mass: number; status: MassMetrics["massStatus"] } {
	const sec = sections[index];
	if (!sec?.metrics || visiting.has(index)) {
		return { mass: 0, status: "incomplete" };
	}

	visiting.add(index);
	// A section with nothing of its own to measure gets `massStatus:
	// "incomplete"` from analyzer/metrics.ts's own "safe fallback for empty
	// lists" — correct for a section that's genuinely empty, but wrong once a
	// referenced intermediate below actually supplies the mass (a pure
	// "->&pate" delegation section with no ingredients of its own, common
	// now that measuring is the only way to resolve a yield): that local
	// fallback shouldn't poison an otherwise fully-known total. Treat
	// "measured nothing locally" as neutral and let the recursion establish
	// the real status instead, falling back to "incomplete" only if nothing
	// below resolves either.
	const measuredNothingLocally =
		sec.metrics.totalMass === 0 && sec.metrics.massStatus === "incomplete";
	let mass = sec.metrics.totalMass;
	let status = sec.metrics.massStatus;
	let resolvedSomething = false;

	sec.ingredients.forEach((ing) => {
		if (ing.type !== "reference" || !ing.name) return;
		const targetIndex = sections.findIndex(
			(s) => s.intermediate_preparation === ing.name,
		);
		if (targetIndex === -1 || targetIndex === index) return;
		const sub = massOfSection(sections, targetIndex, visiting);
		mass += sub.mass;
		status =
			measuredNothingLocally && !resolvedSomething
				? sub.status
				: worseStatus(status, sub.status);
		resolvedSomething = true;
	});

	visiting.delete(index);
	return { mass: round2(mass), status };
}

export interface ResolvedYield {
	value: number;
	// Always "g" — totalMass is always in grams.
	unit: string;
	status: MassMetrics["massStatus"];
}

/**
 * Measures the yield of one export (§D.1): `masse(&x)`, recursively summing
 * that export's own section plus every section it references by name (see
 * `massOfSection`) — a flat `metrics.totalMass` read is only correct when
 * the export's section already covers the whole module's mass with no
 * reference chain leading outside it; the recursive form is a strict
 * superset, reducing to the same flat sum whenever that assumption holds,
 * and staying correct when it doesn't (a multi-section module where the
 * export's own section only *references* an earlier one).
 */
export function resolveYield(
	analyzed: AnalyzedCompilationResult,
	exportInfo: ExportInfo,
): ResolvedYield {
	const { mass, status } = massOfSection(
		analyzed.sections,
		exportInfo.sectionIndex,
		new Set(),
	);
	return { value: mass, unit: "g", status };
}

// --- §D.2: the scale factor ---

interface QtyRequest {
	value: number;
	unit: string | null;
}

/** Every `&name{qty}` reference in `children`, in document order. A bare `&name` (no `{}` at all) or a text quantity contributes nothing (§D.2 — "mentions de prose"). */
function collectReferenceQuantities(
	children: RecipeAST["children"],
	name: string,
): QtyRequest[] {
	const requests: QtyRequest[] = [];

	function visitRef(ref: ReferenceAST) {
		if (ref.name !== name) return;
		const q = ref.quantity;
		if (!q || q.type !== ASTNodeType.Quantity) return;
		const value = getNumericQty(q.value);
		if (value === null) return;
		requests.push({ value, unit: q.unit ?? null });
	}

	function visitStep(step: StepAST) {
		step.children.forEach((c) => {
			if (c.type === ASTNodeType.Reference) visitRef(c);
		});
	}

	children.forEach((child) => {
		if (child.type === ASTNodeType.Step) visitStep(child);
		else if (child.type === ASTNodeType.Section) {
			child.children.forEach((c) => {
				if (c.type === ASTNodeType.Step) visitStep(c);
			});
		}
	});

	return requests;
}

/**
 * Reconciles one request against the yield's unit (§D.2's table): a bare
 * number is a batch multiplier (`request * yieldValue`, so the caller's
 * `sum / yieldValue` division below comes back out to exactly the batch
 * count); an explicit unit goes through `convertUnit` and its density.
 * Returns `null` on a genuine mismatch — the caller turns that into
 * MODULE_UNIT_MISMATCH.
 */
function convertRequestToYieldUnit(
	req: QtyRequest,
	yieldVal: ResolvedYield,
	options: { density?: number; lang?: string },
): number | null {
	if (req.unit === null) return req.value * yieldVal.value;
	return convertUnit(
		req.value,
		req.unit,
		yieldVal.unit,
		options.density,
		options.lang,
	);
}

export interface ScaleFactorOptions {
	density?: number;
	lang?: string;
}

/**
 * The scale factor for one `@use` (§D.2): `max` over every bound export of
 * (sum of what the host explicitly requests of it) / (that export's
 * yield) — the same sum-within-an-export / max-across-exports pairing
 * Gram already uses for composite ingredients. A binding nobody put a
 * quantity on contributes nothing; if none of them did, the factor is 1.
 * Pushes MODULE_UNIT_MISMATCH / MODULE_BATCH_INTERPRETATION /
 * UNRESOLVED_MODULE_YIELD / ESTIMATED_MODULE_YIELD / MODULE_SURPLUS onto
 * `warnings` as it goes, each carrying `decl.loc` so it points at the
 * `@use` line responsible.
 */
export function computeScaleFactor(
	hostChildren: RecipeAST["children"],
	decl: ImportDecl,
	moduleExports: Map<string, ExportInfo>,
	analyzed: AnalyzedCompilationResult,
	options: ScaleFactorOptions,
	warnings: Warning[],
): number {
	const loc = decl.loc;
	let maxRatio = 0;
	let anyQuantified = false;
	const settled: { local: string; sum: number; yieldVal: ResolvedYield }[] = [];

	for (const binding of decl.bindings) {
		const info = moduleExports.get(binding.exported);
		if (!info) continue; // MODULE_EXPORT_NOT_FOUND already raised by the caller

		const requests = collectReferenceQuantities(hostChildren, binding.local);
		if (requests.length === 0) continue;

		const yieldVal = resolveYield(analyzed, info);
		if (yieldVal.status === "incomplete") {
			pushWarning(warnings, WarningCode.UNRESOLVED_MODULE_YIELD, {
				specifier: decl.specifier,
				binding: binding.local,
				loc,
			});
			continue;
		}
		if (yieldVal.status === "estimated") {
			pushWarning(warnings, WarningCode.ESTIMATED_MODULE_YIELD, {
				specifier: decl.specifier,
				binding: binding.local,
				loc,
			});
		}

		let sum = 0;
		let sawBatch = false;
		for (const req of requests) {
			const converted = convertRequestToYieldUnit(req, yieldVal, options);
			if (converted === null) {
				pushWarning(warnings, WarningCode.MODULE_UNIT_MISMATCH, {
					specifier: decl.specifier,
					binding: binding.local,
					requestedUnit: req.unit ?? "",
					yieldUnit: yieldVal.unit,
					loc,
				});
				continue;
			}
			if (req.unit === null) sawBatch = true;
			sum += converted;
		}
		if (sawBatch && yieldVal.value > 0) {
			pushWarning(warnings, WarningCode.MODULE_BATCH_INTERPRETATION, {
				specifier: decl.specifier,
				binding: binding.local,
				batches: Math.round(sum / yieldVal.value),
				loc,
			});
		}

		anyQuantified = true;
		settled.push({ local: binding.local, sum, yieldVal });
		const ratio = yieldVal.value > 0 ? sum / yieldVal.value : 0;
		maxRatio = Math.max(maxRatio, ratio);
	}

	const factor = anyQuantified && maxRatio > 0 ? maxRatio : 1;

	settled.forEach(({ local, sum, yieldVal }) => {
		const delivered = round2(yieldVal.value * factor);
		const requested = round2(sum);
		if (delivered > requested) {
			const unitSuffix = yieldVal.unit ? ` ${yieldVal.unit}` : "";
			pushWarning(warnings, WarningCode.MODULE_SURPLUS, {
				specifier: decl.specifier,
				binding: local,
				surplus: `${delivered}${unitSuffix} produced, ${requested}${unitSuffix} used`,
				loc,
			});
		}
	});

	return factor;
}
