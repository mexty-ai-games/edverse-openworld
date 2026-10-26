// Binary assets, fetched as is or, where a host only serves text (the claude.ai artifact build), from a
// .json file holding { "base64": "..." }.
export async function loadBinary(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(url + ': ' + res.status);
	if (!url.endsWith('.json')) return res.arrayBuffer();
	const { base64 } = await res.json();
	const bin = atob(base64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out.buffer;
}
