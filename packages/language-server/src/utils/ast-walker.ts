import {
	type RecipeAST,
	type SectionAST,
	type StepAST,
	type IntermediateDecl,
	type ReferenceAST,
	type IngredientAST,
	isIntermediateDecl,
	isReference,
	isIngredient,
	isAlternative,
	isStep,
	isSection,
} from "@gram-lang/parser";

export interface IntermediateDeclWithSection {
	decl: IntermediateDecl;
	section: SectionAST;
	step: StepAST | null;
}

// `RecipeAST.children` isn't always `SectionAST[]` — the grammar's
// implicit-content path (no `## Section`
// header anywhere) and the leading-blocks-before-the-first-header case
// (`Content_explicit`'s optional leading `Block*`) both place `Step`/
// `Comment` nodes directly under `Recipe`. The 3 walkers below used to
// assume every top-level child was a section and read `.children`/
// `.intermediateDecl` off it unconditionally — silently wrong (returned
// nothing) for a bare top-level Step, and a runtime crash for a bare
// top-level Comment (`.children` doesn't exist on `CommentAST`, so
// `for (const block of section.children)` threw).
//
// Per-step intermediate declarations (`->&name{}` written inline in a step)
// on a bare top-level step, with no enclosing Section, are not reachable
// through this walker — `IntermediateDeclWithSection.section` is
// non-nullable, and there is no section to attach; this is an accepted gap
// for the exotic "headerless recipe with an inline intermediate decl" case.

function* iterSectionSteps(
	ast: RecipeAST,
): Generator<{ section: SectionAST; step: StepAST }> {
	for (const section of ast.children) {
		if (!isSection(section)) continue;
		for (const block of section.children) {
			if (isStep(block)) yield { section, step: block };
		}
	}
}

// Unlike iterSectionSteps, also yields a bare top-level step (no enclosing
// Section) — correct for collectReferences/collectIngredients, which don't
// need a section to attach to, unlike IntermediateDeclWithSection.
function* iterAllSteps(ast: RecipeAST): Generator<StepAST> {
	for (const child of ast.children) {
		if (isSection(child)) {
			for (const block of child.children) {
				if (isStep(block)) yield block;
			}
		} else if (isStep(child)) {
			yield child;
		}
	}
}

export function collectIntermediates(
	ast: RecipeAST,
): IntermediateDeclWithSection[] {
	const results: IntermediateDeclWithSection[] = [];
	for (const child of ast.children) {
		if (isSection(child) && child.intermediateDecl) {
			results.push({
				decl: child.intermediateDecl,
				section: child,
				step: null,
			});
		}
	}
	for (const { section, step } of iterSectionSteps(ast)) {
		for (const child of step.children) {
			if (isIntermediateDecl(child)) {
				results.push({ decl: child, section, step });
			}
		}
	}
	return results;
}

export function collectReferences(ast: RecipeAST): ReferenceAST[] {
	const refs: ReferenceAST[] = [];
	for (const step of iterAllSteps(ast)) {
		for (const child of step.children) {
			if (isReference(child)) {
				refs.push(child);
			}
		}
	}
	return refs;
}

// Returns the raw source text of a step, preserving ingredients, cookware, etc.
export function getStepSourceText(step: StepAST, documentText: string): string {
	if (!step.loc) return "";
	return documentText.slice(step.loc.start, step.loc.end).trim();
}

export function collectIngredients(ast: RecipeAST): IngredientAST[] {
	const results: IngredientAST[] = [];
	for (const step of iterAllSteps(ast)) {
		for (const child of step.children) {
			if (isIngredient(child)) {
				results.push(child);
			} else if (isAlternative(child)) {
				for (const opt of child.options) {
					if (isIngredient(opt)) results.push(opt);
				}
			}
		}
	}
	return results;
}

export function findNameAtOffset(
	ast: RecipeAST,
	offset: number,
): { name: string; kind: "decl" | "ref" } | null {
	const refs = collectReferences(ast);
	const ref = refs.find(
		(r) => r.loc && r.loc.start <= offset && offset <= r.loc.end,
	);
	if (ref) return { name: ref.name, kind: "ref" };

	const decls = collectIntermediates(ast);
	const decl = decls.find(
		(d) => d.decl.loc && d.decl.loc.start <= offset && offset <= d.decl.loc.end,
	);
	if (decl) return { name: decl.decl.name, kind: "decl" };

	return null;
}
