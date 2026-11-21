/**
 * Two violations with the same signature are the same bug: same invariant,
 * same message once the input-specific parts are blanked, thrown from the
 * same function of the same package.
 */
export function signatureOf(
	invariant: string,
	message: string,
	error?: unknown,
): string {
	const parts = [invariant, normalizeMessage(message)];
	const frame = error instanceof Error ? firstPackageFrame(error.stack) : null;
	if (frame) parts.push(frame);
	return parts.join(" | ");
}

export function normalizeMessage(message: string): string {
	const firstLine = message.split("\n")[0] ?? "";
	return firstLine
		.replace(/"[^"]*"/g, '"…"')
		.replace(/'[^']*'/g, "'…'")
		.replace(/`[^`]*`/g, "`…`")
		.replace(/\d+(\.\d+)?/g, "N")
		.trim();
}

/**
 * `at buildTasks (/…/packages/kitchen/dist/index.js:812:9)` → `kitchen:buildTasks`.
 * Line and column are left out: they change with every rebuild of `dist/`.
 */
export function firstPackageFrame(stack: string | undefined): string | null {
	if (!stack) return null;
	for (const line of stack.split("\n")) {
		const m = line.match(/at (?:(\S+) )?\(?.*\/packages\/([^/]+)\//);
		if (m) return `${m[2]}:${m[1] ?? "<anonymous>"}`;
	}
	return null;
}
