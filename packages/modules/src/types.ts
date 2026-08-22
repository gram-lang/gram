import type { Meta } from "@gram-lang/parser";
import type { CompilationResult, ProcessedSection } from "@gram-lang/kitchen";

// One imported module's contribution to a composed document (module-imports
// RFC §D.7): frontmatter of an imported module is never merged into the
// host's own (an author's tags/title/source are not the host recipe's) --
// this is where that information actually goes instead, so a consumer can
// still credit a base's author or display "contains: shortcrust pastry"
// without Gram having to decide the semantics on its behalf.
export interface ModuleInfo {
	binding: string;
	uri: string;
	title: string | null;
	meta: Meta;
	scaleFactor: number;
	mode: "inline" | "stocked";
}

// Set by `finalizeComposed` on every section it splices in from an import,
// for traceability at render time — never set by kitchen's own compile().
// `binding` is the host's local name for the import, `uri` and `title`
// identify the module the section came from. A narrower shape than
// `ModuleInfo` itself (no `meta`/`scaleFactor`): that's all a single spliced
// section needs to credit its origin.
export interface ComposedSection extends ProcessedSection {
	module?: Pick<ModuleInfo, "binding" | "uri" | "title" | "mode">;
}

// The shape `finalizeComposed` (`packages/modules/src/compose.ts`) actually
// returns: kitchen's own `CompilationResult`, plus this package's
// module-composition metadata. Present only when the result came from
// composing one or more `@use` imports — a plain single-file compile has no
// `modules` at all and every section is a plain `ProcessedSection`, so
// `finalizeComposed`'s output stays byte-identical to kitchen's own for a
// no-import document (the conformance corpus's whole premise).
export interface ComposedCompilationResult extends CompilationResult {
	sections: ComposedSection[];
	modules?: ModuleInfo[];
}
