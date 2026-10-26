// Post: scene pass with normals -> GTAO (ambient occlusion on the lit image, softened), bloom for the
// sun, the rift and the lamp, the universe's colour grade and a vignette, then AgX tone mapping and FXAA.
import * as THREE from 'three/webgpu';
import {
	pass, mrt, output, normalView, packNormalToRGB, unpackRGBToNormal, sample, vec4, vec3, float, mix, smoothstep,
	length, screenUV, renderOutput, uniform,
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { U } from './world.js';

export function createPipeline(renderer, scene, camera, { quality = 'high' } = {}) {
	const pipeline = new THREE.RenderPipeline(renderer);
	pipeline.outputColorTransform = false;

	const scenePass = pass(scene, camera);
	let color;
	let aoPass = null;
	if (quality !== 'low') {
		scenePass.setMRT(mrt({ output, normal: packNormalToRGB(normalView) }));
		const sceneNormalTex = scenePass.getTextureNode('normal');
		const sceneNormal = sample((uv) => unpackRGBToNormal(sceneNormalTex.sample(uv)));
		aoPass = ao(scenePass.getTextureNode('depth'), sceneNormal, camera);
		aoPass.resolutionScale = 0.5;
		aoPass.radius.value = 1.2;
		aoPass.thickness.value = 1.5;
		const occ = aoPass.getTextureNode().r;
		const c = scenePass.getTextureNode('output');
		color = vec4(c.rgb.mul(mix(float(1), occ, 0.75)), c.a);
	} else {
		color = scenePass.getTextureNode('output');
	}

	const flash = uniform(0);
	const glow = bloom(color, 0.14, 0.35, 5.0);
	let c = color.rgb.add(glow.rgb);
	// universe grade (lift / gain around mid grey), then the rift flash
	c = c.mul(U.gain).add(U.lift.sub(1).mul(0.06));
	const vig = float(1).sub(smoothstep(0.35, 1.05, length(screenUV.sub(0.5)).mul(1.35)).mul(0.5));
	c = c.mul(vig);
	c = mix(c, vec3(1.6, 1.1, 0.6), flash);
	const out = renderOutput(vec4(c, 1));
	pipeline.outputNode = quality === 'low' ? out : fxaa(out);
	return { pipeline, flash, aoPass };
}
