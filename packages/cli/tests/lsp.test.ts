import { describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/*
 * `gram lsp` hands stdout to the language server: one stray byte (an update
 * notice, citty's usage for an unknown `--stdio`) would corrupt the JSON-RPC
 * stream. The full coverage of the server lives in its own package; this only
 * checks that the CLI lets the frames through untouched.
 */

const CLI = join(import.meta.dir, "..", "dist", "index.js");

const frame = (message: object) => {
	const body = JSON.stringify({ jsonrpc: "2.0", ...message });
	return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
};

/** Every byte of `out` belongs to a frame; throws on the first that does not. */
function framesOf(out: Buffer): number {
	let count = 0;
	let rest = out;
	while (rest.length > 0) {
		const header = /^Content-Length: (\d+)\r\n\r\n/.exec(
			rest.subarray(0, 64).toString("latin1"),
		);
		if (!header) throw new Error(`stray bytes: ${rest.subarray(0, 40)}`);
		rest = rest.subarray(header[0].length + Number(header[1]));
		count++;
	}
	return count;
}

describe("gram lsp", () => {
	it("answers a framed initialize with frames only, and exits with 0 after shutdown and exit", async () => {
		if (!existsSync(CLI))
			throw new Error(`${CLI} is missing: run bun run build.`);
		const server = spawn("node", [CLI, "lsp", "--stdio"], {
			stdio: ["pipe", "pipe", "ignore"],
		});
		const closed = new Promise<number | null>((resolve) =>
			server.on("close", resolve),
		);
		let out = Buffer.alloc(0);
		const answered = (id: number) =>
			new Promise<void>((resolve) => {
				const check = () => {
					if (out.includes(`"id":${id},`)) resolve();
				};
				server.stdout.on("data", check);
				check();
			});
		server.stdout.on("data", (chunk: Buffer) => {
			out = Buffer.concat([out, chunk]);
		});

		// Each request waits for its answer: the server stops as soon as stdin
		// closes or `exit` arrives, whatever it has not answered yet.
		const params = { processId: null, rootUri: null, capabilities: {} };
		server.stdin.write(frame({ id: 1, method: "initialize", params }));
		await answered(1);
		expect(out.toString().startsWith("Content-Length: ")).toBe(true);

		server.stdin.write(frame({ id: 2, method: "shutdown" }));
		await answered(2);
		server.stdin.write(frame({ method: "exit" }));
		expect(await closed).toBe(0);
		expect(framesOf(out)).toBeGreaterThanOrEqual(2);
	}, 20_000);
});
