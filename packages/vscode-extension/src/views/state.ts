import {
	type Content,
	contentOf,
	type PausedError,
	type ViewUpdate,
} from "./protocol";

/** What one panel shows: the last content of its output, and why it is paused. */
export interface PanelView {
	content: Content | undefined;
	paused: PausedError | undefined;
}

const keyOf = (uri: string, outputId: string) => `${uri}\n${outputId}`;

/**
 * What the panels show, kept apart from VS Code so it can be tested: the last
 * content of every output of every document, whether it is paused, and which
 * outputs the server was told are open.
 *
 * The content is kept while an output is paused, so a panel shows the last
 * valid one, dimmed, rather than blinking at every transient typo.
 */
export class ViewsState {
	private readonly contents = new Map<string, Content>();
	private readonly pauses = new Map<string, PausedError>();
	/** The open set last sent for each document, as sorted ids. */
	private readonly sent = new Map<string, string>();

	constructor(
		private readonly sendOpenViews: (uri: string, viewIds: string[]) => void,
	) {}

	/** Records an update. Returns the view of its output afterwards. */
	apply(update: ViewUpdate): PanelView {
		const key = keyOf(update.uri, update.outputId);
		if (update.state === "ok") {
			this.contents.set(key, contentOf(update.payload));
			this.pauses.delete(key);
		} else {
			this.pauses.set(key, update.error);
		}
		return this.viewOf(update.uri, update.outputId);
	}

	viewOf(uri: string, outputId: string): PanelView {
		const key = keyOf(uri, outputId);
		return { content: this.contents.get(key), paused: this.pauses.get(key) };
	}

	/**
	 * Tells the server what is open: `outputIds` for `uri` (the document the
	 * panels follow), nothing for any other document. Sends only what changed.
	 */
	syncOpen(uri: string | undefined, outputIds: Iterable<string>): void {
		const ids = [...new Set(outputIds)].sort();
		for (const other of [...this.sent.keys()]) {
			if (other === uri && ids.length > 0) continue;
			this.sent.delete(other);
			this.sendOpenViews(other, []);
		}
		if (!uri || ids.length === 0) return;
		const set = ids.join("\n");
		if (this.sent.get(uri) === set) return;
		this.sent.set(uri, set);
		this.sendOpenViews(uri, ids);
	}

	/**
	 * Forgets a closed document: the server forgot what was open for it, so
	 * the open set is sent again if it comes back, and its content is gone.
	 */
	forget(uri: string): void {
		this.sent.delete(uri);
		const prefix = `${uri}\n`;
		for (const map of [this.contents, this.pauses]) {
			for (const key of [...map.keys()]) {
				if (key.startsWith(prefix)) map.delete(key);
			}
		}
	}
}
