import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { formatTemperature, formatTimerDuration } from "@gram-lang/renderer";
import { fillTemplate, getDictionary } from "@gram-lang/i18n";
import type { ActiveTimer, FlatStep } from "./types";
import type { CompilationResult } from "@gram-lang/kitchen";
import {
	fmtQty,
	fmtMass,
	fmtCountdown,
	shouldShowMass,
	stepTargetStates,
} from "./prepare";

/** A temperature as the views show it (`180 °C`, `vif`), with its note. */
export function getTempDisplay(token: any): string {
	const value = formatTemperature(token);
	return token.note ? `${value} (${token.note})` : value;
}

/** A timer as the views show it (`1 h 30 min`, `1–2 h`), or as written when refused. */
export function getTimerDisplay(token: any): string {
	return formatTimerDuration(token);
}

// Strip ANSI escape codes to get visible text (used for smart-join boundary checks)
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
function visibleEnd(s: string): string {
	return s.replace(ANSI_RE, "");
}

// Build instruction string with chalk-colored timers (yellow) and temperatures (red).
// Using a plain string avoids ink Fragment/nested-Text rendering quirks with wrap="wrap".
function buildInstruction(
	content: any[],
	registry: CompilationResult["registry"],
): string {
	const parts: string[] = [];

	for (const token of content) {
		if (typeof token === "string") {
			parts.push(token);
			continue;
		}
		if (!token) continue;
		if (token.type === "comment" || token.type === "declaration") continue;

		if (token.type === "timer") {
			parts.push(chalk.yellow(getTimerDisplay(token)));
			continue;
		}

		if (token.type === "temperature") {
			parts.push(chalk.red(getTempDisplay(token)));
			continue;
		}

		// The state only: its note is on the target line under the step.
		if (token.type === "checkpoint") {
			parts.push(chalk.cyan.underline(token.state));
			continue;
		}

		if (token.type === "reference") {
			parts.push(
				registry.ingredients[token.id]?.name ?? token.name ?? token.id,
			);
			continue;
		}

		if (token.id) {
			parts.push(
				token.alias ??
					registry.ingredients[token.id]?.name ??
					registry.cookware?.[token.id]?.name ??
					token.name ??
					token.id,
			);
			continue;
		}

		if (token.value != null) parts.push(String(token.value));
	}

	// Smart join: check visible (ANSI-stripped) boundary chars so chalk codes don't confuse spacing
	let result = "";
	for (const part of parts) {
		if (!result) {
			result = part;
			continue;
		}
		const last = visibleEnd(result).slice(-1);
		const first = visibleEnd(part)[0] ?? "";
		if (/\w/.test(last) && /\w/.test(first)) result += ` ${part}`;
		else result += part;
	}
	return result.trim();
}

interface Props {
	flatStep: FlatStep;
	stepIndex: number;
	totalSteps: number;
	title: string | null;
	activeTimers: ActiveTimer[];
	tick: number;
	quitConfirm: boolean;
	timerSelect: boolean;
	timerSelectIndex: number;
	registry: CompilationResult["registry"];
	massMap: Record<string, number>;
	width: number;
	lang?: string;
}

export default function StepView({
	flatStep,
	stepIndex,
	totalSteps,
	title,
	activeTimers,
	tick: _tick,
	quitConfirm,
	timerSelect,
	timerSelectIndex,
	registry,
	massMap,
	width,
	lang,
}: Props) {
	const cookWords = getDictionary(lang).cook;
	const { step, timers, sectionTitle } = flatStep;
	const now = Date.now();

	// Distinguish ingredients from cookware via registry (createCleanUsage never sets type:'cookware')
	const stepIngredients = (step.content ?? []).filter(
		(t: any) => t?.id && t.type !== "reference" && !registry.cookware?.[t.id],
	);
	const stepCookware = (step.content ?? []).filter(
		(t: any) => t?.id && t.type !== "reference" && !!registry.cookware?.[t.id],
	);
	const hasStepContent = stepIngredients.length > 0 || stepCookware.length > 0;

	// Step metadata for the info bar
	const stepTempTokens = (step.content ?? []).filter(
		(t: any) => t?.type === "temperature",
	);
	const stepTimerTokens = (step.content ?? []).filter(
		(t: any) => t?.type === "timer" && !t?.isPassive,
	);

	const getIngredientName = (item: any) =>
		item.alias ?? registry.ingredients[item.id]?.name ?? item.name ?? item.id;
	const getCookwareName = (item: any) =>
		registry.cookware?.[item.id]?.name ?? item.name ?? item.id;
	const showMass = (item: any, mass: number | undefined) =>
		mass != null && shouldShowMass(item.unit);

	const stepNum = stepIndex + 1;
	const hasAction = step.action?.trim();

	const runningTimers = activeTimers.filter((t) => !t.done);
	const doneTimers = activeTimers.filter((t) => t.done);
	const availableTimers = timers.filter(
		(t) => !activeTimers.some((a) => a.id === t.id),
	);

	const innerW = Math.max(0, width - 4);
	const divider = "─".repeat(Math.min(innerW, 52));

	const LEFT_W = 22;
	const twoCol = hasStepContent && innerW >= 56;
	const rightW = Math.max(20, innerW - LEFT_W - 2);

	const instruction = buildInstruction(step.content ?? [], registry);
	const targetLines = stepTargetStates(step).map((c, i) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: target states have no natural id
		<Text key={i} wrap="wrap">
			<Text color="cyan">{`${cookWords.targetState} `}</Text>
			<Text bold>{c.state}</Text>
			{c.note && <Text dimColor>{` — ${c.note}`}</Text>}
		</Text>
	));

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1} width={width}>
			{/* ── Header: title (left) | timers + temps + step count (right) ── */}
			<Box justifyContent="space-between" alignItems="flex-start">
				<Box flexDirection="column">
					<Text bold>{title ?? "Recipe"}</Text>
					{sectionTitle && <Text dimColor> {sectionTitle}</Text>}
				</Box>
				<Box alignItems="center">
					{runningTimers.map((t) => {
						const remaining = t.startedAt + t.durationMs - now;
						return (
							<Text key={t.id} bold color="yellow">
								⏱ {fmtCountdown(remaining)}{" "}
							</Text>
						);
					})}
					{stepTempTokens.map((t: any, i: number) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: inline temperature tokens have no natural id
						<Text key={i} color="red">
							{getTempDisplay(t)}{" "}
						</Text>
					))}
					{stepTimerTokens.map((t: any, i: number) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: inline timer tokens have no natural id
						<Text key={i} color="cyan">
							{getTimerDisplay(t)}{" "}
						</Text>
					))}
					<Text dimColor>
						{stepNum} / {totalSteps}
					</Text>
				</Box>
			</Box>

			<Text> </Text>

			{/* Action */}
			{hasAction && (
				<Text bold color="cyan">
					[{step.action!.toUpperCase()}]
				</Text>
			)}

			{/* ── Two-column: ingredients+cookware (left) | instruction (right) ── */}
			{twoCol ? (
				<Box flexDirection="row">
					<Box flexDirection="column" width={LEFT_W} marginRight={2}>
						{stepIngredients.map((item: any, i: number) => {
							const mass = massMap[item.id];
							return (
								// biome-ignore lint/suspicious/noArrayIndexKey: id+index composite key avoids collisions on repeated ingredients
								<React.Fragment key={`${item.id}-${i}`}>
									<Text>
										<Text color="yellow">{"• "}</Text>
										<Text color="yellow">{getIngredientName(item)}</Text>
										<Text dimColor>{fmtQty(item)}</Text>
									</Text>
									{showMass(item, mass) && (
										<Text dimColor>
											{"  ≈ "}
											{fmtMass(mass!)}
										</Text>
									)}
								</React.Fragment>
							);
						})}
						{stepCookware.length > 0 && stepIngredients.length > 0 && (
							<Text> </Text>
						)}
						{stepCookware.map((item: any, i: number) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: id+index composite key avoids collisions on repeated ingredients
							<Text key={`${item.id}-${i}`} color="blue">
								{"○ "}
								{getCookwareName(item)}
							</Text>
						))}
					</Box>
					<Box flexDirection="column" width={rightW}>
						<Text wrap="wrap">{instruction}</Text>
						{targetLines.length > 0 && <Text> </Text>}
						{targetLines}
					</Box>
				</Box>
			) : (
				<>
					{hasStepContent && (
						<>
							{stepIngredients.map((item: any, i: number) => {
								const mass = massMap[item.id];
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: id+index composite key avoids collisions on repeated ingredients
									<React.Fragment key={`${item.id}-${i}`}>
										<Text>
											{"  • "}
											<Text color="yellow">{getIngredientName(item)}</Text>
											<Text dimColor>{fmtQty(item)}</Text>
										</Text>
										{showMass(item, mass) && (
											<Text dimColor>
												{"    ≈ "}
												{fmtMass(mass!)}
											</Text>
										)}
									</React.Fragment>
								);
							})}
							{stepCookware.map((item: any, i: number) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: id+index composite key avoids collisions on repeated ingredients
								<Text key={`${item.id}-${i}`} color="blue">
									{"  ○ "}
									{getCookwareName(item)}
								</Text>
							))}
							<Text> </Text>
						</>
					)}
					<Text wrap="wrap">{instruction}</Text>
					{targetLines.length > 0 && <Text> </Text>}
					{targetLines}
				</>
			)}

			<Text> </Text>
			<Text dimColor>{divider}</Text>

			{/* Done timer alerts */}
			{doneTimers.length > 0 && (
				<>
					{doneTimers.map((t) => (
						<Text key={t.id} color="green">
							{"  ✓ "}
							{t.name} — DONE <Text dimColor>[any key to dismiss]</Text>
							{t.checks && (
								<Text color="cyan">
									{`  ${fillTemplate(cookWords.checkTargetState, { states: t.checks.join(", ") })}`}
								</Text>
							)}
						</Text>
					))}
					<Text> </Text>
				</>
			)}

			{/* Timer selector */}
			{timerSelect && (
				<>
					<Text>Start timer:</Text>
					{timers.map((t, i) => (
						<Text key={t.id}>
							{i === timerSelectIndex ? (
								<Text color="cyan"> › {t.name}</Text>
							) : (
								<Text>
									{"    "}
									{t.name}
								</Text>
							)}
						</Text>
					))}
					<Text> </Text>
				</>
			)}

			{/* Footer */}
			{quitConfirm ? (
				<Text color="yellow">
					{" "}
					Timer is running — really quit? [Y / any key to cancel]
				</Text>
			) : (
				<Box>
					<Text dimColor> [Space] Next [B] Back </Text>
					{availableTimers.length > 0 && <Text dimColor>[T] Timer </Text>}
					<Text dimColor>[Q] Quit</Text>
				</Box>
			)}
		</Box>
	);
}
