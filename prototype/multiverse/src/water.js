// Fjord water: planar reflection (rippled by a procedural normal), refraction of the shore through the
// surface with depth-based absorption, Schlick fresnel, a sun glint and foam where the water is thin.
// The plane follows the universe's sea level.
import * as THREE from 'three/webgpu';
import {
	Fn, vec2, vec3, vec4, float, positionWorld, cameraPosition, normalize, dot, max, min, pow, mix, exp, reflect,
	smoothstep, clamp, time, mx_noise_float, mx_fractal_noise_float, reflector, screenUV, viewportDepthTexture,
	viewportSharedTexture, positionView, perspectiveDepthToViewZ, cameraNear, cameraFar, length,
} from 'three/tsl';
import { U } from './world.js';

export function createWater(world, { size = [1400, 2200], center = [0, -850] } = {}) {
	const reflection = reflector({ resolutionScale: 0.5 });
	reflection.target.rotateX(-Math.PI / 2);

	// wave height field: three scrolling noise octaves, finite-difference normal
	const waveH = Fn(([xz]) => {
		const t = time;
		const h1 = mx_noise_float(vec3(xz.mul(vec2(0.06, 0.11)).add(vec2(t.mul(0.05), t.mul(0.03))), t.mul(0.08))).mul(0.6);
		const h2 = mx_noise_float(vec3(xz.mul(vec2(0.21, 0.17)).sub(vec2(t.mul(0.09), 0)), t.mul(0.15))).mul(0.25);
		const h3 = mx_noise_float(vec3(xz.mul(0.85).add(vec2(0, t.mul(0.22))), t.mul(0.3))).mul(0.06);
		return h1.add(h2).add(h3);
	});

	const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: true });
	mat.colorNode = Fn(() => {
		const P = positionWorld;
		const toCam = cameraPosition.sub(P);
		const dist = length(toCam);
		const V = toCam.div(dist);
		const e = float(0.12);
		const h0 = waveH(P.xz), hx = waveH(P.xz.add(vec2(e, 0))), hz = waveH(P.xz.add(vec2(0, e)));
		// flatter with distance (no shimmer at the horizon)
		const amp = float(0.9).div(dist.mul(0.006).add(1));
		const N = normalize(vec3(h0.sub(hx).div(e).mul(amp), 1, h0.sub(hz).div(e).mul(amp))).toVar();

		// reflection, distorted by the ripples
		reflection.uvNode = reflection.uvNode.add(N.xz.mul(0.035));
		const refl = reflection.rgb;

		// refraction + absorption through the water column behind
		const ruv = screenUV.add(N.xz.mul(0.02));
		const sceneZ = perspectiveDepthToViewZ(viewportDepthTexture(ruv).x, cameraNear, cameraFar);
		const thick = max(positionView.z.sub(sceneZ), 0).toVar();
		const behind = viewportSharedTexture(ruv).rgb;
		const absorb = exp(vec3(0.45, 0.16, 0.12).mul(thick).negate());
		const deep = vec3(0.004, 0.018, 0.022).add(U.sunColor.mul(0.004));
		const body = mix(deep, behind, absorb);

		const cosV = max(dot(N, V), 0);
		const F = float(0.02).add(float(0.98).mul(pow(float(1).sub(cosV), 5)));
		const R = reflect(V.negate(), N);
		const glint = pow(max(dot(R, U.sunDir), 0), 700).mul(60).add(pow(max(dot(R, U.sunDir), 0), 60).mul(0.6));
		const col = mix(body, refl, F).add(U.sunColor.mul(glint));

		// foam lace where the water is thin
		const lace = mx_fractal_noise_float(vec3(P.xz.mul(0.6), time.mul(0.25)), 3, 2.0, 0.5).mul(0.5).add(0.5);
		const foam = smoothstep(0.9, 0.0, thick).mul(smoothstep(0.35, 0.75, lace)).mul(0.85);
		const foamCol = U.sunColor.mul(0.12).add(world.skyAt(vec2(0.25, 0.9)).rgb.mul(0.6));
		return mix(col, foamCol, foam);
	})();

	const geo = new THREE.PlaneGeometry(size[0], size[1], 1, 1);
	geo.rotateX(-Math.PI / 2);
	const mesh = new THREE.Mesh(geo, mat);
	mesh.position.set(center[0], 0, center[1]);
	mesh.renderOrder = 5;
	mesh.receiveShadow = false;
	mesh.name = 'water';
	mesh.add(reflection.target);
	reflection.target.position.set(0, 0, 0);
	world.onApply((u) => { mesh.position.y = u.sea; });
	return mesh;
}
