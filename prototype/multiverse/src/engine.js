// EdVerse OpenWorld v2: the multiverse. One fjord, four universes, a rift you can walk through.
// startMultiverse() draws it inside any container: the standalone page (main.js) or the EdVerse block.
import * as THREE from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { Heightfield } from './heightfield.js';
import { World, U } from './world.js';
import { UNIVERSES, byId } from './universes.js';
import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { createHaze } from './haze.js';
import { createWater } from './water.js';
import { Forest, createDeadTrees } from './forest.js';
import { Grass } from './grass.js';
import { loadProps } from './props.js';
import { createPipeline } from './post.js';
import { Player } from './player.js';
import { createUI } from './ui.js';

const CLIFF = [-150, 30]; // Blender xy of the promontory
const tick = () => new Promise((r) => setTimeout(r, 30));
// the rift crossing: flash in (the universe swaps at its peak), then fade out, in seconds
const IN = 0.2, OUT = 0.5;

/**
 * @param {HTMLElement} container
 * @param {object} o
 * @param {{ heightfield: string, props: string }} o.assets  URLs of the heightfield and the props GLB
 * @param {object} o.text  every word, already in one language (see text.js / resolveText)
 * @param {'high'|'low'} [o.quality]
 * @param {string} [o.start]  universe id to start in
 * @param {Set<string>} [o.off]  parts switched off (debugging): water, forest, grass, shadows, post, portal, terrain, haze
 * @param {boolean} [o.forceWebGL]
 * @param {boolean} [o.hideUI]
 * @param {{ still?: number, dt?: number, conceptCam?: boolean, atRift?: boolean, onStill?: () => void }} [o.debug]
 * @param {(u: object, visited: number) => void} [o.onTravel]  after each crossing (u: the universe reached)
 * @param {() => void} [o.onReady]
 * @param {(e: Error) => void} [o.onError]
 * @returns {{ setPaused(p: boolean): void, dispose(): void }}
 */
export function startMultiverse(container, o) {
	const quality = o.quality || 'high';
	const off = o.off || new Set();
	const debug = o.debug || {};
	const ui = createUI(container, o.text, { hidden: o.hideUI });
	const state = { disposed: false, paused: false, renderer: null, player: null, cleanups: [] };

	const run = async () => {
		ui.progress(0.02, 'start');
		const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL: !!o.forceWebGL, powerPreference: 'high-performance' });
		state.renderer = renderer;
		const size = () => [Math.max(1, container.clientWidth), Math.max(1, container.clientHeight)];
		renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1 : 1.5));
		renderer.setSize(...size());
		renderer.toneMapping = THREE.AgXToneMapping;
		renderer.shadowMap.enabled = !off.has('shadows');
		renderer.shadowMap.type = THREE.PCFShadowMap;
		container.prepend(renderer.domElement);
		await renderer.init();
		if (state.disposed) return;
		ui.setBackend(renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2');

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(55, size()[0] / size()[1], 0.2, 9500);

		ui.progress(0.08, 'fjord');
		const hf = await Heightfield.load(o.assets.heightfield);
		const world = new World(renderer, scene, hf);

		ui.progress(0.15, 'skies');
		await tick();
		world.prepare((p) => ui.progress(0.15 + p * 0.3, 'skies'));

		// sun with cascaded shadows
		const sun = world.sun;
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.bias = -0.0008;
		sun.shadow.normalBias = 1.4;
		const csm = new CSMShadowNode(sun, { cascades: quality === 'low' ? 2 : 4, maxFar: 700, mode: 'practical', lightMargin: 600 });
		csm.fade = true;
		sun.shadow.shadowNode = csm;
		scene.add(sun, sun.target);

		scene.environmentIntensity = 0.2;
		scene.add(createSky(world));
		if (!off.has('haze')) scene.fogNode = createHaze(world);
		ui.progress(0.5, 'terrain');
		if (!off.has('terrain')) scene.add(createTerrain(hf));
		if (!off.has('water')) scene.add(createWater(world, { size: [16000, 16000], center: [0, -2000] }));

		// the rift: its window shows the destination universe, rendered into this target every frame
		const portalRT = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
		ui.progress(0.6, 'stones');
		const props = await loadProps(o.assets.props, world, portalRT.texture);
		if (state.disposed) return;
		scene.add(props.root);

		ui.progress(0.7, 'forest');
		await tick();
		const forest = new Forest(hf, { cliff: CLIFF, count: quality === 'low' ? 30000 : 80000 });
		if (!off.has('forest')) scene.add(forest.group);
		const dead = createDeadTrees(hf);
		scene.add(dead);
		world.toggle(dead, (u) => u.dead);

		ui.progress(0.82, 'meadow');
		await tick();
		const grass = new Grass(hf, {
			center: new THREE.Vector3(CLIFF[0] - 4, 0, -CLIFF[1] + 8),
			radius: quality === 'low' ? 45 : 80, density: quality === 'low' ? 6 : 13,
			exclude: [
				{ x: props.riftCenter.x, z: props.riftCenter.z, r: 5.2 },
				...props.stones.map((s) => ({ x: s.position.x, z: s.position.z, r: 0.9 })),
			],
		});
		if (!off.has('grass')) scene.add(grass.group);

		const player = new Player(hf, props.explorer, camera, renderer.domElement, { stones: props.stones, yaw: -0.36 });
		state.player = player;
		if (debug.atRift) player.pos.set(props.riftCenter.x + 0.8, 0, props.riftCenter.z + 0.5);
		player.pitch = 0.3; player.dist = 11;
		ui.onStick = (x, y) => player.setStick(x, y);

		const { pipeline, flash } = createPipeline(renderer, scene, camera, { quality });

		// ---- universes ---------------------------------------------------------------------------------
		let current = byId[o.start] || UNIVERSES[0];
		let target = UNIVERSES[(UNIVERSES.indexOf(current) + 1) % UNIVERSES.length];
		const visited = new Set([current.id]);
		let transition = null;
		const applyMain = () => {
			world.apply(current);
			player.sea = current.sea;
			renderer.toneMappingExposure = current.exposure;
			sun.position.copy(player.pos).addScaledVector(U.sunDir.value, 1500);
			sun.target.position.copy(player.pos);
		};
		const travel = (u) => {
			if (!u || u === current || transition) return;
			transition = { t: 0, to: u, swapped: false };
		};
		const retune = () => {
			let i = UNIVERSES.indexOf(target);
			do i = (i + 1) % UNIVERSES.length; while (UNIVERSES[i] === current);
			target = UNIVERSES[i];
			ui.setTarget(target);
		};
		ui.onTravel = (id) => travel(byId[id]);
		ui.onRetune = retune;
		const onKey = (e) => {
			const n = Number(e.key);
			if (n >= 1 && n <= UNIVERSES.length) travel(UNIVERSES[n - 1]);
			if (e.code === 'KeyT') retune();
		};
		addEventListener('keydown', onKey);
		state.cleanups.push(() => removeEventListener('keydown', onKey));
		applyMain();
		ui.setUniverse(current);
		ui.setTarget(target);

		const ro = new ResizeObserver(() => {
			const [w, h] = size();
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h);
		});
		ro.observe(container);
		state.cleanups.push(() => ro.disconnect());

		ui.progress(0.95, 'shaders');
		player.update(0);
		const conceptCam = () => {
			// the camera of the Blender concept frames (24 mm lens, 16:9)
			camera.position.set(-162.5, hf.height(-150, -30) + 6, -5.5);
			camera.lookAt(-45, -38, -330);
			camera.fov = 45.6; camera.updateProjectionMatrix();
		};
		if (debug.conceptCam) conceptCam();
		forest.update(camera);
		grass.update(camera);
		// compile everything up front, including what only some universes show (glacier, dead trees, the
		// lighthouse), and the rift's own render target, so the first crossing never stalls on shaders
		const hidden = [];
		scene.traverse((obj) => { if (!obj.visible) { hidden.push(obj); obj.visible = true; } });
		await renderer.compileAsync(scene, camera);
		if (state.disposed) return;
		// the screen renders through the post pipeline (its own shader context): warm that up too
		if (!off.has('post')) pipeline.render();
		portalRT.setSize(64, 36);
		props.windowMesh.visible = false;
		renderer.setRenderTarget(portalRT);
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);
		props.windowMesh.visible = true;
		for (const obj of hidden) obj.visible = false;
		applyMain();
		ui.ready();
		o.onReady && o.onReady();

		// ---- frame loop --------------------------------------------------------------------------------
		const clock = new THREE.Timer();
		let frames = 0, acc = 0, scale = renderer.getPixelRatio();
		const maxScale = renderer.getPixelRatio();
		const tmpV = new THREE.Vector3(), buf = new THREE.Vector2();
		let still = debug.still || 0;
		renderer.setAnimationLoop(() => {
			const tFrame = performance.now();
			clock.update();
			if (state.paused) return;
			const raw = clock.getDelta();
			const dt = debug.still ? debug.dt || 1 / 60 : Math.min(raw, 0.1);
			if (debug.still && still-- <= 0) { renderer.setAnimationLoop(null); debug.onStill && debug.onStill(); return; }

			player.update(dt);
			if (debug.conceptCam) conceptCam();
			forest.update(camera);
			grass.update(camera);
			props.ghost.position.y += Math.sin(performance.now() * 0.0015) * 0.002;

			// walking into the ring takes you to the rift's destination
			const rc = props.riftCenter;
			const nearRift = Math.hypot(player.pos.x - rc.x, player.pos.z - rc.z);
			if (nearRift < 1.6 && !transition && !player._inRift) { player._inRift = true; travel(target); }
			if (nearRift > 3) player._inRift = false;

			if (transition) {
				// real elapsed time (not the per-frame step, which is capped): the crossing never drags on a
				// device that drops frames
				transition.t += debug.still ? dt : Math.min(raw, 0.25);
				const t = transition.t;
				flash.value = t < IN ? t / IN : Math.max(0, 1 - (t - IN) / OUT);
				if (!transition.swapped && t >= IN) {
					const from = current;
					current = transition.to;
					if (target === current) target = from;
					transition.swapped = true;
					visited.add(current.id);
					ui.setUniverse(current);
					ui.setTarget(target);
					o.onTravel && o.onTravel(current, visited.size);
				}
				if (t > IN + OUT) { transition = null; flash.value = 0; }
			}

			applyMain();
			if (off.has('post')) renderer.render(scene, camera); else pipeline.render();

			// then the destination universe, seen through the rift next frame (only when the ring is on screen
			// and near). Rendered after the main view so it reuses this frame's shadow maps and water
			// reflection instead of rendering them again; a frame of latency is invisible in the window.
			tmpV.copy(rc).project(camera);
			const ringOnScreen = tmpV.z < 1 && Math.abs(tmpV.x) < 1.3 && Math.abs(tmpV.y) < 1.3 && camera.position.distanceTo(rc) < 220;
			if (ringOnScreen && !off.has('portal')) {
				renderer.getDrawingBufferSize(buf);
				const w = Math.max(2, Math.floor(buf.x * 0.4)), h = Math.max(2, Math.floor(buf.y * 0.4));
				if (portalRT.width !== w || portalRT.height !== h) portalRT.setSize(w, h);
				world.apply(target);
				props.windowMesh.visible = false;
				grass.group.visible = false;
				renderer.setRenderTarget(portalRT);
				renderer.render(scene, camera);
				renderer.setRenderTarget(null);
				props.windowMesh.visible = true;
				grass.group.visible = !off.has('grass');
				applyMain();
			}
			if (debug.timing) console.info('frame', Math.round(performance.now() - tFrame), 'ms', transition ? 't=' + transition.t.toFixed(2) : '', current.id);

			// dynamic resolution: hold ~50 fps
			frames++; acc += dt;
			if (acc > 1 && !debug.still) {
				const fps = frames / acc;
				ui.setFps(fps);
				if (fps < 42 && scale > 0.55) scale = Math.max(0.55, scale - 0.1);
				else if (fps > 58 && scale < maxScale) scale = Math.min(maxScale, scale + 0.05);
				if (Math.abs(renderer.getPixelRatio() - scale) > 0.01) renderer.setPixelRatio(scale);
				frames = 0; acc = 0;
			}
		});
		state.travel = (id) => travel(byId[id]);
	};

	run().catch((e) => {
		console.error(e);
		ui.error(e);
		o.onError && o.onError(e);
	});

	return {
		setPaused(p) { state.paused = !!p; ui.setPaused(!!p); },
		travel(id) { state.travel && state.travel(id); },
		dispose() {
			state.disposed = true;
			for (const c of state.cleanups) c();
			if (state.player) state.player.dispose();
			if (state.renderer) { state.renderer.setAnimationLoop(null); state.renderer.dispose(); }
			container.replaceChildren();
			container.classList.remove('mv-root', 'mv-touch');
		},
	};
}
