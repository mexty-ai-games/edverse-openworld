// Every word the multiverse shows, in English and French. The standalone page picks one language;
// the EdVerse block receives the same structure as LocalizedText props.
export const TEXT = {
	universes: {
		prime: {
			name: { en: 'Prime', fr: 'Prime' },
			when: { en: 'Today', fr: "Aujourd'hui" },
			kind: { en: 'Record', fr: 'Attesté' },
			blurb: { en: "The baseline: today's fjord, forest and lighthouse.", fr: "La référence : le fjord, la forêt et le phare d'aujourd'hui." },
		},
		glacial: {
			name: { en: 'Glacial', fr: 'Glaciaire' },
			when: { en: '~21,000 years ago', fr: 'Il y a ~21 000 ans' },
			kind: { en: 'Record', fr: 'Attesté' },
			blurb: { en: 'Last Glacial Maximum: the sea far lower, an ice sheet fills the fjord. Nobody has built the lighthouse.', fr: "Dernier maximum glaciaire : la mer bien plus basse, une calotte de glace remplit le fjord. Personne n'a encore bâti le phare." },
		},
		drowned: {
			name: { en: 'Drowned', fr: 'Submergé' },
			when: { en: 'Year 2300, high emissions', fr: 'An 2300, fortes émissions' },
			kind: { en: 'Projection', fr: 'Projection' },
			blurb: { en: 'A projection, not a certainty: the sea several metres higher, the lighthouse standing in water.', fr: "Une projection, pas une certitude : la mer plusieurs mètres plus haut, le phare les pieds dans l'eau." },
		},
		halfg: {
			name: { en: 'Half gravity', fr: 'Demi-gravité' },
			when: { en: 'What if g were 4.9 m/s²', fr: 'Et si g valait 4,9 m/s²' },
			kind: { en: 'What if', fr: 'Et si' },
			blurb: { en: 'One constant changed on purpose: higher peaks, tall thin trees, a lighthouse built twice as tall.', fr: 'Une seule constante changée exprès : des sommets plus hauts, des arbres hauts et fins, un phare deux fois plus grand.' },
		},
	},
	ui: {
		title: { en: 'EdVerse', fr: 'EdVerse' },
		subtitle: { en: 'Multiverse prototype', fr: 'Prototype multivers' },
		riftOpensOn: { en: 'The rift opens on', fr: 'La faille ouvre sur' },
		retune: { en: 'T or tap to retune', fr: 'T ou touchez pour changer' },
		help: { en: 'WASD walk · Shift run · drag to look · walk into the ring to cross · 1–4 jump', fr: 'ZQSD marcher · Maj courir · glisser pour regarder · entrez dans l\'anneau pour traverser · 1–4 sauter' },
		paused: { en: 'Paused', fr: 'En pause' },
		error: { en: 'This device could not start the 3D view.', fr: "Cet appareil n'a pas pu lancer la vue 3D." },
		loading: {
			start: { en: 'Starting the renderer', fr: 'Démarrage du rendu' },
			fjord: { en: 'Loading the fjord', fr: 'Chargement du fjord' },
			skies: { en: 'Scattering light through four skies', fr: 'La lumière traverse quatre ciels' },
			terrain: { en: 'Raising the terrain', fr: 'Le relief se dresse' },
			stones: { en: 'Placing the stones', fr: 'Les pierres se dressent' },
			forest: { en: 'Growing the forest', fr: 'La forêt pousse' },
			meadow: { en: 'Growing the meadow', fr: 'La prairie pousse' },
			shaders: { en: 'Compiling shaders', fr: 'Préparation des shaders' },
		},
	},
};

/** Resolves every LocalizedText of a text tree into one language (falls back to English). */
export function resolveText(tree, lang) {
	if (tree && typeof tree === 'object' && ('en' in tree || 'fr' in tree) && Object.values(tree).every((v) => typeof v === 'string')) {
		return tree[lang] || tree.en || Object.values(tree)[0] || '';
	}
	if (tree && typeof tree === 'object') return Object.fromEntries(Object.entries(tree).map(([k, v]) => [k, resolveText(v, lang)]));
	return tree;
}
