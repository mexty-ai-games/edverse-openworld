// Physically based sky, computed once per universe on the CPU (the sun never moves inside a universe).
// Same medium as Hillaire 2020 / Tidewater's Atmosphere.js (Rayleigh, Mie, ozone layer; km inside the
// planet model): a transmittance table, then single scattering ray-marched into an equirectangular sky
// panorama. The panorama is the sky dome's texture, the fog's colour source and, through PMREM, the
// image-based light. The sun's colour at the ground is the transmittance toward it.
import * as THREE from 'three/webgpu';

const RG = 6360.0;
const RT = 6460.0;
const VIEW_H = RG + 0.05; // km: the promontory, ~50 m above the sea
export const SUN_ILLUMINANCE = 20.0;

const T_W = 128, T_H = 64; // transmittance table: (mu, height)
export const SKY_W = 512, SKY_H = 256;

function medium(h, p) {
	const ray = Math.exp(-h / 8.0) * p.rayleigh;
	const mie = Math.exp(-h / 1.2) * p.mie;
	const oz = Math.max(0, 1 - Math.abs(h - 25) / 15) * p.ozone;
	return {
		rs: [5.802e-3 * ray, 13.558e-3 * ray, 33.1e-3 * ray],
		ms: 3.996e-3 * mie,
		ext: [
			5.802e-3 * ray + 4.44e-3 * mie + 0.65e-3 * oz,
			13.558e-3 * ray + 4.44e-3 * mie + 1.881e-3 * oz,
			33.1e-3 * ray + 4.44e-3 * mie + 0.085e-3 * oz,
		],
	};
}

// distance to the top of the atmosphere from radius r along cos(zenith) mu
function toTop(r, mu) {
	const disc = r * r * (mu * mu - 1) + RT * RT;
	return Math.max(0, -r * mu + Math.sqrt(Math.max(disc, 0)));
}
function hitsGround(r, mu) {
	return mu < 0 && r * r * (mu * mu - 1) + RG * RG >= 0;
}

function buildTransmittance(p) {
	const T = new Float32Array(T_W * T_H * 3);
	for (let j = 0; j < T_H; j++) {
		const r = RG + (j / (T_H - 1)) * (RT - RG);
		for (let i = 0; i < T_W; i++) {
			const mu = -0.25 + (i / (T_W - 1)) * 1.25;
			const d = toTop(r, mu);
			const n = 40, dt = d / n;
			let o0 = 0, o1 = 0, o2 = 0;
			for (let s = 0; s < n; s++) {
				const t = (s + 0.5) * dt;
				const rr = Math.sqrt(r * r + t * t + 2 * r * mu * t);
				const m = medium(rr - RG, p);
				o0 += m.ext[0] * dt; o1 += m.ext[1] * dt; o2 += m.ext[2] * dt;
			}
			const k = (j * T_W + i) * 3;
			T[k] = Math.exp(-o0); T[k + 1] = Math.exp(-o1); T[k + 2] = Math.exp(-o2);
		}
	}
	return T;
}

function sampleT(T, r, mu, out) {
	const fx = Math.min(Math.max((mu + 0.25) / 1.25, 0), 1) * (T_W - 1);
	const fy = Math.min(Math.max((r - RG) / (RT - RG), 0), 1) * (T_H - 1);
	const x0 = Math.floor(fx), y0 = Math.floor(fy);
	const x1 = Math.min(x0 + 1, T_W - 1), y1 = Math.min(y0 + 1, T_H - 1);
	const ax = fx - x0, ay = fy - y0;
	for (let c = 0; c < 3; c++) {
		const a = T[(y0 * T_W + x0) * 3 + c], b = T[(y0 * T_W + x1) * 3 + c];
		const d = T[(y1 * T_W + x0) * 3 + c], e = T[(y1 * T_W + x1) * 3 + c];
		out[c] = (a * (1 - ax) + b * ax) * (1 - ay) + (d * (1 - ax) + e * ax) * ay;
	}
	return out;
}

const rayPhase = (c) => (3 / (16 * Math.PI)) * (1 + c * c);
function miePhase(c, g) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) * (1 + c * c)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * c, 1.5));
	return k;
}

/**
 * @param {{rayleigh:number, mie:number, ozone:number, mieG:number, sunDir:THREE.Vector3}} p
 * @returns {{ texture: THREE.DataTexture, sunColor: THREE.Color, horizon: THREE.Color, zenith: THREE.Color }}
 */
export function computeSky(p) {
	const T = buildTransmittance(p);
	const sun = p.sunDir.clone().normalize();
	const data = new Uint16Array(SKY_W * SKY_H * 4);
	const tv = [0, 0, 0], tl = [0, 0, 0];
	const toHalf = THREE.DataUtils.toHalfFloat;
	const ground = [0.035, 0.04, 0.045]; // below the horizon: dark planet ground, lit by the sky
	const horizon = new THREE.Color(), zenith = new THREE.Color();
	const N = 28;
	for (let y = 0; y < SKY_H; y++) {
		// equirect: v = 0 at the top in three's equirectUV (y up -> v=1). Rows are written bottom to top.
		const v = (y + 0.5) / SKY_H;
		const elev = (v - 0.5) * Math.PI;
		const sinE = Math.sin(elev), cosE = Math.cos(elev);
		for (let x = 0; x < SKY_W; x++) {
			const u = (x + 0.5) / SKY_W;
			// three.js equirectUV: u = atan(dir.z, dir.x) / (2pi) + 0.5
			const phi = (u - 0.5) * 2 * Math.PI;
			const dx = cosE * Math.cos(phi), dz = cosE * Math.sin(phi), dy = sinE;
			let L0 = 0, L1 = 0, L2 = 0;
			const k = (y * SKY_W + x) * 4;
			const mu = dy;
			const dyEff = Math.max(dy, -0.02);
			if (dy < -0.01) {
				// ground: sun-lit albedo through the air in between
				const cs = Math.max(sun.y, 0);
				sampleT(T, VIEW_H, sun.y, tl);
				L0 = ground[0] * cs * tl[0] * SUN_ILLUMINANCE * 0.4 + 0.02;
				L1 = ground[1] * cs * tl[1] * SUN_ILLUMINANCE * 0.4 + 0.022;
				L2 = ground[2] * cs * tl[2] * SUN_ILLUMINANCE * 0.4 + 0.028;
			} else {
				const len = hitsGround(VIEW_H, dyEff) ? 0 : toTop(VIEW_H, dyEff);
				const dt = len / N;
				const cosT = dx * sun.x + dy * sun.y + dz * sun.z;
				const pr = rayPhase(cosT), pm = miePhase(cosT, p.mieG);
				let o0 = 0, o1 = 0, o2 = 0;
				for (let s = 0; s < N; s++) {
					// quadratic step distribution: denser near the viewer, where the horizon haze lives
					const t0 = len * Math.pow(s / N, 2), t1 = len * Math.pow((s + 1) / N, 2);
					const t = 0.5 * (t0 + t1), st = t1 - t0;
					const px = dx * t, py = VIEW_H + dyEff * t, pz = dz * t;
					const r = Math.sqrt(px * px + py * py + pz * pz);
					const m = medium(r - RG, p);
					o0 += m.ext[0] * st; o1 += m.ext[1] * st; o2 += m.ext[2] * st;
					const sMu = (px * sun.x + py * sun.y + pz * sun.z) / r;
					if (hitsGround(r, sMu)) continue;
					sampleT(T, r, sMu, tl);
					const tv0 = Math.exp(-o0), tv1 = Math.exp(-o1), tv2 = Math.exp(-o2);
					// single scattering + a cheap isotropic multiple-scattering lift
					const ms = 0.12;
					L0 += tv0 * tl[0] * (m.rs[0] * (pr + ms) + m.ms * pm) * st;
					L1 += tv1 * tl[1] * (m.rs[1] * (pr + ms) + m.ms * pm) * st;
					L2 += tv2 * tl[2] * (m.rs[2] * (pr + ms) + m.ms * pm) * st;
				}
				L0 *= SUN_ILLUMINANCE; L1 *= SUN_ILLUMINANCE; L2 *= SUN_ILLUMINANCE;
			}
			data[k] = toHalf(L0); data[k + 1] = toHalf(L1); data[k + 2] = toHalf(L2); data[k + 3] = toHalf(1);
		}
	}
	// reference colours for the haze and the CPU side (fog fallback, UI)
	const sample = (elevDeg, az) => {
		const y = Math.round(((elevDeg / 180) + 0.5) * SKY_H - 0.5);
		const x = Math.round(az * SKY_W);
		const k = (y * SKY_W + (x % SKY_W)) * 4;
		const f = THREE.DataUtils.fromHalfFloat;
		return new THREE.Color(f(data[k]), f(data[k + 1]), f(data[k + 2]));
	};
	horizon.copy(sample(2, 0.25)); zenith.copy(sample(80, 0.25));

	const tex = new THREE.DataTexture(data, SKY_W, SKY_H, THREE.RGBAFormat, THREE.HalfFloatType);
	tex.mapping = THREE.EquirectangularReflectionMapping;
	tex.colorSpace = THREE.LinearSRGBColorSpace;
	tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
	tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.flipY = false;
	tex.needsUpdate = true;

	sampleT(T, VIEW_H, sun.y, tv);
	const sunColor = new THREE.Color(tv[0], tv[1], tv[2]).multiplyScalar(SUN_ILLUMINANCE / 8);
	return { texture: tex, sunColor, horizon, zenith, transmittance: tv.slice() };
}

/** Direction of the sun from Blender's Nishita convention (elevation, rotation in degrees), in three.js axes. */
export function sunDirection(elevDeg, rotDeg) {
	const el = THREE.MathUtils.degToRad(elevDeg), az = THREE.MathUtils.degToRad(rotDeg + 180);
	// Blender's Nishita sky (Z up): (sin az cos el, cos az cos el, sin el), checked against the concept
	// frames; three.js is (x, z, -y)
	const bx = Math.sin(az) * Math.cos(el), by = Math.cos(az) * Math.cos(el), bz = Math.sin(el);
	return new THREE.Vector3(bx, bz, -by).normalize();
}
