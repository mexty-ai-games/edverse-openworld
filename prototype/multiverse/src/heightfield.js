// The concept's terrain, exported from Blender (tools/export_scene.py, packed by tools/pack_heightfield.py): three planes A (base relief),
// M (mountains), P (promontory + islet); height = max(A + mtn * M, P), so a universe can raise the
// mountains (half gravity) without new data. Blender (x, y, z) is three.js (x, z, -y).
import * as THREE from 'three/webgpu';
import { loadBinary } from './binary.js';
import { Fn, float, int, ivec2, vec2, vec3, vec4, textureLoad, max, clamp, floor, fract, mix, normalize, uniform } from 'three/tsl';

export class Heightfield {
	static async load(url) {
		return new Heightfield(await loadBinary(url));
	}

	constructor(buf) {
		const dv = new DataView(buf);
		this.nx = dv.getUint32(0, true); this.nz = dv.getUint32(4, true);
		this.x0 = dv.getFloat32(8, true); this.x1 = dv.getFloat32(12, true);
		this.y0 = dv.getFloat32(16, true); this.y1 = dv.getFloat32(20, true);
		const n = this.nx * this.nz;
		// int16 planes in 2 cm steps (tools/pack_heightfield.py)
		const step = dv.getFloat32(24, true);
		const q = new Int16Array(buf, 28, n * 3);
		this.A = new Float32Array(n); this.M = new Float32Array(n); this.P = new Float32Array(n);
		for (let i = 0; i < n; i++) { this.A[i] = q[i] * step; this.M[i] = q[n + i] * step; this.P[i] = q[2 * n + i] * step; }
		this.dx = (this.x1 - this.x0) / (this.nx - 1);
		this.dy = (this.y1 - this.y0) / (this.nz - 1);
		this.mtn = 1;

		const rgba = new Float32Array(n * 4);
		for (let i = 0; i < n; i++) { rgba[i * 4] = this.A[i]; rgba[i * 4 + 1] = this.M[i]; rgba[i * 4 + 2] = this.P[i]; rgba[i * 4 + 3] = 1; }
		this.texture = new THREE.DataTexture(rgba, this.nx, this.nz, THREE.RGBAFormat, THREE.FloatType);
		this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
		this.texture.generateMipmaps = false;
		this.texture.needsUpdate = true;

		this.uMtn = uniform(1);
		this.uOrigin = uniform(new THREE.Vector2(this.x0, this.y0));
		this.uStep = uniform(new THREE.Vector2(this.dx, this.dy));
		this._buildNodes();
	}

	// ---- CPU side (player, placement) ----------------------------------------------------------
	hAt(i, j) {
		i = Math.min(Math.max(i, 0), this.nx - 1); j = Math.min(Math.max(j, 0), this.nz - 1);
		const k = j * this.nx + i;
		return Math.max(this.A[k] + this.mtn * this.M[k], this.P[k]);
	}
	/** Height at three.js world (x, z). */
	height(x, z) {
		const fi = (x - this.x0) / this.dx, fj = (-z - this.y0) / this.dy;
		const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
		const h00 = this.hAt(i, j), h10 = this.hAt(i + 1, j), h01 = this.hAt(i, j + 1), h11 = this.hAt(i + 1, j + 1);
		return (h00 * (1 - a) + h10 * a) * (1 - b) + (h01 * (1 - a) + h11 * a) * b;
	}
	normal(x, z, out = new THREE.Vector3()) {
		const e = 2;
		const hx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e);
		const hz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
		return out.set(-hx, 1, -hz).normalize();
	}
	inside(x, z, margin = 0) {
		const bx = x, by = -z;
		return bx > this.x0 + margin && bx < this.x1 - margin && by > this.y0 + margin && by < this.y1 - margin;
	}

	// ---- GPU side ---------------------------------------------------------------------------------
	_buildNodes() {
		const tex = this.texture, nx = this.nx, nz = this.nz, uMtn = this.uMtn;
		const texel = Fn(([ij]) => {
			const c = ivec2(clamp(ij.x, int(0), int(nx - 1)), clamp(ij.y, int(0), int(nz - 1)));
			const s = textureLoad(tex, c);
			return max(s.x.add(uMtn.mul(s.y)), s.z);
		});
		// grid coordinates of a world xz
		const grid = Fn(([xz]) => vec2(xz.x.sub(this.uOrigin.x).div(this.uStep.x), xz.y.negate().sub(this.uOrigin.y).div(this.uStep.y)));
		/** Bilinear height at world xz (vec2). */
		this.heightNode = Fn(([xz]) => {
			const g = grid(xz);
			const g0 = floor(g), f = fract(g);
			const i = int(g0.x), j = int(g0.y);
			const h00 = texel(ivec2(i, j)), h10 = texel(ivec2(i.add(1), j));
			const h01 = texel(ivec2(i, j.add(1))), h11 = texel(ivec2(i.add(1), j.add(1)));
			return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
		});
		/** Height and normal at a grid vertex (exact, no filtering): vec4(normal.xyz, height). */
		this.vertexNode = Fn(([xz]) => {
			const g = grid(xz);
			const i = int(g.x.add(0.5)), j = int(g.y.add(0.5));
			const h = texel(ivec2(i, j));
			const hl = texel(ivec2(i.sub(1), j)), hr = texel(ivec2(i.add(1), j));
			const hd = texel(ivec2(i, j.sub(1))), hu = texel(ivec2(i, j.add(1)));
			const dhdx = hr.sub(hl).div(this.uStep.x.mul(2));
			// grid j runs along Blender +y = three.js -z
			const dhdz = hu.sub(hd).div(this.uStep.y.mul(2)).negate();
			return vec4(vec3(dhdx.negate(), float(1), dhdz.negate()).normalize(), h);
		});
	}

	setMtn(m) { this.mtn = m; this.uMtn.value = m; }
}
