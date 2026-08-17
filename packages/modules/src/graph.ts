import { getAST, GramParseError, type ImportDecl } from "@gram-lang/parser";
import { WarningCode, pushWarning, type Warning } from "@gram-lang/kitchen";
import type { ModuleHost, ModuleGraph, ModuleRecord } from "./host";

const DEFAULT_MAX_DEPTH = 32;

type SpecifierValidation =
	| { ok: true }
	| {
			ok: false;
			code: WarningCode.MODULE_SCHEME_UNSUPPORTED;
	  }
	| {
			ok: false;
			code: WarningCode.MODULE_SPECIFIER_INVALID;
			reason: string;
	  };

/**
 * Universal rules every host must obey, independent of what "project root"
 * even means for that host (module-imports RFC §B.1). A host's own
 * `resolve()` may reject further (e.g. the CLI host confines a relative
 * path to the project root) — this only rejects the forms no host should
 * ever attempt to resolve at all.
 */
function validateSpecifier(specifier: string): SpecifierValidation {
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(specifier)) {
		return { ok: false, code: WarningCode.MODULE_SCHEME_UNSUPPORTED };
	}
	if (specifier.startsWith("/")) {
		return {
			ok: false,
			code: WarningCode.MODULE_SPECIFIER_INVALID,
			reason: "absolute filesystem paths are not portable",
		};
	}
	if (specifier.startsWith("hub:")) {
		return {
			ok: false,
			code: WarningCode.MODULE_SPECIFIER_INVALID,
			reason: 'the community hub ("hub:...") is not supported yet',
		};
	}
	// "@/rest.gram" (project root) and "@alias/rest.gram" (a `paths:` alias,
	// module-imports RFC §B.1) — actual resolution is host-specific (only the
	// CLI host implements it today), this only accepts the syntactic shape.
	const isAtSpecifier = /^@[^/]*\/.+/.test(specifier);
	if (
		!isAtSpecifier &&
		!specifier.startsWith("./") &&
		!specifier.startsWith("../")
	) {
		return {
			ok: false,
			code: WarningCode.MODULE_SPECIFIER_INVALID,
			reason:
				'expected a relative path starting with "./" or "../", or an "@/"/"@alias/" project path',
		};
	}
	if (!specifier.endsWith(".gram")) {
		return {
			ok: false,
			code: WarningCode.MODULE_SPECIFIER_INVALID,
			reason: 'path imports must end in ".gram"',
		};
	}
	return { ok: true };
}

/**
 * Loads the full transitive import graph starting at `entryUri`. A single
 * depth-first pass: every URI is read and parsed at most once (a diamond —
 * A imports B and C, both import D — loads D once), cycles are detected via
 * the current DFS path rather than the whole visited set (so a diamond
 * isn't mistaken for a cycle), and `order` comes out leaves-first — the
 * order Phase D.1's yield-measurement pass needs, so a module's own
 * imports are always already measured by the time it is.
 *
 * Never throws on a bad module: a missing file, a syntax error, a cycle, or
 * an invalid specifier all become a diagnostic on the graph instead, so one
 * broken import doesn't take down the whole compose. Only `host.resolve`
 * throwing synchronously for a reason unrelated to the module system itself
 * would propagate — hosts are expected to make `resolve` pure path
 * arithmetic that doesn't throw.
 */
export async function loadModuleGraph(
	entryUri: string,
	host: ModuleHost,
	options?: { maxDepth?: number },
): Promise<ModuleGraph> {
	const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
	const modules = new Map<string, ModuleRecord>();
	const diagnostics: Warning[] = [];
	const order: string[] = [];
	const pathStack: string[] = [];

	async function visit(
		uri: string,
		depth: number,
		fromDecl: ImportDecl | undefined,
		fromUri: string | undefined,
	): Promise<void> {
		if (modules.has(uri)) return;

		if (pathStack.includes(uri)) {
			const chainStart = pathStack.indexOf(uri);
			const chain = [...pathStack.slice(chainStart), uri].join(" → ");
			pushWarning(diagnostics, WarningCode.MODULE_CYCLE, {
				chain,
				loc:
					fromDecl?.loc && fromUri
						? { ...fromDecl.loc, uri: fromUri }
						: undefined,
			});
			return;
		}

		// The specifier as the importer actually wrote it (e.g. "./base.gram")
		// — falls back to the resolved uri only for the entry file itself,
		// which has no importing decl to read it from.
		const displaySpecifier = fromDecl?.specifier ?? uri;

		if (depth > maxDepth) {
			pushWarning(diagnostics, WarningCode.MODULE_DEPTH_EXCEEDED, {
				specifier: displaySpecifier,
				depth: maxDepth,
				loc:
					fromDecl?.loc && fromUri
						? { ...fromDecl.loc, uri: fromUri }
						: undefined,
			});
			return;
		}

		let source: string;
		try {
			source = await host.read(uri);
		} catch {
			pushWarning(diagnostics, WarningCode.MODULE_NOT_FOUND, {
				specifier: displaySpecifier,
				loc:
					fromDecl?.loc && fromUri
						? { ...fromDecl.loc, uri: fromUri }
						: undefined,
			});
			return;
		}

		let ast: ReturnType<typeof getAST>;
		try {
			ast = getAST(source);
		} catch (err) {
			if (err instanceof GramParseError) {
				pushWarning(diagnostics, WarningCode.MODULE_PARSE_ERROR, {
					specifier: displaySpecifier,
					parseMessage: err.message,
					loc: { start: err.offset, end: err.offset, uri },
				});
				return;
			}
			throw err;
		}

		pathStack.push(uri);
		const imports: ModuleRecord["imports"] = [];
		for (const decl of ast.imports) {
			const validation = validateSpecifier(decl.specifier);
			if (!validation.ok) {
				pushWarning(diagnostics, validation.code, {
					specifier: decl.specifier,
					...(validation.code === WarningCode.MODULE_SPECIFIER_INVALID
						? { reason: validation.reason }
						: {}),
					loc: decl.loc ? { ...decl.loc, uri } : undefined,
				} as never);
				continue;
			}

			let depUri: string;
			try {
				depUri = host.resolve(decl.specifier, uri);
			} catch (err) {
				pushWarning(diagnostics, WarningCode.MODULE_SPECIFIER_INVALID, {
					specifier: decl.specifier,
					reason: err instanceof Error ? err.message : String(err),
					loc: decl.loc ? { ...decl.loc, uri } : undefined,
				});
				continue;
			}

			imports.push({ decl, uri: depUri });
			await visit(depUri, depth + 1, decl, uri);
		}
		pathStack.pop();

		modules.set(uri, { uri, source, ast, imports });
		order.push(uri);
	}

	await visit(entryUri, 0, undefined, undefined);

	return { entry: entryUri, modules, order, diagnostics };
}
