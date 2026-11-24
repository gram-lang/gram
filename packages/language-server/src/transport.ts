/**
 * Whether the command line already names a transport, read the way
 * `vscode-languageserver`'s `createConnection()` reads it: `--stdio`,
 * `--node-ipc`, `--socket <port>` / `--pipe <name>` (value after a space) or
 * `--socket=<port>` / `--pipe=<name>`.
 *
 * Without one, the server defaults to stdio by adding `--stdio` itself, so the
 * library keeps its own path, including `patchConsole()` (which sends
 * `console.*` to `window/logMessage` instead of the JSON-RPC stream on stdout)
 * that it only applies when it sees `--stdio`.
 */
export function hasTransportFlag(args: readonly string[]): boolean {
	return args.some((arg) => {
		if (arg === "--stdio" || arg === "--node-ipc") return true;
		if (arg === "--socket" || arg === "--pipe") return true;
		const name = arg.split("=")[0];
		return arg.includes("=") && (name === "--socket" || name === "--pipe");
	});
}

/**
 * What `gram-language-server` prints instead of starting, for `--version`
 * (`-v`) or `--help` (`-h`), or `undefined` to start the server. Read before
 * anything else, so these never open a connection that would wait on stdin.
 */
export function commandLineAnswer(
	args: readonly string[],
	version: string,
): string | undefined {
	if (args.includes("--version") || args.includes("-v")) return `${version}\n`;
	if (args.includes("--help") || args.includes("-h")) {
		return [
			`gram-language-server ${version}`,
			"Language server for the Gram recipe language.",
			"",
			"Usage: gram-language-server [--stdio | --node-ipc | --socket=<port> | --pipe=<name>]",
			"",
			"  --stdio       talk over stdin/stdout (the default)",
			"  --node-ipc    talk over a Node IPC channel (VS Code)",
			"  --socket=<port>, --pipe=<name>",
			"                talk over a socket or a named pipe",
			"  -v, --version print the version and exit",
			"  -h, --help    print this help and exit",
			"",
		].join("\n");
	}
	return undefined;
}
