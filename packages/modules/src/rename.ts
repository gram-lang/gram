import {
	ASTNodeType,
	type SectionAST,
	type StepAST,
	type ImportBinding,
} from "@gram-lang/parser";
import { slugify } from "@gram-lang/kitchen";
import type { ExportInfo } from "./exports";

/**
 * Every intermediate name declared anywhere in a (already grouped) section
 * tree — both the section's own `->&` and any step-level one nested in its
 * steps. Used to find the "private and unbound-public" set that Phase C.2
 * needs to prefix: everything that isn't one of this import's own bound
 * names.
 */
function collectIntermediateNames(sections: SectionAST[]): Set<string> {
	const names = new Set<string>();
	sections.forEach((section) => {
		if (section.intermediateDecl) names.add(section.intermediateDecl.name);
		section.children.forEach((child) => {
			if (child.type !== ASTNodeType.Step) return;
			(child as StepAST).children.forEach((c) => {
				if (c.type === ASTNodeType.IntermediateDecl) names.add(c.name);
			});
		});
	});
	return names;
}

/**
 * Builds the name → name rewrite table for one `@use` splice (Phase C.2):
 * a bound export (the module's own `->&x` matched by one of this import's
 * bindings) is renamed directly to the host's chosen local name; every
 * other intermediate — private (step-level) or public but not bound by
 * *this* import — is prefixed with the first binding's local name, joined
 * by `$` (a separator that never appears in a real ingredient/intermediate
 * name, since `slugify` collapses it away before it could ever collide with
 * one — see the post-slugify collision check in `checkRenameCollisions`,
 * the actual safety net).
 */
export function buildRenameTable(
	sections: SectionAST[],
	exports: Map<string, ExportInfo>,
	bindings: ImportBinding[],
): Map<string, string> {
	const table = new Map<string, string>();
	const prefix = bindings[0]?.local ?? "module";

	for (const binding of bindings) {
		const info = exports.get(binding.exported);
		if (!info) continue; // unresolved binding — caller raises MODULE_EXPORT_NOT_FOUND
		table.set(info.name, binding.local);
	}

	collectIntermediateNames(sections).forEach((name) => {
		if (!table.has(name)) table.set(name, `${prefix}$${name}`);
	});

	return table;
}

/**
 * Rewrites every intermediate name in a (structurally cloned) section tree
 * according to `table`. Touches exactly the four places an intermediate
 * name can appear (Phase C.2): a section's own `->&` declaration, a
 * step-level `->&` declaration, a `&name` reference, and the target of a
 * `50% of &name` relative-quantity formula. Never touches ingredient
 * (`@name`) or cookware (`#name`) names — those stay global on purpose
 * (Phase C.1).
 */
export function applyRename(
	sections: SectionAST[],
	table: Map<string, string>,
): SectionAST[] {
	const cloned = structuredClone(sections);
	const rename = (name: string) => table.get(name) ?? name;

	cloned.forEach((section) => {
		if (section.intermediateDecl) {
			section.intermediateDecl.name = rename(section.intermediateDecl.name);
		}
		section.children.forEach((child) => {
			if (child.type !== ASTNodeType.Step) return;
			(child as StepAST).children.forEach((c) => {
				if (c.type === ASTNodeType.IntermediateDecl) {
					c.name = rename(c.name);
				} else if (c.type === ASTNodeType.Reference) {
					c.name = rename(c.name);
				} else if (c.type === ASTNodeType.Ingredient) {
					if (
						c.quantity &&
						c.quantity.type === ASTNodeType.RelativeQuantity &&
						c.quantity.referenceType === "variable"
					) {
						c.quantity.target = rename(c.quantity.target);
					}
				} else if (c.type === ASTNodeType.Alternative) {
					c.options.forEach((opt) => {
						if (
							opt.type === ASTNodeType.Ingredient &&
							opt.quantity &&
							opt.quantity.type === ASTNodeType.RelativeQuantity &&
							opt.quantity.referenceType === "variable"
						) {
							opt.quantity.target = rename(opt.quantity.target);
						}
					});
				}
			});
		});
	});

	return cloned;
}

/**
 * The post-rename safety net (Phase C.2): no separator survives
 * `slugify` (it collapses any run of non-alphanumerics to one hyphen), so
 * `pate$paton`, `pate·paton`, and `pate--paton` all produce the same id
 * `pate-paton` — choosing an "unlikely" separator protects nothing. This
 * checks the *slugified* result of every renamed name against a running set
 * of ids already claimed (by the host or by an earlier-spliced module) and
 * returns the names that collide, for the caller to turn into a
 * SCOPE_CONFLICT rather than silently merging two distinct intermediates.
 */
export function checkRenameCollisions(
	renamedNames: Iterable<string>,
	claimedIds: Set<string>,
): string[] {
	const collisions: string[] = [];
	for (const name of renamedNames) {
		const id = slugify(name);
		if (claimedIds.has(id)) {
			collisions.push(name);
		} else {
			claimedIds.add(id);
		}
	}
	return collisions;
}
