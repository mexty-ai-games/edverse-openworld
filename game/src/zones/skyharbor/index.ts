// Skyharbor district module (ticket 7f686b): Coding & AI, space and engineering, ages 4–18
// (Robot Courier for 7–12 with an arrows mode for 4–6; Planet Parade). See docs/DISTRICTS.md.
export const DISTRICT_ID = "skyharbor";
export type { SkyharborProps, SkyharborOpen, CourierLevel, Planet, InfoSpot } from "./types";
export { KIND_ROBOT, KIND_PLANETS, KIND_INFO } from "./types";
export { defaultProps } from "./content";
export { Scene } from "./Scene";
export { Activity } from "./Activity";
export { SPAWN, colliders, groundY, WORLD_R, EXIT } from "./layout";
