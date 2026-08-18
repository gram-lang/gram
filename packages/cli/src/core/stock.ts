import { join } from "node:path";
import type { ModuleHost } from "@gram-lang/modules";
import { createCliModuleHost } from "./module-host";

// `fromUri`'s dirname is what a bare relative specifier resolves against
// (`ModuleHost.resolve`'s existing fallback, `module-host.ts:65`) — a
// synthetic `__stock__` "file" inside the terminal's own cwd reuses that
// exact resolution logic for a `--stock ./bases/pate.gram` typed (or
// tab-completed) from the shell, with no new resolution path to maintain.
// `@`-prefixed entries ignore `fromUri` entirely (module-host.ts's own
// `AT_SPECIFIER_RE` branch), so the synthetic value is irrelevant there too.
const STOCK_FROM_URI = () => join(process.cwd(), "__stock__");

/**
 * Resolves a `--stock` flag's comma-split specifiers into the set of module
 * URIs `@gram-lang/modules`'s `composeRecipe` matches against (`depUri`,
 * already-normalized). CLI/argv parsing lives here, not in `@gram-lang/modules`
 * — that package stays free of argv/config-file concerns.
 */
export function resolveStockSet(
	host: ModuleHost,
	specifiers: string[] | undefined,
): Set<string> {
	const set = new Set<string>();
	if (!specifiers) return set;
	specifiers.forEach((specifier) => {
		const trimmed = specifier.trim();
		if (!trimmed) return;
		set.add(host.resolve(trimmed, STOCK_FROM_URI()));
	});
	return set;
}

/**
 * Command-level convenience: splits a citty `--stock` string arg on `,` and
 * resolves it, reusing whatever alias config (`paths:`) the caller already
 * loaded. Every command threading `--stock` calls this instead of
 * hand-rolling the split + host-construction dance.
 */
export function resolveStockArg(
	raw: string | undefined,
	projectRoot: string,
	paths: Record<string, string> | undefined,
): Set<string> | undefined {
	if (!raw) return undefined;
	const host = createCliModuleHost(projectRoot, paths);
	return resolveStockSet(
		host,
		raw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	);
}
