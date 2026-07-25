import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { classifyCallExpectation } from "../classify";
import { RAW_SOURCE_CALL_TARGETS, REPO_ROOT } from "../config";
import type { Snippet, SkippedExtraction } from "../types";
import { walkFiles } from "../util/walk-files";

interface VarDecl {
	name: string;
	pos: number;
	text: string | null; // null if initializer isn't a plain literal (dynamic)
}

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

function resolveLiteralText(node: ts.Node): string | null {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	return null;
}

export function extractInlineTestLiterals(): {
	snippets: Snippet[];
	skipped: SkippedExtraction[];
} {
	const snippets: Snippet[] = [];
	const skipped: SkippedExtraction[] = [];

	for (const absPath of findTestFiles()) {
		const relPath = relative(REPO_ROOT, absPath);
		const text = readFileSync(absPath, "utf-8");
		const sourceFile = ts.createSourceFile(
			absPath,
			text,
			ts.ScriptTarget.Latest,
			/* setParentNodes */ true,
			ts.ScriptKind.TS,
		);

		const varDecls: VarDecl[] = [];
		const targetCalls: ts.CallExpression[] = [];

		const visit = (node: ts.Node): void => {
			if (
				ts.isVariableDeclaration(node) &&
				ts.isIdentifier(node.name) &&
				node.initializer
			) {
				varDecls.push({
					name: node.name.text,
					pos: node.getStart(sourceFile),
					text: resolveLiteralText(node.initializer),
				});
			}
			if (
				ts.isCallExpression(node) &&
				ts.isIdentifier(node.expression) &&
				(RAW_SOURCE_CALL_TARGETS as readonly string[]).includes(node.expression.text)
			) {
				targetCalls.push(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(sourceFile);

		for (const call of targetCalls) {
			const arg = call.arguments[0];
			const line = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile)).line + 1;
			if (!arg) continue;

			let content: string | null = resolveLiteralText(arg);

			if (content === null && ts.isIdentifier(arg)) {
				const callPos = call.getStart(sourceFile);
				const candidates = varDecls.filter((d) => d.name === arg.text && d.pos < callPos);
				const nearest = candidates.at(-1);
				if (nearest) {
					if (nearest.text === null) {
						skipped.push({
							file: relPath,
							line,
							reason: `argument variable "${arg.text}" is not a plain string/template literal (dynamic)`,
						});
						continue;
					}
					content = nearest.text;
				} else {
					skipped.push({
						file: relPath,
						line,
						reason: `could not resolve variable "${arg.text}" to a preceding literal declaration`,
					});
					continue;
				}
			}

			if (content === null) {
				skipped.push({
					file: relPath,
					line,
					reason: "dynamic argument (template interpolation, concatenation, or call expression) — not extracted",
				});
				continue;
			}

			const calleeName = (call.expression as ts.Identifier).text;
			snippets.push({
				id: `${relPath}:${line}`,
				sourceKind: "inline-test-literal",
				file: relPath,
				line,
				content,
				label: calleeName,
				expectation: classifyCallExpectation(call),
				// The surrounding bun test already asserts whatever warnings it
				// cares about (or deliberately doesn't) — that's a strictly more
				// reliable ground truth than re-deriving "expected" warnings here.
				skipWarningsCheck: true,
			});
		}
	}

	return { snippets, skipped };
}
