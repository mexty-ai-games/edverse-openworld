// Default Skyharbor content (EN + FR) and asset URLs. This is what `props.skyharbor` holds when the
// game's saved variant has no Skyharbor sub-tree yet; the variant can override any of it.
import type { CourierLevel, InfoSpot, Planet, SkyharborProps, SkyharborUi } from "./types";

const ui: SkyharborUi = {
  name: { en: "Skyharbor", fr: "Port-du-Ciel" },
  backToGrove: { en: "Back to the Idea Grove", fr: "Retour au Bosquet des idées" },
  close: { en: "Close", fr: "Fermer" },
  talkRobot: { en: "Help Bolt the robot", fr: "Aider Boulon le robot" },
  usePlanets: { en: "Planet Parade", fr: "La parade des planètes" },
  look: { en: "Look", fr: "Regarder" },

  courierTitle: { en: "Robot Courier", fr: "Robot coursier" },
  courierIntro: {
    en: "Bolt carries parts to the airship. Give Bolt a program: the robot does exactly what the blocks say, in order.",
    fr: "Boulon apporte des pièces au dirigeable. Donne-lui un programme : le robot fait exactement ce que disent les blocs, dans l'ordre.",
  },
  chooseMode: { en: "How do you want to play?", fr: "Comment veux-tu jouer ?" },
  modeSimple: { en: "Arrows", fr: "Flèches" },
  modeSimpleHint: { en: "Ages 4–6: tap arrows to show the way", fr: "4–6 ans : touche les flèches pour montrer le chemin" },
  modeMain: { en: "Code blocks", fr: "Blocs de code" },
  modeMainHint: { en: "Ages 7–12: forward, turn and repeat", fr: "7–12 ans : avancer, tourner et répéter" },
  level: { en: "Puzzle {n} of {total}", fr: "Défi {n} sur {total}" },
  goal: { en: "Pick up the gear ⚙️, then bring it to the airship.", fr: "Prends l'engrenage ⚙️, puis apporte-le au dirigeable." },
  goalSimple: { en: "Get the gear ⚙️, then go to the airship!", fr: "Prends l'engrenage ⚙️, puis va au dirigeable !" },
  blockForward: { en: "Forward", fr: "Avancer" },
  blockLeft: { en: "Turn left", fr: "Tourner à gauche" },
  blockRight: { en: "Turn right", fr: "Tourner à droite" },
  blockRepeat: { en: "Repeat", fr: "Répéter" },
  arrowUp: { en: "Up", fr: "Haut" },
  arrowDown: { en: "Down", fr: "Bas" },
  arrowLeft: { en: "Left", fr: "Gauche" },
  arrowRight: { en: "Right", fr: "Droite" },
  times: { en: "times", fr: "fois" },
  loopDone: { en: "Close the loop", fr: "Fermer la boucle" },
  loopInside: { en: "New blocks go inside the loop", fr: "Les nouveaux blocs vont dans la boucle" },
  program: { en: "Bolt's program", fr: "Le programme de Boulon" },
  programEmpty: { en: "Tap or drag blocks here", fr: "Touche ou glisse des blocs ici" },
  programEmptySimple: { en: "Tap the arrows", fr: "Touche les flèches" },
  dragHint: { en: "Tap a block in the program to take it out.", fr: "Touche un bloc du programme pour l'enlever." },
  memory: { en: "Memory: {used} / {max} blocks", fr: "Mémoire : {used} / {max} blocs" },
  run: { en: "Go!", fr: "C'est parti !" },
  reset: { en: "Try again", fr: "Réessayer" },
  clear: { en: "Clear", fr: "Effacer" },
  undo: { en: "Undo", fr: "Annuler" },
  showMe: { en: "Show me how", fr: "Montre-moi" },
  shownSolution: {
    en: "Here is one program that works. Press Go! to watch it.",
    fr: "Voici un programme qui marche. Appuie sur C'est parti ! pour le voir.",
  },
  msgEmpty: { en: "Bolt is waiting for some blocks!", fr: "Boulon attend des blocs !" },
  msgTooLong: {
    en: "Bolt's memory holds {max} blocks and this program uses {used}. A repeat block 🔁 can make it shorter!",
    fr: "La mémoire de Boulon contient {max} blocs et ce programme en utilise {used}. Un bloc Répéter 🔁 peut le raccourcir !",
  },
  msgBump: {
    en: "Bonk! At step {step}, Bolt bumped into a crate. Look at the glowing block: what should Bolt do there?",
    fr: "Bong ! À l'étape {step}, Boulon s'est cogné à une caisse. Regarde le bloc qui brille : que devrait faire Boulon ici ?",
  },
  msgEdge: {
    en: "Whoa! At step {step}, Bolt reached the railing and stopped safely. Look at the glowing block.",
    fr: "Oh ! À l'étape {step}, Boulon est arrivé à la rambarde et s'est arrêté. Regarde le bloc qui brille.",
  },
  msgNoPart: {
    en: "Bolt stopped here without the gear. The dots show where Bolt went. Can you reach the gear ⚙️ first?",
    fr: "Boulon s'est arrêté ici sans l'engrenage. Les points montrent son chemin. Peux-tu d'abord atteindre l'engrenage ⚙️ ?",
  },
  msgNotThere: {
    en: "Bolt has the gear! The program ended before the airship. Add the steps that are missing.",
    fr: "Boulon a l'engrenage ! Le programme s'est arrêté avant le dirigeable. Ajoute les étapes qui manquent.",
  },
  msgPicked: { en: "Gear picked up!", fr: "Engrenage pris !" },
  msgDelivered: { en: "Delivered! The airship crew says thank you!", fr: "Livré ! L'équipage du dirigeable te dit merci !" },
  msgFirstTry: { en: "First try — great planning!", fr: "Du premier coup, bien pensé !" },
  next: { en: "Next puzzle", fr: "Défi suivant" },
  roundDone: { en: "All parts delivered!", fr: "Toutes les pièces sont livrées !" },
  roundScore: { en: "{n} of {total} solved on the first try", fr: "{n} sur {total} réussis du premier coup" },
  playAgain: { en: "New puzzles", fr: "Nouveaux défis" },
  changeMode: { en: "Change mode", fr: "Changer de mode" },
  questionCourier: { en: "Robot Courier puzzle {id}", fr: "Défi du robot coursier {id}" },

  planetsTitle: { en: "Planet Parade", fr: "La parade des planètes" },
  planetsIntro: {
    en: "Line up the planets from the Sun outward. Tap the planet that comes next.",
    fr: "Range les planètes en partant du Soleil. Touche la planète qui vient ensuite.",
  },
  planetsFind: { en: "Which planet is number {n} from the Sun?", fr: "Quelle planète est la n° {n} en partant du Soleil ?" },
  planetsNotYet: {
    en: "Not this one yet — {name} is further along the parade. Try again!",
    fr: "Pas encore celle-ci : {name} est plus loin dans la parade. Essaie encore !",
  },
  planetsGood: { en: "Yes! {name}.", fr: "Oui ! {name}." },
  planetsDone: { en: "The whole Solar System is in order!", fr: "Tout le système solaire est rangé !" },
  planetsHint: { en: "Hint", fr: "Indice" },
  sun: { en: "Sun", fr: "Soleil" },
  questionPlanet: { en: "Planet number {n} from the Sun", fr: "Planète n° {n} en partant du Soleil" },
};

const tips = {
  forward: { en: "Count the squares to the gear, then to the airship.", fr: "Compte les cases jusqu'à l'engrenage, puis jusqu'au dirigeable." },
  turn: { en: "Turning does not move Bolt: it only changes where Bolt looks.", fr: "Tourner ne fait pas avancer Boulon : il regarde juste ailleurs." },
  turnSide: { en: "Left and right are Bolt's left and right. Imagine you are Bolt!", fr: "La gauche et la droite sont celles de Boulon. Imagine que tu es Boulon !" },
  loop: { en: "The same block many times in a row? Put it inside one repeat block.", fr: "Le même bloc plusieurs fois de suite ? Mets-le dans un seul bloc Répéter." },
  pattern: { en: "Find the steps that come back again and again, and repeat them.", fr: "Trouve les étapes qui reviennent encore et encore, et répète-les." },
  arrows: { en: "Tap an arrow for each step Bolt takes.", fr: "Touche une flèche pour chaque pas de Boulon." },
  around: { en: "Crates are in the way: go around them.", fr: "Des caisses bloquent le passage : fais le tour." },
};

const levels: CourierLevel[] = [
  // ---- main mode (7–12): sequences
  { id: "seq-1", mode: "main", stage: "sequence", facing: "E", maxBlocks: 0, tip: tips.forward, rows: ["#.#.#.", "S.P..G", "#.#.#."] },
  { id: "seq-2", mode: "main", stage: "sequence", facing: "N", maxBlocks: 0, tip: tips.forward, rows: ["#G#", "#.#", "#P#", "...", "#S#"] },
  { id: "seq-3", mode: "main", stage: "sequence", facing: "E", maxBlocks: 0, tip: tips.forward, rows: ["..##.", "S.P.G", ".#..#"] },
  // turns
  { id: "turn-1", mode: "main", stage: "turns", facing: "S", maxBlocks: 0, tip: tips.turn, rows: ["S.#", "..#", "P.G"] },
  { id: "turn-2", mode: "main", stage: "turns", facing: "N", maxBlocks: 0, tip: tips.turnSide, rows: ["..G", ".#.", "P#.", "S.."] },
  { id: "turn-3", mode: "main", stage: "turns", facing: "E", maxBlocks: 0, tip: tips.turnSide, rows: ["...G", "#..P", "....", "S..#"] },
  { id: "turn-4", mode: "main", stage: "turns", facing: "N", maxBlocks: 0, tip: tips.around, rows: ["G...", "#.#.", "P...", "S#.."] },
  // loops (a memory limit makes the repeat block worth it)
  { id: "loop-1", mode: "main", stage: "loops", facing: "E", maxBlocks: 3, tip: tips.loop, rows: ["#########", "S.....P.G", "#########"] },
  { id: "loop-2", mode: "main", stage: "loops", facing: "S", maxBlocks: 5, tip: tips.loop, rows: ["S##.", ".##.", ".##.", "P..G"] },
  { id: "loop-3", mode: "main", stage: "loops", facing: "E", maxBlocks: 8, tip: tips.loop, rows: ["S.....", "#####.", "G....P"] },
  { id: "loop-4", mode: "main", stage: "loops", facing: "E", maxBlocks: 6, tip: tips.pattern, rows: ["..###G", "####..", "###P.#", "##..##", "#..###", "S.##.."] },
  // ---- simple mode (4–6): arrows, short paths
  { id: "arrow-1", mode: "simple", stage: "sequence", facing: "E", maxBlocks: 0, tip: tips.arrows, rows: ["S.P.G"] },
  { id: "arrow-2", mode: "simple", stage: "sequence", facing: "N", maxBlocks: 0, tip: tips.arrows, rows: ["G..", "P..", "S.."] },
  { id: "arrow-3", mode: "simple", stage: "turns", facing: "E", maxBlocks: 0, tip: tips.arrows, rows: ["S..", "..P", "..G"] },
  { id: "arrow-4", mode: "simple", stage: "turns", facing: "E", maxBlocks: 0, tip: tips.arrows, rows: ["..G", ".#P", "S.."] },
  { id: "arrow-5", mode: "simple", stage: "turns", facing: "N", maxBlocks: 0, tip: tips.arrows, rows: ["P.G", ".#.", "S.."] },
  { id: "arrow-6", mode: "simple", stage: "turns", facing: "E", maxBlocks: 0, tip: tips.around, rows: ["S..#", "#.P#", "G..."] },
];

// Real facts (NASA Solar System facts), checked for ages 7–12.
const planets: Planet[] = [
  {
    id: "mercury", order: 1, color: "#a59a8e", color2: "#7d736a", size: 0.55, rings: false,
    name: { en: "Mercury", fr: "Mercure" },
    fact: { en: "Mercury is the smallest planet and the closest to the Sun. A year there lasts only 88 Earth days.", fr: "Mercure est la plus petite planète et la plus proche du Soleil. Une année y dure seulement 88 jours terrestres." },
    hint: { en: "The smallest planet, grey and rocky, right next to the Sun.", fr: "La plus petite planète, grise et rocheuse, tout près du Soleil." },
  },
  {
    id: "venus", order: 2, color: "#e8c27a", color2: "#c99a52", size: 0.8, rings: false,
    name: { en: "Venus", fr: "Vénus" },
    fact: { en: "Venus is the hottest planet: its thick clouds trap the Sun's heat.", fr: "Vénus est la planète la plus chaude : ses nuages épais gardent la chaleur du Soleil." },
    hint: { en: "A yellow, cloudy planet, almost as big as Earth.", fr: "Une planète jaune et nuageuse, presque aussi grande que la Terre." },
  },
  {
    id: "earth", order: 3, color: "#3d7fd6", color2: "#4fa65a", size: 0.85, rings: false,
    name: { en: "Earth", fr: "Terre" },
    fact: { en: "Earth is our home: the only planet we know with liquid water on its surface and life.", fr: "La Terre est notre maison : la seule planète connue avec de l'eau liquide en surface et de la vie." },
    hint: { en: "Blue oceans and green land: our home!", fr: "Des océans bleus et des terres vertes : notre maison !" },
  },
  {
    id: "mars", order: 4, color: "#c8603a", color2: "#9a4428", size: 0.65, rings: false,
    name: { en: "Mars", fr: "Mars" },
    fact: { en: "Mars looks red because its dust is full of rusty iron. It has the tallest volcano in the Solar System.", fr: "Mars est rouge car sa poussière contient du fer rouillé. Elle a le plus haut volcan du système solaire." },
    hint: { en: "The red planet, smaller than Earth.", fr: "La planète rouge, plus petite que la Terre." },
  },
  {
    id: "jupiter", order: 5, color: "#d9b38c", color2: "#a8754e", size: 1.6, rings: false,
    name: { en: "Jupiter", fr: "Jupiter" },
    fact: { en: "Jupiter is the biggest planet. More than 1,000 Earths could fit inside it.", fr: "Jupiter est la plus grosse planète. Plus de 1 000 Terres pourraient tenir dedans." },
    hint: { en: "The giant with stripes and a big red spot.", fr: "La géante à rayures avec une grosse tache rouge." },
  },
  {
    id: "saturn", order: 6, color: "#e6cf96", color2: "#c4a868", size: 1.35, rings: true,
    name: { en: "Saturn", fr: "Saturne" },
    fact: { en: "Saturn's bright rings are made of countless pieces of ice and rock.", fr: "Les anneaux brillants de Saturne sont faits d'innombrables morceaux de glace et de roche." },
    hint: { en: "The one with big, beautiful rings.", fr: "Celle qui a de grands et beaux anneaux." },
  },
  {
    id: "uranus", order: 7, color: "#9fdbe0", color2: "#7cc3cc", size: 1.05, rings: false,
    name: { en: "Uranus", fr: "Uranus" },
    fact: { en: "Uranus spins on its side, as if it were rolling around the Sun.", fr: "Uranus tourne couchée sur le côté, comme si elle roulait autour du Soleil." },
    hint: { en: "A pale blue-green ice giant.", fr: "Une géante de glace bleu-vert pâle." },
  },
  {
    id: "neptune", order: 8, color: "#3f5fd0", color2: "#2c46a8", size: 1.0, rings: false,
    name: { en: "Neptune", fr: "Neptune" },
    fact: { en: "Neptune is the farthest planet from the Sun and has the fastest winds in the Solar System.", fr: "Neptune est la planète la plus éloignée du Soleil et a les vents les plus rapides du système solaire." },
    hint: { en: "A deep blue ice giant, the last one in the parade.", fr: "Une géante de glace bleu foncé, la dernière de la parade." },
  },
];

const spots: InfoSpot[] = [
  {
    id: "greenhouse", icon: "🌱",
    title: { en: "Glow Greenhouse", fr: "La serre lumineuse" },
    text: {
      en: "A greenhouse's glass lets sunlight in and keeps the warmth from escaping, so plants stay warm even on a cold night. Its triangle frame is a geodesic dome: triangles make it light and very strong.",
      fr: "Le verre d'une serre laisse entrer la lumière du Soleil et garde la chaleur, donc les plantes restent au chaud même par une nuit froide. Sa structure en triangles est un dôme géodésique : les triangles le rendent léger et très solide.",
    },
  },
  {
    id: "airship", icon: "⛵",
    title: { en: "The Sky Ship", fr: "Le navire du ciel" },
    text: {
      en: "Its propellers push air backwards, and the air pushes the ship forwards. Every push has an equal push back: that is one of Newton's laws of motion.",
      fr: "Ses hélices poussent l'air vers l'arrière, et l'air pousse le navire vers l'avant. Chaque poussée a une poussée égale en retour : c'est une des lois du mouvement de Newton.",
    },
  },
];

// Library URLs (assets/manifest.skyharbor.json); fern, grass tuft and forest tree are the Idea Grove's own.
const BASE = "https://future-api.mexty.ai/api/files/p/";

export const defaultProps: SkyharborProps = {
  ui,
  levels,
  roundMain: 8,
  roundSimple: 6,
  planets,
  spots,
  models: {
    observatory: BASE + "6add3bb9ca61b98af27f6a4c",
    airship: BASE + "6add3bbaca61b98af27f6a58",
    greenhouse: BASE + "6add3bbcca61b98af27f6a64",
    workshop: BASE + "6add3bbdca61b98af27f6a72",
    robot: BASE + "6add3bbfca61b98af27f6a84",
    harbor: BASE + "6add3bc0ca61b98af27f6a90",
    cliff: BASE + "6add3bc2ca61b98af27f6a9c",
    glowPlants: BASE + "6add3bc3ca61b98af27f6aa8",
    gate: BASE + "6add3bc5ca61b98af27f6ab4",
    fern: BASE + "6adc9142f7668f50f9400831",
    grassTuft: BASE + "6adc9156f7668f50f9400855",
    forestTree: BASE + "6adc9121f7668f50f94007c2",
  },
  textures: {
    paving: BASE + "6add3c47ca61b98af27f6c21",
    moss: BASE + "6add3c48ca61b98af27f6c33",
  },
  sounds: {
    ambience: BASE + "6add3c4aca61b98af27f6c3f",
    beep: BASE + "6add3c4bca61b98af27f6c4b",
    bump: BASE + "6add3c4dca61b98af27f6c57",
    whirr: BASE + "6add3c4fca61b98af27f6c63",
  },
};
