/**
 * Delta-debugging minimization: the smallest input that still fails the
 * same way, first by whole lines, then by characters. `stillFails` decides
 * what "the same way" means (in practice: same signature).
 */
export function shrink(
	input: string,
	stillFails: (candidate: string) => boolean,
	maxChecks = 5000,
): string {
	let checks = 0;
	const test = (candidate: string) => {
		checks++;
		return stillFails(candidate);
	};

	const ddmin = (units: string[], join: string): string[] => {
		let current = units;
		let granularity = 2;
		while (current.length >= 2 && checks < maxChecks) {
			const chunk = Math.ceil(current.length / granularity);
			let reduced = false;
			for (
				let start = 0;
				start < current.length && checks < maxChecks;
				start += chunk
			) {
				const complement = [
					...current.slice(0, start),
					...current.slice(start + chunk),
				];
				if (complement.length > 0 && test(complement.join(join))) {
					current = complement;
					granularity = Math.max(granularity - 1, 2);
					reduced = true;
					break;
				}
			}
			if (!reduced) {
				if (granularity >= current.length) break;
				granularity = Math.min(granularity * 2, current.length);
			}
		}
		return current;
	};

	const byLines = ddmin(input.split("\n"), "\n").join("\n");
	// Array.from keeps surrogate pairs whole; a lone surrogate stays one unit.
	return ddmin(Array.from(byLines), "").join("");
}
