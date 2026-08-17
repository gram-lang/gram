import { createMemoryHost } from "@gram-lang/modules";
import type { ModuleHost } from "@gram-lang/modules";

// The playground's entry document always lives at this fixed virtual path —
// there's no real filesystem or project root to derive one from, and a
// fixed convention keeps every other piece (the tab bar, the example
// loader, the module-graph entry point) agreeing on where "the recipe
// itself" is without threading a variable through all of them.
export const ENTRY_URI = "/main.gram";

/**
 * The playground's `ModuleHost` (module-imports RFC §B.2): a thin wrapper
 * around `createMemoryHost` over a *snapshot* of the open files. Building a
 * fresh host from a plain `Map` copy on every compile run — rather than
 * closing over the reactive `files` ref directly — keeps Vue's reactivity
 * proxy out of the pure pipeline, and there's no "live buffer vs. disk"
 * duality to reconcile the way the LSP host has: in the playground the VFS
 * *is* the only copy, so a host is only ever asked to read what it was
 * built from.
 */
export function createPlaygroundHost(files: Map<string, string>): ModuleHost {
	return createMemoryHost(files);
}
