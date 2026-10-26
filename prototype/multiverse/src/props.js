// Hero props from the concept scene (tools/export_scene.py -> props.glb): the tuning circle and its rift,
// the explorer and a crew echo, the lighthouse (absent in Glacial, twice as tall in half gravity) and the
// Ice Age glacier. Materials are replaced by node materials tied to the universe uniforms.
import * as THREE from 'three/webgpu';
import {
	Fn, vec2, vec3, vec4, float, positionWorld, positionLocal, normalWorld, cameraPosition, normalize, dot, max, pow,
	mix, smoothstep, time, sin, length, screenUV, texture, mx_fractal_noise_float, mx_noise_float, uniform, clamp, abs, bumpMap,
} from 'three/tsl';
import { loadBinary } from './binary.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { U } from './world.js';

function stoneMaterial() {
	const m = new THREE.MeshStandardNodeMaterial({ flatShading: true });
	const P = positionWorld;
	const n = mx_fractal_noise_float(P.mul(2.2), 5, 2.0, 0.55).mul(0.5).add(0.5);
	const rock = mix(vec3(0.04, 0.04, 0.045), vec3(0.14, 0.135, 0.13), n);
	const moss = smoothstep(0.55, 0.85, normalWorld.y.add(n.sub(0.5).mul(0.5)));
	m.colorNode = mix(rock, U.grass.mul(0.75), moss);
	m.roughnessNode = float(0.88);
	return m;
}

export async function loadProps(url, world, portalTexture) {
	const gltf = await new GLTFLoader().parseAsync(await loadBinary(url), '');
	const root = gltf.scene;
	const byName = {};
	root.traverse((o) => { if (o.name) byName[o.name] = o; });

	const stone = stoneMaterial();
	const cloak = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.05, 0.075, 0.09), roughness: 0.85 });
	cloak.colorNode = vec3(0.05, 0.072, 0.088).mul(mx_noise_float(positionLocal.mul(18)).mul(0.12).add(1));
	const pack = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.075, 0.05, 0.035), roughness: 0.75 });
	const trim = new THREE.MeshBasicNodeMaterial();
	trim.colorNode = vec3(1.0, 0.55, 0.15).mul(6);
	const pulse = sin(time.mul(2.2)).mul(0.15).add(1);
	const gold = new THREE.MeshBasicNodeMaterial();
	gold.colorNode = vec3(1.0, 0.5, 0.12).mul(16).mul(pulse);
	gold.fog = false;

	// the crew echo: a crew mate in another universe, seen as gold light
	const ghost = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
	const V = normalize(cameraPosition.sub(positionWorld));
	const rim = pow(float(1).sub(max(dot(normalWorld, V), 0)), 2.2);
	const flick = mx_noise_float(vec3(positionWorld.y.mul(3).sub(time.mul(2)), time.mul(0.7), 0)).mul(0.25).add(0.75);
	ghost.colorNode = vec3(1.0, 0.48, 0.12).mul(rim.mul(5).add(0.35)).mul(flick);
	ghost.fog = false;

	// the rift's window shows the destination universe, rendered from the same camera (screen-space lookup)
	const win = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
	win.fog = false;
	win.colorNode = Fn(() => {
		const r = clamp(length(positionLocal).div(3.15), 0, 1);
		const swirl = mx_noise_float(positionLocal.mul(0.9).add(time.mul(0.35))).mul(0.012).mul(r);
		const view = texture(portalTexture, screenUV.add(vec2(swirl, swirl.mul(-0.7)))).rgb;
		const edge = smoothstep(0.72, 1.0, r);
		const sparkle = pow(mx_noise_float(positionLocal.mul(3.5).add(time.mul(1.4))).mul(0.5).add(0.5), 6).mul(edge).mul(14);
		return mix(view, vec3(1.0, 0.5, 0.14).mul(5), edge.mul(0.65)).add(vec3(1.0, 0.6, 0.25).mul(sparkle));
	})();

	const white = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.62, 0.6, 0.55), roughness: 0.75 });
	white.colorNode = vec3(0.62, 0.6, 0.55).mul(mx_fractal_noise_float(positionWorld.mul(0.8), 3).mul(0.15).add(0.95));
	const red = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.32, 0.05, 0.03), roughness: 0.6 });
	const lamp = new THREE.MeshBasicNodeMaterial();
	lamp.colorNode = vec3(1.0, 0.8, 0.45).mul(30);

	// glacier: wind-packed snow over blue ice, crevasse bands across the flow (the flow runs along the fjord)
	const ice = new THREE.MeshStandardNodeMaterial({ roughness: 0.6 });
	const flow = positionWorld.mul(vec3(0.045, 0.3, 0.009));
	const crev = mx_fractal_noise_float(flow, 4).mul(0.5).add(0.5);
	const sastrugi = mx_fractal_noise_float(positionWorld.mul(vec3(0.6, 0.6, 0.15)), 3).mul(0.5).add(0.5);
	const blue = smoothstep(0.62, 0.72, crev);
	ice.colorNode = mix(vec3(0.88, 0.92, 0.97).mul(mix(0.92, 1.03, sastrugi)), vec3(0.32, 0.52, 0.7), blue);
	ice.roughnessNode = mix(float(0.75), float(0.25), blue);
	ice.normalNode = bumpMap(crev.mul(2.5).add(sastrugi.mul(0.3)), 1.0);

	const assign = (prefix, material, opts = {}) => {
		for (const [name, o] of Object.entries(byName)) {
			if (!name.startsWith(prefix) || !o.isMesh) continue;
			o.material = material;
			o.castShadow = opts.cast ?? true;
			o.receiveShadow = opts.receive ?? true;
		}
	};
	assign('stone', stone);
	assign('cloak', cloak); assign('pack', pack); assign('trim', trim, { cast: false });
	assign('riftgold', gold, { cast: false, receive: false });
	assign('window', win, { cast: false, receive: false });
	assign('ghost', ghost, { cast: false, receive: false });
	assign('whitewash', white); assign('redband', red); assign('lamp', lamp, { cast: false });
	assign('ice', ice);

	// lighthouse: tower parts stretch, the lantern rides up in half gravity
	const tower = [byName.whitewash_00, byName.redband_02];
	const top = [byName.redband_03, byName.lamp_00, byName.redband_00];
	const all = [...tower, ...top, byName.whitewash_01, byName.redband_01];
	const baseY = 3.3;
	const ty = tower.map((o) => ({ o, y: o.position.y, sy: o.scale.y }));
	const tp = top.map((o) => ({ o, y: o.position.y }));
	world.onApply((u) => {
		const s = u.id === 'halfg' ? 46 / 26 : 1;
		for (const t of ty) { t.o.position.y = baseY + (t.y - baseY) * s; t.o.scale.y = t.sy * s; }
		for (const t of tp) t.o.position.y = t.y + (s - 1) * 26;
		for (const o of all) o.visible = u.lighthouse;
	});
	world.toggle(byName.ice_00, (u) => u.glacier);

	// shared window visibility: never inside the rift's own render
	const windowMesh = byName.window_00;
	const ring = [byName.riftgold_00, byName.riftgold_01];
	const center = windowMesh.position.clone();

	return {
		root,
		explorer: byName.cloak_00,
		ghost: byName.ghost_03,
		windowMesh,
		ring,
		riftCenter: center,
		stones: Object.keys(byName).filter((n) => n.startsWith('stone_') && byName[n].isMesh).map((n) => byName[n]),
	};
}
