import { fileURLToPath } from "node:url";

/**
 * Resolves workspace folder URIs to local filesystem paths, skipping any
 * that aren't `file:` URIs (a virtual/remote workspace folder —
 * vscode-vfs://, untitled:, etc.) instead of throwing.
 *
 * `fileURLToPath` throws on any non-`file:`
 * URI, which used to crash server initialization for the whole session
 * before it could even respond to the client.
 */
export function resolveWorkspaceFolders(
	folders: ReadonlyArray<{ uri: string }> | null | undefined,
): string[] {
	return (folders ?? []).flatMap((f) => {
		try {
			return f.uri.startsWith("file:") ? [fileURLToPath(f.uri)] : [];
		} catch {
			return [];
		}
	});
}
