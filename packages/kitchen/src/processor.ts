import {
	minifyQuantity,
	createCleanUsage,
	quantityToMinutes,
	nextUsageId,
} from "./utils";
import {
	type ASTNode,
	type SectionAST,
	type StepAST,
	type CommentAST,
	type IngredientAST,
	type CookwareAST,
	type AlternativeAST,
	type ReferenceAST,
	type IntermediateDecl,
	type TimerAST,
	type TemperatureAST,
	type TextAST,
	ASTNodeType,
	type Location,
} from "@gram-lang/parser";
import type {
	Context,
	ProcessedSection,
	ProcessedStep,
	Usage,
	ProcessedStepItem,
	StepToken,
	ProcessedTimer,
	ProcessedTemperature,
	ProcessedComment,
	RetroPlanning,
	TimeBreakdownItem,
} from "./types";
import type { CompilerOptions } from "./core";
import type { RecipeRegistry } from "./registry";
import { resolveTimeUnit } from "@gram-lang/i18n";
import { WarningCode, pushWarning } from "./warnings";
import { detectIntermediateCycles } from "./graph";
import {
	scheduleALAP,
	serializeTracks,
	rebaseAndCommit,
	type StepSchedule,
} from "./schedule";

export interface ProcessorContext extends Context {
	options?: CompilerOptions;
}

// Canonical i18n time-unit keys (see @gram-lang/i18n's resolveTimeUnit),
// mapped to the display unit used in compiled output. Shared between ~timer
// and retro-planning (audit 2026-07-22, finding F-005) so a display value
// change or a `resolveTimeUnit` alias addition can't drift between the two —
// previously ~timer normalized "m"/"minutes" to "min" by hand and left every
// other alias (mins, h, heures, ...) untouched, producing up to 4 different
// display strings for 2 physical units in the same compiled document.
const TIME_UNIT_DISPLAY: Record<string, "d" | "h" | "min" | "s"> = {
	d: "d",
	h: "h",
	m: "min",
	s: "s",
};

function checkModifiers(
	ctx: ProcessorContext,
	modifiers: string[],
	itemName: string,
	loc?: Location,
) {
	if (!modifiers) return;

	const seen = new Set<string>();
	for (const m of modifiers) {
		if (seen.has(m)) {
			pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
				item: itemName,
				combination: `Duplicated modifier '${m}'`,
				loc,
			});
		}
		seen.add(m);
	}

	const hasOpt = modifiers.includes("?");
	const hasImp = modifiers.includes("*");
	const hasHid = modifiers.includes("-");
	const hasRef = modifiers.includes("&");

	if (hasOpt && hasImp) {
		pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
			item: itemName,
			combination: "Optional (?) and Important (*)",
			loc,
		});
	}
	if (hasHid && hasImp) {
		pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
			item: itemName,
			combination: "Hidden (-) and Important (*)",
			loc,
		});
	}
	if (hasHid && hasRef) {
		pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, {
			item: itemName,
			combination: "Hidden (-) and Referenceable (&)",
			loc,
		});
	}
}

export type ProcessedBlockResult = StepToken;

function processIngredient(
	item: IngredientAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
): Usage {
	checkModifiers(ctx, item.modifiers, item.name, item.loc);

	const defaultUnit =
		(item.quantity && "unit" in item.quantity && item.quantity.unit) ||
		undefined;
	const id = registry.registerIngredient(
		item.name,
		defaultUnit ? { default_unit: defaultUnit } : undefined,
	);

	// Tag composite ingredients linked to a parent sub-recipe
	if (item.composite) {
		const parentId = registry.registerIngredient(item.composite.parent, {
			is_composite: true,
		});
		registry.registerIngredient(item.name, {
			is_composite: true,
			parent: parentId,
		});
	}

	// Process RelativeQuantity nodes (e.g. 50% of another ingredient/variable)
	if (item.quantity && item.quantity.type === ASTNodeType.RelativeQuantity) {
		const rel = item.quantity;
		const targetName = rel.target;
		const targetId = registry.getIngredientId(targetName);
		const percent = rel.percent;

		let isGhost = false;
		const formulaStr = `${percent}% of ${targetName}`;

		if (rel.referenceType === "variable") {
			if (!ctx.definedIntermediates.has(targetName)) {
				isGhost = true;
				pushWarning(ctx, WarningCode.VARIABLE_NOT_FOUND, {
					targetName,
					item: item.name,
					loc: item.loc,
				});
			}
		} else {
			const found = secIngredients.some((i) => i.id === targetId);
			if (!found) {
				isGhost = true;
				pushWarning(ctx, WarningCode.RELATIVE_QUANTITY_UNRESOLVED, {
					targetName,
					item: item.name,
					loc: item.loc,
				});
			}
		}

		const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
		usage.qty = item.quantity; // Defer evaluation to analyzer
		usage.unit = null;

		if (targetId === id) {
			usage.isCircular = true;
			pushWarning(ctx, WarningCode.CIRCULAR_REFERENCE, {
				name: item.name,
				item: item.name,
				loc: item.loc,
			});
		}

		usage.dependencies = [targetId];
		usage.formula = {
			raw: formulaStr,
			target: targetName,
			percent: percent,
			isGhost: isGhost,
		};

		secIngredients.push(usage);
		return usage;
	}

	const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
	if (item.modifiers?.includes("&")) {
		if (!ctx.seenNames.has(item.name)) {
			pushWarning(ctx, WarningCode.UNDEFINED_REFERENCE, {
				prefix: "@&",
				name: item.name,
				item: item.name,
				loc: item.loc,
			});
		}
		if (ctx.definedIntermediates.has(item.name))
			ctx.usedIntermediates.add(item.name);
	} else {
		ctx.seenNames.add(item.name);
	}

	const hasQuantityValue = !!(
		item.quantity &&
		((item.quantity.type === ASTNodeType.Quantity &&
			(item.quantity.value !== null || item.quantity.unit !== null)) ||
			item.quantity.type === ASTNodeType.TextQuantity)
	);

	if (!item.modifiers?.includes("&") || hasQuantityValue) {
		secIngredients.push(usage);
	}

	return usage;
}

function processCookware(
	item: CookwareAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secCookware: Usage[],
): Usage {
	checkModifiers(ctx, item.modifiers, item.name, item.loc);

	const id = registry.registerCookware(item.name);
	const usage = createCleanUsage(item, id, ctx.usageCounter, ctx.options);
	secCookware.push(usage);
	return usage;
}

function processAlternative(
	item: AlternativeAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
	secCookware: Usage[],
): Usage {
	const processedOptions: ProcessedBlockResult[] = [];
	const tempIngredientsScope = [...secIngredients];
	const tempCookwareScope = [...secCookware];

	item.options.forEach((opt) => {
		const captureIngredients = [...tempIngredientsScope];
		const captureCookware = [...tempCookwareScope];

		const result = processBlockItem(
			opt,
			ctx,
			registry,
			captureIngredients,
			captureCookware,
		);
		if (result !== null) {
			processedOptions.push(result);

			if (typeof result !== "string") {
				// Audit 2026-07-22, kitchen finding F-016: createCleanUsage
				// never sets `.type` on a plain ingredient/cookware Usage, so
				// `r.type === "ingredient"/"drink"/"cookware"` above were
				// dead branches — "drink" doesn't appear anywhere else in
				// the codebase. `opt.type` (the *AST* node, not the
				// processed Usage) is the reliable discriminant that was
				// available here all along.
				const r = result as Usage;
				if (opt.type === ASTNodeType.Cookware) {
					tempCookwareScope.push(r);
				} else {
					tempIngredientsScope.push(r);
				}
			}
		}
	});

	const usage: Usage = {
		id: "alternative",
		type: "alternative",
		options: processedOptions,
	};

	const firstOption = item.options[0];
	if (firstOption) {
		if (firstOption.type === ASTNodeType.Ingredient) {
			secIngredients.push(usage);
		} else if (firstOption.type === ASTNodeType.Cookware) {
			secCookware.push(usage);
		}
	}
	return usage;
}

function processReference(
	item: ReferenceAST,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
): Usage {
	// singleWordName stops at spaces but not punctuation, so "&crust." captures the trailing dot.
	// Strip trailing sentence punctuation before resolving the reference.
	const cleanName = item.name.replace(/[.,!?;:]+$/, "");
	const id = registry.getIngredientId(cleanName);
	if (!registry.ingredients.has(id)) {
		pushWarning(ctx, WarningCode.UNDEFINED_REFERENCE, {
			prefix: "&",
			name: cleanName,
			item: cleanName,
			loc: item.loc,
		});
	}
	if (ctx.definedIntermediates.has(cleanName))
		ctx.usedIntermediates.add(cleanName);

	const obj: Usage = {
		type: "reference",
		id,
		name: cleanName,
		_usageId: nextUsageId(ctx.usageCounter),
	};

	if (item.quantity) {
		if (item.quantity.type === ASTNodeType.Quantity) {
			if (item.quantity.value !== null || item.quantity.unit) {
				const cleanQty = minifyQuantity(item.quantity);
				if (cleanQty !== undefined) obj.qty = cleanQty;
				if (item.quantity.unit) obj.unit = item.quantity.unit;
			}
		} else if (item.quantity.type === ASTNodeType.TextQuantity) {
			obj.qty = item.quantity.value;
		}
	}

	if (!ctx.currentSectionIntermediates.has(cleanName)) {
		secIngredients.push(obj);
	}

	return obj;
}

function processIntermediateDecl(
	item: IntermediateDecl,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
): ProcessedBlockResult {
	const id = registry.registerIngredient(item.name, { is_intermediate: true });
	ctx.intermediateDecl = id;
	ctx.currentSectionIntermediates.add(item.name);
	return { type: "declaration", name: item.name, id };
}

function processTimer(
	item: TimerAST,
	ctx: ProcessorContext,
): ProcessedBlockResult {
	const obj: ProcessedTimer = { type: "timer" };
	if (item.name) obj.name = item.name;
	if (item.isPassive) obj.isPassive = true;
	if (item.quantity) {
		const q = item.quantity;
		if (q.type === ASTNodeType.Quantity) {
			if (!q.unit) {
				pushWarning(ctx, WarningCode.MISSING_UNIT, {
					type: "Timer",
					item: item.name || "Timer",
					loc: item.loc,
				});
			} else {
				const unit = TIME_UNIT_DISPLAY[resolveTimeUnit(q.unit)];
				if (!unit) {
					// Audit 2026-07-22, finding F-006: an unrecognized unit
					// (e.g. "3 bananas") used to fall through
					// quantityToMinutes' d/h/m/s checks and be silently
					// treated as plain minutes. Emitting INVALID_UNIT
					// (matching processTemperature/processRetroPlanning) and
					// leaving `quantity`/`unit` unset means this timer
					// contributes zero duration instead of a fabricated one —
					// the same "degrade to nothing, never guess" choice
					// processRetroPlanning already makes.
					pushWarning(ctx, WarningCode.INVALID_UNIT, {
						type: "Timer",
						value: q.unit,
						loc: item.loc,
					});
				} else {
					if (q.value) obj.quantity = q.value;
					obj.unit = unit;
				}
			}
		} else if (q.type === ASTNodeType.TextQuantity) {
			pushWarning(ctx, WarningCode.INVALID_UNIT, {
				type: "Timer",
				value: q.value,
				loc: item.loc,
			});
			// A plain string, not a fake QuantityValueAST-shaped object —
			// ProcessedTimer.quantity already has a `string` arm for exactly
			// this case (audit 2026-07-22, parser finding I4: QuantityValueAST
			// becoming a real discriminated union stopped this ad-hoc
			// `{type:"text", value}` object from structurally qualifying).
			obj.quantity = q.value;
		}
	}
	return obj;
}

/**
 * Only Celsius and Fahrenheit are supported. Accepts the unit with or
 * without the leading degree sign, case-insensitively, and normalizes to
 * the canonical `°C`/`°F` spelling regardless of how it was written.
 */
const TEMPERATURE_UNIT_PATTERN = /^°?([cf])$/i;

function normalizeTemperatureUnit(unit: string): string | null {
	const letter = TEMPERATURE_UNIT_PATTERN.exec(unit.trim())?.[1];
	return letter ? `°${letter.toUpperCase()}` : null;
}

function processTemperature(
	item: TemperatureAST,
	ctx: ProcessorContext,
): ProcessedBlockResult {
	const obj: ProcessedTemperature = { type: "temperature" };
	if (item.name) obj.name = item.name;
	if (item.text) {
		obj.text = item.text;
	} else {
		if (item.value) obj.quantity = item.value;
		if (item.unit) {
			const normalized = normalizeTemperatureUnit(item.unit);
			if (normalized) {
				obj.unit = normalized;
			} else {
				pushWarning(ctx, WarningCode.INVALID_UNIT, {
					type: "Temperature",
					value: item.unit,
					loc: item.loc,
				});
				obj.unit = item.unit;
			}
		} else {
			pushWarning(ctx, WarningCode.MISSING_UNIT, {
				type: "Temperature",
				item: item.name || "Temperature",
				loc: item.loc,
			});
		}
	}
	return obj;
}

// Retro-planning accepts the same units as ~timer (see TIME_UNIT_DISPLAY)
// except seconds, which don't make sense for a section scheduling offset.
const RETRO_PLANNING_UNIT_DISPLAY: Record<string, "d" | "h" | "min"> =
	Object.fromEntries(
		Object.entries(TIME_UNIT_DISPLAY).filter(([, v]) => v !== "s"),
	) as Record<string, "d" | "h" | "min">;

function processRetroPlanning(
	section: SectionAST,
	ctx: ProcessorContext,
): RetroPlanning | undefined {
	const rp = section.retroPlanning;
	if (!rp) return undefined;

	const item = section.title || "Section";

	// Retro-planning only makes sense as anticipation ("prepare N time before
	// the rest") — a zero or positive offset has no clear meaning here, unlike
	// ~timer where a plain duration is the whole point. So instead of a
	// separate check per failure shape, everything that isn't a strictly
	// negative signed duration collapses into the same MISSING_UNIT warning.
	if (rp.value === null || rp.value === 0 || rp.sign !== -1 || !rp.unit) {
		pushWarning(ctx, WarningCode.MISSING_UNIT, {
			type: "RetroPlanning",
			item,
			loc: section.loc,
		});
		return { raw: rp.raw };
	}

	const resolved = resolveTimeUnit(rp.unit);
	const unit = RETRO_PLANNING_UNIT_DISPLAY[resolved];
	if (!unit) {
		pushWarning(ctx, WarningCode.INVALID_UNIT, {
			type: "RetroPlanning",
			value: rp.unit,
			loc: section.loc,
		});
		return { raw: rp.raw };
	}

	return {
		raw: rp.raw,
		sign: rp.sign,
		value: rp.value,
		unit,
		minutes: quantityToMinutes({ value: rp.value, unit: resolved }) * rp.sign,
	};
}

function processText(item: TextAST): ProcessedBlockResult {
	return item.value;
}

function processComment(item: CommentAST): ProcessedBlockResult {
	return { type: "comment", value: item.value, kind: item.kind };
}

// Audit 2026-07-22, parser finding I3: `ASTNode` now (correctly) also
// includes CompositeAST/QuantityAST/TextQuantityAST/RelativeQuantityAST,
// which only ever appear *nested* inside an Ingredient/Cookware/Reference/
// Timer node, never directly as a step's own child — narrowed to the real
// invariant (`StepAST["children"][number]`, which already covers both call
// sites: a step's own children, and an Alternative's `IngredientAST |
// CookwareAST` options) instead of the too-broad `ASTNode`, so the
// exhaustiveness check below stays meaningful.
export function processBlockItem(
	item: StepAST["children"][number] | null | undefined,
	ctx: ProcessorContext,
	registry: RecipeRegistry,
	secIngredients: Usage[],
	secCookware: Usage[],
): ProcessedBlockResult | null {
	if (!item) return null;

	switch (item.type) {
		case ASTNodeType.Ingredient:
			return processIngredient(
				item as IngredientAST,
				ctx,
				registry,
				secIngredients,
			);
		case ASTNodeType.Cookware:
			return processCookware(item as CookwareAST, ctx, registry, secCookware);
		case ASTNodeType.Alternative:
			return processAlternative(
				item as AlternativeAST,
				ctx,
				registry,
				secIngredients,
				secCookware,
			);
		case ASTNodeType.Reference:
			return processReference(
				item as ReferenceAST,
				ctx,
				registry,
				secIngredients,
			);
		case ASTNodeType.IntermediateDecl:
			return processIntermediateDecl(item as IntermediateDecl, ctx, registry);
		case ASTNodeType.Text:
			return processText(item as TextAST);
		case ASTNodeType.Timer:
			return processTimer(item as TimerAST, ctx);
		case ASTNodeType.Temperature:
			return processTemperature(item as TemperatureAST, ctx);
		case ASTNodeType.Comment:
			return processComment(item as CommentAST);
		default: {
			const _exhaustiveCheck: never = item;
			throw new Error(
				`Unhandled AST node type: ${(_exhaustiveCheck as { type?: string })?.type}`,
			);
		}
	}
}

/**
 * Main structural step/section processor.
 * Builds global scopes, registers intermediate recipe variables, schedules steps,
 * handles passive background tasks, and calculates active and total duration metrics.
 */
export function processSections(
	astChildren: ASTNode[],
	registry: RecipeRegistry,
	options?: CompilerOptions,
): {
	sections: ProcessedSection[];
	metrics: {
		idleTime: number;
		activeTime: number;
		activeBreakdown: TimeBreakdownItem[];
		totalBreakdown: TimeBreakdownItem[];
	};
} {
	const ctx: ProcessorContext = {
		warnings: registry.warnings,
		intermediateDecl: null,
		seenNames: new Set(),
		definedIntermediates: new Set(),
		usedIntermediates: new Set(),
		currentSectionIntermediates: new Set(),
		globalScopes: new Map(),
		usageCounter: { value: 0 },
		options,
	};

	const sections: ProcessedSection[] = [];
	let blocksToProcess: ASTNode[] = astChildren;

	// Group all top-level steps and comments into an implicit default section
	const topLevelBlocks: ASTNode[] = [];
	const actualSections: ASTNode[] = [];

	for (const child of astChildren) {
		if (child.type === ASTNodeType.Section) {
			actualSections.push(child);
		} else {
			topLevelBlocks.push(child);
		}
	}

	blocksToProcess = [...actualSections];
	if (topLevelBlocks.length > 0) {
		blocksToProcess.unshift({
			type: ASTNodeType.Section,
			title: null,
			children: topLevelBlocks,
		} as SectionAST);
	}

	const globalSchedules: StepSchedule[] = [];
	// Parallel to `sections`, kept only to recover a `.loc` for warnings raised
	// by the schedule module (see ./schedule) — `ProcessedSection` is the JSON
	// output shape and doesn't carry source locations.
	const sectionASTs: SectionAST[] = [];
	let globalActiveTime = 0;

	// --- PHASE 1: Forward Pass (Estimation & Flattening) ---
	blocksToProcess.forEach((node, sectionIndex) => {
		const sectionAST = node as SectionAST;
		sectionASTs.push(sectionAST);
		ctx.currentSectionIntermediates.clear();

		if (sectionAST.intermediateDecl) {
			const varName = sectionAST.intermediateDecl.name;
			if (ctx.globalScopes.has(varName)) {
				pushWarning(registry.warnings, WarningCode.SCOPE_CONFLICT, {
					varName,
					section: sectionAST.title,
					loc: sectionAST.intermediateDecl?.loc,
				});
			} else {
				ctx.globalScopes.set(varName, sectionAST.title || "");
			}
			registry.registerIngredient(varName, { is_intermediate: true });
			ctx.definedIntermediates.add(varName);
			ctx.currentSectionIntermediates.add(varName);
		}

		const sectionIngredients: Usage[] = [];
		const sectionCookware: Usage[] = [];
		const steps: ProcessedStepItem[] = [];

		const res: ProcessedSection = {
			title: sectionAST.title,
			ingredients: sectionIngredients,
			cookware: sectionCookware,
			steps,
		};

		if (sectionAST.intermediateDecl) {
			res.intermediate_preparation = sectionAST.intermediateDecl.name;
		}

		if (sectionAST.retroPlanning) {
			res.retro_planning = processRetroPlanning(sectionAST, ctx);
		}

		sections.push(res);

		sectionAST.children.forEach((block) => {
			if (block.type === ASTNodeType.Step) {
				let localActiveTime = 0;
				const stepPassiveTasks: StepSchedule["passiveTasks"] = [];
				const stepContentObjects: StepToken[] = [];
				const produced: string[] = [];
				const consumed: string[] = [];

				ctx.intermediateDecl = null;

				block.children.forEach((item) => {
					const processed = processBlockItem(
						item,
						ctx,
						registry,
						sectionIngredients,
						sectionCookware,
					);

					if (processed) {
						if (Array.isArray(processed)) {
							stepContentObjects.push(...processed);
						} else {
							stepContentObjects.push(processed);

							if (typeof processed !== "string" && "type" in processed) {
								if (processed.type === "reference" && processed.name) {
									consumed.push(processed.name);
								} else if (processed.type === "declaration" && processed.name) {
									produced.push(processed.name);
								} else if (
									processed.type === "timer" &&
									!("id" in processed) &&
									processed.quantity
								) {
									const duration = quantityToMinutes({
										value: processed.quantity,
										unit: processed.unit,
									});
									if (processed.isPassive) {
										stepPassiveTasks.push({
											name: processed.name || "Timer",
											duration: duration,
											localOffset: localActiveTime,
											isNamed: !!processed.name,
											// Only set for genuinely named tracks — left undefined
											// for anonymous passive timers so the renderer's own
											// localized "Timer" fallback applies instead of a
											// hardcoded English string baked into the JSON.
											sourceName: processed.name || undefined,
										});
									} else {
										localActiveTime += duration;
									}
								}
							}
						}
					}
				});

				if (localActiveTime === 0 && stepPassiveTasks.length === 0) {
					localActiveTime = 2;
				}

				let productionTime = localActiveTime;
				for (const task of stepPassiveTasks) {
					productionTime = Math.max(
						productionTime,
						task.localOffset + task.duration,
					);
				}

				const stepObj: ProcessedStep = {
					type: "step",
					content: stepContentObjects,
					timings: { start: 0, end: 0, activeDuration: localActiveTime },
					backgroundTasks: [],
				};
				if (block.action) stepObj.action = block.action;
				if (ctx.intermediateDecl) {
					stepObj.intermediate_preparation = ctx.intermediateDecl;
				}

				steps.push(stepObj);
				globalSchedules.push({
					sectionIndex,
					stepObj,
					isComment: false,
					localActiveTime,
					productionTime,
					produced,
					consumed,
					passiveTasks: stepPassiveTasks,
					ls: 0,
					lf: 0,
				});

				globalActiveTime += localActiveTime;
			} else if (block.type === ASTNodeType.Comment) {
				const commentObj: ProcessedComment = {
					type: "comment",
					value: block.value,
					kind: block.kind,
				};
				steps.push(commentObj);
				globalSchedules.push({
					sectionIndex,
					stepObj: commentObj,
					isComment: true,
					localActiveTime: 0,
					productionTime: 0,
					produced: [],
					consumed: [],
					passiveTasks: [],
					ls: 0,
					lf: 0,
				});
			}
		});
	});

	// Audit 2026-07-22, kitchen finding F-012: `detectCycles` (./graph, used by
	// the shopping list for ingredient-formula dependencies) never saw the
	// language's other dependency domain — section-level `->&produced` /
	// `&consumed` intermediates — so an indirect cycle (`&a -> &b -> &a`)
	// went completely undetected. Same algorithm, fed the intermediate graph.
	const intermediateCycles = detectIntermediateCycles(sections);
	for (const name of intermediateCycles) {
		const decl = sectionASTs.find(
			(s) => s.intermediateDecl?.name === name,
		)?.intermediateDecl;
		pushWarning(registry.warnings, WarningCode.CIRCULAR_REFERENCE, {
			name,
			item: name,
			loc: decl?.loc,
		});
	}

	// Phases 2-4 (ALAP backward pass, named-track re-serialization, rebase +
	// commit) live in ./schedule — extracted so each is independently
	// unit-testable on synthetic StepSchedule arrays, without going through
	// the parser (audit 2026-07-22, kitchen finding F-004/P-001).
	scheduleALAP(globalSchedules, sections, sectionASTs, registry.warnings);
	const scheduledPassiveTasks = serializeTracks(
		globalSchedules,
		sections,
		sectionASTs,
		registry.warnings,
	);
	const metrics = rebaseAndCommit(
		globalSchedules,
		scheduledPassiveTasks,
		sections,
		globalActiveTime,
	);

	return { sections, metrics };
}
