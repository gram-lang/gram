import { describe, it, expect } from "bun:test";
import { assertPublicUrl } from "../src/core/ssrf";
import { GramCLIError } from "../src/errors";

// Regression tests for the audit (2026-07-22, cli finding I-2, SSRF):
// `gram import <url>` fetched any http(s) URL and sent the response body
// straight into an AI prompt, with no check on the destination —
// `gram import http://169.254.169.254/latest/meta-data/...` exfiltrates a
// cloud metadata endpoint to a third-party LLM. All cases below use literal
// IP addresses (no DNS lookup needed) so the parameterized sweep is fast and
// network-independent, matching the audit's own closure criterion: "a
// parameterized test over the list of forbidden ranges".

describe("assertPublicUrl", () => {
	const forbidden = [
		["http://0.0.0.0/", "this-network"],
		["http://10.0.0.5/", "RFC1918 private (10/8)"],
		["http://100.64.0.1/", "CGNAT"],
		["http://127.0.0.1/", "loopback"],
		["http://169.254.169.254/", "link-local / cloud metadata"],
		["http://172.16.5.5/", "RFC1918 private (172.16/12)"],
		["http://192.168.1.1/", "RFC1918 private (192.168/16)"],
		["http://198.18.0.1/", "benchmarking"],
		["http://224.0.0.1/", "multicast"],
		["http://[::1]/", "IPv6 loopback"],
		["http://[fe80::1]/", "IPv6 link-local"],
		["http://[fc00::1]/", "IPv6 unique-local"],
		["http://[::ffff:169.254.169.254]/", "IPv4-mapped IPv6 metadata address"],
		["http://localhost/", "localhost"],
		["http://LOCALHOST/", "localhost (case-insensitive)"],
	] as const;

	for (const [url, label] of forbidden) {
		it(`rejects ${label} (${url})`, async () => {
			await expect(assertPublicUrl(url)).rejects.toThrow(GramCLIError);
		});
	}

	it("rejects a non-http(s) protocol", async () => {
		await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(
			GramCLIError,
		);
	});

	it("rejects a malformed URL", async () => {
		await expect(assertPublicUrl("not a url")).rejects.toThrow(GramCLIError);
	});

	it("accepts a public IPv4 literal", async () => {
		await expect(
			assertPublicUrl("http://93.184.216.34/"),
		).resolves.toBeUndefined();
	});

	it("accepts a public IPv6 literal", async () => {
		await expect(
			assertPublicUrl("http://[2001:4860:4860::8888]/"),
		).resolves.toBeUndefined();
	});
});
