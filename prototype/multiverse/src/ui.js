// Interface: the universe dial (what you are in, with its honesty label), the rift's destination, the
// controls, and the loading screen. Same visual language as the v2 concept: dark glass, thin lines,
// one gold accent.
import { UNIVERSES } from './universes.js';

export function createUI({ hidden = false } = {}) {
	const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
	const root = document.getElementById('ui');
	if (hidden) root.classList.add('hidden');

	const loader = el('div', 'loader', '<div class="brand">EdVerse <span>Multiverse</span></div><div class="bar"><i></i></div><div class="step">Starting</div>');
	document.body.appendChild(loader);

	const top = el('div', 'top');
	top.append(el('div', 'brand', 'EdVerse <span>Multiverse prototype</span>'));
	const meta = el('div', 'meta', '<span class="backend"></span><span class="fps"></span>');
	top.append(meta);
	root.append(top);

	const card = el('div', 'card');
	card.innerHTML = '<div class="kicker"></div><div class="name"></div><div class="when"></div><p class="blurb"></p>';
	root.append(card);

	const dial = el('div', 'dial');
	const buttons = UNIVERSES.map((u, i) => {
		const b = el('button', 'uni', `<b>${i + 1}</b><span>${u.name}</span><em>${u.kind}</em>`);
		b.onclick = () => api.onTravel && api.onTravel(u.id);
		dial.append(b);
		return b;
	});
	root.append(dial);

	const rift = el('div', 'rift', 'Rift opens on <b></b> · <kbd>T</kbd> to retune');
	rift.querySelector('b').onclick = () => {};
	root.append(rift);

	const help = el('div', 'help', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · <kbd>Shift</kbd> run · drag to look · walk into the ring to cross · <kbd>1</kbd>–<kbd>4</kbd> jump');
	root.append(help);

	const api = {
		onTravel: null,
		onTarget: null,
		progress(p, step) {
			loader.querySelector('i').style.width = Math.round(p * 100) + '%';
			loader.querySelector('.step').textContent = step;
		},
		ready() { loader.classList.add('done'); setTimeout(() => loader.remove(), 900); },
		error(e) {
			loader.querySelector('.step').textContent = 'This browser could not start the renderer: ' + (e && e.message ? e.message : e);
			loader.classList.add('failed');
		},
		setBackend(b) { meta.querySelector('.backend').textContent = b; },
		setFps(f) { meta.querySelector('.fps').textContent = Math.round(f) + ' fps'; },
		setUniverse(u) {
			card.querySelector('.kicker').textContent = u.kind;
			card.querySelector('.kicker').dataset.kind = u.kind;
			card.querySelector('.name').textContent = u.name;
			card.querySelector('.when').textContent = u.when;
			card.querySelector('.blurb').textContent = u.blurb;
			buttons.forEach((b, i) => b.classList.toggle('on', UNIVERSES[i] === u));
		},
		setTarget(u) { rift.querySelector('b').textContent = u.name; },
	};
	return api;
}
