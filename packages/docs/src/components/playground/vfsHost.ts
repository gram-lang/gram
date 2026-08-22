import { createMemoryHost } from "@gram-lang/modules";
import type { ModuleHost } from "@gram-lang/modules";

// Default virtual path used when creating a blank recipe scratchpad.
export const DEFAULT_ENTRY_URI = "/blank.gram";
export const ENTRY_URI = DEFAULT_ENTRY_URI;

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
