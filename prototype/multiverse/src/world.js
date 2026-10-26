// Universe state shared by every material: one set of uniforms, switched as a whole. Rendering a second
// universe (through the rift) is: apply(B), render to a target, apply(A).
import * as THREE from 'three/webgpu';
import { uniform, texture } from 'three/tsl';
import { computeSky, sunDirection } from './atmosphere.js';
import { UNIVERSES } from './universes.js';

export const U = {
	sea: uniform(0),
	snow: uniform(95),
	grass: uniform(new THREE.Color()),
	rock: uniform(new THREE.Color()),
	tree: uniform(new THREE.Color()),
	treeDensity: uniform(1),
	treeH: uniform(1),
	treeW: uniform(1),
	grassDensity: uniform(1),
	hazeDensity: uniform(0.001),
	hazeFalloff: uniform(0.01),
	hazeTint: uniform(new THREE.Color(1, 1, 1)),
	clouds: uniform(0.4),
	sunDir: uniform(new THREE.Vector3(0, 0.1, -1)),
	sunColor: uniform(new THREE.Color(1, 1, 1)),
	lift: uniform(new THREE.Color(1, 1, 1)),
	gain: uniform(new THREE.Color(1, 1, 1)),
	exposure: uniform(1),
	glacier: uniform(0),
	/** 1 inside the rift's render of the other universe (no rift window there). */
	portalPass: uniform(0),
};

export class World {
	constructor(renderer, scene, heightfield) {
		this.renderer = renderer;
		this.scene = scene;
		this.hf = heightfield;
		this.skies = new Map();
		this.envs = new Map();
		// every node that samples the sky panorama; their texture is swapped with the universe
		this.skyNodes = [];
		this._blank = new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType);
		this.sun = new THREE.DirectionalLight(0xffffff, 3);
		this.toggles = []; // { object, test(u) }
		this.hooks = [];
		this.current = null;
	}

	/** Builds every universe's sky panorama and image-based light (once, at start). */
	prepare(onProgress) {
		const pmrem = new THREE.PMREMGenerator(this.renderer);
		UNIVERSES.forEach((u, i) => {
			const dir = sunDirection(u.sun.el, u.sun.rot);
			const sky = computeSky({ ...u.air, sunDir: dir });
			sky.sunDir = dir;
			this.skies.set(u.id, sky);
			this.envs.set(u.id, pmrem.fromEquirectangular(sky.texture).texture);
			onProgress && onProgress((i + 1) / UNIVERSES.length);
		});
		pmrem.dispose();
	}

	/** A sky panorama lookup at uv (equirect) that follows the current universe. */
	skyAt(uvNode) {
		const n = texture(this._blank, uvNode);
		this.skyNodes.push(n);
		return n;
	}

	toggle(object, test) { this.toggles.push({ object, test }); }
	onApply(fn) { this.hooks.push(fn); }

	apply(u) {
		const sky = this.skies.get(u.id);
		U.sea.value = u.sea;
		U.snow.value = u.snow;
		U.grass.value.copy(u.grass);
		U.rock.value.copy(u.rock);
		U.tree.value.copy(u.tree);
		U.treeDensity.value = u.treeDensity;
		U.treeH.value = u.treeH;
		U.treeW.value = u.treeW;
		U.grassDensity.value = u.grassDensity;
		U.hazeDensity.value = u.haze.density;
		U.hazeFalloff.value = u.haze.falloff;
		U.hazeTint.value.copy(u.haze.tint);
		U.clouds.value = u.clouds;
		U.sunDir.value.copy(sky.sunDir);
		U.sunColor.value.copy(sky.sunColor);
		U.lift.value.copy(u.grade.lift);
		U.gain.value.copy(u.grade.gain);
		U.exposure.value = u.exposure;
		U.glacier.value = u.glacier ? 1 : 0;
		this.hf.setMtn(u.mtn);
		for (const n of this.skyNodes) n.value = sky.texture;
		this.scene.environment = this.envs.get(u.id);
		// the key light: the sun's colour through the air, a little less saturated than the raw transmittance
		this.sun.color.copy(sky.sunColor).multiplyScalar(1 / Math.max(sky.sunColor.r, sky.sunColor.g, sky.sunColor.b)).lerp(new THREE.Color(1, 0.97, 0.92), 0.35);
		this.sun.intensity = Math.max(sky.sunColor.r, sky.sunColor.g, sky.sunColor.b) * 3.2;
		for (const t of this.toggles) t.object.visible = t.test(u);
		for (const h of this.hooks) h(u);
		this.current = u;
	}
}
