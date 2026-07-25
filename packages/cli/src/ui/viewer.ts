import chalk from "chalk";
import { spawn } from "node:child_process";
import { fmtNumber } from "../core/format";
import type { RecipeViewModel } from "../types";

// ── Inline step coloring ──────────────────────────────────────────────────────

function isInlineToken(item: any): boolean {
	if (typeof item === "string") return false;
	if (!item) return false;
	if (item.type === "comment" || item.type === "declaration") return false;
	return true;
}

function tokenToRichText(
	item: any,
	ingReg: Record<string, any>,
	cwReg: Record<string, any>,
): string {
	if (typeof item === "string") return item;
	if (!item) return "";

	if (item.type === "reference") {
		const name = ingReg[item.id]?.name ?? item.name ?? item.id;
		return chalk.magenta(name);
	}

	if (item.type === "timer") {
		const q = item.quantity;
		if (!q) return "";
		const val = q.text ?? (q.value != null ? String(q.value) : "");
		return chalk.dim(`~${val}${q.unit ?? "min"}`);
	}

	if (item.type === "temperature") {
		const q = item.quantity;
		if (!q) return item.text ?? "";
		const val = q.text ?? (q.value != null ? String(q.value) : "");
		return chalk.dim(`${val}${item.unit ?? "°C"}`);
	}

	if (item.type === "comment" || item.type === "declaration") return "";

	if (item.id) {
		const name =
			item.alias ??
			ingReg[item.id]?.name ??
			cwReg[item.id]?.name ??
			item.name ??
			item.id;
		if (item.type === "cookware" || cwReg[item.id]) return chalk.cyan(name);
		// Composite child — just color the child name, no parent reference in step
		return chalk.yellow(name);
	}

	return item.value ?? item.name ?? "";
}

function stepToRichText(
	tokens: any[],
	ingReg: Record<string, any>,
	cwReg: Record<string, any>,
): string {
	const parts: string[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const item = tokens[i];
		const text = tokenToRichText(item, ingReg, cwReg);
		if (!text) continue;

		if (isInlineToken(item) && parts.length > 0) {
			const last = parts[parts.length - 1]!;
			// Strip ANSI codes before testing the last character
			const lastPlain = last.replace(/\x1b\[[0-9;]*m/g, "");
			if (lastPlain && !/[\s']$/.test(lastPlain)) parts.push(" ");
		}

		parts.push(text);

		if (isInlineToken(item)) {
			const next = tokens[i + 1];
			const nextPlain = next
				? typeof next === "string"
					? next
					: tokenToRichText(next, ingReg, cwReg).replace(/\x1b\[[0-9;]*m/g, "")
				: "";
			if (nextPlain && !/^[\s.,!?:;)]/.test(nextPlain)) parts.push(" ");
		}
	}
	return parts.join("").trim();
}

const COL = Math.min(process.stdout.columns || 70, 78);

function pad(s: string, width: number): string {
	return s + " ".repeat(Math.max(0, width - s.length));
}

function rule(label?: string): string {
	if (!label) return chalk.dim("─".repeat(COL));
	const inner = `─── ${label} `;
	return chalk.dim(inner + "─".repeat(Math.max(0, COL - inner.length)));
}

function formatMinutes(mins: number): string {
	if (mins < 60) return `${mins}min`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h}h${m}` : `${h}h`;
}

function renderHeader(model: RecipeViewModel): string {
	const lines: string[] = [];
	const servStr = model.servings ? ` ${model.servings} servings ` : " ";
	const maxTitleLen = COL - 6 - servStr.length;
	const rawTitle = model.title;
	const title =
		rawTitle.length > maxTitleLen
			? `${rawTitle.slice(0, maxTitleLen - 1)}…`
			: rawTitle;
	const top = `┌─ ${title} ${"─".repeat(Math.max(2, COL - 4 - title.length - servStr.length))}${servStr}─┐`;
	lines.push(chalk.bold(top));

	if (model.times) {
		const t = model.times;
		const parts: string[] = [];
		if (t.prep) parts.push(`Prep: ${formatMinutes(t.prep)}`);
		if (t.active) parts.push(`Active: ${formatMinutes(t.active)}`);
		if (t.rest) parts.push(`Rest: ${formatMinutes(t.rest)}`);
		if (t.total) parts.push(`Total: ${formatMinutes(t.total)}`);
		if (parts.length > 0) {
			const inner = `⏱  ${parts.join("  ·  ")}`;
			lines.push(
				chalk.bold(`│  `) + chalk.dim(pad(inner, COL - 5)) + chalk.bold(` │`),
			);
		}
	}

	lines.push(chalk.bold(`└${"─".repeat(COL - 2)}┘`));
	return lines.join("\n");
}

function renderShoppingList(list: RecipeViewModel["shoppingList"]): string {
	if (list.length === 0) return "";
	const lines: string[] = ["", chalk.bold("SHOPPING LIST")];
	for (const item of list) {
		const name = item.name.padEnd(22);
		const qty = item.isEstimate
			? chalk.dim(`≈ ${item.displayQty}`)
			: item.displayQty;
		lines.push(`  ${name} ${qty}`);
	}
	return lines.join("\n");
}

function renderSections(
	sections: RecipeViewModel["sections"],
	registries: RecipeViewModel["_registries"],
): string {
	const lines: string[] = [];
	let stepNum = 1;

	for (const sec of sections) {
		lines.push("");
		lines.push(rule(sec.title ?? undefined));

		if (sec.ingredients.length > 0) {
			for (const ing of sec.ingredients) {
				const name = ing.name.padEnd(20);
				const qty = ing.isEstimate
					? chalk.dim(`≈ ${ing.displayQty}`)
					: ing.displayQty;
				lines.push(`  ${chalk.dim("•")} ${name} ${qty}`);
				if (ing.children) {
					for (const child of ing.children) {
						const childName = child.name.padEnd(18);
						const childQty = child.displayQty
							? chalk.dim(child.displayQty)
							: "";
						lines.push(`    ${chalk.dim("↳")} ${childName} ${childQty}`);
					}
				}
			}
			lines.push("");
		}

		for (const step of sec.steps) {
			const num = String(stepNum++).padStart(2);
			const action = step.action
				? chalk.cyan(`[${step.action}]`).padEnd(12)
				: "".padEnd(10);
			const timer = step.timerMinutes
				? chalk.dim(` (~${formatMinutes(step.timerMinutes)})`)
				: "";
			const richText = stepToRichText(
				step._tokens,
				registries.ingredients,
				registries.cookware,
			);
			lines.push(`  ${chalk.dim(`${num}.`)} ${action} ${richText}${timer}`);
		}
	}

	return lines.join("\n");
}

function renderNutrition(nutrition: RecipeViewModel["nutrition"]): string {
	if (!nutrition?.perPortion) return "";
	const p = nutrition.perPortion;
	const lines: string[] = [
		"",
		chalk.bold("NUTRITION (per serving)"),
		`  ${"Calories".padEnd(12)} ${fmtNumber(p.calories, 0)} kcal`,
		`  ${"Carbs".padEnd(12)} ${fmtNumber(p.carbs, 1)} g`,
		`  ${"Protein".padEnd(12)} ${fmtNumber(p.protein, 1)} g`,
		`  ${"Fat".padEnd(12)} ${fmtNumber(p.fat, 1)} g`,
	];
	if (p.fiber != null)
		lines.push(`  ${"Fiber".padEnd(12)} ${fmtNumber(p.fiber, 1)} g`);
	if (nutrition.isEstimate) lines.push(chalk.dim("  * estimated values"));
	return lines.join("\n");
}

function renderMissingWarning(missing: string[]): string {
	if (missing.length === 0) return "";
	return (
		"\n" +
		chalk.yellow(
			`⚠ ${missing.length} ingredient${missing.length !== 1 ? "s" : ""} missing nutrition data — run \`gram db enrich\``,
		)
	);
}

function renderRecipe(model: RecipeViewModel): string {
	return [
		renderHeader(model),
		renderShoppingList(model.shoppingList),
		renderSections(model.sections, model._registries),
		renderNutrition(model.nutrition),
		renderMissingWarning(model.missingIngredients),
		"",
	].join("\n");
}

export async function outputRecipe(
	model: RecipeViewModel,
	noPager: boolean,
): Promise<void> {
	// Force chalk colors before rendering so ANSI codes are present even when piping to less
	const savedLevel = chalk.level;
	if (chalk.level === 0) chalk.level = 1;

	const content = renderRecipe(model);

	const lineCount = content.split("\n").length;
	const termRows = process.stdout.rows ?? 24;
	const usePager =
		!noPager && process.stdout.isTTY && lineCount > termRows * 0.85;

	if (usePager) {
		await new Promise<void>((resolve, _reject) => {
			const less = spawn("less", ["-R", "--quit-if-one-screen"], {
				stdio: ["pipe", "inherit", "inherit"],
			});
			less.on("error", () => {
				// less unavailable (Windows, minimal containers) — fall back to direct write
				process.stdout.write(content);
				resolve();
			});
			less.stdin.write(content);
			less.stdin.end();
			less.on("close", resolve);
		});
	} else {
		process.stdout.write(content);
	}

	chalk.level = savedLevel;
}
