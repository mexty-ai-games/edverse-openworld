// Terrain: a flat grid whose heights and normals come from the heightfield texture in the vertex
// shader, so a universe's mountain scale (half gravity) is a uniform. The material is the concept's
// Blender material in TSL: rock with strata, grass on gentle slopes, wet shore, snow above the snow line.
import * as THREE from 'three/webgpu';
import {
	Fn, vec3, float, positionLocal, positionWorld, normalLocal, normalWorld, varying, mix, smoothstep, clamp,
	mx_fractal_noise_float, mx_noise_float, bumpMap, sin, abs,
} from 'three/tsl';
import { U } from './world.js';

export function createTerrain(hf, { step = 1 } = {}) {
	const nx = Math.floor((hf.nx - 1) / step) + 1, nz = Math.floor((hf.nz - 1) / step) + 1;
	const pos = new Float32Array(nx * nz * 3);
	for (let j = 0; j < nz; j++) {
		for (let i = 0; i < nx; i++) {
			const k = (j * nx + i) * 3;
			pos[k] = hf.x0 + i * step * hf.dx;
			pos[k + 1] = 0;
			pos[k + 2] = -(hf.y0 + j * step * hf.dy);
		}
	}
	const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
	let p = 0;
	for (let j = 0; j < nz - 1; j++) {
		for (let i = 0; i < nx - 1; i++) {
			const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
			// winding for +y normals with z = -y_blender
			idx[p++] = a; idx[p++] = b; idx[p++] = c;
			idx[p++] = b; idx[p++] = d; idx[p++] = c;
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nx * nz * 3).fill(0), 3));
	geo.setIndex(new THREE.BufferAttribute(idx, 1));
	geo.boundingBox = new THREE.Box3(new THREE.Vector3(hf.x0, -60, -hf.y1), new THREE.Vector3(hf.x1, 700, -hf.y0));
	geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());

	const mat = new THREE.MeshStandardNodeMaterial();
	mat.positionNode = Fn(() => {
		const v = hf.vertexNode(positionLocal.xz);
		normalLocal.assign(v.xyz);
		return vec3(positionLocal.x, v.w, positionLocal.z);
	})();

	const P = positionWorld;
	const nY = normalWorld.y;
	const n1 = mx_fractal_noise_float(P.mul(0.08), 6, 2.0, 0.5).mul(0.5).add(0.5);
	const n2 = mx_fractal_noise_float(P.mul(0.9), 4, 2.0, 0.6).mul(0.5).add(0.5);
	const macro = mx_noise_float(P.xz.mul(0.004)).mul(0.5).add(0.5);
	// strata: banded along height, distorted
	const strata = sin(P.y.mul(0.55).add(mx_noise_float(P.mul(0.03)).mul(6))).mul(0.5).add(0.5);

	const rockMix = mix(n1, strata, 0.3);
	const rock = mix(U.rock.mul(0.5), U.rock.mul(1.55), rockMix).mul(mix(0.85, 1.15, macro));
	// turf: the ground between the grass blades, darker than the blades' tips
	const grass = mix(U.grass.mul(0.42), U.grass.mul(0.95), n1).mul(mix(0.8, 1.15, macro));
	const grassMask = smoothstep(0.6, 1.0, smoothstep(0.78, 0.9, nY).add(n1.mul(0.35)));
	const base = mix(rock, grass, grassMask);

	const shore = smoothstep(U.sea.add(0.3), U.sea.add(2.2), P.y);
	const wet = vec3(0.09, 0.08, 0.065).mul(mix(0.7, 1.1, n2));
	const withShore = mix(wet, base, shore);

	const snowH = smoothstep(U.snow.sub(12), U.snow.add(12), P.y.add(n1.sub(0.5).mul(16)));
	const snowS = smoothstep(0.5, 0.72, nY.add(n2.sub(0.5).mul(0.2)));
	const snow = clamp(snowH.mul(snowS), 0, 1);
	const snowCol = vec3(0.82, 0.86, 0.92).mul(mix(0.92, 1.04, n2));

	mat.colorNode = mix(withShore, snowCol, snow);
	mat.roughnessNode = mix(mix(0.22, 0.92, shore), 0.55, snow);
	mat.metalnessNode = float(0);
	// small-scale relief: rock gets the full bump, grass and snow a softer one
	const bumpH = n2.mul(0.8).add(strata.mul(0.4)).mul(mix(1.0, 0.08, grassMask.max(snow)));
	mat.normalNode = bumpMap(bumpH, 0.6);

	const mesh = new THREE.Mesh(geo, mat);
	mesh.receiveShadow = true;
	// no terrain self-shadowing: at a 3-7 degree sun it only produces acne on the rock faces
	mesh.castShadow = false;
	mesh.frustumCulled = false;
	mesh.name = 'terrain';
	return mesh;
}
