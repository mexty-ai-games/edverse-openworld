// Binary assets, fetched as is or, where a host only serves text (the claude.ai artifact build), from a
// .json file holding { "base64": "..." }. MEXTY media-library URLs sit behind the player's login: their
// requests carry its cookies (as in the OpenWorld game's scene/assets.ts).
const needsLogin = (url) => /(^|\.)mexty\.ai\/|(^|\.)mext\.app\//.test(url.replace(/^https?:\/\//, ''));

export async function loadBinary(url) {
	const res = await fetch(url, { credentials: needsLogin(url) ? 'include' : 'same-origin' });
	if (!res.ok) throw new Error(url + ': ' + res.status);
	if (!url.endsWith('.json')) return res.arrayBuffer();
	const { base64 } = await res.json();
	const bin = atob(base64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out.buffer;
}
