import {
	type Content,
	contentOf,
	type PausedError,
	type Session,
	type SessionPatch,
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
	/** What the cook chose for each document this sitting. */
	private readonly sessions = new Map<string, Session>();

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

	sessionOf(uri: string): Session {
		return this.sessions.get(uri) ?? {};
	}

	/**
	 * Applies a change to the session of `uri`: each part given replaces the
	 * last, `null` (or `undefined`) clears it. Returns the whole session to
	 * send, which the server takes as a replacement, or `undefined` when
	 * nothing changed.
	 */
	updateSession(uri: string, patch: SessionPatch): Session | undefined {
		const previous = this.sessionOf(uri);
		const next: Record<string, unknown> = { ...previous };
		for (const [key, value] of Object.entries(patch)) {
			if (value === null || value === undefined) delete next[key];
			else next[key] = value;
		}
		const session = next as Session;
		if (JSON.stringify(sorted(session)) === JSON.stringify(sorted(previous)))
			return undefined;
		if (Object.keys(session).length === 0) this.sessions.delete(uri);
		else this.sessions.set(uri, session);
		return session;
	}

	/**
	 * Forgets a closed document: the server forgot what was open for it and
	 * its session, so the open set is sent again if it comes back, and its
	 * content and serving time are gone.
	 */
	forget(uri: string): void {
		this.sent.delete(uri);
		this.sessions.delete(uri);
		const prefix = `${uri}\n`;
		for (const map of [this.contents, this.pauses]) {
			for (const key of [...map.keys()]) {
				if (key.startsWith(prefix)) map.delete(key);
			}
		}
	}
}

/** `session` with its keys in a stable order, to compare two of them. */
function sorted(session: Session): [string, unknown][] {
	return Object.entries(session).sort(([a], [b]) => a.localeCompare(b));
}
