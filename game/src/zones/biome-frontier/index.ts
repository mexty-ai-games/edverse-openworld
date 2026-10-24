// Biome Frontier district module (ticket 7f686b): science + geography, ages 4-18 (main 7-12, picture mode 4-6).
export const DISTRICT_ID = "biome-frontier";
export const PROPS_KEY = "biomeFrontier";
export type { BiomeFrontierProps } from "./types";
export { defaultProps } from "./content";
export { Scene, KIND } from "./Scene";
export type { BiomeCard } from "./Scene";
export { Activity } from "./Activity";
export { SPAWN, colliders, groundY, WORLD_R, EXIT } from "./layout";
export { useSurvey } from "./store";
