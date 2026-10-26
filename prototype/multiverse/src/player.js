// Third-person explorer: walks on the heightfield (WASD / arrows / ZQSD on AZERTY, Shift to run), the
// camera orbits with a drag and zooms with the wheel, like the game's 3/4 view. Steep slopes, the sea and
// the standing stones block the way.
import * as THREE from 'three/webgpu';

export class Player {
	constructor(hf, explorer, camera, dom, { stones = [], yaw = 0 } = {}) {
		this.hf = hf;
		this.body = explorer;
		this.camera = camera;
		this.pos = explorer.position.clone();
		this.heading = yaw;
		this.yaw = yaw;
		this.pitch = 0.32;
		this.dist = 9.5;
		this.keys = new Set();
		this.blockers = stones.map((s) => ({ x: s.position.x, z: s.position.z, r: 1.15 }));
		this.walk = 0;
		this.sea = 0;
		this.enabled = true;
		this._bind(dom);
	}

	_bind(dom) {
		addEventListener('keydown', (e) => { this.keys.add(e.code); });
		addEventListener('keyup', (e) => { this.keys.delete(e.code); });
		addEventListener('blur', () => this.keys.clear());
		let drag = null;
		dom.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; dom.setPointerCapture(e.pointerId); });
		dom.addEventListener('pointermove', (e) => {
			if (!drag || drag.id !== e.pointerId) return;
			this.yaw -= (e.clientX - drag.x) * 0.005;
			this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - drag.y) * 0.004, -0.05, 1.1);
			drag.x = e.clientX; drag.y = e.clientY;
		});
		dom.addEventListener('pointerup', () => { drag = null; });
		dom.addEventListener('wheel', (e) => { this.dist = THREE.MathUtils.clamp(this.dist * (1 + e.deltaY * 0.001), 3.5, 60); }, { passive: true });
	}

	/** Touch / on-screen stick input in [-1, 1]. */
	setStick(x, y) { this.stick = { x, y }; }

	update(dt) {
		const k = this.keys;
		let f = 0, s = 0;
		if (this.enabled) {
			if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
			if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
			if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
			if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
			if (this.stick) { f -= this.stick.y; s += this.stick.x; }
		}
		const len = Math.hypot(f, s);
		const moving = len > 0.05;
		if (moving) {
			const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 6.5 : 3.2) * Math.min(len, 1);
			// camera-relative: forward is away from the camera
			const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
			const rx = -fz, rz = fx;
			const dx = (fx * f + rx * s) / len, dz = (fz * f + rz * s) / len;
			const nx = this.pos.x + dx * speed * dt, nz = this.pos.z + dz * speed * dt;
			if (this._walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
			else if (this._walkable(nx, this.pos.z)) this.pos.x = nx;
			else if (this._walkable(this.pos.x, nz)) this.pos.z = nz;
			const want = Math.atan2(dx, dz);
			let d = want - this.heading;
			d = Math.atan2(Math.sin(d), Math.cos(d));
			this.heading += d * Math.min(1, dt * 10);
			this.walk += dt * speed * 2.2;
		}
		const ground = this.hf.height(this.pos.x, this.pos.z);
		this.pos.y = ground;
		const bob = moving ? Math.abs(Math.sin(this.walk)) * 0.05 : 0;
		this.body.position.set(this.pos.x, ground + bob, this.pos.z);
		this.body.rotation.set(0, this.heading + Math.PI, moving ? Math.sin(this.walk) * 0.03 : 0);

		// orbit camera, kept above the ground
		const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
		const tx = this.pos.x, ty = ground + 1.6, tz = this.pos.z;
		let cx = tx + Math.sin(this.yaw) * cp * this.dist, cz = tz + Math.cos(this.yaw) * cp * this.dist;
		let cy = ty + sp * this.dist;
		const g = this.hf.inside(cx, cz) ? this.hf.height(cx, cz) : -50;
		cy = Math.max(cy, g + 1.2, this.sea + 1.0);
		this.camera.position.set(cx, cy, cz);
		this.camera.lookAt(tx, ty + 0.4, tz);
		return moving;
	}

	_walkable(x, z) {
		if (!this.hf.inside(x, z, 10)) return false;
		const h = this.hf.height(x, z);
		if (h < this.sea + 0.4) return false;
		if (this.hf.normal(x, z).y < 0.72) return false;
		for (const b of this.blockers) if (Math.hypot(x - b.x, z - b.z) < b.r) return false;
		return true;
	}
}
