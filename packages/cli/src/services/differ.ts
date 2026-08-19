import { dirname, resolve, relative } from "node:path";
import { spawn } from "node:child_process";
import { compile } from "@gram-lang/kitchen";
import type { CompilationResult } from "@gram-lang/kitchen";
import {
	loadModuleGraph,
	composeRecipe,
	finalizeComposed,
} from "@gram-lang/modules";
import type { ModuleHost } from "@gram-lang/modules";
import { diffRecipes } from "@gram-lang/analyzer";
import type { DiffResult } from "@gram-lang/analyzer";
import { GramCLIError, ExitCode } from "../errors";
import { createCliModuleHost } from "../core/module-host";
import { findProjectRoot } from "../core/workspace";
import { loadConfig } from "../core/config";

export type { DiffResult };

function run(cmd: string, args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
		child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
		child.on("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "ENOENT")
				reject(new Error(`"${cmd}" is not available in PATH`));
			else reject(err);
		});
		child.on("close", (code) => {
			if (code === 0) resolve(stdout);
			else
				reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`));
		});
	});
}

async function gitRoot(fromPath: string): Promise<string> {
	try {
		const root = await run("git", ["rev-parse", "--show-toplevel"], fromPath);
		return root.trim();
	} catch {
		throw new GramCLIError(
			'Not inside a git repository. Use "gram diff file-a.gram file-b.gram" to compare two explicit files.',
			ExitCode.Error,
		);
	}
}

// `gram diff` resolves `@use` imports the same way every other command does
// (`runPipeline`, `core/pipeline.ts`) so a change purely inside an imported
// base recipe is visible as a MODULES delta rather than silently invisible —
// no `db`, since diff never runs the analyzer (nutrition/mass data plays no
// part in a structural/semantic diff).
async function composeAndCompile(
	entryUri: string,
	host: ModuleHost,
	notFound: () => Error,
): Promise<CompilationResult> {
	const graph = await loadModuleGraph(entryUri, host);
	if (!graph.modules.has(entryUri)) throw notFound();
	const composed = composeRecipe(graph, { db: {} });
	return finalizeComposed(compile(composed.ast), composed);
}

async function compileFile(filePath: string): Promise<CompilationResult> {
	const projectRoot = await findProjectRoot(dirname(filePath));
	const config = await loadConfig();
	const host = createCliModuleHost(projectRoot, config.paths);
	return composeAndCompile(
		filePath,
		host,
		() => new GramCLIError(`File not found: ${filePath}`, ExitCode.Error),
	);
}

async function compileAtRef(
	ref: string,
	absPath: string,
): Promise<CompilationResult> {
	const root = await gitRoot(resolve(absPath, ".."));
	const projectRoot = await findProjectRoot(dirname(absPath));
	const config = await loadConfig();
	// `read` failures (a missing import, same as any other host) are swallowed
	// into a MODULE_NOT_FOUND diagnostic by `loadModuleGraph` regardless of
	// what this throws, so there's no point catching/rewrapping `run()`'s
	// rejection here — only the entry file itself gets a dedicated,
	// git-specific error, via `composeAndCompile`'s `notFound` below.
	const host = createCliModuleHost(projectRoot, config.paths, (uri) =>
		run("git", ["show", `${ref}:${relative(root, uri)}`], root),
	);
	return composeAndCompile(absPath, host, () => {
		const relToRoot = relative(root, absPath);
		return new GramCLIError(
			`Cannot read "${relToRoot}" at "${ref}".\n\nMake sure the file is tracked by git and the ref exists.`,
			ExitCode.Error,
		);
	});
}

export interface DiffOptions {
	fileA: string;
	fileB?: string;
	ref?: string;
}

export async function computeDiff(
	opts: DiffOptions,
): Promise<{ result: DiffResult; label: string }> {
	const absA = resolve(opts.fileA);

	let compiled_a: CompilationResult;
	let compiled_b: CompilationResult;
	let label: string;

	if (opts.fileB) {
		// Two explicit files
		const absB = resolve(opts.fileB);
		[compiled_a, compiled_b] = await Promise.all([
			compileFile(absA),
			compileFile(absB),
		]);
		label = `${opts.fileA} → ${opts.fileB}`;
	} else {
		// Git mode: working tree vs ref (default HEAD)
		const ref = opts.ref ?? "HEAD";
		compiled_b = await compileFile(absA);
		compiled_a = await compileAtRef(ref, absA);
		label = `${opts.fileA} (${ref} → working tree)`;
	}

	return { result: diffRecipes(compiled_a, compiled_b), label };
}
