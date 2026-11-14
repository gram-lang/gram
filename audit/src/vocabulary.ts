// Generic AST-shape walker, built on the real parser types
// (packages/parser/src/types.ts), not string/regex matching. Used both to
// build the trusted-corpus vocabulary and to compute a given snippet's own
// shape set for comparison. Deliberately mirrors the defensive style already
// fixed in packages/language-server/src/utils/ast-walker.ts (guard
// Array.isArray before recursing) rather than reusing its exports, which are
// collection-specific (collectIngredients/collectReferences/...), not a
// generic walk.

import { parseDuration } from "@gram-lang/i18n";

interface WalkContext {
	inStepScope: boolean;
}

function addModifierKeys(
	modifiers: unknown,
	prefix: string,
	shapes: Set<string>,
): void {
	if (!Array.isArray(modifiers)) return;
	for (const m of modifiers) shapes.add(`${prefix}:modifier=${m}`);
}

// How a duration is written (`1h30` is compound, `1:30 h` a clock, `5'30"`
// primes, `45 min - 1 h` a range), read by the same `parseDuration` as the
// compiler, so a snippet using a form the syntax pages never show is flagged.
// A refused duration adds nothing: its warning is the compiler's business.
function addDurationShapes(raw: unknown, prefix: string, shapes: Set<string>): void {
	if (typeof raw !== "string") return;
	const duration = parseDuration(raw);
	if (!duration.ok) return;
	for (const side of duration.sides) {
		shapes.add(`${prefix}:form=${side.form}`);
		if (side.parts.length > 1) shapes.add(`${prefix}:compound`);
	}
	if (duration.range) shapes.add(`${prefix}:range`);
}

function walk(node: unknown, shapes: Set<string>, ctx: WalkContext): void {
	if (!node || typeof node !== "object") return;

	if (Array.isArray(node)) {
		for (const child of node) walk(child, shapes, ctx);
		return;
	}

	const record = node as Record<string, unknown>;
	const type = record.type;
	if (typeof type === "string") shapes.add(type);

	switch (type) {
		case "Ingredient": {
			addModifierKeys(record.modifiers, "Ingredient", shapes);
			const composite = record.composite as Record<string, unknown> | null | undefined;
			if (composite) {
				shapes.add("Ingredient:hasComposite");
				if (composite.preparation) shapes.add("Ingredient:compositeHasPreparation");
			}
			if (record.preparation) shapes.add("Ingredient:ownHasPreparation");
			break;
		}
		case "Cookware": {
			addModifierKeys(record.modifiers, "Cookware", shapes);
			if (record.preparation) shapes.add("Cookware:hasPreparation");
			break;
		}
		case "Composite": {
			if (record.preparation) shapes.add("Composite:hasPreparation");
			break;
		}
		case "Timer":
			shapes.add(`Timer:isPassive=${Boolean(record.isPassive)}`);
			addDurationShapes(record.raw, "Timer", shapes);
			break;
		case "RelativeQuantity":
			shapes.add(`RelativeQuantity:referenceType=${String(record.referenceType)}`);
			break;
		case "IntermediateDecl":
			shapes.add(ctx.inStepScope ? "IntermediateDecl:step-level" : "IntermediateDecl:section-level");
			break;
		case "Section": {
			const anchor = record.retroPlanning as Record<string, unknown> | null | undefined;
			if (anchor) {
				shapes.add("Section:hasRetroPlanning");
				if (typeof anchor.raw === "string")
					addDurationShapes(anchor.raw.trim().replace(/^-/, ""), "Section:retroPlanning", shapes);
			}
			break;
		}
		default:
			break;
	}

	const childCtx: WalkContext = { inStepScope: type === "Step" || ctx.inStepScope };
	for (const key of Object.keys(record)) {
		if (key === "type" || key === "loc") continue;
		const value = record[key];
		if (Array.isArray(value)) {
			for (const child of value) walk(child, shapes, childCtx);
		} else if (value && typeof value === "object") {
			walk(value, shapes, childCtx);
		}
	}
}

export function collectShapes(ast: unknown): Set<string> {
	const shapes = new Set<string>();
	walk(ast, shapes, { inStepScope: false });
	return shapes;
}
