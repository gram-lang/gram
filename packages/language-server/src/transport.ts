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
