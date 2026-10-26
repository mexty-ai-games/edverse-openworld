// Sky dome: the universe's physical sky panorama, the sun disc seen through the atmosphere, and a
// procedural cloud layer (a slab ~1.4 km up, sun-lit with a cheap self-shadow and silver lining).
import * as THREE from 'three/webgpu';
import {
	Fn, vec2, vec3, float, positionWorld, cameraPosition, normalize, equirectUV, dot, smoothstep, max, mix, exp, pow,
	mx_fractal_noise_float, time, clamp,
} from 'three/tsl';
import { U } from './world.js';

export function createSky(world) {
	const geo = new THREE.SphereGeometry(1, 64, 32);
	const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
	mat.fog = false;

	mat.colorNode = Fn(() => {
		const dir = normalize(positionWorld.sub(cameraPosition)).toVar();
		// below the horizon the dome is only ever seen past the far water: keep the horizon haze there
		const look = normalize(vec3(dir.x, max(dir.y, 0.004), dir.z));
		const sky = world.skyAt(equirectUV(look)).rgb.toVar();
		const cosS = dot(dir, U.sunDir);
		// sun disc (angular radius ~0.27 deg) + a tight aureole; colour = sun through the air
		const disc = smoothstep(0.99996, 0.99999, cosS).mul(900);
		const aureole = pow(max(cosS, 0), 900).mul(6);
		const sunTerm = U.sunColor.mul(disc.add(aureole));

		// clouds: intersect a slab at 1400 m above the camera
		const up = max(dir.y, 0.0);
		const t = float(1400).div(up.add(0.035));
		const hit = cameraPosition.xz.add(dir.xz.mul(t));
		const wind = vec2(time.mul(3.0), time.mul(1.2));
		const p = hit.add(wind).mul(vec2(0.00042, 0.00095));
		const base = mx_fractal_noise_float(vec3(p, time.mul(0.004)), 6, 2.1, 0.55).mul(0.5).add(0.5);
		const cover = U.clouds;
		const density = smoothstep(float(1).sub(cover), float(1.25).sub(cover), base).toVar();
		// light toward the sun: denser upstream -> darker
		const toward = mx_fractal_noise_float(vec3(p.add(U.sunDir.xz.mul(0.02)), time.mul(0.004)), 4, 2.1, 0.55).mul(0.5).add(0.5);
		const shade = exp(smoothstep(float(1).sub(cover), float(1.25).sub(cover), toward).mul(-1.6));
		const silver = pow(max(cosS, 0), 6).mul(2.5).add(0.35);
		const zen = world.skyAt(vec2(0.25, 0.92)).rgb;
		const cloudCol = zen.mul(0.55).add(U.sunColor.mul(shade).mul(silver).mul(0.55));
		// fade the layer toward the horizon, into the haze
		const fade = smoothstep(0.0, 0.18, up);
		const a = density.mul(fade).mul(0.92);
		const col = mix(sky, cloudCol, a).add(sunTerm.mul(float(1).sub(a)));
		return col;
	})();

	const mesh = new THREE.Mesh(geo, mat);
	mesh.scale.setScalar(9000);
	mesh.frustumCulled = false;
	mesh.renderOrder = -10;
	mesh.name = 'sky';
	mesh.onBeforeRender = (r, s, camera) => mesh.position.copy(camera.position);
	return mesh;
}
