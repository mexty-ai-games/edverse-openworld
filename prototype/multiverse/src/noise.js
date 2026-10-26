// Small deterministic helpers for CPU-side placement.
export function mulberry32(a) {
	return function () {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hash2(i, j) {
	let h = (i * 374761393 + j * 668265263) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1]. */
export function vnoise(x, y) {
	const i = Math.floor(x), j = Math.floor(y);
	const fx = x - i, fy = y - j;
	const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
	const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
	return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm2(x, y, oct = 4) {
	let s = 0, a = 0.5, f = 1, t = 0;
	for (let k = 0; k < oct; k++) { s += vnoise(x * f, y * f) * a; t += a; a *= 0.5; f *= 2.03; }
	return s / t;
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
