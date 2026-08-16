import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	mock,
	spyOn,
} from "bun:test";

// Everything in this file needs @clack/prompts stubbed, and Bun's mock.module
// replaces a specifier process-wide — a second, differently-shaped stub in
// another test file for the same specifier fights this one over which exports
// exist. So every case that needs @clack/prompts mocked shares this one
// factory, covering the union of what ui/ai-model.ts AND ui/video-import.ts
// import from it, rather than each getting its own partial mock.

type Prompt = { message: string; options?: { value: string; label: string }[] };

const asked: Prompt[] = [];
let answers: unknown[] = [];
const errors: string[] = [];

const CANCEL = Symbol.for("clack:cancel");

mock.module("@clack/prompts", () => ({
	select: (opts: Prompt) => {
		asked.push(opts);
		return Promise.resolve(answers.shift());
	},
	text: (opts: Prompt) => {
		asked.push(opts);
		return Promise.resolve(answers.shift());
	},
	confirm: () => Promise.resolve(true),
	isCancel: (v: unknown) => v === CANCEL,
	cancel: () => {},
	log: {
		step: () => {},
		warn: () => {},
		error: (msg: string) => {
			errors.push(msg);
		},
	},
}));

const { pickAiModel, resolveAiForCommand } = await import("../src/ui/ai-model");
const { assertGoogleProvider } = await import("../src/ui/video-import");
type GramConfig = import("../src/types").GramConfig;

function labels(prompt: Prompt): string[] {
	return (prompt.options ?? []).map((o) => o.label);
}

describe("pickAiModel", () => {
	beforeEach(() => {
		asked.length = 0;
		answers = [];
	});

	it("offers every provider, then that provider's recommended models", async () => {
		answers = ["anthropic", "claude-haiku-4.5"];
		const picked = await pickAiModel();

		expect(picked).toEqual({
			provider: "anthropic",
			model: "claude-haiku-4.5",
		});
		expect(labels(asked[0])).toEqual([
			"Google (Gemini)",
			"OpenAI (ChatGPT)",
			"Anthropic (Claude)",
			"Ollama (Local)",
		]);
		expect(labels(asked[1])).toEqual([
			"claude-sonnet-4.6 (Recommended)",
			"claude-haiku-4.5",
			"claude-fable-5",
			"Other (Manual entry)",
		]);
	});

	it("keeps an off-list model in the running, without calling it recommended", async () => {
		answers = ["google", "gemini-2.0-legacy"];
		await pickAiModel({
			provider: "google",
			model: "gemini-2.0-legacy",
			providerSource: "config",
			modelSource: "config",
		});

		expect(labels(asked[1])).toEqual([
			"gemini-2.0-legacy (current)",
			"gemini-3.5-flash (Recommended)",
			"gemini-3.1-pro",
			"Other (Manual entry)",
		]);
	});

	it("does not list the current model twice when it is already recommended", async () => {
		answers = ["google", "gemini-3.1-pro"];
		await pickAiModel({
			provider: "google",
			model: "gemini-3.1-pro",
			providerSource: "config",
			modelSource: "config",
		});

		expect(labels(asked[1])).toEqual([
			"gemini-3.5-flash (Recommended)",
			"gemini-3.1-pro",
			"Other (Manual entry)",
		]);
	});

	it("asks for a name when the model is not on the list", async () => {
		answers = ["openai", "other", "gpt-6-preview"];
		const picked = await pickAiModel();

		expect(picked).toEqual({ provider: "openai", model: "gpt-6-preview" });
		expect(asked).toHaveLength(3);
	});

	it("returns null when the provider prompt is canceled", async () => {
		answers = [CANCEL];
		expect(await pickAiModel()).toBeNull();
	});

	it("returns null when the model prompt is canceled", async () => {
		answers = ["google", CANCEL];
		expect(await pickAiModel()).toBeNull();
	});

	it("returns null on an empty manual entry rather than an empty model name", async () => {
		answers = ["google", "other", ""];
		expect(await pickAiModel()).toBeNull();
	});
});

// `--provider anthropic` on a YouTube URL used to fail on "Missing
// ANTHROPIC_API_KEY" — true, but not why the run could never work, since no
// key would have helped: video import needs Google specifically. The fix
// makes resolveAiForCommand check a caller-supplied `validate` against the
// resolved selection BEFORE attempting to build the client, so a rejection
// like "needs Google" surfaces instead of a credential error that was never
// the real problem.
describe("resolveAiForCommand — validate runs before the client is built", () => {
	const PROVIDER_ENV_VARS = [
		"GEMINI_API_KEY",
		"OPENAI_API_KEY",
		"ANTHROPIC_API_KEY",
	];
	const previous: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const k of PROVIDER_ENV_VARS) {
			previous[k] = process.env[k];
			delete process.env[k];
		}
	});
	afterEach(() => {
		for (const k of PROVIDER_ENV_VARS) {
			if (previous[k] === undefined) delete process.env[k];
			else process.env[k] = previous[k];
		}
	});

	it("surfaces a validate rejection instead of the credential error it would otherwise hit first", async () => {
		// No ANTHROPIC_API_KEY anywhere — buildAiModel would throw "Missing
		// ANTHROPIC_API_KEY" if validate did not stop things first.
		const config: GramConfig = { ai: { provider: "anthropic" } };
		await expect(
			resolveAiForCommand(config, {}, undefined, () => {
				throw new Error("rejected by validate");
			}),
		).rejects.toThrow("rejected by validate");
	});

	it("still builds the client, using the resolved selection, when validate raises no objection", async () => {
		process.env.ANTHROPIC_API_KEY = "sk-ant-test";
		const config: GramConfig = { ai: { provider: "anthropic" } };
		const seenProviders: string[] = [];

		const { selection } = await resolveAiForCommand(
			config,
			{},
			undefined,
			(sel) => {
				seenProviders.push(sel.provider);
			},
		);

		expect(selection.provider).toBe("anthropic");
		expect(seenProviders).toEqual(["anthropic"]);
	});

	it("does not require a validate callback at all — db lint/enrich pass none", async () => {
		process.env.GEMINI_API_KEY = "sk-google-test";
		const config: GramConfig = { ai: { provider: "google" } };
		await expect(resolveAiForCommand(config, {})).resolves.toMatchObject({
			selection: { provider: "google" },
		});
	});
});

// assertGoogleProvider is the single enforcement point behind "video import
// needs Google": @ai-sdk/google is the only provider that passes a YouTube
// URL through untouched (services/youtube.ts's parseYoutubeUrl docblock) —
// any other provider silently downloads the watch page and sends its HTML to
// the model labelled as video/mp4.
describe("assertGoogleProvider", () => {
	afterEach(() => {
		errors.length = 0;
	});

	it("passes silently for google", () => {
		expect(() => assertGoogleProvider("google", undefined)).not.toThrow();
		expect(errors).toEqual([]);
	});

	it.each([
		"anthropic",
		"openai",
		"ollama",
	] as const)("exits and names the offending provider for %s", (provider) => {
		const exit = spyOn(process, "exit").mockImplementation(((): never => {
			throw new Error("__would_exit__");
		}) as never);
		try {
			expect(() => assertGoogleProvider(provider, undefined)).toThrow(
				"__would_exit__",
			);
			expect(errors.join(" ")).toContain("needs the Google provider");
			expect(errors.join(" ")).toContain(`"${provider}"`);
		} finally {
			exit.mockRestore();
		}
	});
});
