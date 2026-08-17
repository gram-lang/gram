import {
	ASTNodeType,
	type RecipeAST,
	type StepAST,
	type ReferenceAST,
	type ImportDecl,
	type Meta,
} from "@gram-lang/parser";
import {
	WarningCode,
	pushWarning,
	getNumericQty,
	round2,
	type Warning,
} from "@gram-lang/kitchen";
import { normalizeUnit, UNIT_CONVERSIONS } from "@gram-lang/i18n";
import { convertUnit } from "@gram-lang/analyzer";
import type {
	AnalyzedCompilationResult,
	AnalyzedSection,
	MassMetrics,
} from "@gram-lang/analyzer";
import type { ExportInfo } from "./exports";

// --- §D.1: parsing a declared `yields:` frontmatter key ---

export interface ParsedYieldSpec {
	value: number;
	// null for a bare count ("yields: 4") — no unit at all, a pure multiple
	// of the whole module.
	unit: string | null;
}

const YIELD_VALUE_RE = /^(\d+(?:\.\d+)?)\s*(.*)$/;

function parseYieldString(raw: string): ParsedYieldSpec | null {
	const m = raw.trim().match(YIELD_VALUE_RE);
	if (!m) return null;
	const value = parseFloat(m[1]!);
	const unit = m[2]?.trim() || null;
	if (!Number.isFinite(value) || value <= 0) return null;
	return { value, unit };
}

/**
 * Parses the `yields:` frontmatter key (§D.1): a scalar ("500g", "24
 * cookies") applies to the module's default export, keyed here as
 * "default"; the array form (`[blancs:100g, jaunes:50g]` — the same
 * bracketed-list syntax already used by `densities:`, the only form the
 * (non-YAML) frontmatter grammar can represent) keys each entry by the
 * module's own export name.
 */
export function parseDeclaredYields(meta: Meta): Map<string, ParsedYieldSpec> {
	const result = new Map<string, ParsedYieldSpec>();
	const raw = meta.yields;
	if (raw === undefined) return result;

	if (typeof raw === "string") {
		const parsed = parseYieldString(raw);
		if (parsed) result.set("default", parsed);
		return result;
	}

	raw.forEach((entry) => {
		const idx = entry.indexOf(":");
		if (idx === -1) return;
		const name = entry.slice(0, idx).trim();
		const parsed = parseYieldString(entry.slice(idx + 1));
		if (parsed && name) result.set(name, parsed);
	});
	return result;
}

// --- §D.1: measuring an export's yield when it isn't declared ---

export type UnitFamily = "mass" | "volume" | "discrete";

function classifyUnit(unit: string | null): UnitFamily {
	if (!unit) return "discrete";
	const normalized = normalizeUnit(unit);
	if (normalized in UNIT_CONVERSIONS.mass.map) return "mass";
	if (normalized in UNIT_CONVERSIONS.volume.map) return "volume";
	return "discrete";
}

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
	let mass = sec.metrics.totalMass;
	let status = sec.metrics.massStatus;

	sec.ingredients.forEach((ing) => {
		if (ing.type !== "reference" || !ing.name) return;
		const targetIndex = sections.findIndex(
			(s) => s.intermediate_preparation === ing.name,
		);
		if (targetIndex === -1 || targetIndex === index) return;
		const sub = massOfSection(sections, targetIndex, visiting);
		mass += sub.mass;
		status = worseStatus(status, sub.status);
	});

	visiting.delete(index);
	return { mass: round2(mass), status };
}

export interface ResolvedYield {
	value: number;
	// "" for a declared bare count; "g" for every measured (undeclared) yield
	// — totalMass is always in grams.
	unit: string;
	family: UnitFamily;
	status: MassMetrics["massStatus"];
}

/**
 * Resolves the yield of one export (§D.1): a declared `yields:` entry is
 * authoritative and skips measurement entirely (the stated perf benefit of
 * declaring it); otherwise falls back to the recursive mass computation.
 *
 * Deliberately uses the *same* recursive formula for every export, including
 * "default" — the RFC's own text calls out `metrics.totalMass` (a flat,
 * whole-module sum) as sufficient for the default case specifically, but
 * that's only true when the default's section already covers the whole
 * module's mass with no reference chain leading outside it. The recursive
 * form is a strict superset: it reduces to the same flat sum whenever that
 * assumption holds, and stays correct when it doesn't (a multi-section
 * module where the default section only *references* an earlier one).
 */
export function resolveYield(
	analyzed: AnalyzedCompilationResult,
	exportInfo: ExportInfo,
	requestedKey: string,
	declaredYields: Map<string, ParsedYieldSpec>,
): ResolvedYield {
	const declared =
		declaredYields.get(requestedKey) ?? declaredYields.get(exportInfo.name);
	if (declared) {
		return {
			value: declared.value,
			unit: declared.unit ?? "",
			family: classifyUnit(declared.unit),
			status: "precise",
		};
	}

	const { mass, status } = massOfSection(
		analyzed.sections,
		exportInfo.sectionIndex,
		new Set(),
	);
	return { value: mass, unit: "g", family: "mass", status };
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
 * Reconciles one request against the yield's unit family (§D.2's table):
 * same-family converts directly; a bare number against a discrete
 * (named-count) yield is taken as-is; a bare number against a mass/volume
 * yield is a batch multiplier (`request * yieldValue`, so the caller's
 * `sum / yieldValue` division below comes back out to exactly the batch
 * count); anything else needing a cross-family bridge goes through
 * `convertUnit` and its density. Returns `null` on a genuine mismatch —
 * the caller turns that into MODULE_UNIT_MISMATCH.
 */
function convertRequestToYieldUnit(
	req: QtyRequest,
	yieldVal: ResolvedYield,
	options: { density?: number; lang?: string },
): number | null {
	if (req.unit === null) {
		if (yieldVal.family === "discrete") return req.value;
		return req.value * yieldVal.value;
	}
	if (yieldVal.family === "discrete") return req.value;
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
	declaredYields: Map<string, ParsedYieldSpec>,
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

		const yieldVal = resolveYield(
			analyzed,
			info,
			binding.exported,
			declaredYields,
		);
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
			if (req.unit === null && yieldVal.family !== "discrete") sawBatch = true;
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
