// Conifer forest. Procedural spruce-like trees (star-shaped branch tiers drooping at the tips, a dark
// underside, AO in the vertex colours) in two levels of detail. Instances carry only (x, z, rotation,
// scale, random); the height comes from the heightfield in the vertex shader, so the trees ride the
// half-gravity mountains, drown below the universe's sea and thin out with its tree density.
// LOD buckets are rebuilt on the CPU when the camera has moved (the forest is static).
import * as THREE from 'three/webgpu';
import {
	Fn, vec3, vec4, float, positionLocal, normalLocal, instancedDynamicBufferAttribute, vertexColor, sin, cos, time,
	step, mix, hash, smoothstep, select,
} from 'three/tsl';
import { U } from './world.js';
import { mulberry32, fbm2, smooth } from './noise.js';

function conifer({ tiers, seg, under, H = 12, R = 3.0, seed = 1 }) {
	const rnd = mulberry32(seed);
	const P = [], C = [], I = [];
	const v = (x, y, z, c) => { P.push(x, y, z); C.push(c[0], c[1], c[2]); return P.length / 3 - 1; };
	// trunk
	const trunkTop = H * 0.55, tr = 0.32;
	const bark = [0.32, 0.24, 0.18], barkDark = [0.12, 0.09, 0.07];
	const tb = [], tt = [];
	for (let s = 0; s < 6; s++) {
		const a = (s / 6) * Math.PI * 2;
		tb.push(v(Math.cos(a) * tr, -0.4, Math.sin(a) * tr, barkDark));
		tt.push(v(Math.cos(a) * tr * 0.35, trunkTop, Math.sin(a) * tr * 0.35, bark));
	}
	for (let s = 0; s < 6; s++) {
		const n = (s + 1) % 6;
		I.push(tb[s], tt[s], tb[n], tb[n], tt[s], tt[n]);
	}
	// tiers from the bottom (wide) to the top (narrow)
	for (let k = 0; k < tiers; k++) {
		const f = k / tiers;
		const y0 = 1.6 + f * (H - 2.6);
		const rad = R * Math.pow(1 - f, 0.95) + 0.35;
		const tierH = (H - 1.6) / tiers * 1.9;
		const droop = rad * 0.38;
		const rot = rnd() * Math.PI * 2;
		const apex = v(0, y0 + tierH, 0, [1.05, 1.1, 1.0]);
		const ring = [], inner = [];
		for (let s = 0; s < seg; s++) {
			const a = rot + (s / seg) * Math.PI * 2;
			// star silhouette: branch tips alternate with notches between them
			const tip = s % 2 === 0;
			const rr = rad * (tip ? 1 + (rnd() - 0.5) * 0.25 : 0.62);
			const yy = y0 - (tip ? droop : droop * 0.35) + (rnd() - 0.5) * 0.25;
			const shade = tip ? [1.15, 1.2, 1.05] : [0.75, 0.78, 0.75];
			ring.push(v(Math.cos(a) * rr, yy, Math.sin(a) * rr, shade));
			if (under) inner.push(v(Math.cos(a) * rr * 0.3, yy + tierH * 0.18, Math.sin(a) * rr * 0.3, [0.28, 0.3, 0.28]));
		}
		for (let s = 0; s < seg; s++) {
			const n = (s + 1) % seg;
			I.push(apex, ring[n], ring[s]);
			if (under) I.push(ring[s], ring[n], inner[s], inner[s], ring[n], inner[n]);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
	g.setIndex(I);
	g.computeVertexNormals();
	// soften the normals toward a rounded crown (reads as foliage, not as facets)
	const pos = g.attributes.position, nor = g.attributes.normal;
	const tmp = new THREE.Vector3(), out = new THREE.Vector3();
	for (let i = 0; i < pos.count; i++) {
		tmp.set(pos.getX(i), (pos.getY(i) - H * 0.45) * 0.6, pos.getZ(i)).normalize();
		out.set(nor.getX(i), nor.getY(i), nor.getZ(i)).lerp(tmp, 0.55).normalize();
		nor.setXYZ(i, out.x, out.y, out.z);
	}
	return g;
}

function deadTree(seed) {
	const rnd = mulberry32(seed);
	const parts = [];
	const trunk = new THREE.CylinderGeometry(0.06, 0.32, 9, 7, 1, true);
	trunk.translate(0, 4.5, 0);
	parts.push(trunk);
	for (let b = 0; b < 4; b++) {
		const len = 1.2 + rnd() * 1.8;
		const br = new THREE.CylinderGeometry(0.02, 0.08, len, 5, 1, true);
		br.translate(0, len / 2, 0);
		br.rotateZ(0.9 + rnd() * 0.5);
		br.rotateY(rnd() * Math.PI * 2);
		br.translate(0, 3.5 + rnd() * 4.5, 0);
		parts.push(br);
	}
	const g = mergeGeometries(parts);
	const n = g.attributes.position.count;
	g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
	return g;
}

function mergeGeometries(list) {
	let count = 0, icount = 0;
	for (const g of list) { count += g.attributes.position.count; icount += g.index ? g.index.count : g.attributes.position.count; }
	const P = new Float32Array(count * 3), N = new Float32Array(count * 3), I = [];
	let o = 0;
	for (const g of list) {
		P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
		if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + o);
		o += g.attributes.position.count;
	}
	const m = new THREE.BufferGeometry();
	m.setAttribute('position', new THREE.BufferAttribute(P, 3));
	m.setAttribute('normal', new THREE.BufferAttribute(N, 3));
	m.setIndex(I);
	return m;
}

function treeMaterial(hf, attr, { dead = false } = {}) {
	const mat = new THREE.MeshStandardNodeMaterial();
	const inst = instancedDynamicBufferAttribute(attr.a, 'vec4');
	const extra = instancedDynamicBufferAttribute(attr.b, 'vec4');
	mat.positionNode = Fn(() => {
		const base = hf.heightNode(inst.xy);
		const rnd = extra.x;
		const alive = dead
			? float(1)
			: step(rnd, U.treeDensity).mul(step(U.sea.add(1.5), base));
		const s = inst.w.mul(alive);
		const sx = s.mul(dead ? float(1) : U.treeW), sy = s.mul(dead ? float(1) : U.treeH);
		const c = cos(inst.z), sn = sin(inst.z);
		const lp = positionLocal;
		// wind: crowns sway, more toward the top
		const sway = sin(time.mul(1.1).add(rnd.mul(30))).mul(0.018).mul(lp.y.mul(lp.y)).mul(0.08);
		const x = lp.x.mul(c).sub(lp.z.mul(sn)).mul(sx).add(sway);
		const z = lp.x.mul(sn).add(lp.z.mul(c)).mul(sx);
		const n = normalLocal;
		normalLocal.assign(vec3(n.x.mul(c).sub(n.z.mul(sn)), n.y, n.x.mul(sn).add(n.z.mul(c))));
		return vec3(x.add(inst.x), lp.y.mul(sy).add(base).sub(0.25), z.add(inst.y));
	})();
	const tint = mix(0.72, 1.25, extra.y);
	mat.colorNode = dead
		? vec3(0.13, 0.11, 0.095).mul(tint)
		: U.tree.mul(vertexColor()).mul(tint).mul(vec3(1.0, mix(0.95, 1.1, extra.z), 1.0));
	mat.roughnessNode = float(0.88);
	return mat;
}

export class Forest {
	constructor(hf, { cliff, count = 70000, near = 260 } = {}) {
		this.hf = hf;
		this.near = near;
		this.group = new THREE.Group();
		this.group.name = 'forest';
		this._place(cliff, count);

		const nearGeo = conifer({ tiers: 11, seg: 14, under: true, seed: 3 });
		const farGeo = conifer({ tiers: 4, seg: 8, under: false, seed: 5 });
		this.lods = [nearGeo, farGeo].map((g, k) => {
			const ig = new THREE.InstancedBufferGeometry();
			ig.index = g.index;
			for (const name of ['position', 'normal', 'color']) ig.setAttribute(name, g.attributes[name]);
			const n = this.count;
			const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
			const b = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
			ig.setAttribute('instA', a); ig.setAttribute('instB', b);
			ig.instanceCount = 0;
			const mesh = new THREE.Mesh(ig, treeMaterial(hf, { a, b }));
			mesh.frustumCulled = false;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.name = k === 0 ? 'trees-near' : 'trees-far';
			this.group.add(mesh);
			return { mesh, a, b };
		});
		this._last = new THREE.Vector3(1e9, 0, 0);
	}

	_place(cliff, target) {
		const hf = this.hf;
		const rnd = mulberry32(17);
		const pts = [];
		const step = 3.4;
		for (let bz = hf.y0 + 4; bz < hf.y1 - 4; bz += step) {
			for (let x = hf.x0 + 4; x < hf.x1 - 4; x += step) {
				const px = x + (rnd() - 0.5) * step, by = bz + (rnd() - 0.5) * step;
				const wz = -by;
				const h = hf.height(px, wz);
				if (h < 1.5 || h > 175) continue;
				const ny = hf.normal(px, wz).y;
				const slope = smooth(0.5, 0.8, ny);
				const clump = smooth(0.32, 0.55, fbm2(px / 55, by / 55, 3));
				const line = 1 - smooth(110, 175, h + (fbm2(px / 30, by / 30, 2) - 0.5) * 40);
				if (Math.hypot(px - cliff[0], by - cliff[1]) < 36) continue;
				const w = slope * clump * line;
				if (rnd() > w) continue;
				pts.push(px, wz, rnd() * Math.PI * 2, 0.75 + rnd() * 0.6, rnd(), rnd(), rnd());
			}
		}
		this.count = Math.min(pts.length / 7, target);
		this.data = new Float32Array(pts.slice(0, this.count * 7));
	}

	update(camera) {
		if (camera.position.distanceToSquared(this._last) < 20 * 20) return;
		this._last.copy(camera.position);
		const [n, f] = this.lods;
		const cx = camera.position.x, cz = camera.position.z, r2 = this.near * this.near;
		let ni = 0, fi = 0;
		const d = this.data;
		for (let i = 0; i < this.count; i++) {
			const o = i * 7;
			const dx = d[o] - cx, dz = d[o + 1] - cz;
			const L = dx * dx + dz * dz < r2 ? n : f;
			const k = L === n ? ni++ : fi++;
			L.a.array[k * 4] = d[o]; L.a.array[k * 4 + 1] = d[o + 1]; L.a.array[k * 4 + 2] = d[o + 2]; L.a.array[k * 4 + 3] = d[o + 3];
			L.b.array[k * 4] = d[o + 4]; L.b.array[k * 4 + 1] = d[o + 5]; L.b.array[k * 4 + 2] = d[o + 6]; L.b.array[k * 4 + 3] = 0;
		}
		n.mesh.geometry.instanceCount = ni; f.mesh.geometry.instanceCount = fi;
		for (const L of this.lods) { L.a.needsUpdate = true; L.b.needsUpdate = true; }
	}
}

/** Drowned forest: bare trunks standing in the shallows of the 2300 sea (only in that universe). */
export function createDeadTrees(hf, { seaFuture = 9, count = 90 } = {}) {
	const rnd = mulberry32(5);
	const pts = [];
	let tries = 0;
	while (pts.length / 7 < count && tries++ < 60000) {
		const x = -260 + rnd() * 300, by = 120 + rnd() * 300;
		const h = hf.height(x, -by);
		if (h > seaFuture - 6 && h < seaFuture - 0.5) pts.push(x, -by, rnd() * 6.28, 0.6 + rnd() * 0.6, rnd(), rnd(), 0);
	}
	const n = pts.length / 7;
	const g = deadTree(9);
	const ig = new THREE.InstancedBufferGeometry();
	ig.index = g.index;
	for (const name of ['position', 'normal', 'color']) ig.setAttribute(name, g.attributes[name]);
	const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
	const b = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
	for (let i = 0; i < n; i++) {
		a.array.set(pts.slice(i * 7, i * 7 + 4), i * 4);
		b.array.set([pts[i * 7 + 4], pts[i * 7 + 5], 0, 0], i * 4);
	}
	ig.setAttribute('instA', a); ig.setAttribute('instB', b);
	ig.instanceCount = n;
	const mesh = new THREE.Mesh(ig, treeMaterial(hf, { a, b }, { dead: true }));
	mesh.frustumCulled = false;
	mesh.castShadow = true;
	mesh.name = 'dead-trees';
	return mesh;
}
