// Interface: the universe dial (what you are in, with its honesty label), the rift's destination, the
// controls, a touch stick on phones and tablets, and the loading screen. Everything is drawn inside the
// container it is given (the EdVerse block or the standalone page), with its own scoped styles; every
// word comes from `text`. Same visual language as the v2 concept: dark glass, thin lines, one gold accent.
import { UNIVERSES } from './universes.js';

const CSS = `
.mv-root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #07090a; color: #eef1ee; font-family: "Atkinson Hyperlegible", system-ui, sans-serif;
	--gold: #e9b45a; --soft: #b9c4bf; --glass: rgba(10, 14, 16, 0.62); --line: rgba(238, 241, 238, 0.16); }
.mv-root * { box-sizing: border-box; }
.mv-root canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.mv-ui { position: absolute; inset: 0; pointer-events: none; padding: 16px; }
.mv-ui.hidden { display: none; }
.mv-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.mv-brand { font-family: "Bricolage Grotesque", system-ui, sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -0.01em; text-shadow: 0 1px 8px rgba(0,0,0,.5); }
.mv-brand span { color: var(--gold); }
.mv-meta { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; display: flex; gap: 12px; color: var(--soft); }
.mv-card { position: absolute; left: 16px; top: 56px; width: min(340px, calc(100% - 32px)); background: var(--glass); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; backdrop-filter: blur(8px); }
.mv-kicker { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8fc78a; }
.mv-kicker[data-kind="projection"] { color: #e0a15a; }
.mv-kicker[data-kind="whatif"] { color: #b9a3e8; }
.mv-name { font-family: "Bricolage Grotesque", system-ui, sans-serif; font-size: 26px; font-weight: 700; margin-top: 4px; }
.mv-when { color: var(--gold); font-size: 13px; }
.mv-blurb { margin: 8px 0 0; color: var(--soft); font-size: 14px; line-height: 1.45; }
.mv-dial { position: absolute; right: 16px; top: 56px; display: flex; flex-direction: column; gap: 6px; pointer-events: auto; }
.mv-uni { all: unset; cursor: pointer; display: grid; grid-template-columns: 22px 1fr; column-gap: 8px; align-items: baseline; background: var(--glass); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; min-width: 170px; min-height: 44px; backdrop-filter: blur(8px); }
.mv-uni b { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; color: var(--soft); grid-row: span 2; }
.mv-uni span { font-weight: 700; font-size: 14px; }
.mv-uni em { font-style: normal; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--soft); }
.mv-uni.on { border-color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold); }
.mv-uni:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.mv-rift { position: absolute; left: 50%; bottom: 52px; transform: translateX(-50%); background: var(--glass); border: 1px solid rgba(233,180,90,.5); border-radius: 99px; padding: 7px 14px; font-size: 13px; white-space: nowrap; backdrop-filter: blur(8px); pointer-events: auto; cursor: pointer; }
.mv-rift b { color: var(--gold); }
.mv-help { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); color: var(--soft); font-size: 12px; white-space: nowrap; text-shadow: 0 1px 6px rgba(0,0,0,.6); }
.mv-stick { position: absolute; left: 24px; bottom: 24px; width: 120px; height: 120px; border-radius: 50%; border: 1px solid var(--line); background: rgba(10,14,16,.35); pointer-events: auto; touch-action: none; display: none; }
.mv-stick i { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; background: rgba(233,180,90,.75); }
.mv-touch .mv-stick { display: block; }
.mv-touch .mv-help { display: none; }
.mv-loader { position: absolute; inset: 0; display: grid; place-content: center; gap: 14px; background: radial-gradient(ellipse at 50% 60%, #1a1610, #07090a 70%); z-index: 10; transition: opacity .8s ease; text-align: center; }
.mv-loader .mv-brand { font-size: 28px; }
.mv-bar { width: min(320px, 70vw); height: 2px; background: var(--line); }
.mv-bar i { display: block; height: 100%; width: 0; background: var(--gold); transition: width .3s ease; }
.mv-step { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--soft); max-width: 80vw; }
.mv-loader.done { opacity: 0; pointer-events: none; }
.mv-loader.failed .mv-step { color: #e07a6a; text-transform: none; letter-spacing: 0; font-size: 13px; }
.mv-root [hidden] { display: none !important; }
.mv-paused { position: absolute; inset: 0; display: grid; place-content: center; background: rgba(7,9,10,.55); font-family: "Bricolage Grotesque", system-ui, sans-serif; font-size: 22px; z-index: 5; }
@media (max-width: 720px), (max-height: 480px) {
	.mv-card { top: auto; bottom: 96px; left: auto; right: 16px; width: min(260px, calc(100% - 180px)); padding: 10px 12px; }
	.mv-card .mv-blurb { display: none; }
	.mv-name { font-size: 20px; }
	.mv-dial { flex-direction: row; flex-wrap: wrap; top: 44px; left: 16px; right: 16px; }
	.mv-uni { min-width: 0; padding: 6px 10px; }
	.mv-uni em { display: none; }
	.mv-help { display: none; }
	.mv-rift { bottom: 16px; left: auto; right: 16px; transform: none; }
}
@media (prefers-reduced-motion: reduce) { .mv-loader { transition: none; } }
`;

export function createUI(root, text, { hidden = false } = {}) {
	const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
	const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
	root.classList.add('mv-root');
	const style = el('style'); style.textContent = CSS; root.append(style);
	const ui = el('div', 'mv-ui' + (hidden ? ' hidden' : ''));
	root.append(ui);
	const touch = matchMedia('(pointer: coarse)').matches;
	if (touch) root.classList.add('mv-touch');

	const loader = el('div', 'mv-loader', `<div class="mv-brand">${esc(text.ui.title)}</div><div class="mv-bar"><i></i></div><div class="mv-step"></div>`);
	root.append(loader);

	const top = el('div', 'mv-top');
	top.append(el('div', 'mv-brand', `${esc(text.ui.title)} <span>${esc(text.ui.subtitle)}</span>`));
	const meta = el('div', 'mv-meta', '<span class="b"></span><span class="f"></span>');
	top.append(meta);
	ui.append(top);

	const card = el('div', 'mv-card', '<div class="mv-kicker"></div><div class="mv-name"></div><div class="mv-when"></div><p class="mv-blurb"></p>');
	ui.append(card);

	const dial = el('div', 'mv-dial');
	const buttons = UNIVERSES.map((u, i) => {
		const t = text.universes[u.id];
		const b = el('button', 'mv-uni', `<b>${i + 1}</b><span>${esc(t.name)}</span><em>${esc(t.kind)}</em>`);
		b.onclick = () => api.onTravel && api.onTravel(u.id);
		dial.append(b);
		return b;
	});
	ui.append(dial);

	const rift = el('div', 'mv-rift', `${esc(text.ui.riftOpensOn)} <b></b> · ${esc(text.ui.retune)}`);
	rift.onclick = () => api.onRetune && api.onRetune();
	ui.append(rift);
	ui.append(el('div', 'mv-help', esc(text.ui.help)));

	// touch stick: drag inside the circle to walk
	const stick = el('div', 'mv-stick', '<i></i>');
	ui.append(stick);
	const knob = stick.querySelector('i');
	let sid = null;
	const move = (e) => {
		const r = stick.getBoundingClientRect();
		let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
		const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
		knob.style.transform = `translate(${x * 36}px, ${y * 36}px)`;
		api.onStick && api.onStick(x, y);
	};
	stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); move(e); e.stopPropagation(); });
	stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) move(e); });
	const end = () => { sid = null; knob.style.transform = ''; api.onStick && api.onStick(0, 0); };
	stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);

	const pausedEl = el('div', 'mv-paused', esc(text.ui.paused));
	pausedEl.hidden = true;
	root.append(pausedEl);

	const api = {
		onTravel: null, onRetune: null, onStick: null,
		progress(p, step) {
			loader.querySelector('.mv-bar i').style.width = Math.round(p * 100) + '%';
			loader.querySelector('.mv-step').textContent = text.ui.loading[step] || '';
		},
		ready() { loader.classList.add('done'); setTimeout(() => loader.remove(), 900); },
		error(e) {
			loader.querySelector('.mv-step').textContent = text.ui.error + (e && e.message ? ' (' + e.message + ')' : '');
			loader.classList.add('failed');
		},
		setBackend(b) { meta.querySelector('.b').textContent = b; },
		setFps(f) { meta.querySelector('.f').textContent = Math.round(f) + ' fps'; },
		setPaused(p) { pausedEl.hidden = !p; },
		setUniverse(u) {
			const t = text.universes[u.id];
			const k = card.querySelector('.mv-kicker');
			k.textContent = t.kind; k.dataset.kind = u.kind;
			card.querySelector('.mv-name').textContent = t.name;
			card.querySelector('.mv-when').textContent = t.when;
			card.querySelector('.mv-blurb').textContent = t.blurb;
			buttons.forEach((b, i) => b.classList.toggle('on', UNIVERSES[i] === u));
		},
		setTarget(u) { rift.querySelector('b').textContent = text.universes[u.id].name; },
	};
	return api;
}
