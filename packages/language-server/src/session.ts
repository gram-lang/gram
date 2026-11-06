import type { ScaleRequest } from "@gram-lang/kitchen";
import { isCalendarDate } from "@gram-lang/scheduler";

/**
 * What the cook chose for this sitting with one recipe, sent by the client in
 * `gram/setSession`: when it is served, how much is made, which imports are
 * already in stock, the baker's math reference. Kept per document, in memory
 * only: forgotten when the document closes or the server restarts, so a plan is
 * never laid out on a serving time already past.
 */
export interface Session {
	/** A local date-time, "2026-10-11T13:00", in the kitchen's time zone. */
	serveAt?: string;
	scale?: ScaleRequest;
	/** The `@use` imports already made, by the URI they resolve to. */
	stock?: string[];
	/** The ingredient id the baker's percentages are computed against. */
	bakersReference?: string;
}

const SERVE_AT = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})$/;

/** "2026-10-11 9:30" or "2026-10-11T09:30" as "2026-10-11T09:30"; anything else, `undefined`. */
function parseServeAt(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const m = SERVE_AT.exec(raw.trim());
	if (!m || !isCalendarDate(m[1]!)) return undefined;
	const hour = Number(m[2]);
	const minute = Number(m[3]);
	if (hour > 23 || minute > 59) return undefined;
	return `${m[1]}T${m[2]?.padStart(2, "0")}:${m[3]}`;
}

const isPositive = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && value > 0;

function parseScale(raw: unknown): ScaleRequest | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const scale = raw as Record<string, unknown>;
	if (scale.type === "factor" && isPositive(scale.value)) {
		// ×1 is no scale at all: one compilation is enough.
		return scale.value === 1
			? undefined
			: { type: "factor", value: scale.value };
	}
	if (
		scale.type === "target" &&
		typeof scale.id === "string" &&
		scale.id !== "" &&
		isPositive(scale.qty)
	) {
		return {
			type: "target",
			id: scale.id,
			qty: scale.qty,
			unit:
				typeof scale.unit === "string" && scale.unit !== "" ? scale.unit : null,
		};
	}
	return undefined;
}

function parseStock(raw: unknown): string[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const uris = [
		...new Set(
			raw.filter((u): u is string => typeof u === "string" && u !== ""),
		),
	].sort();
	return uris.length > 0 ? uris : undefined;
}

/**
 * The session of a `gram/setSession` message. Tolerant like the view settings:
 * a part it cannot read is left out (no serving time, no scale, ...), it never
 * throws, so a bad message never blanks a view.
 */
export function parseSession(raw: unknown): Session {
	if (!raw || typeof raw !== "object") return {};
	const params = raw as Record<string, unknown>;
	const session: Session = {};
	const serveAt = parseServeAt(params.serveAt);
	if (serveAt) session.serveAt = serveAt;
	const scale = parseScale(params.scale);
	if (scale) session.scale = scale;
	const stock = parseStock(params.stock);
	if (stock) session.stock = stock;
	if (
		typeof params.bakersReference === "string" &&
		params.bakersReference !== ""
	) {
		session.bakersReference = params.bakersReference;
	}
	return session;
}

/** The parts of a session that change what is compiled, not only how it is laid out. */
export type CompileSession = Pick<
	Session,
	"scale" | "stock" | "bakersReference"
>;

/** The compile part of `session`, or `undefined` when the source as written is enough. */
export function compileSessionOf(session: Session): CompileSession | undefined {
	const { scale, stock, bakersReference } = session;
	if (!scale && !stock && !bakersReference) return undefined;
	return {
		...(scale && { scale }),
		...(stock && { stock }),
		...(bakersReference && { bakersReference }),
	};
}

/** Whether going from `a` to `b` needs the views compiled again. */
export function compileSessionChanged(a: Session, b: Session): boolean {
	return (
		JSON.stringify(compileSessionOf(a) ?? null) !==
		JSON.stringify(compileSessionOf(b) ?? null)
	);
}
