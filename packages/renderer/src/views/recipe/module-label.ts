// Traceability label for a section spliced in from an `@use` import
// (module-imports RFC §D.7) — credits the source module rather than merging
// its own frontmatter (title/author/tags) into the host's, which stays
// exclusively authoritative. A `--stock`ed import splices no section at all,
// so this is only ever reached for `mode: "inline"` imports —
// `CompilationResult.modules.filter(m => m.mode === "stocked")` is the
// future hook for a "view source" link on a stocked import, deliberately
// not implemented in this pass.
export function moduleLabel(mod: {
	title: string | null;
	binding: string;
}): string {
	return mod.title ?? mod.binding;
}
