import { resolve } from "node:path";
import { getDictionary } from "@gram-lang/i18n";
import { GramParseError } from "@gram-lang/parser";
import {
	type DescribableDiagnostic,
	DEFAULT_VIEW_SETTINGS,
	describeError,
	type RecipeSettings,
	type ViewDefinition,
	type ViewSettings,
	views,
} from "@gram-lang/renderer";
import { configPaths, loadConfig } from "../core/config";
import { loadDb } from "../core/db";
import {
	CLI_VIEW_NAMES,
	cliViewName,
	isPlanned,
	viewByCliName,
} from "../core/cli-views";
import type { PipelineResult } from "../core/pipeline";
import { resolveStockFromConfig } from "../core/stock";
import { ExitCode, GramCLIError, getErrorMessage } from "../errors";
import { exportRecipe, NothingToShowError } from "./exporter";
import { resolveClock } from "./plan-flags";
import { type ExportView, resolveKitchenContext } from "./plan-options";
import type { PreviewRenderResult, PreviewStrings } from "./preview-server";
import { resolveScaleFactor } from "./scaler";
import { readViewSettingArgs } from "./setting-args";

/*
 * `gram view --serve`: the flags, and the render the live preview server calls.
 * The server itself (`preview-server.ts`) knows nothing of the config, the
 * database or the pipeline; this file is where they meet it.
 */

/** The views the live preview offers: those that have a screen layout. */
export const PREVIEW_VIEWS: readonly ViewDefinition[] = (
	views as readonly ViewDefinition[]
).filter((view) => view.formats.includes("html"));

const PREVIEW_VIEW_NAMES = PREVIEW_VIEWS.map((view) => cliViewName(view.id));

/** The flags of `gram view` that start and shape the live preview. */
export const VIEW_SERVE_ARGS = {
	serve: {
		type: "boolean",
		description:
			"Start a live preview in the browser, updated on every save of the recipe, its @use imports, the config and the database",
		default: false,
	},
	port: {
		type: "string",
		description:
			"Port of the live preview (default: 4173, else a free one). Only with --serve",
	},
	open: {
		type: "boolean",
		description: "Open the live preview in the browser (use --no-open to skip)",
		default: true,
	},
	view: {
		type: "string",
		description: `The view the live preview opens on: ${PREVIEW_VIEW_NAMES.join(" | ")} (default: recipe). Only with --serve`,
	},
} as const;

export interface ServeOptions {
	port?: number;
	open: boolean;
	/** The command-line name of the view shown first. */
	view: string;
}

/**
 * What the flags of `gram view` ask for: `null` for the terminal view, else the
 * live preview. Throws a usage error for a flag of the preview without
 * `--serve`, a bad port or view, and a positional too many (most often
 * `--serve "2026-10-11 13:00"`, written the `gram plan` way).
 */
export function resolveServeOptions(
	args: Record<string, unknown>,
): ServeOptions | null {
	const positionals = Array.isArray(args._) ? args._ : [];
	if (positionals.length > 1) {
		const extra = positionals.slice(1).map((p) => `"${String(p)}"`);
		throw new GramCLIError(
			`Unexpected argument ${extra.join(", ")}: gram view takes one recipe file. In gram view, --serve starts the live preview and takes no value; to put a recipe on the calendar, use gram plan --serve "<date>".`,
			ExitCode.Error,
		);
	}
	const serve = args.serve === true;
	const port = args.port as string | undefined;
	const view = args.view as string | undefined;
	if (!serve) {
		if (port !== undefined) {
			throw new GramCLIError(
				"--port only applies with --serve.",
				ExitCode.Error,
			);
		}
		if (view !== undefined) {
			throw new GramCLIError(
				"--view only applies with --serve: the terminal shows the recipe.",
				ExitCode.Error,
			);
		}
		return null;
	}
	let portNumber: number | undefined;
	if (port !== undefined) {
		portNumber = /^\d+$/.test(port) ? Number(port) : Number.NaN;
		if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
			throw new GramCLIError(
				`Invalid --port value "${port}": expected a number from 1 to 65535.`,
				ExitCode.Error,
			);
		}
	}
	const name = view ?? "recipe";
	if (!PREVIEW_VIEW_NAMES.includes(name)) {
		// The registry's words for an unknown view, else one without a screen layout.
		if (!CLI_VIEW_NAMES.includes(name)) viewByCliName(name);
		throw new GramCLIError(
			`The ${name} view has no screen layout. Expected one of: ${PREVIEW_VIEW_NAMES.join(", ")}.`,
			ExitCode.Error,
		);
	}
	return {
		...(portNumber !== undefined && { port: portNumber }),
		open: args.open !== false,
		view: name,
	};
}

/** The words of the preview page, in `lang`. */
export function previewStrings(lang?: string): PreviewStrings {
	const t = getDictionary(lang).renderer;
	return {
		lang: lang ?? "en",
		views: t.outputs,
		print: t.print,
		outputEmpty: t.outputEmpty,
		disconnected: t.disconnected,
	};
}

/**
 * A syntax error of the recipe file itself. The module graph turns it into a
 * diagnostic rather than an exception (`gram view` in the terminal then shows
 * an empty recipe); the preview keeps the last good render instead.
 */
export function entryParseError(
	result: PipelineResult,
	file: string,
): DescribableDiagnostic | null {
	const entry = resolve(file);
	const warning = result.compiled.warnings?.find(
		(w) =>
			w.code === "MODULE_PARSE_ERROR" &&
			(w.uri ?? w.loc?.uri) !== undefined &&
			resolve((w.uri ?? w.loc?.uri) as string) === entry,
	);
	if (!warning) return null;
	return {
		code: "PARSE_ERROR",
		message: warning.message,
		severity: "error",
		blocking: true,
		...(warning.loc && {
			loc: { start: warning.loc.start, end: warning.loc.end },
		}),
	};
}

/** An error of the pipeline, as the blocking diagnostic the banner describes. */
export function errorDiagnostic(err: unknown): DescribableDiagnostic {
	if (err instanceof GramParseError) {
		return {
			code: "PARSE_ERROR",
			message: err.message,
			severity: "error",
			blocking: true,
			loc: { start: err.offset, end: err.offset },
		};
	}
	return {
		code: "COMPILE_ERROR",
		message: getErrorMessage(err),
		severity: "error",
		blocking: true,
	};
}

export interface PreviewRenderOptions {
	file: string;
	/** The parsed flags of `gram view`. */
	args: Record<string, unknown>;
	rawArgs: string[] | undefined;
	settings: Partial<ViewSettings>;
	recipe: RecipeSettings;
	bakersReference: string | undefined;
	/** Told what the pipeline produced, after every successful render. */
	onPipeline?: (result: PipelineResult) => void;
}

/**
 * The render the preview server calls. The config, the database, the scale and
 * the kitchen are read again on every render: a change of config or database
 * shows without any reload logic, and the present of a run sheet never freezes
 * at the start of a long session.
 */
export function createPreviewRender(options: PreviewRenderOptions) {
	const file = resolve(options.file);
	const { args } = options;
	return async (
		view: ViewDefinition,
		format: "html" | "print",
	): Promise<PreviewRenderResult> => {
		const paths = await configPaths();
		const watch = [file, paths.global, paths.project];
		let lang: string | undefined;
		try {
			const config = await loadConfig();
			lang = config.language;
			const dbResult = args["skip-db"]
				? null
				: await loadDb(config, args.db as string | undefined);
			if (dbResult) watch.push(dbResult.dbPath);
			const db = dbResult?.data ?? null;
			const scale = args.scale as string | undefined;
			const scaleFactor = scale
				? await resolveScaleFactor(
						file,
						scale,
						db,
						config.language,
						config.paths,
					)
				: undefined;
			const exportView: ExportView = isPlanned(view)
				? {
						view,
						kitchen: resolveKitchenContext(args, options.rawArgs, config),
						clock: resolveClock(
							readViewSettingArgs(args, ["clock"]).clock,
							config.clock,
						),
					}
				: { view };
			let pipeline: PipelineResult | undefined;
			let html: string | null;
			try {
				html = await exportRecipe(file, format, db, scaleFactor, {
					settings: { ...DEFAULT_VIEW_SETTINGS, ...options.settings },
					view: exportView,
					bakersReference: options.bakersReference,
					recipe: options.recipe,
					lang: config.language,
					paths: config.paths,
					stock: resolveStockFromConfig(
						args.stock as string | undefined,
						config,
					),
					onPipeline: (result) => {
						pipeline = result;
					},
				});
			} catch (err) {
				if (!(err instanceof NothingToShowError)) throw err;
				html = null;
			}
			if (pipeline) watch.push(...pipeline.dependencies);
			const parseError = pipeline ? entryParseError(pipeline, file) : null;
			if (parseError) {
				return { html: null, error: describeError([parseError], lang), watch };
			}
			if (pipeline) options.onPipeline?.(pipeline);
			return {
				...(pipeline?.compiled.title && { title: pipeline.compiled.title }),
				html,
				error: null,
				watch,
			};
		} catch (err) {
			return {
				html: null,
				error: describeError([errorDiagnostic(err)], lang),
				watch,
			};
		}
	};
}
