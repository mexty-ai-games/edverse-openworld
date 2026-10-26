// Meadow grass on the promontory (the walkable area). Tufts of curved blades, placed once on the CPU in
// 8 m chunks; each chunk draws a prefix of its shuffled instances, so it thins out smoothly with distance
// (the idea behind Tidewater's GrassField tiers). Blades bend in a travelling wind and shade from a dark
// root to a sunlit tip; the universe sets the colour and how much grass there is.
import * as THREE from 'three/webgpu';
import {
	Fn, vec3, float, positionLocal, normalLocal, attribute, sin, cameraPosition, positionWorld, max, dot, cos, time, mix, step, uv, smoothstep,
	mx_noise_float, vec2, pow,
} from 'three/tsl';
import { U } from './world.js';
import { mulberry32, fbm2, smooth } from './noise.js';

const CELL = 8;

function tuftGeometry(seed) {
	const rnd = mulberry32(seed);
	const P = [], UV = [], I = [];
	const BLADES = 11, SEG = 3;
	for (let b = 0; b < BLADES; b++) {
		const a = rnd() * Math.PI * 2, r = rnd() * 0.16;
		const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
		const h = 0.28 + rnd() * 0.42;
		const lean = 0.08 + rnd() * 0.22;
		const facing = rnd() * Math.PI * 2;
		const w = 0.016 + rnd() * 0.012;
		const fx = Math.cos(facing), fz = Math.sin(facing);
		const base = P.length / 3;
		for (let s = 0; s <= SEG; s++) {
			const t = s / SEG;
			const width = w * (1 - t * 0.92);
			const cx = bx + Math.cos(a) * lean * t * t, cz = bz + Math.sin(a) * lean * t * t;
			const y = h * t;
			P.push(cx - fz * width, y, cz + fx * width, cx + fz * width, y, cz - fx * width);
			UV.push(0, t, 1, t);
		}
		for (let s = 0; s < SEG; s++) {
			const o = base + s * 2;
			I.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
	g.setIndex(I);
	return g;
}

export class Grass {
	constructor(hf, { center, radius = 75, density = 9, exclude = [] } = {}) {
		this.group = new THREE.Group();
		this.group.name = 'grass';
		const rnd = mulberry32(23);
		const cells = new Map();
		const area = Math.PI * radius * radius;
		const n = Math.floor(area * density);
		for (let i = 0; i < n; i++) {
			const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
			const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
			const h = hf.height(x, z);
			if (h < 20) continue;
			const ny = hf.normal(x, z).y;
			let w = smooth(0.82, 0.95, ny) * (0.25 + 0.75 * smooth(0.36, 0.6, fbm2(x / 9, z / 9, 3)));
			for (const e of exclude) w *= smooth(e.r, e.r + 1.2, Math.hypot(x - e.x, z - e.z));
			if (rnd() > w) continue;
			const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
			let c = cells.get(key);
			if (!c) cells.set(key, (c = { x: (Math.floor(x / CELL) + 0.5) * CELL, z: (Math.floor(z / CELL) + 0.5) * CELL, pts: [] }));
			c.pts.push(x, h, z, rnd() * 6.28, 0.6 + rnd() * 0.8, rnd(), rnd(), 0);
		}
		const geo = tuftGeometry(31);
		this.mat = this._material();
		this.chunks = [];
		for (const c of cells.values()) {
			const m = c.pts.length / 8;
			// shuffle so that any prefix is spread over the whole chunk
			for (let i = m - 1; i > 0; i--) {
				const j = Math.floor(rnd() * (i + 1));
				for (let k = 0; k < 8; k++) { const t = c.pts[i * 8 + k]; c.pts[i * 8 + k] = c.pts[j * 8 + k]; c.pts[j * 8 + k] = t; }
			}
			const data = new Float32Array(c.pts);
			const ig = new THREE.InstancedBufferGeometry();
			ig.index = geo.index;
			for (const name of ['position', 'uv', 'normal']) ig.setAttribute(name, geo.attributes[name]);
			const ib = new THREE.InstancedInterleavedBuffer(data, 8);
			ig.setAttribute('gA', new THREE.InterleavedBufferAttribute(ib, 4, 0));
			ig.setAttribute('gB', new THREE.InterleavedBufferAttribute(ib, 4, 4));
			ig.instanceCount = m;
			const y = data[1];
			ig.boundingSphere = new THREE.Sphere(new THREE.Vector3(c.x, y, c.z), CELL);
			const mesh = new THREE.Mesh(ig, this.mat);
			mesh.receiveShadow = true;
			mesh.name = 'grass-chunk';
			this.group.add(mesh);
			this.chunks.push({ mesh, x: c.x, z: c.z, total: m });
		}
	}

	_material() {
		const mat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
		// per instance: gA = (x, y, z, rotation), gB = (scale, random, random, 0)
		const a = attribute('gA', 'vec4');
		const b = attribute('gB', 'vec4');
		mat.positionNode = Fn(() => {
			const lp = positionLocal;
			const t = uv().y;
			const keep = step(b.z, U.grassDensity);
			const s = b.x.mul(keep);
			const c = cos(a.w), sn = sin(a.w);
			const x = lp.x.mul(c).sub(lp.z.mul(sn)).mul(s);
			const z = lp.x.mul(sn).add(lp.z.mul(c)).mul(s);
			const y = lp.y.mul(s);
			// travelling gusts + a quick flutter, bending grows with height^2
			const wp = vec2(a.x, a.z);
			const gust = mx_noise_float(vec3(wp.mul(0.07).sub(vec2(time.mul(0.35), time.mul(0.12))), 0)).mul(0.5).add(0.5);
			const flutter = sin(time.mul(4.0).add(a.x.mul(1.7)).add(a.z.mul(1.3))).mul(0.05);
			const bend = pow(t, 2).mul(gust.mul(0.32).add(flutter)).mul(s);
			normalLocal.assign(vec3(0, 1, 0));
			return vec3(a.x.add(x).add(bend), a.y.add(y).sub(0.03), a.z.add(z).add(bend.mul(0.4)));
		})();
		const t = uv().y;
		const tip = U.grass.mul(1.2).add(vec3(0.015, 0.012, 0.0));
		const root = U.grass.mul(0.22);
		mat.colorNode = mix(root, tip, pow(t, 0.8)).mul(mix(0.8, 1.2, b.y));
		// light through the blades when looking toward the sun (golden-hour backlight)
		const V = cameraPosition.sub(positionWorld).normalize();
		const through = pow(max(dot(V.negate(), U.sunDir), 0), 4).mul(pow(t, 1.5));
		mat.emissiveNode = U.sunColor.mul(U.grass.mul(2.2).add(vec3(0.05, 0.04, 0))).mul(through).mul(0.22);
		mat.roughnessNode = float(0.7);
		return mat;
	}

	update(camera) {
		const cx = camera.position.x, cz = camera.position.z;
		for (const c of this.chunks) {
			const d = Math.hypot(c.x - cx, c.z - cz);
			const f = d < 12 ? 1 : d < 70 ? 1 - smooth(12, 55, d) * 0.88 : 0.08;
			c.mesh.geometry.instanceCount = Math.max(1, Math.floor(c.total * f));
			c.mesh.visible = d < 95;
		}
	}
}
