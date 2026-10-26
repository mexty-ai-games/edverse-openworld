// The four universes of the v2 concept: one set of parameters each, applied to the same world.
// Values follow tools/concept_scene.py, which rendered the concept frames.
import * as THREE from 'three/webgpu';

const c = (r, g, b) => new THREE.Color(r, g, b);

export const UNIVERSES = [
	{
		id: 'prime', name: 'Prime', when: 'Today', kind: 'Record',
		blurb: 'The baseline: today\'s fjord, forest and lighthouse.',
		sea: 0, mtn: 1, snow: 95,
		grass: c(0.11, 0.2, 0.055), rock: c(0.2, 0.18, 0.16), tree: c(0.018, 0.045, 0.024),
		treeDensity: 1, treeH: 1, treeW: 1, grassDensity: 1,
		sun: { el: 7, rot: 166 }, air: { rayleigh: 1, mie: 1.2, ozone: 1, mieG: 0.8 },
		haze: { density: 0.00022, falloff: 0.008, tint: c(1, 1, 1) },
		clouds: 0.42, lighthouse: true, glacier: false, dead: false,
		grade: { lift: c(1, 1, 1), gain: c(1, 1, 1) }, exposure: 0.85,
	},
	{
		id: 'glacial', name: 'Glacial', when: '~21,000 years ago', kind: 'Record',
		blurb: 'Last Glacial Maximum: sea far lower, an ice sheet fills the fjord. Nobody has built the lighthouse.',
		sea: -16, mtn: 1, snow: 22,
		grass: c(0.2, 0.18, 0.11), rock: c(0.22, 0.22, 0.23), tree: c(0.04, 0.06, 0.04),
		treeDensity: 0.05, treeH: 0.45, treeW: 1, grassDensity: 0.35,
		sun: { el: 6, rot: 180 }, air: { rayleigh: 1, mie: 0.4, ozone: 1.6, mieG: 0.8 },
		haze: { density: 0.0005, falloff: 0.008, tint: c(0.95, 1.0, 1.08) },
		clouds: 0.3, lighthouse: false, glacier: true, dead: false,
		grade: { lift: c(0.98, 1.0, 1.04), gain: c(0.95, 1.0, 1.08) }, exposure: 0.8,
	},
	{
		id: 'drowned', name: 'Drowned', when: 'Year 2300, high emissions', kind: 'Projection',
		blurb: 'A projection, not a certainty: the sea several metres higher, the lighthouse standing in water.',
		sea: 9, mtn: 1, snow: 400,
		grass: c(0.24, 0.22, 0.08), rock: c(0.22, 0.18, 0.14), tree: c(0.035, 0.05, 0.025),
		treeDensity: 0.55, treeH: 0.9, treeW: 1, grassDensity: 0.8,
		sun: { el: 4, rot: 168 }, air: { rayleigh: 1.6, mie: 7, ozone: 0.6, mieG: 0.82 },
		haze: { density: 0.0014, falloff: 0.007, tint: c(1.08, 0.95, 0.82) },
		clouds: 0.55, lighthouse: true, glacier: false, dead: true,
		grade: { lift: c(1.03, 1.0, 0.96), gain: c(1.08, 1.0, 0.9) }, exposure: 1.0,
	},
	{
		id: 'halfg', name: 'Half gravity', when: 'What if g were 4.9 m/s²', kind: 'What if',
		blurb: 'One constant changed on purpose: higher peaks, tall thin trees, a lighthouse built twice as tall.',
		sea: 0, mtn: 1.75, snow: 170,
		grass: c(0.07, 0.17, 0.13), rock: c(0.15, 0.14, 0.18), tree: c(0.02, 0.06, 0.05),
		treeDensity: 0.85, treeH: 2.3, treeW: 0.6, grassDensity: 0.9,
		sun: { el: 4.5, rot: 176 }, air: { rayleigh: 1.3, mie: 1.2, ozone: 5.5, mieG: 0.78 },
		haze: { density: 0.0006, falloff: 0.008, tint: c(0.92, 0.88, 1.12) },
		clouds: 0.38, lighthouse: true, glacier: false, dead: false,
		grade: { lift: c(1.0, 0.97, 1.08), gain: c(0.9, 0.9, 1.18) }, exposure: 1.1,
	},
];

export const byId = Object.fromEntries(UNIVERSES.map((u) => [u.id, u]));
