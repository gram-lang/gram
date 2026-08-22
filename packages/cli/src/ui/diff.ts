import chalk from "chalk";
import { log } from "@clack/prompts";
import type {
	DiffResult,
	IngredientDelta,
	TimingDelta,
	SectionDelta,
	MetaDelta,
	TemperatureDelta,
	TimerDelta,
	PrepDelta,
	ModuleDelta,
} from "@gram-lang/analyzer";

function fmtQty(qty?: number, unit?: string | null): string {
	if (qty === undefined) return "?";
	const rounded =
		Math.abs(qty - Math.round(qty)) < 0.005
			? Math.round(qty)
			: parseFloat(qty.toFixed(2));
	return unit ? `${rounded}${unit}` : String(rounded);
}

function fmtMinutes(m: number): string {
	if (m === 0) return "0 min";
	const h = Math.floor(Math.abs(m) / 60);
	const min = Math.abs(m) % 60;
	const sign = m < 0 ? "-" : "+";
	if (h > 0 && min > 0) return `${sign}${h}h ${min} min`;
	if (h > 0) return `${sign}${h}h`;
	return `${sign}${min} min`;
}

function fmtMetaValue(v: unknown): string {
	if (v === null || v === undefined) return "(none)";
	if (Array.isArray(v)) return v.join(", ");
	return String(v);
}

function fmtTempValue(v?: { value: number; unit: string }): string {
	if (!v) return "?";
	return `${v.value}${v.unit}`;
}

const TIMING_LABELS: Record<string, string> = {
	totalTime: "Total time",
	idleTime: "Idle time",
	activeTime: "Active time",
	preparationTime: "Prep time",
};

function renderMeta(d: MetaDelta): string {
	const label = d.field.padEnd(18);
	const from = chalk.dim(fmtMetaValue(d.from));
	const to = chalk.yellow(fmtMetaValue(d.to));
	return `  ${chalk.yellow("~")} ${label} ${from} → ${to}`;
}

function renderIngredient(d: IngredientDelta): string {
	const name = (d.name || d.id).padEnd(18);

	if (d.change === "added") {
		return `  ${chalk.green("+")} ${name} ${chalk.green(fmtQty(d.toQty, d.toUnit))}`;
	}
	if (d.change === "removed") {
		return `  ${chalk.red("-")} ${name} ${chalk.red(fmtQty(d.fromQty, d.fromUnit))}`;
	}

	const from = chalk.dim(fmtQty(d.fromQty, d.fromUnit));
	const to = chalk.yellow(fmtQty(d.toQty, d.toUnit));
	const pct =
		d.percentChange !== undefined
			? chalk.dim(` (${d.percentChange > 0 ? "+" : ""}${d.percentChange}%)`)
			: "";
	return `  ${chalk.yellow("~")} ${name} ${from} → ${to}${pct}`;
}

function renderPrep(d: PrepDelta): string {
	const name = (d.name || d.id).padEnd(18);
	const section = d.section ? chalk.dim(` [${d.section}]`) : "";
	const from = d.from ? chalk.dim(`(${d.from})`) : chalk.dim("—");
	const to = d.to ? chalk.yellow(`(${d.to})`) : chalk.yellow("—");
	return `  ${chalk.yellow("~")} ${name}${section}  ${from} → ${to}`;
}

function renderTiming(d: TimingDelta): string {
	const label = (TIMING_LABELS[d.field] ?? d.field).padEnd(18);
	const from = chalk.dim(`${d.from} min`);
	const to = chalk.yellow(`${d.to} min`);
	const delta = fmtMinutes(d.to - d.from);
	return `  ${chalk.yellow("~")} ${label} ${from} → ${to} ${chalk.dim(`(${delta})`)}`;
}

function renderSection(d: SectionDelta): string {
	const title = d.title ? `"${d.title}"` : "(unnamed)";

	if (d.change === "added") {
		const steps =
			d.toStepCount !== undefined
				? ` — ${d.toStepCount} step${d.toStepCount !== 1 ? "s" : ""}`
				: "";
		return `  ${chalk.green("+")} Section ${title}${steps}`;
	}
	if (d.change === "removed") {
		return `  ${chalk.red("-")} Section ${title}`;
	}

	const from = d.fromStepCount ?? 0;
	const to = d.toStepCount ?? 0;
	const diff = to - from;
	const sign = diff > 0 ? "+" : "";
	return `  ${chalk.yellow("~")} Section ${title} — ${chalk.dim(`${from}`)} → ${chalk.yellow(`${to}`)} steps ${chalk.dim(`(${sign}${diff})`)}`;
}

function renderTemperature(d: TemperatureDelta): string {
	const section = d.section ? chalk.dim(`[${d.section}] `) : "";
	const label = d.name ? `${d.name}: ` : "";

	if (d.change === "added")
		return `  ${chalk.green("+")} ${section}${label}${chalk.green(fmtTempValue(d.to))}`;
	if (d.change === "removed")
		return `  ${chalk.red("-")} ${section}${label}${chalk.red(fmtTempValue(d.from))}`;
	return `  ${chalk.yellow("~")} ${section}${label}${chalk.dim(fmtTempValue(d.from))} → ${chalk.yellow(fmtTempValue(d.to))}`;
}

function fmtFactor(f?: number): string {
	return f === undefined ? "?" : `×${f}`;
}

function renderModule(d: ModuleDelta): string {
	if (d.change === "added") {
		return `  ${chalk.green("+")} ${d.uri} as &${d.toBinding} ${chalk.green(fmtFactor(d.toFactor))}`;
	}
	if (d.change === "removed") {
		return `  ${chalk.red("-")} ${d.uri} as &${d.fromBinding} ${chalk.red(fmtFactor(d.fromFactor))}`;
	}
	const binding =
		d.fromBinding !== d.toBinding
			? `${chalk.dim(`&${d.fromBinding}`)} → ${chalk.yellow(`&${d.toBinding}`)}`
			: `&${d.toBinding}`;
	const factor =
		d.fromFactor !== d.toFactor
			? `${chalk.dim(fmtFactor(d.fromFactor))} → ${chalk.yellow(fmtFactor(d.toFactor))}`
			: chalk.dim(fmtFactor(d.toFactor));
	return `  ${chalk.yellow("~")} ${d.uri} as ${binding} ${factor}`;
}

function renderTimer(d: TimerDelta): string {
	const section = d.section ? chalk.dim(`[${d.section}] `) : "";
	const label = d.name ? `${d.name}: ` : "";

	if (d.change === "added")
		return `  ${chalk.green("+")} ${section}${label}${chalk.green(d.to ?? "?")}`;
	if (d.change === "removed")
		return `  ${chalk.red("-")} ${section}${label}${chalk.red(d.from ?? "?")}`;
	return `  ${chalk.yellow("~")} ${section}${label}${chalk.dim(d.from ?? "?")} → ${chalk.yellow(d.to ?? "?")}`;
}

export function renderDiffResult(result: DiffResult, label: string): void {
	console.log();
	console.log(`  ${chalk.bold("Semantic diff:")} ${chalk.dim(label)}`);

	if (!result.hasChanges) {
		console.log();
		log.info("No semantic changes detected.");
		return;
	}

	if (result.titleChanged) {
		console.log();
		console.log(
			`  ${chalk.yellow("~")} ${"Title".padEnd(18)} ${chalk.dim(result.fromTitle ?? "(none)")} → ${chalk.yellow(result.toTitle ?? "(none)")}`,
		);
	}

	if (result.meta.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("FRONTMATTER")}`);
		for (const d of result.meta) console.log(renderMeta(d));
	}

	if (result.ingredients.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("INGREDIENTS")}`);
		for (const d of result.ingredients) console.log(renderIngredient(d));
	}

	if (result.preparations.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("PREPARATIONS")}`);
		for (const d of result.preparations) console.log(renderPrep(d));
	}

	if (result.temperatures.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("TEMPERATURES")}`);
		for (const d of result.temperatures) console.log(renderTemperature(d));
	}

	if (result.timers.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("TIMERS")}`);
		for (const d of result.timers) console.log(renderTimer(d));
	}

	if (result.timings.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("TIMING")}`);
		for (const d of result.timings) console.log(renderTiming(d));
	}

	if (result.sections.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("SECTIONS")}`);
		for (const d of result.sections) console.log(renderSection(d));
	}

	if (result.modules.length > 0) {
		console.log();
		console.log(`  ${chalk.bold("MODULES")}`);
		for (const d of result.modules) console.log(renderModule(d));
	}

	console.log();
}
