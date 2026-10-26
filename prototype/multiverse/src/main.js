// EdVerse OpenWorld v2: multiverse prototype. One fjord, four universes, a rift you can walk through.
//   ?webgl      force the WebGL 2 backend          ?q=low   cheaper post, less grass
//   ?u=glacial  start in another universe          ?shot    hide the interface (screenshots)
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

const params = new URLSearchParams(location.search);
const quality = params.get('q') === 'low' ? 'low' : 'high';
// debugging: ?no=water,forest,grass,shadows,post,portal,terrain,haze switches parts off
const off = new Set((params.get('no') || '').split(',').filter(Boolean));
const ui = createUI({ hidden: params.has('shot') });
const BASE = import.meta.env.BASE_URL;

async function main() {
	ui.progress(0.02, 'Starting the renderer');
	const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL: params.has('webgl'), powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1 : 1.5));
	renderer.setSize(innerWidth, innerHeight);
	renderer.toneMapping = THREE.AgXToneMapping;
	renderer.shadowMap.enabled = !off.has('shadows');
	renderer.shadowMap.type = THREE.PCFShadowMap;
	document.getElementById('app').appendChild(renderer.domElement);
	await renderer.init();
	const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
	ui.setBackend(backend);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.2, 9500);

	ui.progress(0.08, 'Loading the fjord');
	// ?pack=json: the artifact build ships binaries as base64 JSON
	const ext = params.get('pack') === 'json' || window.__MV_PACK === 'json' ? '.json' : '';
	const hf = await Heightfield.load(BASE + 'assets/heightfield.i16.bin' + ext);
	const world = new World(renderer, scene, hf);

	ui.progress(0.15, 'Scattering light through four skies');
	await new Promise((r) => setTimeout(r, 30));
	const tSky = performance.now();
	world.prepare((p) => ui.progress(0.15 + p * 0.3, 'Scattering light through four skies'));
	console.info('skies ready in', Math.round(performance.now() - tSky), 'ms');

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

	scene.environmentIntensity = params.get('dbg') === 'direct' ? 0 : 0.2;
	scene.add(createSky(world));
	if (!off.has('haze')) scene.fogNode = createHaze(world);
	ui.progress(0.5, 'Raising the terrain');
	if (!off.has('terrain')) scene.add(createTerrain(hf));
	if (!off.has('water')) scene.add(createWater(world, { size: [16000, 16000], center: [0, -2000] }));

	// the rift: its window shows the destination universe, rendered into this target every frame
	const portalRT = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
	ui.progress(0.6, 'Placing the stones');
	const props = await loadProps(BASE + 'assets/props.glb' + ext, world, portalRT.texture);
	scene.add(props.root);

	const CLIFF = [-150, 30]; // Blender xy of the promontory
	ui.progress(0.7, 'Growing the forest');
	await new Promise((r) => setTimeout(r, 30));
	const forest = new Forest(hf, { cliff: CLIFF, count: quality === 'low' ? 30000 : 80000 });
	if (!off.has('forest')) scene.add(forest.group);
	const dead = createDeadTrees(hf);
	scene.add(dead);
	world.toggle(dead, (u) => u.dead);

	ui.progress(0.82, 'Growing the meadow');
	await new Promise((r) => setTimeout(r, 30));
	const center = new THREE.Vector3(CLIFF[0] - 4, 0, -CLIFF[1] + 8);
	const grass = new Grass(hf, {
		center, radius: quality === 'low' ? 45 : 80, density: quality === 'low' ? 6 : 13,
		exclude: [
			{ x: props.riftCenter.x, z: props.riftCenter.z, r: 5.2 },
			...props.stones.map((s) => ({ x: s.position.x, z: s.position.z, r: 0.9 })),
		],
	});
	if (!off.has('grass')) scene.add(grass.group);

	const player = new Player(hf, props.explorer, camera, renderer.domElement, { stones: props.stones, yaw: -0.36 });
	if (params.get('at') === 'rift') player.pos.set(props.riftCenter.x + 0.8, 0, props.riftCenter.z + 0.5); // verification
	player.pitch = 0.3; player.dist = 11;

	const { pipeline, flash } = createPipeline(renderer, scene, camera, { quality });

	// ---- universes ---------------------------------------------------------------------------------
	let current = byId[params.get('u')] || UNIVERSES[0];
	let target = UNIVERSES[(UNIVERSES.indexOf(current) + 1) % UNIVERSES.length];
	const applyMain = () => {
		world.apply(current);
		player.sea = current.sea;
		renderer.toneMappingExposure = current.exposure;
		const d = U.sunDir.value;
		sun.position.copy(player.pos).addScaledVector(d, 1500);
		sun.target.position.copy(player.pos);
	};
	const travel = (u) => {
		if (u === current || transition) return;
		transition = { t: 0, to: u, swapped: false };
	};
	let transition = null;
	ui.onTravel = (id) => travel(byId[id]);
	ui.onTarget = (id) => { target = byId[id]; ui.setTarget(target); };
	addEventListener('keydown', (e) => {
		const n = Number(e.key);
		if (n >= 1 && n <= UNIVERSES.length) travel(UNIVERSES[n - 1]);
		if (e.code === 'KeyT') { target = UNIVERSES[(UNIVERSES.indexOf(target) + 1) % UNIVERSES.length]; if (target === current) target = UNIVERSES[(UNIVERSES.indexOf(target) + 1) % UNIVERSES.length]; ui.setTarget(target); }
	});
	applyMain();
	ui.setUniverse(current);
	ui.setTarget(target);

	addEventListener('resize', () => {
		camera.aspect = innerWidth / innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(innerWidth, innerHeight);
	});

	ui.progress(0.95, 'Compiling shaders');
	player.update(0);
	if (params.get('cam') === 'concept') { camera.position.set(-162.5, hf.height(-150, -30) + 6, -5.5); camera.lookAt(-45, -38, -330); }
	forest.update(camera);
	grass.update(camera);
	await renderer.compileAsync(scene, camera);
	ui.ready();

	// ---- frame loop --------------------------------------------------------------------------------
	const clock = new THREE.Timer();
	let frames = 0, acc = 0, scale = renderer.getPixelRatio();
	const maxScale = renderer.getPixelRatio();
	const tmpV = new THREE.Vector3();
	const conceptCam = params.get('cam') === 'concept';
	const still = params.has('still'); // verification: render a few frames, then stop
	let stillFrames = Number(params.get('still')) || 2;
	renderer.setAnimationLoop(() => {
		clock.update();
		const dt = still ? 1 / 60 : Math.min(clock.getDelta(), 0.1);
		if (still && stillFrames-- <= 0) { renderer.setAnimationLoop(null); document.body.dataset.done = '1'; return; }

		player.update(dt);
		if (conceptCam) {
			// the camera of the Blender concept frames (24 mm lens, 16:9)
			camera.position.set(-162.5, hf.height(-150, -30) + 6, -5.5);
			camera.lookAt(-45, -38, -330);
			camera.fov = 45.6; camera.updateProjectionMatrix();
		}
		forest.update(camera);
		grass.update(camera);
		props.ghost.position.y += Math.sin(performance.now() * 0.0015) * 0.002;

		// walking into the ring takes you to the rift's destination
		const rc = props.riftCenter;
		const nearRift = Math.hypot(player.pos.x - rc.x, player.pos.z - rc.z);
		if (nearRift < 1.6 && !transition && !player._inRift) { player._inRift = true; travel(target); }
		if (nearRift > 3) player._inRift = false;

		if (transition) {
			transition.t += dt;
			const t = transition.t;
			flash.value = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 0.9);
			if (!transition.swapped && t >= 0.35) {
				const from = current;
				current = transition.to;
				if (target === current) target = from;
				transition.swapped = true;
				ui.setUniverse(current);
				ui.setTarget(target);
			}
			if (t > 1.25) { transition = null; flash.value = 0; }
		}

		// the destination universe, seen through the rift (only when the ring is on screen and near)
		tmpV.copy(rc).project(camera);
		const ringOnScreen = tmpV.z < 1 && Math.abs(tmpV.x) < 1.3 && Math.abs(tmpV.y) < 1.3 && camera.position.distanceTo(rc) < 220;
		const size = renderer.getDrawingBufferSize(new THREE.Vector2());
		if (ringOnScreen && !off.has('portal')) {
			const w = Math.max(2, Math.floor(size.x * 0.5)), h = Math.max(2, Math.floor(size.y * 0.5));
			if (portalRT.width !== w || portalRT.height !== h) portalRT.setSize(w, h);
			world.apply(target);
			sun.position.copy(player.pos).addScaledVector(U.sunDir.value, 1500);
			props.windowMesh.visible = false;
			renderer.setRenderTarget(portalRT);
			renderer.render(scene, camera);
			renderer.setRenderTarget(null);
			props.windowMesh.visible = true;
		}
		applyMain();
		if (off.has('post')) renderer.render(scene, camera); else pipeline.render();

		// dynamic resolution: hold ~50 fps
		frames++; acc += dt;
		if (acc > 1 && !still) {
			const fps = frames / acc;
			ui.setFps(fps);
			if (fps < 42 && scale > 0.55) scale = Math.max(0.55, scale - 0.1);
			else if (fps > 58 && scale < maxScale) scale = Math.min(maxScale, scale + 0.05);
			if (Math.abs(renderer.getPixelRatio() - scale) > 0.01) renderer.setPixelRatio(scale);
			frames = 0; acc = 0;
		}
	});
	window.__mv = { renderer, scene, camera, player, world, travel: (id) => travel(byId[id]) };
}

main().catch((e) => { console.error(e); ui.error(e); });
