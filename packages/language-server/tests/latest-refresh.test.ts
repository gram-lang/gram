import { describe, expect, it } from "bun:test";
import { LatestRefresh } from "../src/utils/latest-refresh";

const A = "file:///a.gram";
const B = "file:///b.gram";

describe("LatestRefresh", () => {
	it("lets only the latest refresh of a document write", () => {
		const latest = new LatestRefresh();
		const first = latest.begin(A);
		const second = latest.begin(A);
		// The first finishes last: it must not put back its older state.
		expect(latest.isLatest(A, second)).toBe(true);
		expect(latest.isLatest(A, first)).toBe(false);
	});

	it("keeps each document's refreshes apart", () => {
		const latest = new LatestRefresh();
		const a = latest.begin(A);
		const b = latest.begin(B);
		expect(latest.isLatest(A, a)).toBe(true);
		expect(latest.isLatest(B, b)).toBe(true);
	});

	it("outdates every refresh in flight when the document closes, even once it opens again", () => {
		const latest = new LatestRefresh();
		const beforeClose = latest.begin(A);
		latest.forget(A);
		expect(latest.isLatest(A, beforeClose)).toBe(false);
		const reopened = latest.begin(A);
		expect(latest.isLatest(A, beforeClose)).toBe(false);
		expect(latest.isLatest(A, reopened)).toBe(true);
	});
});
