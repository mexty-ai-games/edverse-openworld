// Aerial perspective as the scene's fog node (every lit material gets it, no extra pass): an exponential
// height-fog layer above the sea with analytic optical depth along the view ray (Quilez), coloured by the
// universe's own sky just above the horizon in the view direction plus the sun's forward-scattered glow.
// Same idea as Tidewater's AirHaze: distant land fades into the actual horizon sky.
import { Fn, float, vec3, vec2, positionWorld, cameraPosition, normalize, length, exp, max, abs, dot, pow, select, fog, equirectUV, clamp } from 'three/tsl';
import { U } from './world.js';

export function createHaze(world) {
	const factor = Fn(() => {
		const d = length(positionWorld.sub(cameraPosition));
		const rd = positionWorld.sub(cameraPosition).div(d.max(1e-3));
		const a = U.hazeDensity, b = U.hazeFalloff;
		const camH = max(cameraPosition.y.sub(U.sea), 0);
		const ry = rd.y;
		// integral of a*exp(-b*h) along the ray; the small-slope limit is a*exp(-b*h0)*d
		const k = ry.mul(b);
		const integ = select(abs(k).greaterThan(1e-5),
			a.div(b).mul(exp(camH.mul(b).negate())).mul(float(1).sub(exp(d.mul(k).negate()))).div(ry),
			a.mul(exp(camH.mul(b).negate())).mul(d));
		// plus a thin, uniform aerosol term so the far mountains still recede
		const aer = d.mul(a).mul(0.05);
		return float(1).sub(exp(integ.add(aer).negate())).clamp(0, 0.97);
	})();

	const color = Fn(() => {
		const rd = normalize(positionWorld.sub(cameraPosition));
		const h = normalize(vec3(rd.x, clamp(rd.y, 0.015, 0.12), rd.z));
		const sky = world.skyAt(equirectUV(h)).rgb;
		const sunGlow = pow(max(dot(rd, U.sunDir), 0), 10).mul(0.6).add(pow(max(dot(rd, U.sunDir), 0), 120).mul(1.2));
		return sky.mul(U.hazeTint).add(U.sunColor.mul(sunGlow).mul(0.12));
	})();

	return fog(color, factor);
}
