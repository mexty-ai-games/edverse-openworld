import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudSave, useLanguage, useMexty, pickLanguage } from "@mexty/sdk";
import { useGLTF, useProgress } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GameCanvas, GROVE_ZONE, ActiveZone } from "./scene/GameCanvas";
import { GROVE_LAYOUT } from "./scene/Players";
import { Start } from "./ui/Start";
import { Hud } from "./ui/Hud";
import { Sky } from "./ui/Sky";
import { InfoCard, CardState } from "./ui/Cards";
import { ReportNote, ReportSheet, ReportStatus, ReportTarget, sendReport } from "./ui/Report";
import { createGame, Game, Peer, Target } from "./game/state";
import { STALLS, stallPoint } from "./game/layout";
import { sound } from "./audio";
import { useSettings } from "./settings";
import { makeNickname } from "./game/nickname";
import { openPresence, Presence, roomForAge } from "./game/net";
import { GROVE, PROPS_KEY, isDistrict, loadZone } from "./zones/registry";
import { Expedition } from "./ui/Expedition";
import { defaultExpedition, defaultQuests } from "./expedition/content";
import { defaultBugGames } from "./expedition/bugGames";
import { BugGames } from "./ui/BugGames";
import { Together, togetherLabel } from "./ui/Together";
import { defaultTogether } from "./together/content";
import "./game.css";
import "./ui/hub.css";

export interface LocalizedText {
  en?: string;
  fr?: string;
}

export interface Lantern {
  nickname: string;
  by?: string;
  title: LocalizedText;
  where: string;
  shippedAt: string;
}

export interface DistrictPreview {
  modelUrl: string;
  label: LocalizedText;
  credit?: string;
}

export interface District {
  id: string;
  name: LocalizedText;
  teaser: LocalizedText;
  learns: LocalizedText;
  imageUrl: string;
  imageAlt: LocalizedText;
  previews?: DistrictPreview[];
}

export interface DistrictName {
  id: string;
  name: LocalizedText;
}

export interface Star {
  x: number;
  y: number;
  size: number;
}

export interface Constellation {
  id: string;
  name: LocalizedText;
  hint: LocalizedText;
  fact: LocalizedText;
  stars: Star[];
  lines: number[][];
}

export interface Phrase {
  id: string;
  icon: string;
  text: LocalizedText;
  anim: string;
}

export interface AvatarPreset {
  id: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  bag: string;
}

export interface Models {
  tree: string;
  forestTree: string;
  lantern: string;
  plaza: string;
  stallBiome: string;
  stallChrono: string;
  stallSky: string;
  telescope: string;
  boulders: string;
  fern: string;
  flowers: string;
  grassTuft: string;
  avatar: string;
}

export interface Textures {
  grass: string;
  dirt: string;
}

export interface Sounds {
  ambience: string;
  chime: string;
  pop: string;
  success: string;
}

export interface VoiceLines {
  welcome?: LocalizedText;
  move?: LocalizedText;
  tapGlow?: LocalizedText;
  biomeFrontier?: LocalizedText;
  chronoQuarter?: LocalizedText;
  skyharbor?: LocalizedText;
  wellDone?: LocalizedText;
  tryAgain?: LocalizedText;
  backGate?: LocalizedText;
  thanks?: LocalizedText;
}

export interface UiText {
  title: LocalizedText;
  tagline: LocalizedText;
  loading: LocalizedText;
  chooseLook: LocalizedText;
  yourName: LocalizedText;
  newName: LocalizedText;
  enter: LocalizedText;
  howToKeys: LocalizedText;
  howToTouch: LocalizedText;
  ideaBy: LocalizedText;
  ideaByTeam?: LocalizedText;
  youWillSee?: LocalizedText;
  livesIn: LocalizedText;
  builtOn: LocalizedText;
  lanternCount: LocalizedText;
  noLanterns: LocalizedText;
  readLantern: LocalizedText;
  look: LocalizedText;
  comingSoon: LocalizedText;
  comingSoonText: LocalizedText;
  youWillLearn: LocalizedText;
  close: LocalizedText;
  telescope: LocalizedText;
  useTelescope: LocalizedText;
  skyTitle: LocalizedText;
  skyFind: LocalizedText;
  skyTapHint: LocalizedText;
  skyTryAgain: LocalizedText;
  skyFound: LocalizedText;
  skyNext: LocalizedText;
  skyShowMe: LocalizedText;
  skyDone: LocalizedText;
  skyAgain: LocalizedText;
  skyProgress: LocalizedText;
  say: LocalizedText;
  settings: LocalizedText;
  quality: LocalizedText;
  qualityAuto: LocalizedText;
  qualityLow: LocalizedText;
  qualityMedium: LocalizedText;
  qualityHigh: LocalizedText;
  sound: LocalizedText;
  on: LocalizedText;
  off: LocalizedText;
  changeExplorer: LocalizedText;
  explorersHere: LocalizedText;
  aloneHere: LocalizedText;
  roomNote: LocalizedText;
  hidePlayer: LocalizedText;
  showPlayer: LocalizedText;
  paused: LocalizedText;
  lookLabel: LocalizedText;
  loadError: LocalizedText;
  retry: LocalizedText;
  nowOpen?: LocalizedText;
  enterDistrict?: LocalizedText;
  entering?: LocalizedText;
  backToGrove?: LocalizedText;
  resume?: LocalizedText;
  listen?: LocalizedText;
  report?: LocalizedText;
  reportTitle?: LocalizedText;
  reportUnkind?: LocalizedText;
  reportScary?: LocalizedText;
  reportPersonal?: LocalizedText;
  reportBroken?: LocalizedText;
  reportOther?: LocalizedText;
  reportThanks?: LocalizedText;
  reportGuest?: LocalizedText;
  reportError?: LocalizedText;
}

export interface Biome {
  id: string;
  name: LocalizedText;
  icon: string;
  color: string;
  about: LocalizedText;
}

export interface Fossil {
  id: string;
  layer: number;
  name: LocalizedText;
  icon: string;
  age: LocalizedText;
  ageMyr: number;
  period: LocalizedText;
  fact: LocalizedText;
  factEasy: LocalizedText;
  source: string;
  modelUrl: string;
  iconUrl: string;
  spot: number[];
}

export interface BiomeUi {
  title: LocalizedText;
  showMe: LocalizedText;
  next: LocalizedText;
  close: LocalizedText;
  digTitle: LocalizedText;
  digIntro: LocalizedText;
  digDone: LocalizedText;
  layerLabel: LocalizedText;
  stationTitle: LocalizedText;
  playAgain: LocalizedText;
  easyMode: LocalizedText;
  explorerMode: LocalizedText;
  modeLabel: LocalizedText;
  backToGrove: LocalizedText;
  look: LocalizedText;
  digWaiting: LocalizedText;
  digNeedTools: LocalizedText;
  trowel: LocalizedText;
  brush: LocalizedText;
  trowelHint: LocalizedText;
  brushHint: LocalizedText;
  useBrush: LocalizedText;
  useTrowel: LocalizedText;
  brushFirst: LocalizedText;
  layerGone: LocalizedText;
  fossilFound: LocalizedText;
  timeline: LocalizedText;
  timelineNow: LocalizedText;
  deeperOlder: LocalizedText;
  mya: LocalizedText;
  digAgain: LocalizedText;
}

export interface BiomeModels {
  jungleTree: string;
  palm: string;
  giantLeaves: string;
  waterfallCliff: string;
  canyonRocks: string;
  digSite: string;
  digBlock: string;
  corals: string;
  pier: string;
  fieldStation: string;
  ropeBridge: string;
  signposts: string;
  trailGate: string;
  toucan: string;
  treeFrog: string;
  morpho: string;
  tortoise: string;
  hornedLizard: string;
  saguaro: string;
  seaTurtle: string;
  clownfish: string;
  seaStar: string;
  fern: string;
  grassTuft: string;
}

export interface BiomeTextures {
  jungleFloor: string;
  sand: string;
  canyonFloor: string;
  waterNormal: string;
}

export interface BiomeSounds {
  ambience: string;
}

export interface BiomeFrontierProps {
  ui: BiomeUi;
  biomes: Biome[];
  fossils: Fossil[];
  layersFact: LocalizedText;
  layersFactEasy: LocalizedText;
  models: BiomeModels;
  textures: BiomeTextures;
  sounds: BiomeSounds;
}

export interface CqEra {
  id: string;
  name: LocalizedText;
  period: LocalizedText;
  sortYear: number;
  icon: string;
  color: string;
  intro: LocalizedText;
}

export interface CqArtifact {
  id: string;
  era: string;
  name: LocalizedText;
  clue: LocalizedText;
  fact: LocalizedText;
  factSimple: LocalizedText;
  icon: string;
  mesh: string;
  scale: number;
}

export interface CqUi {
  title: LocalizedText;
  intro: LocalizedText;
  introYoung: LocalizedText;
  start: LocalizedText;
  caseFile: LocalizedText;
  returned: LocalizedText;
  lostHere: LocalizedText;
  pickUp: LocalizedText;
  carryHint: LocalizedText;
  carrying: LocalizedText;
  putBack: LocalizedText;
  question: LocalizedText;
  correct: LocalizedText;
  wrong: LocalizedText;
  hint: LocalizedText;
  standOf: LocalizedText;
  standEmpty: LocalizedText;
  standHas: LocalizedText;
  allReturned: LocalizedText;
  dialTitle: LocalizedText;
  dialAsk: LocalizedText;
  dialAskYoung: LocalizedText;
  dialWrong: LocalizedText;
  dialNotYet: LocalizedText;
  dialRight: LocalizedText;
  oldest: LocalizedText;
  newest: LocalizedText;
  done: LocalizedText;
  score: LocalizedText;
  again: LocalizedText;
  close: LocalizedText;
  next: LocalizedText;
  young: LocalizedText;
  big: LocalizedText;
  gate: LocalizedText;
  dial: LocalizedText;
}

export interface CqModels {
  temple: string;
  columns: string;
  fountain: string;
  pavilion: string;
  bridge: string;
  stoneLantern: string;
  pyramid: string;
  stela: string;
  cherry: string;
  streetLamp: string;
  gate: string;
  plinths: string;
  dial: string;
  jungle: string;
  pondLife: string;
  artifacts: string;
  boulders: string;
  forestTree: string;
  fern: string;
  flowers: string;
  grassTuft: string;
}

export interface CqTextures {
  grass: string;
  dirt: string;
  cobbles: string;
  paving: string;
  skyline: string;
}

export interface CqSounds {
  ambience: string;
}

export interface ChronoQuarterProps {
  ui: CqUi;
  eras: CqEra[];
  artifacts: CqArtifact[];
  roundSize: number;
  roundSizeYoung: number;
  hintAfter: number;
  timelineFact: LocalizedText;
  timelineFactSimple: LocalizedText;
  models: CqModels;
  textures: CqTextures;
  sounds: CqSounds;
}

export interface SkyharborModels {
  observatory: string;
  airship: string;
  greenhouse: string;
  workshop: string;
  robot: string;
  harbor: string;
  cliff: string;
  glowPlants: string;
  gate: string;
  fern: string;
  grassTuft: string;
  forestTree: string;
}

export interface SkyharborTextures {
  paving: string;
  moss: string;
}

export interface SkyharborSounds {
  ambience: string;
  beep: string;
  bump: string;
  whirr: string;
}

export interface CourierLevel {
  id: string;
  mode: string;
  stage: string;
  rows: string[];
  facing: string;
  maxBlocks: number;
  tip: LocalizedText;
}

export interface Planet {
  id: string;
  name: LocalizedText;
  order: number;
  fact: LocalizedText;
  hint: LocalizedText;
  color: string;
  color2: string;
  size: number;
  rings: boolean;
}

export interface InfoSpot {
  id: string;
  icon: string;
  title: LocalizedText;
  text: LocalizedText;
}

export interface SkyharborUi {
  name: LocalizedText;
  backToGrove: LocalizedText;
  close: LocalizedText;
  talkRobot: LocalizedText;
  usePlanets: LocalizedText;
  look: LocalizedText;
  courierTitle: LocalizedText;
  courierIntro: LocalizedText;
  chooseMode: LocalizedText;
  modeSimple: LocalizedText;
  modeSimpleHint: LocalizedText;
  modeMain: LocalizedText;
  modeMainHint: LocalizedText;
  level: LocalizedText;
  goal: LocalizedText;
  goalSimple: LocalizedText;
  blockForward: LocalizedText;
  blockLeft: LocalizedText;
  blockRight: LocalizedText;
  blockRepeat: LocalizedText;
  arrowUp: LocalizedText;
  arrowDown: LocalizedText;
  arrowLeft: LocalizedText;
  arrowRight: LocalizedText;
  times: LocalizedText;
  loopDone: LocalizedText;
  loopInside: LocalizedText;
  program: LocalizedText;
  programEmpty: LocalizedText;
  programEmptySimple: LocalizedText;
  dragHint: LocalizedText;
  memory: LocalizedText;
  run: LocalizedText;
  reset: LocalizedText;
  clear: LocalizedText;
  undo: LocalizedText;
  showMe: LocalizedText;
  shownSolution: LocalizedText;
  msgEmpty: LocalizedText;
  msgTooLong: LocalizedText;
  msgBump: LocalizedText;
  msgEdge: LocalizedText;
  msgNoPart: LocalizedText;
  msgNotThere: LocalizedText;
  msgPicked: LocalizedText;
  msgDelivered: LocalizedText;
  msgFirstTry: LocalizedText;
  next: LocalizedText;
  roundDone: LocalizedText;
  roundScore: LocalizedText;
  playAgain: LocalizedText;
  changeMode: LocalizedText;
  questionCourier: LocalizedText;
  planetsTitle: LocalizedText;
  planetsIntro: LocalizedText;
  planetsFind: LocalizedText;
  planetsNotYet: LocalizedText;
  planetsGood: LocalizedText;
  planetsDone: LocalizedText;
  planetsHint: LocalizedText;
  sun: LocalizedText;
  questionPlanet: LocalizedText;
}

export interface SkyharborProps {
  ui: SkyharborUi;
  levels: CourierLevel[];
  roundMain: number;
  roundSimple: number;
  planets: Planet[];
  spots: InfoSpot[];
  models: SkyharborModels;
  textures: SkyharborTextures;
  sounds: SkyharborSounds;
}

export interface SkyharborOpen {
  kind: string;
  ref?: string;
}

export interface QuestStep {
  id: string;
  kind: string;
  target: string;
  count: number;
  zone?: string;
  icon: string;
  text: LocalizedText;
  line?: string;
  dialogue?: string;
}

export interface Quest {
  id: string;
  icon: string;
  title: LocalizedText;
  intro?: string;
  done?: string;
  giveAtStart: string[];
  reward: string[];
  steps: QuestStep[];
  report?: boolean;
}

export interface KeeperLine {
  id: string;
  text: LocalizedText;
  audio?: LocalizedText;
  anim?: string;
}

export interface Dialogue {
  id: string;
  lines: string[];
}

export interface KeeperProps {
  name: LocalizedText;
  modelUrl: string;
  portraitUrl: string;
  icon: string;
  lines: KeeperLine[];
  dialogues: Dialogue[];
}

export interface Tool {
  id: string;
  icon: string;
  iconUrl: string;
  modelUrl: string;
  name: LocalizedText;
  about: LocalizedText;
}

export interface GuideFact {
  text: LocalizedText;
  easy: LocalizedText;
  source: string;
}

export interface LensFeature {
  id: string;
  kind: string;
  icon: string;
  question: LocalizedText;
  tip: LocalizedText;
  max: number;
}

export interface LensCheck {
  feature: string;
  value: number;
}

export interface Measure {
  lengthMm: number;
  lengthText: LocalizedText;
  what: LocalizedText;
  massG: number;
  massText: LocalizedText;
  source: string;
}

export interface GuideSpecies {
  id: string;
  biome: string;
  icon: string;
  name: LocalizedText;
  group: LocalizedText;
  iconUrl: string;
  silhouetteUrl: string;
  modelUrl: string;
  scale: number;
  feed: LocalizedText;
  special: LocalizedText;
  facts: GuideFact[];
  lens: LensCheck[];
  factAudio?: LocalizedText;
  stages?: number[];
  catchable?: boolean;
  measure?: Measure;
  iconAxis?: number[];
  camoModelUrl?: string;
  habitat?: LocalizedText;
}

export interface ExpeditionUi {
  next: LocalizedText;
  close: LocalizedText;
  listen: LocalizedText;
  talk: LocalizedText;
  pickUp: LocalizedText;
  sparkName: LocalizedText;
  sparkFound: LocalizedText;
  questDone: LocalizedText;
  newTool: LocalizedText;
  allDone: LocalizedText;
  camera: LocalizedText;
  cameraHint: LocalizedText;
  zoom: LocalizedText;
  shutter: LocalizedText;
  noCreature: LocalizedText;
  tipCentre: LocalizedText;
  tipCloser: LocalizedText;
  tipFill: LocalizedText;
  tipBehaviour: LocalizedText;
  perfect: LocalizedText;
  starsLabel: LocalizedText;
  photoBest: LocalizedText;
  photoKept: LocalizedText;
  newPage: LocalizedText;
  tooShy: LocalizedText;
  guide: LocalizedText;
  guideProgress: LocalizedText;
  guideChip: LocalizedText;
  unknown: LocalizedText;
  stageSeen: LocalizedText;
  stagePhoto: LocalizedText;
  stageId: LocalizedText;
  stageBehaviour: LocalizedText;
  lockedSeen: LocalizedText;
  lockedPhoto: LocalizedText;
  lockedId: LocalizedText;
  lockedBehaviour: LocalizedText;
  source: LocalizedText;
  bestPhoto: LocalizedText;
  noPhoto: LocalizedText;
  back: LocalizedText;
  lens: LocalizedText;
  lensHint: LocalizedText;
  lensFar: LocalizedText;
  lensNone: LocalizedText;
  lensTitle: LocalizedText;
  lensCompare: LocalizedText;
  lensCheck: LocalizedText;
  lensRight: LocalizedText;
  lensWrong: LocalizedText;
  lensCountHint: LocalizedText;
  yes: LocalizedText;
  no: LocalizedText;
  undo: LocalizedText;
  doingIdle: LocalizedText;
  doingMove: LocalizedText;
  doingHide: LocalizedText;
  stationIntro: LocalizedText;
  net: LocalizedText;
  netHint: LocalizedText;
  sweep: LocalizedText;
  sweepHint: LocalizedText;
  sweepKeys: LocalizedText;
  sweepFast: LocalizedText;
  sweepMiss: LocalizedText;
  sweepNone: LocalizedText;
  caught: LocalizedText;
  jarFull: LocalizedText;
  jar: LocalizedText;
  jarLook: LocalizedText;
  jarCount: LocalizedText;
  isInsect: LocalizedText;
  notInsect: LocalizedText;
  release: LocalizedText;
  releaseHere: LocalizedText;
  releaseFar: LocalizedText;
  released: LocalizedText;
  releaseFirst: LocalizedText;
  wentHome: LocalizedText;
  lookFirst: LocalizedText;
  measureTitle: LocalizedText;
  measureHint: LocalizedText;
  measureShort: LocalizedText;
  measureLong: LocalizedText;
  measureRight: LocalizedText;
  magnified: LocalizedText;
  weighTitle: LocalizedText;
  weighHint: LocalizedText;
  weighHeavy: LocalizedText;
  weighLight: LocalizedText;
  weighRight: LocalizedText;
  weighNone: LocalizedText;
  weighClear: LocalizedText;
  needTape: LocalizedText;
  stageReleased: LocalizedText;
  stageMeasured: LocalizedText;
  lockedReleased: LocalizedText;
  lockedMeasured: LocalizedText;
  where: LocalizedText;
  sizes: LocalizedText;
  sizesHint: LocalizedText;
  weights: LocalizedText;
  measuredValue: LocalizedText;
  weighedValue: LocalizedText;
  guideAnimals: LocalizedText;
  guideInsects: LocalizedText;
}

export interface ExpeditionModels {
  spark: string;
  milkweed: string;
  lavender: string;
}

export interface ExpeditionSounds {
  shutter: string;
}

export interface ExpeditionProps {
  ui: ExpeditionUi;
  keeper: KeeperProps;
  tools: Tool[];
  species: GuideSpecies[];
  lensFeatures: LensFeature[];
  models: ExpeditionModels;
  sounds: ExpeditionSounds;
}

export interface GamesTime {
  id: string;
  icon: string;
  name: LocalizedText;
  light: string;
  intensity: number;
}

export interface GamesEvent {
  id: string;
  icon: string;
  name: LocalizedText;
  goal: LocalizedText;
  piece: string;
  winner: string;
  times: string[];
  score: LocalizedText;
  fact: LocalizedText;
  factEasy: LocalizedText;
  source: string;
  wrongTime: LocalizedText;
  needs: LocalizedText;
  almostSpecies: string[];
  almost: LocalizedText;
}

export interface GamesTalent {
  species: string;
  a: LocalizedText;
  talent: LocalizedText;
}

export interface BugGamesUi {
  title: LocalizedText;
  intro: LocalizedText;
  introEasy: LocalizedText;
  start: LocalizedText;
  again: LocalizedText;
  event: LocalizedText;
  pickAthlete: LocalizedText;
  pickTime: LocalizedText;
  go: LocalizedText;
  team: LocalizedText;
  guest: LocalizedText;
  notYet: LocalizedText;
  skip: LocalizedText;
  wrongCreature: LocalizedText;
  rightCreature: LocalizedText;
  won: LocalizedText;
  roundDone: LocalizedText;
  score: LocalizedText;
  medalGold: LocalizedText;
  medalSilver: LocalizedText;
  medalBronze: LocalizedText;
  fleaGuest: LocalizedText;
  needGuide: LocalizedText;
  next: LocalizedText;
  close: LocalizedText;
  watch: LocalizedText;
  board: LocalizedText;
  enter: LocalizedText;
}

export interface BugGamesModels {
  grandstand: string;
  longJump: string;
  weightPull: string;
  raceLane: string;
  hideBoard: string;
  nightBox: string;
  podium: string;
  scoreboard: string;
}

export interface BugGamesProps {
  ui: BugGamesUi;
  events: GamesEvent[];
  times: GamesTime[];
  talents: GamesTalent[];
  models: BugGamesModels;
}

export interface GardenPlant {
  id: string;
  icon: string;
  name: LocalizedText;
  modelUrl: string;
  iconUrl: string;
  visitors: string[];
  fact: LocalizedText;
  source: string;
}

export interface CoopFind {
  id: string;
  species: string;
  zone: string;
  hold: string;
  act: string;
  fact: LocalizedText;
  source: string;
}

export interface TogetherBadge {
  id: string;
  icon: string;
  node: string;
  name: LocalizedText;
  about: LocalizedText;
}

export interface Sticker {
  id: string;
  url: string;
  name: LocalizedText;
}

export interface MuseumPhoto {
  species: string;
  behaviour: string;
  stars: number;
}

export interface TogetherRules {
  youngMin: number;
  flowerMin: number;
  waterMin: number;
  waterMax: number;
  plantsEach: number;
  lifeHours: number;
  blitzGoal: number;
  blitzMinutes: number;
  museumEach: number;
  helperAfter: number;
  newcomerPages: number;
}

export interface TogetherModels {
  bed: string;
  bedSoil: string;
  can: string;
  packets: string;
  museum: string;
  frame: string;
  plinth: string;
  stickerBoard: string;
  banner: string;
  totem: string;
  badges: string;
  lantern: string;
}

export interface UiLine {
  id: string;
  text: LocalizedText;
}

export interface TogetherProps {
  ui: UiLine[];
  rules: TogetherRules;
  plants: GardenPlant[];
  keeperBed: string[];
  coop: CoopFind[];
  badges: TogetherBadge[];
  stickers: Sticker[];
  keeperPhotos: MuseumPhoto[];
  blitzFact: LocalizedText;
  blitzFactEasy: LocalizedText;
  blitzSource: string;
  helperName: LocalizedText;
  models: TogetherModels;
}

export interface BlockProps {
  ui: UiText;
  lanterns: Lantern[];
  districts: District[];
  districtNames: DistrictName[];
  constellations: Constellation[];
  phrases: Phrase[];
  avatars: AvatarPreset[];
  nicknameAdjectives: string[];
  nicknameAnimals: string[];
  models: Models;
  textures: Textures;
  sounds: Sounds;
  biomeFrontier?: BiomeFrontierProps;
  chronoQuarter?: ChronoQuarterProps;
  skyharbor?: SkyharborProps;
  voice?: VoiceLines;
  quests?: Quest[];
  expedition?: ExpeditionProps;
  bugGames?: BugGamesProps;
  together?: TogetherProps;
}

/** Catches a model or texture that could not load, so the child sees a kind message and a retry button. */
class LoadGuard extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type T = (x: LocalizedText | string | undefined, vars?: Record<string, string | number>) => string;

interface ExplorerSave {
  avatar: number;
  nickname: string;
  /** Constellation ids found at least once. */
  found: string[];
  /** The zone the explorer was last in (idea-grove or a district id), to resume there. */
  zone?: string;
}

const EMPTY_SAVE: ExplorerSave = { avatar: 0, nickname: "", found: [] };
const LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

type VoiceId = keyof VoiceLines;

function apiOrigin(models: Partial<Models> | undefined): string {
  for (const u of Object.values(models || {})) {
    try {
      const o = new URL(String(u)).origin;
      if (o !== window.location.origin) return o;
    } catch {
      /* relative URL (local test) */
    }
  }
  return "";
}

export const Block: React.FC<Partial<BlockProps>> = (raw) => {
  const props = raw as BlockProps;
  const ready = !!(props.ui && props.models && props.textures);
  const mexty = useMexty();
  const lang = useLanguage();
  const settings = useSettings();
  const t: T = useCallback(
    (x, vars) => {
      let s = x == null ? "" : typeof x === "string" ? x : pickLanguage(x, lang.language, lang.defaultLanguage || "en");
      if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
      return s;
    },
    [lang.language, lang.defaultLanguage],
  );
  const save = useCloudSave<ExplorerSave>("explorer", EMPTY_SAVE);
  const saved = save.value || EMPTY_SAVE;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const avatars = props.avatars || [];
  const [avatar, setAvatar] = useState(0);
  const [nickname, setNickname] = useState("");
  const [phase, setPhase] = useState<"start" | "play">("start");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [card, setCard] = useState<CardState | null>(null);
  const [skyOpen, setSkyOpen] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [roomInfo, setRoomInfo] = useState<{ online: boolean; reason: string }>({ online: false, reason: "" });
  const [zone, setZone] = useState<ActiveZone>(GROVE_ZONE);
  const [fade, setFade] = useState<string | null>(null);
  const [districtBusy, setDistrictBusy] = useState(false);
  const [shOpen, setShOpen] = useState<{ kind: string; ref?: string } | null>(null);
  const [report, setReport] = useState<{ target: ReportTarget; peerId?: string } | null>(null);
  const [reportHidden, setReportHidden] = useState(false);
  const [note, setNote] = useState<ReportStatus | null>(null);
  const [flagTarget, setFlagTarget] = useState<ReportTarget | null>(null);
  const [young, setYoung] = useState(false);
  const [expBusy, setExpBusy] = useState(false);
  const [gamesBusy, setGamesBusy] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const exp = props.expedition || defaultExpedition;
  const quests = props.quests && props.quests.length ? props.quests : defaultQuests;
  const tp = props.together || defaultTogether;
  /** Local screenshots only: stop drawing frames (headless software rendering is slow). */
  const [frozen, setFrozen] = useState(false);
  const game = useMemo<Game>(() => createGame(), []);
  // local testing hook (never on the store's domains)
  if (LOCAL) (window as unknown as { __owGame: Game }).__owGame = game;
  const { progress } = useProgress();
  const shown = useRef(0);
  shown.current = Math.max(shown.current, Math.min(99, Math.round(progress)));
  const words = { adj: props.nicknameAdjectives || [], animals: props.nicknameAnimals || [] };
  const switching = useRef(false);
  const lastObj = useRef<{ id: string; at: number } | null>(null);
  /** The zone whose voice lines play once its first picture is on screen. */
  const pendingVoice = useRef<string | null>(null);

  // the props of the district the explorer is in (its saved sub-tree, else the module's own defaults)
  const zoneProps = useMemo(() => {
    if (!zone.mod) return null;
    const key = PROPS_KEY[zone.id];
    return (key && (props as unknown as Record<string, unknown>)[key]) || zone.mod.defaultProps;
  }, [zone, props]);
  const activeZone = useMemo<ActiveZone>(() => ({ ...zone, props: zoneProps }), [zone, zoneProps]);
  const districtName = useMemo(() => {
    if (!zone.mod) return "";
    const d = (props.districts || []).find((x) => x.id === zone.id) || (props.districtNames || []).find((x) => x.id === zone.id);
    return d ? t(d.name) : "";
  }, [zone, props.districts, props.districtNames, t]);

  // the first screen is our own loader: the store's can go
  useEffect(() => {
    mexty.ready();
  }, [mexty]);

  // the saved explorer (or a fresh name) once the save has loaded
  const took = useRef(false);
  useEffect(() => {
    if (save.loading || took.current) return;
    took.current = true;
    setAvatar(Math.min(Math.max(0, saved.avatar || 0), Math.max(0, avatars.length - 1)));
    setNickname(saved.nickname || makeNickname(words.adj, words.animals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.loading]);
  useEffect(() => {
    if (!nickname && words.adj.length && words.animals.length && took.current) setNickname(makeNickname(words.adj, words.animals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.adj.length, words.animals.length]);

  game.avatar = avatar;
  game.nickname = nickname;

  // sound: the store's mute and pause win; sounds come from props
  useEffect(() => {
    if (props.sounds) sound.configure(props.sounds);
  }, [props.sounds]);
  useEffect(() => sound.setMuted(!settings.sound || !!mexty.muted), [settings.sound, mexty.muted]);
  useEffect(() => sound.suspend(!!mexty.paused), [mexty.paused]);
  useEffect(() => {
    game.paused = !!mexty.paused;
  }, [mexty.paused, game]);
  // a district plays its own ambience loop while the explorer is inside it
  useEffect(() => {
    const s = zoneProps && (zoneProps as { sounds?: { ambience?: string } }).sounds;
    sound.setAmbience((s && s.ambience) || "");
  }, [zoneProps]);

  // ages 4-6 hear the short voice lines on their own (everyone has the speaker button)
  useEffect(() => {
    let alive = true;
    mexty
      .getPlayer()
      .then((p) => {
        let max = p.ageMax;
        if (max == null && LOCAL) {
          const q = Number(new URLSearchParams(window.location.search).get("age"));
          if (q) max = q;
        }
        if (alive) setYoung(max != null && max <= 6);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mexty]);
  const voiceUrl = useCallback((id: VoiceId) => t((props.voice || {})[id]), [props.voice, t]);
  const speak = useCallback((ids: VoiceId[]) => sound.voice(ids.map(voiceUrl)), [voiceUrl]);
  const linesFor = useCallback((zid: string): VoiceId[] => (isDistrict(zid) ? [PROPS_KEY[zid] as VoiceId, "backGate"] : ["welcome", "move", "tapGlow"]), []);
  // kind words after each answer and at the end of a round, for the youngest (every activity reports through mexty.progress)
  const cue = useRef<(id: VoiceId) => void>(() => undefined);
  const lastCue = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  cue.current = (id: VoiceId) => {
    if (!young || phase !== "play") return;
    const now = performance.now();
    if (now - lastCue.current.at < 2200) return;
    lastCue.current = { id, at: now };
    sound.voice([voiceUrl(id)]);
  };
  useEffect(() => {
    const pr = mexty.progress as unknown as {
      answer: (a: { correct: boolean }) => void;
      complete: (...a: unknown[]) => void;
      __owVoice?: boolean;
    };
    if (!pr || pr.__owVoice) return;
    pr.__owVoice = true;
    const answer = pr.answer;
    const complete = pr.complete;
    // local testing record of the learning events (never on the store's domains)
    const rec = (x: unknown) => {
      if (!LOCAL) return;
      const w = window as unknown as { __owProgress?: unknown[] };
      (w.__owProgress = w.__owProgress || []).push(x);
    };
    pr.answer = (a) => {
      rec({ answer: a });
      answer(a);
      cue.current(a && a.correct ? "wellDone" : "tryAgain");
    };
    pr.complete = (...a) => {
      rec({ complete: a });
      complete(...a);
      lastCue.current.at = 0;
      cue.current("wellDone");
    };
  }, [mexty]);

  // presence: one room per zone and EdVerse age tile, opened once the player is in the world
  const api = useMemo(() => apiOrigin(props.models), [props.models]);
  useEffect(() => {
    if (phase !== "play") return;
    let alive = true;
    let pr: Presence | null = null;
    mexty
      .getPlayer()
      .then((p) => {
        const room = roomForAge(p.ageMin, p.ageMax, zone.id);
        if (!room) {
          if (alive) setRoomInfo({ online: false, reason: "age" });
          return null;
        }
        return openPresence(room, api, game);
      })
      .then((x) => {
        if (!x) return;
        if (!alive) {
          x.close();
          return;
        }
        pr = x;
        setPresence(x);
        setRoomInfo({ online: true, reason: "" });
      })
      .catch(() => alive && setRoomInfo({ online: false, reason: "offline" }));
    return () => {
      alive = false;
      if (pr) pr.close();
      setPresence(null);
    };
  }, [phase, api, game, mexty, zone.id]);

  /** Fades out, loads the district (its own chunk), puts the explorer at its spawn (or back at the stall) and fades in. */
  const goZone = useCallback(
    (id: string, fromDistrict?: string) => {
      if (switching.current || id === zone.id) return;
      switching.current = true;
      setCard(null);
      setSkyOpen(false);
      setShOpen(null);
      setReport(null);
      setDistrictBusy(false);
      sound.stopVoice();
      const placeName = (() => {
        const d = (props.districtNames || []).find((x) => x.id === id);
        return d ? t(d.name) : t(props.ui.title);
      })();
      setFade(props.ui.entering ? t(props.ui.entering, { place: placeName }) : placeName);
      const wait = new Promise((r) => window.setTimeout(r, 450));
      const load = isDistrict(id) ? loadZone(id) : Promise.resolve(null);
      Promise.all([load, wait])
        .then(([mod]) => {
          game.targets = [];
          game.focus = null;
          game.walkTo = null;
          game.input.x = game.input.z = 0;
          const layout = mod ? { id, SPAWN: mod.SPAWN, colliders: mod.colliders, groundY: mod.groundY, WORLD_R: mod.WORLD_R } : GROVE_LAYOUT;
          const st = !mod && fromDistrict ? STALLS.find((s) => s.district === fromDistrict) : undefined;
          if (st) {
            // back in front of the stall the explorer left from, facing the plaza
            const p = stallPoint(st, 0, 3.4);
            game.me.x = p.x;
            game.me.z = p.z;
            game.me.ry = st.ry;
          } else {
            game.me.x = layout.SPAWN.x;
            game.me.z = layout.SPAWN.z;
            game.me.ry = layout.SPAWN.ry;
          }
          game.me.y = layout.groundY(game.me.x, game.me.z);
          setZone({ id, mod, props: null, layout });
          pendingVoice.current = id;
          save.save({ ...savedRef.current, avatar: game.avatar, nickname: game.nickname, zone: id });
          switching.current = false;
        })
        .catch(() => {
          // the district could not download: stay where we are
          switching.current = false;
          setFade(null);
        });
    },
    [zone.id, game, props.districtNames, props.ui, t, save],
  );

  const onZoneReady = useCallback(() => {
    setLoaded(true);
    setFade(null);
    const z = pendingVoice.current;
    pendingVoice.current = null;
    if (z && young && game.mode === "play") speak(linesFor(z));
  }, [young, game, speak, linesFor]);

  const enter = () => {
    sound.unlock();
    sound.startAmbience();
    save.save({ ...saved, avatar, nickname });
    game.mode = "play";
    setPhase("play");
    try {
      mexty.gameplayStart();
    } catch {
      /* outside EdVerse */
    }
    if (isDistrict(saved.zone)) goZone(saved.zone);
    else if (young) speak(linesFor(GROVE));
  };
  const backToStart = () => {
    game.mode = "start";
    setPhase("start");
    setCard(null);
    setSkyOpen(false);
    setShOpen(null);
    setReport(null);
    sound.stopVoice();
    if (zone.mod) {
      game.targets = [];
      setZone(GROVE_ZONE);
      save.save({ ...saved, avatar, nickname, zone: GROVE });
    }
  };

  const open = useCallback(
    (c: CardState) => {
      if (game.mode !== "play") return;
      if (c.kind === "telescope") {
        setSkyOpen(true);
        sound.sfx("chime", 0.7);
      } else {
        setCard(c);
        sound.sfx(c.kind === "lantern" ? "chime" : "pop", 0.8);
      }
    },
    [game],
  );
  const openDistrict = useCallback((o: { kind: string; ref?: string }) => {
    lastObj.current = { id: o.kind + (o.ref ? ":" + o.ref : ""), at: performance.now() };
    if (String(o.kind).indexOf("skyharbor:") === 0) setShOpen({ kind: o.kind, ref: o.ref });
  }, []);
  // the HUD's action button opens the nearest thing (same as tapping it in the world); district kinds
  // ("<district>:<what>") belong to that district's Activity, which listens to the same event
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<Target>).detail;
      if (!f) return;
      const k = String(f.kind);
      if (k === "lantern") open({ kind: "lantern", index: f.ref as number, empty: (f.ref as number) >= (props.lanterns || []).length });
      else if (k === "stall") open({ kind: "stall", district: String(f.ref) });
      else if (k === "telescope") open({ kind: "telescope" });
      else if (k.indexOf(":") > 0) openDistrict({ kind: k, ref: f.ref != null ? String(f.ref) : undefined });
    };
    window.addEventListener("ow-open", h);
    return () => window.removeEventListener("ow-open", h);
  }, [open, openDistrict, props.lanterns]);

  // a district card or activity is open: it gets a small flag button (report what it shows)
  const busy = districtBusy || !!shOpen;
  useEffect(() => {
    if (!busy || !zone.mod) {
      setFlagTarget(null);
      return;
    }
    const lo = lastObj.current;
    const id = lo && performance.now() - lo.at < 3000 ? lo.id : zone.id + ":activity";
    setFlagTarget({ kind: "object", id, label: districtName });
  }, [busy, zone, districtName]);

  const onFound = (id: string) => {
    if (saved.found.indexOf(id) < 0) save.save({ ...saved, avatar, nickname, found: saved.found.concat(id) });
  };

  const onPeerTap = useCallback(
    (p: Peer) => {
      if (game.mode !== "play") return;
      setReportHidden(game.hidden.has(p.id));
      setReport({ target: { kind: "player", id: p.id, label: p.nick }, peerId: p.id });
      sound.sfx("pop", 0.6);
    },
    [game],
  );
  const doReport = (reason: Parameters<typeof sendReport>[1]) => {
    const r = report;
    if (!r) return;
    // a reported explorer disappears for me at once
    if (r.peerId) game.hidden.add(r.peerId);
    setReport(null);
    sendReport(r.target, reason).then((s) => {
      setNote(s);
      if ((s === "sent" || s === "limit") && young) speak(["thanks"]);
    });
  };
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 5000);
    return () => window.clearTimeout(id);
  }, [note]);

  // local testing hooks (never on the store's domains)
  if (LOCAL) (window as unknown as Record<string, unknown>).__ow = { goZone, zone: zone.id, openReport: onPeerTap, freeze: setFrozen, busy: { card: !!card, skyOpen, busy, expBusy, gamesBusy, tgBusy, report: !!report, fade: !!fade } };

  const labelFor = useCallback(
    (tg: Target): [string, string] | null => {
      if (tg.kind === "keeper") return [exp.keeper.icon || "🧓", t(exp.ui.talk)];
      if (tg.kind === "spark") return ["✨", t(exp.ui.pickUp)];
      if (tg.kind === "games") return ["🏅", t((props.bugGames || defaultBugGames).ui.enter)];
      if (String(tg.kind).indexOf("tg:") === 0) return togetherLabel(tg, tp, t);
      if (zone.id === "skyharbor" && zoneProps) {
        const ui = (zoneProps as SkyharborProps).ui;
        if (tg.kind === "skyharbor:robot") return ["🤖", t(ui.talkRobot)];
        if (tg.kind === "skyharbor:planets") return ["🪐", t(ui.usePlanets)];
      }
      return null;
    },
    [zone.id, zoneProps, t, exp, tp],
  );

  if (!ready) return <div className="ow-root ow-empty">EdVerse OpenWorld</div>;

  const paused = !!mexty.paused;
  const Activity = zone.mod ? zone.mod.Activity : null;
  const resumeName = isDistrict(saved.zone) ? (props.districtNames || []).find((d) => d.id === saved.zone) : undefined;

  return (
    <div className="ow-root" onPointerDown={() => sound.unlock()}>
      <LoadGuard key={attempt} onError={() => setFailed(true)}>
        <GameCanvas
          props={props}
          game={game}
          settings={settings}
          paused={paused || frozen}
          zone={activeZone}
          onZoneReady={onZoneReady}
          onZoneError={() => {
            // a district that fails to load: back home
            switching.current = false;
            game.targets = [];
            setZone(GROVE_ZONE);
            setFade(null);
          }}
          onOpen={open}
          onDistrictOpen={openDistrict}
          onExit={() => goZone(GROVE, zone.id)}
          onPeerTap={onPeerTap}
          t={t}
        />
      </LoadGuard>
      {failed && (
        <div className="ow-loading">
          <div className="ow-loading-title">{t(props.ui.title)}</div>
          <div>{t(props.ui.loadError)}</div>
          <button
            className="ow-btn"
            onClick={() => {
              // forget the failed downloads, then build the grove again
              Object.values(props.models).forEach((u) => useGLTF.clear(u));
              try {
                useLoader.clear(THREE.TextureLoader, [props.textures.grass, props.textures.dirt]);
              } catch {
                /* not cached */
              }
              setFailed(false);
              setLoaded(false);
              setAttempt((a) => a + 1);
            }}
          >
            🔁 {t(props.ui.retry)}
          </button>
        </div>
      )}
      {!loaded && !failed && (
        <div className="ow-loading">
          <div className="ow-lantern-spin" />
          <div className="ow-loading-title">{t(props.ui.title)}</div>
          <div>
            {t(props.ui.loading)} {shown.current}%
          </div>
          <div className="ow-bar">
            <i style={{ width: shown.current + "%" }} />
          </div>
        </div>
      )}
      {loaded && phase === "start" && (
        <Start
          ui={props.ui}
          t={t}
          avatars={avatars}
          avatar={avatar}
          nickname={nickname}
          onAvatar={(i) => {
            setAvatar(i);
            game.emote("cheer");
            sound.unlock();
            sound.sfx("pop", 0.6);
          }}
          onReroll={() => {
            setNickname(makeNickname(words.adj, words.animals, nickname));
            sound.unlock();
            sound.sfx("pop", 0.5);
          }}
          onEnter={enter}
          enterLabel={resumeName && props.ui.resume ? t(props.ui.resume, { place: t(resumeName.name) }) : undefined}
        />
      )}
      {loaded && phase === "play" && (
        <Hud
          props={props}
          t={t}
          game={game}
          presence={presence}
          roomInfo={roomInfo}
          blocked={!!card || skyOpen || busy || expBusy || gamesBusy || tgBusy || !!report || !!fade || paused}
          onBack={backToStart}
          found={saved.found.length}
          zoneName={zone.mod ? districtName : undefined}
          onHome={zone.mod ? () => goZone(GROVE, zone.id) : undefined}
          onSpeak={props.voice ? () => speak(linesFor(zone.id)) : undefined}
          labelFor={labelFor}
        />
      )}
      {loaded && (
        <Expedition
          exp={exp}
          quests={quests}
          t={t}
          game={game}
          zone={zone.id}
          phase={phase}
          young={young}
          blocked={!!card || skyOpen || busy || gamesBusy || tgBusy || !!report || !!fade || paused}
          onBusy={setExpBusy}
        />
      )}
      {loaded && (
        <Together
          tp={tp}
          exp={exp}
          t={t}
          game={game}
          zone={zone.id}
          phase={phase}
          young={young}
          blocked={!!card || skyOpen || busy || expBusy || gamesBusy || !!report || !!fade || paused}
          onBusy={setTgBusy}
        />
      )}
      {loaded && phase === "play" && !zone.mod && (
        <BugGames
          games={props.bugGames || defaultBugGames}
          exp={exp}
          t={t}
          game={game}
          young={young}
          blocked={!!card || skyOpen || expBusy || tgBusy || !!report || !!fade || paused}
          onBusy={setGamesBusy}
        />
      )}
      {loaded && phase === "play" && Activity && zoneProps && (
        <React.Fragment key={zone.id}>
          {zone.id === "biome-frontier" && <Activity props={zoneProps} expedition={exp} t={t} paused={paused} onBusy={setDistrictBusy} game={game} />}
          {zone.id === "chrono-quarter" && <Activity props={zoneProps} game={game} t={t} paused={paused} onBlockingChange={setDistrictBusy} />}
          {zone.id === "skyharbor" && shOpen && <Activity props={zoneProps} open={shOpen} t={t} onClose={() => setShOpen(null)} paused={paused} />}
        </React.Fragment>
      )}
      {flagTarget && !report && (
        <button
          className="ow-flag ow-flag-float"
          aria-label={t(props.ui.report)}
          title={t(props.ui.report)}
          onClick={() => {
            setReport({ target: flagTarget });
            sound.sfx("pop", 0.6);
          }}
        >
          🚩
        </button>
      )}
      {card && (
        <InfoCard
          card={card}
          props={props}
          t={t}
          language={lang.language}
          onClose={() => setCard(null)}
          onEnter={(d) => isDistrict(d) && goZone(d)}
          onReport={(o) => setReport({ target: { kind: "object", id: o.id, label: o.label } })}
        />
      )}
      {skyOpen && (
        <Sky
          ui={props.ui}
          t={t}
          constellations={props.constellations || []}
          onFound={onFound}
          onClose={() => setSkyOpen(false)}
          paused={paused}
        />
      )}
      {report && (
        <ReportSheet
          target={report.target}
          ui={props.ui}
          t={t}
          hidden={reportHidden}
          onToggleHide={
            report.peerId
              ? () => {
                  const id = report.peerId!;
                  if (game.hidden.has(id)) game.hidden.delete(id);
                  else game.hidden.add(id);
                  setReportHidden(game.hidden.has(id));
                }
              : undefined
          }
          onReport={doReport}
          onClose={() => setReport(null)}
        />
      )}
      {note && <ReportNote status={note} ui={props.ui} t={t} onClose={() => setNote(null)} />}
      <div className={"ow-fade" + (fade ? " on" : "")} aria-hidden={!fade}>
        <div className="ow-lantern-spin" />
        <div>{fade || ""}</div>
      </div>
      {paused && loaded && <div className="ow-paused">{t(props.ui.paused)}</div>}
    </div>
  );
};
