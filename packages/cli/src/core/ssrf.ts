import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { GramCLIError, ExitCode } from "../errors";

// IPv4 ranges that must never be reachable from a server-initiated fetch:
// loopback, RFC1918 private ranges, link-local (includes the cloud metadata
// endpoint 169.254.169.254), CGNAT, and a few smaller reserved/special-use
// blocks. Expressed as [network, prefix-length] pairs.
const FORBIDDEN_IPV4_RANGES: [string, number][] = [
	["0.0.0.0", 8], // "this network"
	["10.0.0.0", 8], // RFC1918 private
	["100.64.0.0", 10], // carrier-grade NAT
	["127.0.0.0", 8], // loopback
	["169.254.0.0", 16], // link-local (cloud metadata lives here)
	["172.16.0.0", 12], // RFC1918 private
	["192.0.0.0", 24], // IETF protocol assignments
	["192.168.0.0", 16], // RFC1918 private
	["198.18.0.0", 15], // benchmarking
	["224.0.0.0", 4], // multicast
];

function ipv4ToInt(ip: string): number {
	return (
		ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
	);
}

function isForbiddenIPv4(ip: string): boolean {
	const target = ipv4ToInt(ip);
	return FORBIDDEN_IPV4_RANGES.some(([base, bits]) => {
		const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
		return (target & mask) === (ipv4ToInt(base) & mask);
	});
}

// An IPv4-mapped address's embedded IPv4 part is 2 hex groups (each holding
// 2 bytes) once the WHATWG URL parser canonicalizes it — new URL("http://
// [::ffff:169.254.169.254]/").hostname is "[::ffff:a9fe:a9fe]", not the
// dotted-quad form you'd naively expect from the input string.
function hexGroupsToIPv4(a: string, b: string): string {
	const av = parseInt(a, 16);
	const bv = parseInt(b, 16);
	return [av >> 8, av & 0xff, bv >> 8, bv & 0xff].join(".");
}

// IPv6: exact/prefix checks for the reserved ranges relevant to this threat
// model (loopback, unique-local, link-local), plus unwrapping an
// IPv4-mapped address back into the IPv4 check above — in whichever of its
// two equivalent textual forms it shows up (dotted-quad, or the canonical
// hex-group form the URL parser normalizes it to).
function isForbiddenIPv6(ip: string): boolean {
	const normalized = ip.toLowerCase();
	if (normalized === "::1" || normalized === "::") return true;
	if (normalized.startsWith("fe80:")) return true; // link-local, fe80::/10
	if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local, fc00::/7

	const dotted = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (dotted?.[1]) return isForbiddenIPv4(dotted[1]);

	const hex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
	if (hex?.[1] && hex[2]) {
		return isForbiddenIPv4(hexGroupsToIPv4(hex[1], hex[2]));
	}

	return false;
}

/**
 * `gram import <url>` used to fetch any http(s) URL and send the response
 * body straight into an AI prompt, with no check on the destination at all —
 * `gram import
 * http://169.254.169.254/latest/meta-data/...` exfiltrates a cloud metadata
 * endpoint to a third-party LLM. This resolves the hostname via DNS (or reads
 * a literal IP directly) and throws unless every resolved address is public.
 *
 * Callers that follow redirects MUST call this again on every hop — a public
 * hostname can still redirect (or, via DNS rebinding, re-resolve) to an
 * internal address, and this function only ever sees the URL it's given.
 */
export async function assertPublicUrl(url: string): Promise<void> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new GramCLIError(`Invalid URL: ${url}`, ExitCode.Error);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new GramCLIError(
			`Refusing to fetch ${url}: only http/https URLs are allowed.`,
			ExitCode.Error,
		);
	}

	// URL.hostname wraps an IPv6 literal in brackets ("[::1]") — strip them so
	// isIP()/the forbidden-range checks see the bare address form they expect.
	const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
	if (hostname.toLowerCase() === "localhost") {
		throw new GramCLIError(
			`Refusing to fetch ${url}: localhost is not a public address.`,
			ExitCode.Error,
		);
	}

	const literalFamily = isIP(hostname);
	let addresses: { address: string; family: number }[];
	if (literalFamily) {
		addresses = [{ address: hostname, family: literalFamily }];
	} else {
		try {
			addresses = await lookup(hostname, { all: true });
		} catch {
			throw new GramCLIError(
				`Could not resolve host: ${hostname}`,
				ExitCode.Error,
			);
		}
	}

	for (const { address, family } of addresses) {
		const forbidden =
			family === 6 ? isForbiddenIPv6(address) : isForbiddenIPv4(address);
		if (forbidden) {
			throw new GramCLIError(
				`Refusing to fetch ${url}: resolves to ${address}, which is not a public address.`,
				ExitCode.Error,
			);
		}
	}
}
