import type { RecipeAST, SectionAST } from "@gram-lang/parser";
import { groupIntoSections } from "@gram-lang/kitchen";

export interface ExportInfo {
	// The identifier as declared by the module itself (its own `->&name`),
	// or the literal "default" when the section picked as the default export
	// has no `->&` of its own to rename from — the composer then attaches a
	// fresh `intermediateDecl` using the host's chosen local binding name
	// directly, rather than renaming an existing one.
	name: string;
	// Index into the module's *grouped* section list (`groupIntoSections`
	// applied to the module's own `ast.children`) — never the raw
	// `ast.children` index, since a module with no section headers at all
	// only has real `SectionAST` nodes after grouping.
	sectionIndex: number;
}

export interface ModuleExports {
	sections: SectionAST[];
	exports: Map<string, ExportInfo>;
}

/**
 * Computes what a module exports (module-imports RFC, Phase A.4): only
 * section-level `->&` declarations are public — step-level intermediates
 * stay private, and so does anything a module merely *imports* itself
 * (deliberately not read from `ctx.globalScopes`, which would also capture
 * import bindings and leak transitive re-exports the module never opted
 * into).
 *
 * The "default" export is deterministic:
 * 1. the module's one and only section-level `->&`, if it has exactly one;
 * 2. otherwise, the *last* section, whether or not it declares its own
 *    `->&` — covering both "no sections were exported at all" and
 *    "multiple were, and none was singled out" the same way, since a
 *    module with several exports still needs *some* answer for
 *    `@use "..." as &name` (no destructuring).
 *
 * Every module contributes at least one section once grouped (§C.5): a
 * module that's just a bare sequence of steps, with no `## heading`
 * anywhere, becomes a single untitled section — never spilled loose into
 * the host's own untitled section.
 */
export function computeExports(ast: RecipeAST): ModuleExports {
	const sections = groupIntoSections(ast.children) as SectionAST[];
	const exports = new Map<string, ExportInfo>();
	const declaredIndices: number[] = [];

	sections.forEach((section, i) => {
		const declName = section.intermediateDecl?.name;
		if (declName) {
			exports.set(declName, { name: declName, sectionIndex: i });
			declaredIndices.push(i);
		}
	});

	if (declaredIndices.length === 1) {
		const idx = declaredIndices[0]!;
		const name = sections[idx]!.intermediateDecl!.name;
		exports.set("default", { name, sectionIndex: idx });
	} else if (sections.length > 0) {
		const idx = sections.length - 1;
		const existingName = sections[idx]?.intermediateDecl?.name;
		exports.set("default", {
			name: existingName ?? "default",
			sectionIndex: idx,
		});
	}

	return { sections, exports };
}
