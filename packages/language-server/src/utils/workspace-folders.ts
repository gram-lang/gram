import { fileURLToPath } from "node:url";

/**
 * Resolves workspace folder URIs to local filesystem paths, skipping any
 * that aren't `file:` URIs (a virtual/remote workspace folder —
 * vscode-vfs://, untitled:, etc.) instead of throwing.
 *
 * `fileURLToPath` throws on any non-`file:`
 * URI, which used to crash server initialization for the whole session
 * before it could even respond to the client.
 *
 * A client that sends no workspace folders (an older or minimal client, or
 * one opened on a single directory) may still send `rootUri`: it stands for
 * the one folder, so `.gram/ingredients.yaml` is found there too.
 */
export function resolveWorkspaceFolders(
	folders: ReadonlyArray<{ uri: string }> | null | undefined,
	rootUri?: string | null,
): string[] {
	const uris = folders?.length
		? folders.map((f) => f.uri)
		: rootUri
			? [rootUri]
			: [];
	return uris.flatMap((uri) => {
		try {
			return uri.startsWith("file:") ? [fileURLToPath(uri)] : [];
		} catch {
			return [];
		}
	});
}
