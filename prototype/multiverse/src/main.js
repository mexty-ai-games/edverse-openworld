// Standalone page for the multiverse (the EdVerse block mounts the same engine).
//   ?webgl      force the WebGL 2 backend          ?q=low   cheaper post, less grass
//   ?u=glacial  start in another universe          ?shot    hide the interface (screenshots)
//   ?lang=fr    French                             ?cam=concept  the concept frames' camera
//   ?no=water,forest,grass,shadows,post,portal,terrain,haze   switch parts off (debugging)
//   ?still=N&dt=s  render N fixed-step frames, then stop (headless checks)   ?at=rift  start in the ring
import { startMultiverse } from './engine.js';
import { TEXT, resolveText } from './text.js';

const params = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL;
// the artifact build ships binaries as base64 JSON
const ext = params.get('pack') === 'json' || window.__MV_PACK === 'json' ? '.json' : '';
const lang = params.get('lang') || (navigator.language || 'en').slice(0, 2);

const mv = startMultiverse(document.getElementById('app'), {
	assets: { heightfield: BASE + 'assets/heightfield.i16.bin' + ext, props: BASE + 'assets/props.glb' + ext },
	text: resolveText(TEXT, lang === 'fr' ? 'fr' : 'en'),
	quality: params.get('q') === 'low' ? 'low' : 'high',
	start: params.get('u') || undefined,
	off: new Set((params.get('no') || '').split(',').filter(Boolean)),
	forceWebGL: params.has('webgl'),
	hideUI: params.has('shot'),
	debug: {
		still: params.has('still') ? Number(params.get('still')) || 2 : 0,
		dt: Number(params.get('dt')) || 0,
		conceptCam: params.get('cam') === 'concept',
		atRift: params.get('at') === 'rift',
		onStill: () => { document.body.dataset.done = '1'; },
	},
	onError: () => { document.body.dataset.done = '1'; },
});
window.__mv = mv;
