import {
	ASTNodeType,
	type RecipeAST,
	type SectionAST,
	type StepAST,
	type IngredientAST,
	type ImportDecl,
	type ImportBinding,
	type Location,
	type Meta,
} from "@gram-lang/parser";
import {
	compile,
	scaleAst,
	WarningCode,
	pushWarning,
	type Warning,
	type ModuleInfo,
	type CompilationResult,
} from "@gram-lang/kitchen";
import {
	analyze,
	type AnalyzedCompilationResult,
	type IngredientData,
} from "@gram-lang/analyzer";
import type { ModuleGraph } from "./host";
import { computeExports, type ExportInfo } from "./exports";
import { buildRenameTable, applyRename, checkRenameCollisions } from "./rename";
import { parseDeclaredYields, computeScaleFactor } from "./yield";

export interface ComposeOptions {
	db: Record<string, IngredientData>;
	lang?: string;
	// Yield measurements are memoized by URI — share one Map across a whole
	// `gram build`/`gram shop` run (Phase F.1) so a base imported by 50
	// recipes is compiled+analyzed once, not 50 times. Callers own the
	// Map's lifetime; this package never keeps a module-level singleton.
	cache?: Map<string, AnalyzedCompilationResult>;
}

export interface ComposeResult {
	ast: RecipeAST;
	warnings: Warning[];
	modules: ModuleInfo[];
	// Aligned 1:1 with `groupIntoSections(ast.children)` — `undefined` for a
	// section that belongs to the entry document itself, a `ModuleInfo` for
	// one spliced in from a module. `finalizeComposed` uses this to tag
	// `ProcessedSection.module` after `compile()` runs, since compiled
	// output carries no location info to correlate a section back to its
	// origin any other way.
	sectionOrigins: (ModuleInfo | undefined)[];
}

// --- small local helpers (kept here rather than as their own module: each
// is a handful of lines, single call site) ---

function levenshtein(a: string, b: string): number {
	const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
		new Array(b.length + 1).fill(i === 0 ? 0 : 0),
	);
	for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
	for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			dp[i]![j] =
				a[i - 1] === b[j - 1]
					? dp[i - 1]![j - 1]!
					: 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
		}
	}
	return dp[a.length]![b.length]!;
}

function fuzzySuggest(name: string, candidates: string[]): string | undefined {
	let best: string | undefined;
	let bestDist = Infinity;
	candidates.forEach((c) => {
		const d = levenshtein(name, c);
		if (d < bestDist) {
			bestDist = d;
			best = c;
		}
	});
	return bestDist <= Math.max(2, Math.ceil(name.length / 3)) ? best : undefined;
}

function stampUri(sections: SectionAST[], uri: string): void {
	const stamp = (node: { loc?: Location }) => {
		if (node.loc) node.loc.uri = uri;
	};
	sections.forEach((section) => {
		stamp(section);
		if (section.intermediateDecl) stamp(section.intermediateDecl);
		section.children.forEach((child) => {
			stamp(child);
			if (child.type === ASTNodeType.Step) {
				(child as StepAST).children.forEach((c) => {
					stamp(c);
				});
			}
		});
	});
}

/** Baker's `*` doesn't survive a module boundary (§D.6) — compile() itself throws on two `*`s in one document, and baker's math for "tart plus imported pastry" has no coherent meaning anyway. */
function dropBakersReference(sections: SectionAST[]): {
	sections: SectionAST[];
	dropped: boolean;
} {
	let dropped = false;
	const cloned = structuredClone(sections);
	const strip = (ing: IngredientAST) => {
		if (ing.modifiers.includes("*")) {
			ing.modifiers = ing.modifiers.filter((m) => m !== "*");
			dropped = true;
		}
	};
	cloned.forEach((section) => {
		section.children.forEach((child) => {
			if (child.type !== ASTNodeType.Step) return;
			(child as StepAST).children.forEach((c) => {
				if (c.type === ASTNodeType.Ingredient) strip(c);
				else if (c.type === ASTNodeType.Alternative) {
					c.options.forEach((opt) => {
						if (opt.type === ASTNodeType.Ingredient) strip(opt);
					});
				}
			});
		});
	});
	return { sections: cloned, dropped };
}

/**
 * A module with no `->&` at all (the common "just a sequence of steps"
 * case) has nothing for the rename table to rename *from* — its default
 * export's `ExportInfo.name` is the literal placeholder `"default"`, which
 * doesn't actually appear anywhere in the section. Synthesizes a real
 * `->&` declaration on that section first, so `buildRenameTable`/
 * `applyRename` have something to find. A no-op when the section already
 * declares one (every named export, and a default that happens to reuse a
 * real one) — `computeExports` (§A.4) only ever leaves this placeholder for
 * the "no `->&` anywhere" case.
 */
function ensureExportDecl(sections: SectionAST[], info: ExportInfo): void {
	const section = sections[info.sectionIndex];
	if (section && !section.intermediateDecl) {
		section.intermediateDecl = {
			type: ASTNodeType.IntermediateDecl,
			name: info.name,
		};
	}
}

function isBindingReferenced(
	children: RecipeAST["children"],
	name: string,
): boolean {
	let found = false;
	const visitStep = (step: StepAST) => {
		step.children.forEach((c) => {
			if (c.type === ASTNodeType.Reference && c.name === name) found = true;
		});
	};
	children.forEach((child) => {
		if (child.type === ASTNodeType.Step) visitStep(child);
		else if (child.type === ASTNodeType.Section) {
			child.children.forEach((c) => {
				if (c.type === ASTNodeType.Step) visitStep(c);
			});
		}
	});
	return found;
}

function parseDensityEntries(meta: Meta): Map<string, string> {
	const raw = meta.densities;
	const entries = Array.isArray(raw)
		? raw
		: typeof raw === "string"
			? [raw]
			: [];
	const map = new Map<string, string>();
	entries.forEach((entry) => {
		const idx = entry.indexOf(":");
		if (idx === -1) return;
		map.set(entry.slice(0, idx).trim(), entry.slice(idx + 1).trim());
	});
	return map;
}

/** Merges a spliced module's `densities:` into the (recursively-)host's own — the host always wins on conflict (§D.6), warned via DENSITY_OVERRIDE_SHADOWED when the values actually differ. */
function mergeDensities(
	hostMeta: Meta,
	depMeta: Meta,
	specifier: string,
	loc: Location | undefined,
	warnings: Warning[],
): Meta {
	const depEntries = parseDensityEntries(depMeta);
	if (depEntries.size === 0) return hostMeta;

	const hostEntries = parseDensityEntries(hostMeta);
	const merged = new Map(hostEntries);
	depEntries.forEach((depValue, ingredient) => {
		const hostValue = merged.get(ingredient);
		if (hostValue === undefined) {
			merged.set(ingredient, depValue);
		} else if (hostValue !== depValue) {
			pushWarning(warnings, WarningCode.DENSITY_OVERRIDE_SHADOWED, {
				ingredient,
				specifier,
				hostValue: parseFloat(hostValue),
				moduleValue: parseFloat(depValue),
				loc,
			});
		}
	});

	return {
		...hostMeta,
		densities: [...merged.entries()].map(([k, v]) => `${k}:${v}`),
	};
}

interface Resolved {
	ast: RecipeAST;
	exports: Map<string, ExportInfo>;
	sectionOrigins: (ModuleInfo | undefined)[];
}

/**
 * Composes a loaded `ModuleGraph` into a single flat `RecipeAST` (Phase C/D
 * of the module-imports RFC): every module is visited leaves-first, its own
 * imports spliced into copies of its own sections first (so a module that
 * itself imports something is already fully self-contained by the time
 * it's someone else's import target), measured (yield, mass) exactly once
 * per URI, and finally spliced into whoever imports it — scaled and
 * renamed *per import site*, since the same module can be imported more
 * than once (a diamond dependency) with different bindings and different
 * requested quantities each time.
 *
 * `prepared` mode (Phase D.4, the "black box" opt-out) isn't implemented
 * yet — out of scope for this pass alongside `@/`/`std:` specifiers, per
 * the RFC's own v0.1/v0.2 split. A `prepared` import is spliced inline
 * instead, which stays *correct* (the schedule and shopping list are still
 * right) even though it doesn't yet hide the module's own step-by-step
 * detail the way the opt-out promises.
 */
export function composeRecipe(
	graph: ModuleGraph,
	options: ComposeOptions,
): ComposeResult {
	const warnings: Warning[] = [...graph.diagnostics];
	const analyzedCache =
		options.cache ?? new Map<string, AnalyzedCompilationResult>();
	const resolved = new Map<string, Resolved>();
	const claimedIds = new Set<string>();

	function getAnalyzed(uri: string): AnalyzedCompilationResult {
		const cached = analyzedCache.get(uri);
		if (cached) return cached;
		const record = resolved.get(uri);
		if (!record)
			throw new Error(
				`@gram-lang/modules: internal error — ${uri} not resolved before measurement`,
			);
		const compiled = compile(record.ast);
		const analyzed = analyze(compiled, options.db, {
			lang: options.lang,
		}).result;
		analyzedCache.set(uri, analyzed);
		return analyzed;
	}

	for (const uri of graph.order) {
		const record = graph.modules.get(uri)!;
		const { sections: ownSections, exports: ownExports } = computeExports(
			record.ast,
		);

		let meta = record.ast.meta;
		const unresolvedImports: ImportDecl[] = [];
		const prepended: SectionAST[] = [];
		const prependedOrigins: (ModuleInfo | undefined)[] = [];

		for (const { decl, uri: depUri } of record.imports) {
			const dep = resolved.get(depUri);
			if (!dep) {
				// Failed to load (diagnostic already recorded in graph.diagnostics) —
				// keep the decl so kitchen's own §C.4 degraded path registers the
				// binding as a plain intermediate instead of cascading
				// UNDEFINED_REFERENCE for every use of it in this document.
				unresolvedImports.push(decl);
				continue;
			}

			const depMeta = graph.modules.get(depUri)!.ast.meta;
			const depModuleTitle =
				typeof depMeta.title === "string" ? depMeta.title : null;

			const validBindings: ImportBinding[] = [];
			for (const binding of decl.bindings) {
				if (dep.exports.has(binding.exported)) {
					validBindings.push(binding);
				} else {
					const available = [...dep.exports.keys()].filter(
						(k) => k !== "default",
					);
					pushWarning(warnings, WarningCode.MODULE_EXPORT_NOT_FOUND, {
						specifier: decl.specifier,
						exported: binding.exported,
						available,
						suggestion: fuzzySuggest(binding.exported, available),
						loc: decl.loc,
					});
				}
			}
			if (validBindings.length === 0) continue;

			if (decl.mode === "prepared" && validBindings.length > 1) {
				pushWarning(warnings, WarningCode.PREPARED_MULTI_EXPORT, {
					specifier: decl.specifier,
					loc: decl.loc,
				});
			}

			const depAnalyzed = getAnalyzed(depUri);
			// yields: belongs to the module being imported, not the importer —
			// `densities:` is the only key `mergeDensities` touches on `dep.ast.meta`,
			// so its own `yields:` is still exactly what that module declared.
			const depDeclaredYields = parseDeclaredYields(dep.ast.meta);
			const factor = computeScaleFactor(
				record.ast.children,
				decl,
				dep.exports,
				depAnalyzed,
				depDeclaredYields,
				{ lang: options.lang },
				warnings,
			);

			validBindings.forEach((binding) => {
				if (!isBindingReferenced(record.ast.children, binding.local)) {
					pushWarning(warnings, WarningCode.UNUSED_IMPORT, {
						local: binding.local,
						specifier: decl.specifier,
						loc: decl.loc,
					});
				}
			});

			const scaledAst = scaleAst(dep.ast, factor);
			const scaledSections = scaledAst.children as SectionAST[];

			validBindings.forEach((binding) => {
				const info = dep.exports.get(binding.exported);
				if (info) ensureExportDecl(scaledSections, info);
			});

			const table = buildRenameTable(
				scaledSections,
				dep.exports,
				validBindings,
			);
			const renamed = applyRename(scaledSections, table);
			const { sections: debakered, dropped } = dropBakersReference(renamed);
			if (dropped) {
				pushWarning(warnings, WarningCode.IMPORTED_BAKERS_REFERENCE_DROPPED, {
					specifier: decl.specifier,
					loc: decl.loc,
				});
			}
			stampUri(debakered, depUri);

			const collisions = checkRenameCollisions(table.values(), claimedIds);
			collisions.forEach((name) => {
				pushWarning(warnings, WarningCode.SCOPE_CONFLICT, {
					varName: name,
					section: depModuleTitle,
					loc: decl.loc,
				});
			});

			const info: ModuleInfo = {
				binding: validBindings[0]!.local,
				uri: depUri,
				title: depModuleTitle,
				meta: depMeta,
				scaleFactor: factor,
				mode: decl.mode,
			};

			prepended.push(...debakered);
			dep.sectionOrigins.forEach((existing) => {
				prependedOrigins.push(existing ?? info);
			});

			meta = mergeDensities(
				meta,
				info.meta,
				decl.specifier,
				decl.loc,
				warnings,
			);
		}

		const offset = prepended.length;
		const shiftedExports = new Map(
			[...ownExports].map(([k, v]) => [
				k,
				{ ...v, sectionIndex: v.sectionIndex + offset },
			]),
		);

		const composedAst: RecipeAST = {
			...record.ast,
			meta,
			imports: unresolvedImports,
			children: [...prepended, ...ownSections],
		};
		const sectionOrigins = [
			...prependedOrigins,
			...ownSections.map(() => undefined),
		];

		resolved.set(uri, {
			ast: composedAst,
			exports: shiftedExports,
			sectionOrigins,
		});
	}

	const entry = resolved.get(graph.entry);
	if (!entry) {
		return {
			ast: { type: ASTNodeType.Recipe, meta: {}, imports: [], children: [] },
			warnings,
			modules: [],
			sectionOrigins: [],
		};
	}

	const modulesByUri = new Map<string, ModuleInfo>();
	entry.sectionOrigins.forEach((origin) => {
		if (origin) modulesByUri.set(origin.uri, origin);
	});

	return {
		ast: entry.ast,
		warnings,
		modules: [...modulesByUri.values()],
		sectionOrigins: entry.sectionOrigins,
	};
}

/**
 * Glue between `composeRecipe`'s output and `compile()`'s: attaches
 * `CompilationResult.modules` and tags each spliced section's
 * `ProcessedSection.module`, matched back to `compose.sectionOrigins` by
 * position — `compile()` preserves section order 1:1 from `ast.children`,
 * so index alignment is reliable even though the compiled shape carries no
 * location info of its own to correlate by.
 */
export function finalizeComposed(
	compiled: CompilationResult,
	compose: Pick<ComposeResult, "modules" | "sectionOrigins" | "warnings">,
): CompilationResult {
	const sections = compiled.sections.map((section, i) => {
		const origin = compose.sectionOrigins[i];
		return origin
			? {
					...section,
					module: {
						binding: origin.binding,
						uri: origin.uri,
						title: origin.title,
					},
				}
			: section;
	});
	// A module that fails to resolve is deliberately still kept on the
	// composed AST's own `imports` (so kitchen's §C.4 degraded path
	// registers the binding and the document keeps compiling) -- which
	// means the *same* MODULE_NOT_FOUND can legitimately be raised twice,
	// once here (graph loading) and once by compile() itself. Deduped by
	// (code, message): a warning's message is a deterministic function of
	// its payload (see warningTemplates), so two entries with the same code
	// and message are the same underlying problem, not two different ones.
	const seen = new Set<string>();
	const warnings = [...compiled.warnings, ...compose.warnings].filter((w) => {
		const key = `${w.code} ${w.message}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	return {
		...compiled,
		sections,
		modules: compose.modules,
		warnings,
	};
}
