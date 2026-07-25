import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { GRAM_SIGNAL_PATTERN, REPO_ROOT, TMPFILE_WRITE_CALL_TARGETS } from "../config";
import type { Snippet } from "../types";
import { walkFiles } from "../util/walk-files";

function findTestFiles(): string[] {
	const packagesDir = join(REPO_ROOT, "packages");
	const files: string[] = [];
	for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const testsDir = join(packagesDir, entry.name, "tests");
		files.push(...walkFiles(testsDir, (name) => name.endsWith(".test.ts")));
	}
	return files;
}

function literalText(node: ts.Node): string | null {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	return null;
}

// Scans for writeFile(path, "gram-looking content") in tests — a third
// embedding shape distinct from a physical fixture or an inline getAST() arg
// (e.g. packages/cli/tests/checker.test.ts writes Gram to a runtime tmpfile
// before running the CLI checker against it).
export function extractTmpfileWrites(): Snippet[] {
	const snippets: Snippet[] = [];

	for (const absPath of findTestFiles()) {
		const relPath = relative(REPO_ROOT, absPath);
		const text = readFileSync(absPath, "utf-8");
		const sourceFile = ts.createSourceFile(
			absPath,
			text,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);

		const visit = (node: ts.Node): void => {
			if (
				ts.isCallExpression(node) &&
				ts.isIdentifier(node.expression) &&
				(TMPFILE_WRITE_CALL_TARGETS as readonly string[]).includes(node.expression.text)
			) {
				const contentArg = node.arguments[1];
				const content = contentArg ? literalText(contentArg) : null;
				if (content && GRAM_SIGNAL_PATTERN.test(content)) {
					const line =
						sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
					snippets.push({
						id: `${relPath}:${line}`,
						sourceKind: "inline-test-tmpfile",
						file: relPath,
						line,
						content,
						// Content fed to a CLI service (checker/differ) that may catch
						// a parse error internally rather than letting it propagate —
						// checks/parse.ts treats an unexpected throw here as "info",
						// not "flag", for the same reason as parseDocument below.
						expectation: "must-parse",
						// Same reasoning as inline-test-literal: the surrounding
						// bun test already asserts whatever this content is meant
						// to produce.
						skipWarningsCheck: true,
					});
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(sourceFile);
	}

	return snippets;
}
