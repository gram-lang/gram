/**
 * A small seeded PRNG (sfc32, seeded through splitmix32), so a fuzz run is a
 * pure function of its seed: same seed, same inputs, on every machine.
 */
export interface Rng {
	/** Uniform float in [0, 1). */
	next(): number;
	/** Uniform integer in [min, max], both inclusive. */
	int(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	chance(probability: number): boolean;
}

function splitmix32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x9e3779b9) >>> 0;
		let z = state;
		z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
		z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
		return (z ^ (z >>> 16)) >>> 0;
	};
}

export function createRng(seed: number): Rng {
	const init = splitmix32(seed);
	let a = init();
	let b = init();
	let c = init();
	let d = init();
	const u32 = (): number => {
		const t = (((a + b) >>> 0) + d) >>> 0;
		d = (d + 1) >>> 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) >>> 0;
		c = ((c << 21) | (c >>> 11)) >>> 0;
		c = (c + t) >>> 0;
		return t;
	};
	for (let i = 0; i < 12; i++) u32();
	const next = () => u32() / 0x100000000;
	return {
		next,
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
		pick: (items) => {
			if (items.length === 0) throw new Error("pick() from an empty list");
			return items[Math.floor(next() * items.length)] as (typeof items)[number];
		},
		chance: (probability) => next() < probability,
	};
}

/** The seed of iteration `index` of a run: each iteration replays on its own. */
export function iterationSeed(seed: number, index: number): number {
	return splitmix32((seed ^ Math.imul(index + 1, 0x27d4eb2d)) >>> 0)();
}
