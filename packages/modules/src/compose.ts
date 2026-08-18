import {
	ASTNodeType,
	type RecipeAST,
	type SectionAST,
	type StepAST,
	type IngredientAST,
	type ImportBinding,
	type Location,
	type Meta,
} from "@gram-lang/parser";
import {
	compile,
	scaleAst,
	slugify,
	cleanRegistryName,
	WarningCode,
	pushWarning,
	type Warning,
	type ModuleInfo,
	type CompilationResult,
	type DeferredImport,
} from "@gram-lang/kitchen";
import {
	analyze,
	convertUnit,
	type AnalyzedCompilationResult,
	type IngredientData,
} from "@gram-lang/analyzer";
import type { ModuleGraph } from "./host";
import { computeExports, type ExportInfo } from "./exports";
import { buildRenameTable, applyRename, checkRenameCollisions } from "./rename";
import {
	parseDeclaredYields,
	computeScaleFactor,
	resolveYield,
	type ParsedYieldSpec,
} from "./yield";

export interface ComposeOptions {
	db: Record<string, IngredientData>;
	lang?: string;
	// Yield measurements are memoized by URI — share one Map across a whole
	// `gram build`/`gram shop` run (Phase F.1) so a base imported by 50
	// recipes is compiled+analyzed once, not 50 times. Callers own the
	// Map's lifetime; this package never keeps a module-level singleton.
	cache?: Map<string, AnalyzedCompilationResult>;
	// URIs (already resolved, matching what `ModuleHost.resolve()` produces —
	// never a raw specifier string) the reader already has on hand for this
	// particular build/shop invocation. Resolution and CLI-arg parsing are
	// the caller's job (`packages/cli`) — this package stays free of
	// argv/config-file concerns.
	stock?: Set<string>;
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
	// Per-slug synthetic `ingredients.yaml`-shaped entries for every stocked
	// leaf, derived from the imported module's own real composition — merged
	// into the analyzer's `database` argument by the caller (never mutated
	// here) so a stocked import's mass/nutrition keeps counting toward the
	// host's totals despite never being spliced into the timeline.
	syntheticIngredients: Record<string, IngredientData>;
	// The subset of `options.stock` that actually matched a `@use` somewhere
	// in this composition — lets the caller warn once, at the end of a whole
	// glob-driven invocation, about a `--stock` entry that never matched
	// anything (UNUSED_STOCK_SPECIFIER, a CLI-level diagnostic).
	usedStock: Set<string>;
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

/**
 * The mass (in grams) `computeScaleFactor` actually scaled the module
 * against for one binding: the declared `yields:` entry when present
 * (converted to grams for a mass-family yield), else the same recursive
 * section-mass measurement `resolveYield` itself falls back to. `null` for
 * a discrete/volume yield (`yields: 24 cookies`) — a stocked import's
 * nutrition then falls back to the module's flat `totalMass`, same as
 * before this existed.
 *
 * This matters because a declared `yields:` doesn't have to exactly match
 * the sum of the module's own ingredient masses (a recipe author's rounded
 * "about 500g" against ingredients that actually sum to 553g, say) —
 * `factor` is computed against the *declared* value, not the measured one,
 * so a stocked import's nutrition has to extrapolate against that same
 * value too, or it drifts from what inlining-then-scaling the same module
 * would have produced.
 */
function resolveYieldMassGrams(
	analyzed: AnalyzedCompilationResult,
	exportInfo: ExportInfo,
	requestedKey: string,
	declaredYields: Map<string, ParsedYieldSpec>,
	lang: string | undefined,
): number | null {
	const yieldVal = resolveYield(
		analyzed,
		exportInfo,
		requestedKey,
		declaredYields,
	);
	if (yieldVal.family !== "mass") return null;
	if (yieldVal.unit === "g") return yieldVal.value;
	return convertUnit(yieldVal.value, yieldVal.unit, "g", undefined, lang);
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
 * A `--stock`ed import ("stock" mechanism, module-imports RFC redesign)
 * splices nothing at all: zero timeline cost, one synthetic shopping-list
 * leaf sourced from the module's own real composition. A non-stocked import
 * carrying `@use`-level `~{...}` retro-planning gets that clause attached to
 * the section(s) that actually produce its bound export(s), letting ALAP's
 * normal backward chaining pull the whole sub-timeline along with it.
 */
export function composeRecipe(
	graph: ModuleGraph,
	options: ComposeOptions,
): ComposeResult {
	const warnings: Warning[] = [...graph.diagnostics];
	const analyzedCache =
		options.cache ?? new Map<string, AnalyzedCompilationResult>();
	const resolved = new Map<string, Resolved>();
	// Accumulated across *every* uri in `graph.order`, not per-record — a
	// `--stock`ed import declared deep inside a transitively-imported module
	// (A imports B normally, B imports stocked C) has no spliced section to
	// carry its `ModuleInfo`/synthetic ingredient forward through
	// `sectionOrigins` the way an inline splice does, so these three are
	// threaded straight into the final `ComposeResult` instead.
	const syntheticIngredients: Record<string, IngredientData> = {};
	const stockedInfos: ModuleInfo[] = [];
	const usedStock = new Set<string>();

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
		const deferredImports: DeferredImport[] = [];
		const prepended: SectionAST[] = [];
		const prependedOrigins: (ModuleInfo | undefined)[] = [];
		// Scoped to *this* record's own imports, not shared across the whole
		// compose() call: two unrelated modules can each independently import
		// the same dependency under the same local name (e.g. both `b.gram`
		// and `c.gram` doing `@use "./d.gram" as &d`) without colliding —
		// each is renamed again, relative to *its own* local name, the next
		// time it's spliced further up. A collision only actually matters
		// among the bindings *this* record itself is splicing side by side.
		const claimedIds = new Set<string>();

		for (const { decl, uri: depUri } of record.imports) {
			const dep = resolved.get(depUri);
			if (!dep) {
				// Failed to load (diagnostic already recorded in graph.diagnostics) —
				// keep the decl so kitchen's own §C.4 degraded path registers the
				// binding as a plain intermediate instead of cascading
				// UNDEFINED_REFERENCE for every use of it in this document.
				deferredImports.push(decl);
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

			const isStocked = options.stock?.has(depUri) ?? false;

			const info: ModuleInfo = {
				binding: validBindings[0]!.local,
				uri: depUri,
				title: depModuleTitle,
				meta: depMeta,
				scaleFactor: factor,
				mode: isStocked ? "stocked" : "inline",
			};

			if (isStocked) {
				usedStock.add(depUri);

				if (decl.retroPlanning) {
					pushWarning(warnings, WarningCode.STOCKED_RETRO_PLANNING_IGNORED, {
						specifier: decl.specifier,
						loc: decl.loc,
					});
				}

				validBindings.forEach((binding) => {
					if (slugify(cleanRegistryName(binding.local)) in options.db) {
						pushWarning(
							warnings,
							WarningCode.MODULE_BINDING_SHADOWS_INGREDIENT,
							{
								binding: binding.local,
								specifier: decl.specifier,
								loc: decl.loc,
							},
						);
					}
				});

				// No AST splice at all — zero timeline cost. The binding still
				// registers (as `is_module_synthetic`, via kitchen's degraded
				// registration path) once this record's own `deferredImports`
				// land on `composedAst.imports` below.
				deferredImports.push({
					type: ASTNodeType.ImportDecl,
					specifier: decl.specifier,
					bindings: validBindings,
					stocked: true,
					title: depModuleTitle,
					loc: decl.loc,
				});

				if (validBindings.length > 1) {
					pushWarning(
						warnings,
						WarningCode.STOCKED_DESTRUCTURED_NUTRITION_BLENDED,
						{ specifier: decl.specifier, loc: decl.loc },
					);
				}

				const depTotalMass = depAnalyzed.metrics.totalMass;
				const depNutrition = depAnalyzed.metrics.nutrition;
				// `basis.mass` is `accountedMass` (analyzer/nutrition.ts): the mass
				// of only the base's own ingredients that actually carry nutrition
				// data, which can be less than the base's full `totalMass`
				// whenever one of its ingredients has no database entry.
				const depAccountedMass = depNutrition?.basis?.mass;
				// The *same* basis `factor` (this import's own scale factor, a few
				// lines above) was computed against — only sound for a single
				// binding, though: each export has its *own* yield basis (an
				// undeclared one is measured per-section, not module-wide), and a
				// destructured import already blends every bound export's mass
				// into one shared profile (STOCKED_DESTRUCTURED_NUTRITION_BLENDED).
				// Picking one export's own basis there would apply *its* yield to
				// every other export's own usage too — worse than the flat
				// `depTotalMass` the blended case already accepts as approximate.
				const primaryExportInfo =
					validBindings.length === 1
						? dep.exports.get(validBindings[0]!.exported)
						: undefined;
				const yieldBasisMass =
					(primaryExportInfo &&
						resolveYieldMassGrams(
							depAnalyzed,
							primaryExportInfo,
							validBindings[0]!.exported,
							depDeclaredYields,
							options.lang,
						)) ??
					depTotalMass;
				if (
					depNutrition?.per100g &&
					depAccountedMass !== undefined &&
					yieldBasisMass > 0
				) {
					// Deliberately not `depNutrition.per100g` as-is, on two counts:
					// 1. It's per 100 g of `accountedMass`, not of `yieldBasisMass` —
					//    rescale by `accountedMass / yieldBasisMass` first so a
					//    missing-nutrition-data ingredient's share of the mass isn't
					//    silently assumed to carry the same density as the rest.
					// 2. `yieldBasisMass` itself — not `depTotalMass` — is what
					//    `factor` (and thus the *inlined* splice) actually scales
					//    against; a declared `yields:` doesn't have to exactly equal
					//    the sum of the module's own ingredient masses (a rounded
					//    "about 500g" against ingredients that measure 553g, say),
					//    and extrapolating against the wrong one of the two drifts
					//    from what inlining the same base and scaling it to the same
					//    amount would produce.
					// Together these keep a stocked import's contribution within one
					// rounding step of its inlined-and-scaled equivalent — the
					// invariant the module-imports docs promise ("switching --stock
					// on or off never changes what the recipe is").
					const nutritionPerYieldBasis = Object.fromEntries(
						Object.entries(depNutrition.per100g).map(([key, value]) => [
							key,
							value * (depAccountedMass / yieldBasisMass),
						]),
					) as typeof depNutrition.per100g;

					validBindings.forEach((binding) => {
						syntheticIngredients[slugify(cleanRegistryName(binding.local))] = {
							name: binding.local,
							nutrition: nutritionPerYieldBasis,
							// Discrete/bare references (`&pate{1}`, `&pate` with no
							// unit) resolve via mass_standardization.ts's `unit_weight`
							// path, not a mass unit — without this, standardizeMass
							// returns null for anything but an explicit mass-unit
							// quantity (`{300g}`), silently dropping the leaf from
							// mass/nutrition totals. Uses the module's real measured
							// mass, not `yieldBasisMass` — a bare/discrete reference is
							// about how much the thing physically weighs, not the
							// (possibly rounded) figure its author declared.
							physical: { unit_weight: depTotalMass },
						};
					});
				}

				stockedInfos.push(info);
			} else {
				const scaledAst = scaleAst(dep.ast, factor);
				const scaledSections = scaledAst.children as SectionAST[];

				validBindings.forEach((binding) => {
					const exportInfo = dep.exports.get(binding.exported);
					if (exportInfo) ensureExportDecl(scaledSections, exportInfo);
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

				// `@use`-level retro-planning (Mechanism B) anchors the section(s)
				// that actually *produce* the bound export(s), not `debakered[0]` —
				// so ALAP's normal backward chaining pulls every earlier section of
				// a multi-section module along with it instead of leaving the
				// producing section stranded near the host's own T-zero.
				if (decl.retroPlanning) {
					const targetIndices = new Set(
						validBindings
							.map((b) => dep.exports.get(b.exported)?.sectionIndex)
							.filter((i): i is number => i !== undefined),
					);
					targetIndices.forEach((i) => {
						const target = debakered[i];
						if (!target) return;
						if (target.retroPlanning) {
							pushWarning(
								warnings,
								WarningCode.RETRO_PLANNING_OVERRIDE_SHADOWED,
								{ specifier: decl.specifier, loc: decl.loc },
							);
						}
						target.retroPlanning = decl.retroPlanning;
					});
				}

				prepended.push(...debakered);
				dep.sectionOrigins.forEach((existing) => {
					prependedOrigins.push(existing ?? info);
				});

				// Prerequisite fix: without this, module B's own deferred/
				// unresolved imports (it importing C itself) are silently
				// dropped when B is spliced into A — any `&c` reference inside
				// B's spliced sections then has nothing registering it once
				// merged into A. No renaming needed: these names are internal to
				// B and untouched by buildRenameTable/applyRename, which only
				// rewrites B's *exported* names.
				//
				// Stamp `.uri` onto a propagated decl's own `.loc` (with `depUri`
				// — the module it's propagated *from*) when it doesn't already
				// carry one: a decl straight out of the parser never has one, so
				// without this, the MODULE_NOT_FOUND (or similar) warning kitchen
				// raises once this propagated decl reaches the degraded
				// registration path loses its cross-file location — colliding
				// (same code + message) with, and silently discarding via
				// `finalizeComposed`'s dedup, the properly-`uri`'d diagnostic
				// `loadModuleGraph` already raised for the exact same failure.
				deferredImports.push(
					...(dep.ast.imports ?? []).map((d) =>
						d.loc && !d.loc.uri ? { ...d, loc: { ...d.loc, uri: depUri } } : d,
					),
				);
			}

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
			imports: deferredImports,
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
			syntheticIngredients: {},
			usedStock: new Set(),
		};
	}

	const modulesByUri = new Map<string, ModuleInfo>();
	entry.sectionOrigins.forEach((origin) => {
		if (origin) modulesByUri.set(origin.uri, origin);
	});
	// Stocked imports never touch `sectionOrigins` (no spliced section to tag)
	// — seeded separately so they still surface in `ComposeResult.modules`
	// (and any renderer badge that reads it), including ones nested deep
	// inside a transitively-imported module.
	stockedInfos.forEach((info) => {
		modulesByUri.set(info.uri, info);
	});

	return {
		ast: entry.ast,
		warnings,
		modules: [...modulesByUri.values()],
		sectionOrigins: entry.sectionOrigins,
		syntheticIngredients,
		usedStock,
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
						mode: origin.mode,
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
		// Omitted (not an empty array) when nothing was actually composed —
		// compile() itself never sets this field, so a no-import document
		// must come out byte-identical to the pre-modules pipeline output
		// (the conformance corpus's whole premise).
		...(compose.modules.length > 0 ? { modules: compose.modules } : {}),
		warnings,
	};
}
