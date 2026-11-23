import { defineCommand } from "citty";
import { version } from "../../package.json";

export default defineCommand({
	meta: {
		name: "lsp",
		version,
		description: "Start the Gram language server over stdio",
	},
	args: {
		// No-op: stdio is the only transport `gram lsp` offers, and the server
		// picks it by default. Declared so editor configs that pass `--stdio`
		// (the usual LSP convention) don't make citty print the usage on stdout,
		// which would corrupt the JSON-RPC stream.
		stdio: {
			type: "boolean",
			description: "Use stdio (the default and only transport)",
		},
	},
	async run() {
		// Same process, no child: the server reads the transport from
		// process.argv (it injects --stdio when none is given), owns stdin and
		// stdout, and handles `exit` itself. citty's runMain doesn't exit after
		// the command, so the event loop stays open on stdin.
		await import("@gram-lang/language-server");
	},
});
