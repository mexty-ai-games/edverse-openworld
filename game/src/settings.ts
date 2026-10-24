// The player's settings on this device: picture quality and sound. Kept in the browser's storage
// (a private window or blocked storage keeps them for this visit only).
import { useSyncExternalStore } from "react";

export type Quality = "auto" | "low" | "medium" | "high";

export interface Settings {
  quality: Quality;
  sound: boolean;
}

const KEY = "ow-grove-settings";
const QUALITIES: Quality[] = ["auto", "low", "medium", "high"];
const DEFAULTS: Settings = { quality: "auto", sound: true };

function load(): Settings {
  try {
    const o = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<Settings>;
    return {
      quality: QUALITIES.indexOf(o.quality as Quality) >= 0 ? (o.quality as Quality) : "auto",
      sound: o.sound !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  if (!current) current = load();
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...getSettings(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage blocked: the settings last for this visit */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    getSettings,
    getSettings,
  );
}

/** Phones and tablets: fewer pixels and no multisampling (memory and fill rate are tight). */
export const TOUCH =
  typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 && Math.min(window.screen.width, window.screen.height) < 1000;

export interface QualityPlan {
  /** Start pixel ratio, and the floor the adaptive step may lower it to. */
  dpr: number;
  minDpr: number;
  adaptive: boolean;
  shadows: boolean;
  shadowSize: number;
  /** Post-processing: bloom on lanterns, vignette, multisampling. */
  bloom: boolean;
  vignette: boolean;
  msaa: number;
  /** Ground cover density (grass tufts, ferns, flowers). */
  grass: number;
  ferns: number;
  flowers: number;
  /** Light shafts, fireflies, lantern point lights. */
  extras: boolean;
}

export function qualityPlan(q: Quality, touch: boolean = TOUCH): QualityPlan {
  const device = Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const low: QualityPlan = { dpr: touch ? 0.8 : 1, minDpr: touch ? 0.6 : 0.75, adaptive: true, shadows: false, shadowSize: 512, bloom: false, vignette: false, msaa: 0, grass: 450, ferns: 90, flowers: 130, extras: false };
  const medium: QualityPlan = { dpr: Math.min(touch ? 1.1 : 1.25, device), minDpr: touch ? 0.75 : 1, adaptive: true, shadows: true, shadowSize: 1024, bloom: true, vignette: true, msaa: 0, grass: 1400, ferns: 170, flowers: 260, extras: true };
  const high: QualityPlan = { dpr: Math.min(2, device), minDpr: Math.min(1.5, device), adaptive: false, shadows: true, shadowSize: 2048, bloom: true, vignette: true, msaa: 4, grass: 2600, ferns: 250, flowers: 420, extras: true };
  if (q === "low") return low;
  if (q === "medium") return medium;
  if (q === "high") return high;
  // auto: medium look, a lighter start on phones, then the adaptive step watches the frame rate
  return touch ? { ...medium, dpr: Math.min(1, device), minDpr: 0.6, shadowSize: 1024, grass: 900, ferns: 130, flowers: 200 } : { ...medium, msaa: 2 };
}
