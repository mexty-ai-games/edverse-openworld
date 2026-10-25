// The hub's list of districts. Each district module is loaded only when the explorer first walks into
// it (dynamic import → its own chunk), so the Idea Grove's first load stays light.
import type React from "react";
import type { Circle } from "../game/layout";

export type ZoneId = "idea-grove" | "biome-frontier" | "chrono-quarter" | "skyharbor";
export const GROVE: ZoneId = "idea-grove";
export const DISTRICTS: ZoneId[] = ["biome-frontier", "chrono-quarter", "skyharbor"];

/** What the hub uses from a district module (see docs/DISTRICTS.md). Scene / Activity props differ per district. */
export interface ZoneModule {
  DISTRICT_ID: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Scene: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Activity: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultProps: any;
  SPAWN: { x: number; y: number; z: number; ry: number };
  colliders: () => Circle[];
  groundY: (x: number, z: number) => number;
  WORLD_R: number;
  EXIT: { x: number; z: number; r: number };
}

/** The props key of each district's sub-tree. */
export const PROPS_KEY: Record<string, "biomeFrontier" | "chronoQuarter" | "skyharbor"> = {
  "biome-frontier": "biomeFrontier",
  "chrono-quarter": "chronoQuarter",
  skyharbor: "skyharbor",
};

const LOADERS: Record<string, () => Promise<ZoneModule>> = {
  "biome-frontier": () => import("./biome-frontier") as unknown as Promise<ZoneModule>,
  "chrono-quarter": () => import("./chrono-quarter") as unknown as Promise<ZoneModule>,
  skyharbor: () => import("./skyharbor") as unknown as Promise<ZoneModule>,
};

const cache = new Map<string, Promise<ZoneModule>>();

export function isDistrict(id: string | undefined | null): id is ZoneId {
  return !!id && DISTRICTS.indexOf(id as ZoneId) >= 0;
}

/** Loads (once) the district's module. A failed download is forgotten so the next try fetches again. */
export function loadZone(id: string): Promise<ZoneModule> {
  const have = cache.get(id);
  if (have) return have;
  const l = LOADERS[id];
  if (!l) return Promise.reject(new Error("no district " + id));
  const p = l().catch((e) => {
    cache.delete(id);
    throw e;
  });
  cache.set(id, p);
  return p;
}
