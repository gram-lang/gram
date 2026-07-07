import chalk from "chalk";
import { log } from "@clack/prompts";
import type { ShopResult } from "../types";

export function renderShopTerminal(result: ShopResult): void {
	const { byCategory, items, warnings, recipeCount } = result;

	if (items.length === 0) {
		log.warn("No ingredients found in the provided recipes.");
		return;
	}

	console.log();

	const hasCategories =
		byCategory.size > 1 || ![...byCategory.keys()].every((k) => k === "Other");

	if (hasCategories) {
		for (const [category, catItems] of byCategory) {
			const label =
				category === "Other"
					? chalk.dim("  Other")
					: `  ${chalk.bold(category)}`;
			console.log(label);
			for (const item of catItems) {
				const name = item.name.padEnd(24);
				const qty = item.isEstimate
					? chalk.dim(`≈ ${item.displayQty}`)
					: item.displayQty;
				const flag = item.cannotAggregate ? chalk.yellow(" ⚠") : "";
				console.log(`    ${name} ${qty}${flag}`);
			}
			console.log();
		}
	} else {
		for (const item of items) {
			const name = item.name.padEnd(24);
			const qty = item.isEstimate
				? chalk.dim(`≈ ${item.displayQty}`)
				: item.displayQty;
			console.log(`  ${name} ${qty}`);
		}
		console.log();
	}

	if (warnings.length > 0) {
		for (const w of warnings) {
			console.log(chalk.yellow(`  ⚠ ${w}`));
		}
		console.log();
	}

	console.log(chalk.dim("─".repeat(42)));
	console.log(
		chalk.dim(
			`  ${items.length} ingredient${items.length !== 1 ? "s" : ""} · ${recipeCount} recipe${recipeCount !== 1 ? "s" : ""}`,
		),
	);
}

export function renderShopMarkdown(result: ShopResult): string {
	const { byCategory, items } = result;
	const lines: string[] = ["## Shopping list", ""];

	const hasCategories =
		byCategory.size > 1 || ![...byCategory.keys()].every((k) => k === "Other");

	if (hasCategories) {
		for (const [category, catItems] of byCategory) {
			lines.push(`### ${category}`);
			for (const item of catItems) {
				const qty =
					item.displayQty === "-"
						? ""
						: item.isEstimate
							? `≈ ${item.displayQty}`
							: item.displayQty;
				lines.push(qty ? `- [ ] ${item.name} — ${qty}` : `- [ ] ${item.name}`);
			}
			lines.push("");
		}
	} else {
		for (const item of items) {
			const qty =
				item.displayQty === "-"
					? ""
					: item.isEstimate
						? `≈ ${item.displayQty}`
						: item.displayQty;
			lines.push(qty ? `- [ ] ${item.name} — ${qty}` : `- [ ] ${item.name}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

export function renderShopJson(result: ShopResult): string {
	const { items, recipeCount, warnings } = result;
	const output = {
		recipeCount,
		ingredientCount: items.length,
		warnings,
		items: items.map((i) => ({
			id: i.id,
			name: i.name,
			qty: i.displayQty,
			isEstimate: i.isEstimate,
			category: i.category,
			recipes: i.recipes,
		})),
	};
	return JSON.stringify(output, null, 2);
}
